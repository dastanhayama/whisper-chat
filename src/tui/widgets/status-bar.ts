import blessed, { Widgets } from 'blessed';

/**
 * Status bar widget showing current room, nick, and connection info.
 */
export class StatusBar {
  readonly widget: Widgets.BoxElement;
  private nick: string = '';
  private fingerprint: string = '';
  private room: string = '';
  private peerCount: number = 0;
  private userCount: number = 0;

  constructor(parent: Widgets.Screen) {
    this.widget = blessed.box({
      parent,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      style: {
        bg: 'blue',
        fg: 'white',
      },
      tags: true,
    });
  }

  /**
   * Set the current nick.
   */
  setNick(nick: string): void {
    this.nick = nick;
    this.render();
  }

  /**
   * Set the current fingerprint.
   */
  setFingerprint(fingerprint: string): void {
    this.fingerprint = fingerprint;
    this.render();
  }

  /**
   * Set the current room.
   */
  setRoom(room: string): void {
    this.room = room;
    this.render();
  }

  /**
   * Set the P2P peer count.
   */
  setPeerCount(count: number): void {
    this.peerCount = count;
    this.render();
  }

  /**
   * Set the user count in current room.
   */
  setUserCount(count: number): void {
    this.userCount = count;
    this.render();
  }

  /**
   * Update all status values at once.
   */
  updateAll(values: {
    nick?: string;
    fingerprint?: string;
    room?: string;
    peerCount?: number;
    userCount?: number;
  }): void {
    if (values.nick !== undefined) this.nick = values.nick;
    if (values.fingerprint !== undefined) this.fingerprint = values.fingerprint;
    if (values.room !== undefined) this.room = values.room;
    if (values.peerCount !== undefined) this.peerCount = values.peerCount;
    if (values.userCount !== undefined) this.userCount = values.userCount;
    this.render();
  }

  /**
   * Render the status bar.
   */
  private render(): void {
    const shortFp = this.fingerprint.slice(0, 8);
    const left = ` {bold}${this.nick}{/bold} [${shortFp}] | Room: {bold}${this.room}{/bold} (${this.userCount} users)`;
    const right = `Peers: ${this.peerCount} | {bold}Whisper{/bold} `;

    // Calculate padding
    const width = (this.widget.width as number) || 80;
    const leftLen = this.stripTags(left).length;
    const rightLen = this.stripTags(right).length;
    const padding = Math.max(0, width - leftLen - rightLen);

    this.widget.setContent(left + ' '.repeat(padding) + right);
    this.widget.screen.render();
  }

  /**
   * Strip blessed tags from a string for length calculation.
   */
  private stripTags(text: string): string {
    return text.replace(/\{[^}]+\}/g, '');
  }
}
