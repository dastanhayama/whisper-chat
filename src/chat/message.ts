import { v4 as uuidv4 } from 'uuid';

export type MessageType = 'text' | 'join' | 'leave' | 'nick' | 'action';

export interface ChatMessage {
  id: string;           // UUID
  timestamp: number;    // Unix timestamp in milliseconds
  room: string;         // Room name
  nick: string;         // Sender's nickname
  fingerprint: string;  // Sender's key fingerprint
  type: MessageType;    // Message type
  content: string;      // Message content
  oldNick?: string;     // For nick change messages
}

/**
 * Create a new chat message.
 */
export function createMessage(
  type: MessageType,
  room: string,
  nick: string,
  fingerprint: string,
  content: string,
  oldNick?: string
): ChatMessage {
  return {
    id: uuidv4(),
    timestamp: Date.now(),
    room,
    nick,
    fingerprint,
    type,
    content,
    oldNick,
  };
}

/**
 * Create a text message.
 */
export function createTextMessage(
  room: string,
  nick: string,
  fingerprint: string,
  content: string
): ChatMessage {
  return createMessage('text', room, nick, fingerprint, content);
}

/**
 * Create a join message.
 */
export function createJoinMessage(
  room: string,
  nick: string,
  fingerprint: string
): ChatMessage {
  return createMessage('join', room, nick, fingerprint, `${nick} has joined the room`);
}

/**
 * Create a leave message.
 */
export function createLeaveMessage(
  room: string,
  nick: string,
  fingerprint: string
): ChatMessage {
  return createMessage('leave', room, nick, fingerprint, `${nick} has left the room`);
}

/**
 * Create a nick change message.
 */
export function createNickChangeMessage(
  room: string,
  oldNick: string,
  newNick: string,
  fingerprint: string
): ChatMessage {
  return createMessage(
    'nick',
    room,
    newNick,
    fingerprint,
    `${oldNick} is now known as ${newNick}`,
    oldNick
  );
}

/**
 * Create an action message (/me).
 */
export function createActionMessage(
  room: string,
  nick: string,
  fingerprint: string,
  action: string
): ChatMessage {
  return createMessage('action', room, nick, fingerprint, action);
}

/**
 * Encode a message for transmission.
 */
export function encodeMessage(message: ChatMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

/**
 * Decode a message from transmission.
 */
export function decodeMessage(data: Uint8Array): ChatMessage {
  return JSON.parse(new TextDecoder().decode(data));
}

/**
 * Validate message size.
 */
export function isMessageSizeValid(content: string, maxSize: number): boolean {
  return new TextEncoder().encode(content).length <= maxSize;
}
