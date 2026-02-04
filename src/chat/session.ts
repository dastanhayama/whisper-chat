import { v4 as uuidv4 } from 'uuid';
import type { Config } from '../config.js';
import type { EphemeralIdentity } from '../crypto/identity.js';
import { generateFingerprint } from '../crypto/fingerprint.js';
import type { P2PNode } from '../network/node.js';
import { ChatPubSub } from '../network/pubsub.js';
import { ChatState, type UserInfo } from './state.js';
import {
  type ChatMessage,
  createTextMessage,
  createJoinMessage,
  createLeaveMessage,
  createNickChangeMessage,
  createActionMessage,
  isMessageSizeValid,
} from './message.js';
import { executeCommand } from './commands.js';
import { RateLimiter } from '../utils/buffer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('chat:session');

export interface SessionCallbacks {
  onMessage: (message: ChatMessage) => void;
  onSystemMessage: (message: string) => void;
  onUserListUpdate: (users: UserInfo[]) => void;
  onRoomChange: (room: string) => void;
  onDisconnect: () => void;
  onClearMessages: () => void;
}

/**
 * Represents a single user's chat session.
 * Manages identity, P2P connection, room subscriptions, and messaging.
 */
export class UserSession {
  readonly id: string;
  readonly config: Config;
  readonly identity: EphemeralIdentity;
  readonly fingerprint: string;

  private p2pNode: P2PNode;
  private pubsub: ChatPubSub;
  private chatState: ChatState;
  private callbacks: SessionCallbacks;
  private rateLimiter: RateLimiter;

  private _nick: string;
  private _room: string;
  private _isConnected: boolean = false;

  constructor(
    identity: EphemeralIdentity,
    p2pNode: P2PNode,
    chatState: ChatState,
    config: Config,
    callbacks: SessionCallbacks
  ) {
    this.id = uuidv4();
    this.identity = identity;
    this.fingerprint = generateFingerprint(identity.publicKeyBytes);
    this.p2pNode = p2pNode;
    this.chatState = chatState;
    this.config = config;
    this.callbacks = callbacks;
    this.rateLimiter = new RateLimiter(config.rateLimit);

    // Default nick based on fingerprint
    this._nick = `anon_${this.fingerprint.slice(0, 6)}`;
    this._room = config.defaultRoom;

    // Create pubsub wrapper
    this.pubsub = new ChatPubSub(p2pNode);

    logger.info(`Session created: ${this.id} as ${this._nick} [${this.fingerprint}]`);
  }

  get nick(): string {
    return this._nick;
  }

  get room(): string {
    return this._room;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Start the session and join the default room.
   */
  async start(): Promise<void> {
    logger.info(`Starting session ${this.id}`);

    // Register with chat state
    this.chatState.addUser(this.id, this._nick, this.fingerprint, this._room);

    // Setup state event listeners
    this.setupStateListeners();

    // Join the default room
    await this.joinRoom(this._room);

    this._isConnected = true;

    // Show welcome message
    this.showSystemMessage(`Welcome to Whisper! You are ${this._nick} [${this.fingerprint}]`);
    this.showSystemMessage(`You are in room: ${this._room}`);
    this.showSystemMessage('Type /help for available commands.');
  }

  /**
   * Setup listeners for chat state events.
   */
  private setupStateListeners(): void {
    // Listen for messages in current room
    this.chatState.on('message', (message: ChatMessage) => {
      if (message.room === this._room && message.fingerprint !== this.fingerprint) {
        this.callbacks.onMessage(message);
      }
    });

    // Listen for user changes in current room
    this.chatState.on('user:join', (user: UserInfo) => {
      if (user.room === this._room && user.sessionId !== this.id) {
        this.updateUserList();
      }
    });

    this.chatState.on('user:leave', (user: UserInfo) => {
      if (user.room === this._room) {
        this.updateUserList();
      }
    });

    this.chatState.on('user:nick', () => {
      this.updateUserList();
    });

    this.chatState.on('user:room', () => {
      this.updateUserList();
    });
  }

  /**
   * Handle incoming pubsub message.
   */
  private handlePubsubMessage(message: ChatMessage): void {
    // Don't process our own messages
    if (message.fingerprint === this.fingerprint) {
      return;
    }

    // Add to chat state (for history)
    this.chatState.addMessage(message);

    // Notify UI
    this.callbacks.onMessage(message);
  }

  /**
   * Process user input (command or message).
   */
  async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Check if it's a command
    const wasCommand = await executeCommand(this, trimmed);
    if (wasCommand) return;

    // Otherwise, send as a regular message
    await this.sendMessage(trimmed);
  }

  /**
   * Send a text message to the current room.
   */
  async sendMessage(content: string): Promise<void> {
    if (!this._isConnected) {
      this.showSystemMessage('Not connected');
      return;
    }

    // Rate limiting
    if (!this.rateLimiter.record()) {
      this.showSystemMessage('Rate limit exceeded. Please slow down.');
      return;
    }

    // Size validation
    if (!isMessageSizeValid(content, this.config.maxMessageSize)) {
      this.showSystemMessage(`Message too long (max ${this.config.maxMessageSize} bytes)`);
      return;
    }

    const message = createTextMessage(this._room, this._nick, this.fingerprint, content);

    try {
      await this.pubsub.sendMessage(this._room, message);
      // Show our own message locally
      this.callbacks.onMessage(message);
      // Add to state for history
      this.chatState.addMessage(message);
    } catch (err) {
      logger.error('Failed to send message:', err);
      this.showSystemMessage('Failed to send message');
    }
  }

  /**
   * Send an action message (/me).
   */
  async sendAction(action: string): Promise<void> {
    if (!this._isConnected) {
      this.showSystemMessage('Not connected');
      return;
    }

    if (!this.rateLimiter.record()) {
      this.showSystemMessage('Rate limit exceeded. Please slow down.');
      return;
    }

    const message = createActionMessage(this._room, this._nick, this.fingerprint, action);

    try {
      await this.pubsub.sendMessage(this._room, message);
      this.callbacks.onMessage(message);
      this.chatState.addMessage(message);
    } catch (err) {
      logger.error('Failed to send action:', err);
      this.showSystemMessage('Failed to send action');
    }
  }

  /**
   * Change the user's nickname.
   */
  async changeNick(newNick: string): Promise<void> {
    if (newNick === this._nick) {
      this.showSystemMessage('That is already your nickname');
      return;
    }

    // Check if nick is taken in the room
    if (this.chatState.isNickTaken(newNick, this._room, this.id)) {
      this.showSystemMessage(`Nickname "${newNick}" is already taken in this room`);
      return;
    }

    const oldNick = this._nick;
    this._nick = newNick;

    // Update chat state
    this.chatState.setNick(this.id, newNick);

    // Broadcast nick change
    const message = createNickChangeMessage(this._room, oldNick, newNick, this.fingerprint);
    try {
      await this.pubsub.sendMessage(this._room, message);
      this.chatState.addMessage(message);
    } catch (err) {
      logger.error('Failed to broadcast nick change:', err);
    }

    this.showSystemMessage(`You are now known as ${newNick}`);
  }

  /**
   * Join a new room (leaves current room).
   */
  async joinRoom(newRoom: string): Promise<void> {
    if (newRoom === this._room && this._isConnected) {
      this.showSystemMessage(`You are already in room: ${newRoom}`);
      return;
    }

    const oldRoom = this._room;

    // Leave old room if connected
    if (this._isConnected && oldRoom) {
      const leaveMessage = createLeaveMessage(oldRoom, this._nick, this.fingerprint);
      try {
        await this.pubsub.sendMessage(oldRoom, leaveMessage);
      } catch (err) {
        logger.error('Failed to send leave message:', err);
      }
      await this.pubsub.leaveRoom(oldRoom);
    }

    // Update room
    this._room = newRoom;
    this.chatState.setRoom(this.id, newRoom);

    // Join new room
    await this.pubsub.joinRoom(newRoom, (msg) => this.handlePubsubMessage(msg));

    // Announce join
    const joinMessage = createJoinMessage(newRoom, this._nick, this.fingerprint);
    try {
      await this.pubsub.sendMessage(newRoom, joinMessage);
      this.chatState.addMessage(joinMessage);
    } catch (err) {
      logger.error('Failed to send join message:', err);
    }

    // Notify UI
    this.callbacks.onRoomChange(newRoom);
    this.updateUserList();

    this.showSystemMessage(`Joined room: ${newRoom}`);

    // Show recent messages if any
    const recentMessages = this.chatState.getRecentMessages(newRoom, 20);
    if (recentMessages.length > 0) {
      this.showSystemMessage(`--- Recent messages ---`);
      for (const msg of recentMessages) {
        if (msg.fingerprint !== this.fingerprint) {
          this.callbacks.onMessage(msg);
        }
      }
      this.showSystemMessage(`--- End of history ---`);
    }
  }

  /**
   * Show the list of users in the current room.
   */
  showUserList(): void {
    const users = this.chatState.getUsersInRoom(this._room);

    if (users.length === 0) {
      this.showSystemMessage('No other users in this room');
      return;
    }

    const userList = users
      .map(u => `  ${u.nick} [${u.fingerprint}]${u.sessionId === this.id ? ' (you)' : ''}`)
      .join('\n');

    this.showSystemMessage(`Users in ${this._room} (${users.length}):\n${userList}`);
  }

  /**
   * Show the list of known rooms.
   */
  showRoomList(): void {
    const rooms = this.chatState.getKnownRooms();

    if (rooms.length === 0) {
      this.showSystemMessage('No known rooms');
      return;
    }

    const roomList = rooms
      .map(r => {
        const count = this.chatState.getUsersInRoom(r).length;
        const current = r === this._room ? ' (current)' : '';
        return `  ${r} (${count} users)${current}`;
      })
      .join('\n');

    this.showSystemMessage(`Known rooms:\n${roomList}`);
  }

  /**
   * Show a system message to the user.
   */
  showSystemMessage(message: string): void {
    this.callbacks.onSystemMessage(message);
  }

  /**
   * Clear all messages from the display.
   */
  clearMessages(): void {
    this.callbacks.onClearMessages();
  }

  /**
   * Update the user list display.
   */
  private updateUserList(): void {
    const users = this.chatState.getUsersInRoom(this._room);
    this.callbacks.onUserListUpdate(users);
  }

  /**
   * Disconnect from the chat.
   */
  async disconnect(): Promise<void> {
    if (!this._isConnected) return;

    logger.info(`Session disconnecting: ${this.id}`);

    // Send leave message
    const leaveMessage = createLeaveMessage(this._room, this._nick, this.fingerprint);
    try {
      await this.pubsub.sendMessage(this._room, leaveMessage);
    } catch (err) {
      logger.error('Failed to send leave message:', err);
    }

    // Leave room
    await this.pubsub.leaveRoom(this._room);

    // Clean up
    this.pubsub.destroy();
    this.chatState.removeUser(this.id);
    this._isConnected = false;

    // Notify UI
    this.callbacks.onDisconnect();
  }

  /**
   * Clean up resources.
   */
  async destroy(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }

  private removeAllListeners(): void {
    this.chatState.removeAllListeners();
  }
}
