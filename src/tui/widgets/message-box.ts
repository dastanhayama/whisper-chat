import blessed, { Widgets } from 'blessed';
import type { ChatMessage } from '../../chat/message.js';

/**
 * Message display widget - shows chat messages with scrolling.
 */
export class MessageBox {
  readonly widget: Widgets.BoxElement;
  private messages: string[] = [];
  private maxMessages: number;

  constructor(parent: Widgets.Screen, maxMessages: number = 1000) {
    this.maxMessages = maxMessages;

    this.widget = blessed.box({
      parent,
      label: ' Messages ',
      top: 0,
      left: 0,
      width: '80%',
      height: '100%-3',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray',
        },
        style: {
          bg: 'white',
        },
      },
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'blue',
        },
        scrollbar: {
          bg: 'white',
        },
      },
      tags: true,
    });
  }

  /**
   * Format a timestamp for display.
   */
  private formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * Sanitize user input to prevent blessed tag injection.
   */
  private sanitize(text: string): string {
    return text.replace(/\{[^}]+\}/g, '');
  }

  /**
   * Get a color for a fingerprint (consistent per user).
   */
  private getNickColor(fingerprint: string): string {
    const colors = ['cyan', 'green', 'yellow', 'magenta', 'red', 'blue'];
    const hash = fingerprint.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  /**
   * Add a chat message to the display.
   */
  addMessage(message: ChatMessage): void {
    const time = this.formatTime(message.timestamp);
    const color = this.getNickColor(message.fingerprint);
    const shortFp = message.fingerprint.slice(0, 4);
    const content = this.sanitize(message.content);

    let formatted: string;

    switch (message.type) {
      case 'text':
        formatted = `{gray-fg}${time}{/} {${color}-fg}<${message.nick}>{/} {gray-fg}[${shortFp}]{/} ${content}`;
        break;
      case 'action':
        formatted = `{gray-fg}${time}{/} {magenta-fg}* ${message.nick} ${content}{/}`;
        break;
      case 'join':
        formatted = `{gray-fg}${time}{/} {green-fg}>>> ${message.nick} [${shortFp}] has joined{/}`;
        break;
      case 'leave':
        formatted = `{gray-fg}${time}{/} {red-fg}<<< ${message.nick} [${shortFp}] has left{/}`;
        break;
      case 'nick':
        formatted = `{gray-fg}${time}{/} {yellow-fg}*** ${message.oldNick || 'Someone'} is now known as ${message.nick}{/}`;
        break;
      default:
        formatted = `{gray-fg}${time}{/} ${content}`;
    }

    this.messages.push(formatted);

    // Trim old messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.render();
  }

  /**
   * Add a system message.
   */
  addSystemMessage(text: string): void {
    const time = this.formatTime(Date.now());
    const lines = text.split('\n');

    for (const line of lines) {
      const formatted = `{gray-fg}${time}{/} {yellow-fg}*** ${this.sanitize(line)}{/}`;
      this.messages.push(formatted);
    }

    // Trim old messages
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }

    this.render();
  }

  /**
   * Clear all messages.
   */
  clear(): void {
    this.messages = [];
    this.render();
  }

  /**
   * Render messages to the widget.
   */
  private render(): void {
    this.widget.setContent(this.messages.join('\n'));
    this.widget.setScrollPerc(100); // Scroll to bottom
    this.widget.screen.render();
  }

  /**
   * Scroll up one page.
   */
  scrollUp(): void {
    this.widget.scroll(-Math.floor((this.widget.height as number) / 2));
    this.widget.screen.render();
  }

  /**
   * Scroll down one page.
   */
  scrollDown(): void {
    this.widget.scroll(Math.floor((this.widget.height as number) / 2));
    this.widget.screen.render();
  }

  /**
   * Focus this widget.
   */
  focus(): void {
    this.widget.focus();
  }
}
