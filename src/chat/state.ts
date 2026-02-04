import { EventEmitter } from 'events';
import type { ChatMessage } from './message.js';
import { BoundedBuffer } from '../utils/buffer.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('chat:state');

export interface UserInfo {
  sessionId: string;
  nick: string;
  fingerprint: string;
  room: string;
  joinedAt: number;
}

export interface ChatStateEvents {
  'message': (message: ChatMessage) => void;
  'user:join': (user: UserInfo) => void;
  'user:leave': (user: UserInfo) => void;
  'user:nick': (user: UserInfo, oldNick: string) => void;
  'user:room': (user: UserInfo, oldRoom: string) => void;
}

/**
 * Global chat state that tracks all connected users and room messages.
 * Emits events for UI updates.
 */
export class ChatState extends EventEmitter {
  private users: Map<string, UserInfo> = new Map();
  private roomMessages: Map<string, BoundedBuffer<ChatMessage>> = new Map();
  private maxMessagesPerRoom: number;

  constructor(maxMessagesPerRoom: number = 100) {
    super();
    this.maxMessagesPerRoom = maxMessagesPerRoom;
    logger.debug(`ChatState initialized with max ${maxMessagesPerRoom} messages per room`);
  }

  /**
   * Add a new user session.
   */
  addUser(sessionId: string, nick: string, fingerprint: string, room: string): UserInfo {
    const user: UserInfo = {
      sessionId,
      nick,
      fingerprint,
      room,
      joinedAt: Date.now(),
    };

    this.users.set(sessionId, user);
    logger.info(`User added: ${nick} [${fingerprint}] in room ${room}`);
    this.emit('user:join', user);

    return user;
  }

  /**
   * Remove a user session.
   */
  removeUser(sessionId: string): UserInfo | undefined {
    const user = this.users.get(sessionId);
    if (user) {
      this.users.delete(sessionId);
      logger.info(`User removed: ${user.nick} [${user.fingerprint}]`);
      this.emit('user:leave', user);
    }
    return user;
  }

  /**
   * Get user by session ID.
   */
  getUser(sessionId: string): UserInfo | undefined {
    return this.users.get(sessionId);
  }

  /**
   * Get user by fingerprint.
   */
  getUserByFingerprint(fingerprint: string): UserInfo | undefined {
    for (const user of this.users.values()) {
      if (user.fingerprint === fingerprint) {
        return user;
      }
    }
    return undefined;
  }

  /**
   * Update user's nickname.
   */
  setNick(sessionId: string, newNick: string): boolean {
    const user = this.users.get(sessionId);
    if (!user) return false;

    const oldNick = user.nick;
    user.nick = newNick;
    logger.info(`Nick change: ${oldNick} -> ${newNick}`);
    this.emit('user:nick', user, oldNick);

    return true;
  }

  /**
   * Update user's room.
   */
  setRoom(sessionId: string, newRoom: string): boolean {
    const user = this.users.get(sessionId);
    if (!user) return false;

    const oldRoom = user.room;
    user.room = newRoom;
    logger.info(`Room change: ${user.nick} moved from ${oldRoom} to ${newRoom}`);
    this.emit('user:room', user, oldRoom);

    return true;
  }

  /**
   * Get all users in a room.
   */
  getUsersInRoom(room: string): UserInfo[] {
    const users: UserInfo[] = [];
    for (const user of this.users.values()) {
      if (user.room === room) {
        users.push(user);
      }
    }
    return users;
  }

  /**
   * Get all known room names.
   */
  getKnownRooms(): string[] {
    const rooms = new Set<string>();
    for (const user of this.users.values()) {
      rooms.add(user.room);
    }
    for (const room of this.roomMessages.keys()) {
      rooms.add(room);
    }
    return Array.from(rooms);
  }

  /**
   * Get total user count.
   */
  getUserCount(): number {
    return this.users.size;
  }

  /**
   * Add a message to a room's history.
   */
  addMessage(message: ChatMessage): void {
    let buffer = this.roomMessages.get(message.room);
    if (!buffer) {
      buffer = new BoundedBuffer<ChatMessage>(this.maxMessagesPerRoom);
      this.roomMessages.set(message.room, buffer);
    }

    buffer.push(message);
    this.emit('message', message);
  }

  /**
   * Get recent messages for a room.
   */
  getRecentMessages(room: string, count?: number): ChatMessage[] {
    const buffer = this.roomMessages.get(room);
    if (!buffer) return [];
    return count ? buffer.getLast(count) : buffer.getAll();
  }

  /**
   * Check if a nick is already in use in a room.
   */
  isNickTaken(nick: string, room: string, excludeSessionId?: string): boolean {
    for (const user of this.users.values()) {
      if (user.room === room && user.nick.toLowerCase() === nick.toLowerCase()) {
        if (excludeSessionId && user.sessionId === excludeSessionId) {
          continue;
        }
        return true;
      }
    }
    return false;
  }
}

// Global singleton instance
let globalState: ChatState | null = null;

export function getGlobalState(): ChatState {
  if (!globalState) {
    globalState = new ChatState();
  }
  return globalState;
}

export function setGlobalState(state: ChatState): void {
  globalState = state;
}
