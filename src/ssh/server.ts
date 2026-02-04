import ssh2 from 'ssh2';
import { readFileSync, existsSync } from 'fs';

const { Server } = ssh2;
type Server = ssh2.Server;
type Connection = ssh2.Connection;
import type { Config } from '../config.js';
import type { P2PNode } from '../network/node.js';
import { ChatState } from '../chat/state.js';
import { handleSSHConnection } from './handler.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ssh:server');

export interface SSHServerContext {
  config: Config;
  p2pNode: P2PNode;
  chatState: ChatState;
}

/**
 * Create and configure the SSH server.
 */
export function createSSHServer(context: SSHServerContext): Server {
  const { config } = context;

  // Load host key
  if (!existsSync(config.sshHostKeyPath)) {
    throw new Error(
      `SSH host key not found at ${config.sshHostKeyPath}. ` +
      `Run 'npm run generate-host-key' to create one.`
    );
  }

  const hostKey = readFileSync(config.sshHostKeyPath);
  logger.info(`Loaded SSH host key from ${config.sshHostKeyPath}`);

  const server = new Server(
    {
      hostKeys: [hostKey],
      banner: 'Welcome to Whisper - Anonymous P2P Chat\r\n',
    },
    (client: Connection, info) => {
      const clientIp = info.ip;
      logger.info(`Client connected from ${clientIp}`);

      // Handle authentication - accept all for anonymous mode
      client.on('authentication', (ctx) => {
        logger.debug(`Auth attempt: ${ctx.method} from ${ctx.username}`);

        // Accept any authentication method for anonymous access
        // In production, you might want to restrict this
        switch (ctx.method) {
          case 'none':
          case 'password':
          case 'publickey':
            ctx.accept();
            break;
          default:
            // Try password or none
            ctx.reject(['password', 'none']);
        }
      });

      client.on('ready', () => {
        logger.info(`Client authenticated from ${clientIp}`);
        handleSSHConnection(client, context);
      });

      client.on('error', (err: Error) => {
        logger.error(`Client error from ${clientIp}:`, err.message);
      });

      client.on('close', () => {
        logger.info(`Client disconnected from ${clientIp}`);
      });
    }
  );

  server.on('error', (err: Error) => {
    logger.error('SSH server error:', err);
  });

  return server;
}

/**
 * Start the SSH server.
 */
export function startSSHServer(
  server: Server,
  port: number,
  host: string = '0.0.0.0'
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(port, host, () => {
      logger.info(`SSH server listening on ${host}:${port}`);
      logger.info(`Connect with: ssh -p ${port} <hostname>`);
      resolve();
    });

    server.on('error', (err: Error) => {
      reject(err);
    });
  });
}
