import blessed, { Widgets } from 'blessed';
import type { UserInfo } from '../../chat/state.js';

/**
 * User list sidebar widget.
 */
export class UserList {
  readonly widget: Widgets.ListElement;
  private users: UserInfo[] = [];
  private currentSessionId: string = '';

  constructor(parent: Widgets.Screen) {
    this.widget = blessed.list({
      parent,
      label: ' Users ',
      top: 0,
      right: 0,
      width: '20%',
      height: '100%-3',
      mouse: true,
      keys: true,
      vi: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'green',
        },
        selected: {
          bg: 'blue',
          fg: 'white',
        },
        item: {
          fg: 'white',
        },
      },
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray',
        },
        style: {
          bg: 'white',
        },
      },
      tags: true,
    });
  }

  /**
   * Set the current user's session ID for highlighting.
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Update the user list.
   */
  update(users: UserInfo[]): void {
    this.users = users;
    this.render();
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
   * Render the user list.
   */
  private render(): void {
    const items = this.users.map(user => {
      const color = this.getNickColor(user.fingerprint);
      const shortFp = user.fingerprint.slice(0, 4);
      const isMe = user.sessionId === this.currentSessionId;
      const suffix = isMe ? ' (you)' : '';

      return `{${color}-fg}${user.nick}{/}{gray-fg} [${shortFp}]${suffix}{/}`;
    });

    this.widget.setItems(items);
    this.widget.screen.render();
  }

  /**
   * Get the count of users.
   */
  getCount(): number {
    return this.users.length;
  }

  /**
   * Focus this widget.
   */
  focus(): void {
    this.widget.focus();
  }
}
