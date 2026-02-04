import type { Widgets } from 'blessed';
import type { ServerChannel } from 'ssh2';
import type { Config } from '../config.js';
import type { EphemeralIdentity } from '../crypto/identity.js';
import { generateFingerprint } from '../crypto/fingerprint.js';
import type { P2PNode } from '../network/node.js';
import { getConnectedPeerCount, setupConnectionEvents } from '../network/discovery.js';
import { ChatState, type UserInfo } from '../chat/state.js';
import { UserSession, type SessionCallbacks } from '../chat/session.js';
import type { ChatMessage } from '../chat/message.js';
import { createScreen, type PTYInfo } from './screen.js';
import { MessageBox, InputBox, UserList, StatusBar } from './widgets/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tui:app');

export interface TUIContext {
  screen: Widgets.Screen;
  userSession: UserSession;
}

/**
 * Create the complete chat TUI and wire everything together.
 */
export async function createChatTUI(
  stream: ServerChannel,
  ptyInfo: PTYInfo,
  identity: EphemeralIdentity,
  p2pNode: P2PNode,
  chatState: ChatState,
  config: Config
): Promise<TUIContext> {
  logger.info('Creating chat TUI');

  // Create the blessed screen
  const screen = createScreen(stream, ptyInfo);

  // Create widgets
  const messageBox = new MessageBox(screen, config.maxMessagesInMemory);
  const inputBox = new InputBox(screen);
  const userList = new UserList(screen);
  const statusBar = new StatusBar(screen);

  // Calculate fingerprint
  const fingerprint = generateFingerprint(identity.publicKeyBytes);

  // Setup session callbacks
  const callbacks: SessionCallbacks = {
    onMessage: (message: ChatMessage) => {
      messageBox.addMessage(message);
    },

    onSystemMessage: (message: string) => {
      messageBox.addSystemMessage(message);
    },

    onUserListUpdate: (users: UserInfo[]) => {
      userList.update(users);
      statusBar.setUserCount(users.length);
    },

    onRoomChange: (room: string) => {
      statusBar.setRoom(room);
      messageBox.widget.setLabel(` Messages - #${room} `);
      screen.render();
    },

    onDisconnect: () => {
      if (!(screen as unknown as { destroyed?: boolean }).destroyed) {
        screen.destroy();
      }
      if (stream.writable) {
        stream.end();
      }
    },

    onClearMessages: () => {
      messageBox.clear();
    },
  };

  // Create user session
  const userSession = new UserSession(
    identity,
    p2pNode,
    chatState,
    config,
    callbacks
  );

  // Set current session for user list highlighting
  userList.setCurrentSession(userSession.id);

  // Setup input handling
  inputBox.setOnSubmit(async (value: string) => {
    await userSession.handleInput(value);
  });

  // Setup keyboard shortcuts
  setupKeyboardShortcuts(screen, inputBox, messageBox, userSession);

  // Setup P2P connection events for peer count
  setupConnectionEvents(
    p2pNode,
    () => statusBar.setPeerCount(getConnectedPeerCount(p2pNode)),
    () => statusBar.setPeerCount(getConnectedPeerCount(p2pNode))
  );

  // Initialize status bar
  statusBar.updateAll({
    nick: userSession.nick,
    fingerprint: fingerprint,
    room: config.defaultRoom,
    peerCount: getConnectedPeerCount(p2pNode),
    userCount: 0,
  });

  // Update status bar when nick changes
  chatState.on('user:nick', (user: UserInfo) => {
    if (user.sessionId === userSession.id) {
      statusBar.setNick(user.nick);
    }
  });

  // Start the user session
  await userSession.start();

  // Update user list
  userList.update(chatState.getUsersInRoom(userSession.room));
  statusBar.setUserCount(chatState.getUsersInRoom(userSession.room).length);

  // Focus input and render - do this AFTER session starts
  screen.render();
  inputBox.focus();

  logger.info('Chat TUI created successfully');

  return { screen, userSession };
}

/**
 * Setup keyboard shortcuts for the TUI.
 */
function setupKeyboardShortcuts(
  screen: Widgets.Screen,
  inputBox: InputBox,
  messageBox: MessageBox,
  userSession: UserSession
): void {
  // Quit on Ctrl+C or Ctrl+D
  screen.key(['C-c', 'C-d'], async () => {
    await userSession.disconnect();
  });

  // Page Up/Down for scrolling messages
  screen.key(['pageup'], () => {
    messageBox.scrollUp();
  });

  screen.key(['pagedown'], () => {
    messageBox.scrollDown();
  });

  // Tab to refocus input
  screen.key(['tab'], () => {
    inputBox.focus();
  });
}
