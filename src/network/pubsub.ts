import type { P2PNode } from './node.js';
import type { ChatMessage } from '../chat/message.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('network:pubsub');

const TOPIC_PREFIX = '/whisper/room/';

export type MessageHandler = (message: ChatMessage) => void;

/**
 * Wrapper around GossipSub for room-based pub/sub messaging.
 */
export class ChatPubSub {
  private node: P2PNode;
  private subscriptions: Map<string, MessageHandler> = new Map();
  private boundMessageHandler: (evt: CustomEvent) => void;

  constructor(node: P2PNode) {
    this.node = node;
    this.boundMessageHandler = this.handleMessage.bind(this) as (evt: CustomEvent) => void;
    this.node.services.pubsub.addEventListener('message', this.boundMessageHandler);
    logger.debug('ChatPubSub initialized');
  }

  /**
   * Get the topic string for a room name.
   */
  private getTopic(roomName: string): string {
    return `${TOPIC_PREFIX}${roomName}`;
  }

  /**
   * Extract room name from topic string.
   */
  private getRoomFromTopic(topic: string): string | null {
    if (topic.startsWith(TOPIC_PREFIX)) {
      return topic.slice(TOPIC_PREFIX.length);
    }
    return null;
  }

  /**
   * Handle incoming pubsub messages.
   */
  private handleMessage(evt: CustomEvent): void {
    const { topic, data } = evt.detail;
    const roomName = this.getRoomFromTopic(topic);

    if (!roomName) {
      logger.debug(`Ignoring message on unknown topic: ${topic}`);
      return;
    }

    const handler = this.subscriptions.get(roomName);
    if (!handler) {
      logger.debug(`No handler for room: ${roomName}`);
      return;
    }

    try {
      const message = JSON.parse(new TextDecoder().decode(data)) as ChatMessage;
      logger.debug(`Received message in room ${roomName}: ${message.type}`);
      handler(message);
    } catch (err) {
      logger.error(`Failed to parse message in room ${roomName}:`, err);
    }
  }

  /**
   * Join a room and subscribe to its messages.
   */
  async joinRoom(roomName: string, onMessage: MessageHandler): Promise<void> {
    const topic = this.getTopic(roomName);

    if (this.subscriptions.has(roomName)) {
      logger.warn(`Already subscribed to room: ${roomName}`);
      return;
    }

    this.subscriptions.set(roomName, onMessage);
    this.node.services.pubsub.subscribe(topic);

    logger.info(`Joined room: ${roomName}`);
  }

  /**
   * Leave a room and unsubscribe from its messages.
   */
  async leaveRoom(roomName: string): Promise<void> {
    const topic = this.getTopic(roomName);

    this.subscriptions.delete(roomName);
    this.node.services.pubsub.unsubscribe(topic);

    logger.info(`Left room: ${roomName}`);
  }

  /**
   * Send a message to a room.
   */
  async sendMessage(roomName: string, message: ChatMessage): Promise<void> {
    const topic = this.getTopic(roomName);
    const data = new TextEncoder().encode(JSON.stringify(message));

    try {
      await this.node.services.pubsub.publish(topic, data);
      logger.debug(`Sent message to room ${roomName}: ${message.type}`);
    } catch (err: unknown) {
      // NoPeersSubscribedToTopic is expected when you're the only one in a room
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('NoPeersSubscribedToTopic')) {
        logger.debug(`No peers in room ${roomName} yet (message will be seen by future joiners)`);
        return; // Not an error - just no one else is here yet
      }
      logger.error(`Failed to send message to room ${roomName}:`, err);
      throw err;
    }
  }

  /**
   * Get list of rooms we're currently subscribed to.
   */
  getSubscribedRooms(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  /**
   * Get list of peers subscribed to a room.
   */
  getRoomPeers(roomName: string): string[] {
    const topic = this.getTopic(roomName);
    const subscribers = this.node.services.pubsub.getSubscribers(topic);
    return subscribers.map(peerId => peerId.toString());
  }

  /**
   * Clean up resources.
   */
  destroy(): void {
    this.node.services.pubsub.removeEventListener('message', this.boundMessageHandler);
    for (const roomName of this.subscriptions.keys()) {
      const topic = this.getTopic(roomName);
      this.node.services.pubsub.unsubscribe(topic);
    }
    this.subscriptions.clear();
    logger.debug('ChatPubSub destroyed');
  }
}
