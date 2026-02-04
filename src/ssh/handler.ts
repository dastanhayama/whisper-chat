import type ssh2 from 'ssh2';

type Connection = ssh2.Connection;
type Session = ssh2.Session;
type ServerChannel = ssh2.ServerChannel;
import type { SSHServerContext } from './server.js';
import { generateEphemeralIdentity } from '../crypto/identity.js';
import { UserSession } from '../chat/session.js';
import { createChatTUI } from '../tui/app.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ssh:handler');

interface PTYInfo {
  term: string;
  cols: number;
  rows: number;
}

/**
 * Handle a new SSH connection.
 */
export function handleSSHConnection(client: Connection, context: SSHServerContext): void {
  client.on('session', (accept, reject) => {
    const session = accept();
    handleSession(session, client, context);
  });
}

/**
 * Handle a new SSH session.
 */
function handleSession(session: Session, client: Connection, context: SSHServerContext): void {
  let ptyInfo: PTYInfo | null = null;
  let stream: ServerChannel | null = null;
  let userSession: UserSession | null = null;

  // Handle PTY request - must come before shell
  session.on('pty', (accept, reject, info) => {
    const termType = (info as unknown as { term?: string }).term || 'xterm-256color';
    logger.debug(`PTY request: ${termType} ${info.cols}x${info.rows}`);
    ptyInfo = {
      term: termType,
      cols: info.cols || 80,
      rows: info.rows || 24,
    };
    accept?.();
  });

  // Handle shell request - spawns the TUI
  session.on('shell', async (accept, reject) => {
    stream = accept();

    if (!stream) {
      logger.error('Failed to accept shell');
      return;
    }

    // Default PTY info if not provided
    if (!ptyInfo) {
      ptyInfo = { term: 'xterm-256color', cols: 80, rows: 24 };
    }

    logger.info(`Shell started: ${ptyInfo.term} ${ptyInfo.cols}x${ptyInfo.rows}`);

    try {
      // Generate ephemeral identity for this session
      const identity = await generateEphemeralIdentity();

      // Create the TUI and user session
      const { screen, userSession: chatSession } = await createChatTUI(
        stream,
        ptyInfo,
        identity,
        context.p2pNode,
        context.chatState,
        context.config
      );

      userSession = chatSession;

      // Handle window resize
      session.on('window-change', (accept, reject, info) => {
        logger.debug(`Window change: ${info.cols}x${info.rows}`);

        // Update stream dimensions
        (stream as any).rows = info.rows;
        (stream as any).columns = info.cols;

        // Emit resize event for blessed
        stream!.emit('resize');

        accept?.();
      });

      // Handle stream close
      stream.on('close', async () => {
        logger.info('Stream closed');
        await cleanup();
      });

      stream.on('error', (err: Error) => {
        logger.error('Stream error:', err.message);
      });

      // Handle screen destroy
      screen.on('destroy', async () => {
        logger.debug('Screen destroyed');
        await cleanup();
      });

    } catch (err) {
      logger.error('Failed to start TUI:', err);
      stream.write('\r\nFailed to start chat interface. Please try again.\r\n');
      stream.end();
    }
  });

  // Cleanup function
  async function cleanup(): Promise<void> {
    if (userSession) {
      try {
        await userSession.destroy();
      } catch (err) {
        logger.error('Error during session cleanup:', err);
      }
      userSession = null;
    }

    if (stream && stream.writable) {
      stream.end();
    }
  }

  // Handle session close
  session.on('close', async () => {
    logger.debug('Session closed');
    await cleanup();
  });
}
