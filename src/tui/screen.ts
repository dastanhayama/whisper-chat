import blessed, { Widgets } from 'blessed';
import type { ServerChannel } from 'ssh2';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('tui:screen');

export interface PTYInfo {
  term: string;
  cols: number;
  rows: number;
}

/**
 * Create a blessed screen attached to an SSH stream.
 * This is the critical integration point between SSH and the TUI.
 */
export function createScreen(stream: ServerChannel, ptyInfo: PTYInfo): Widgets.Screen {
  logger.debug(`Creating screen: ${ptyInfo.term} ${ptyInfo.cols}x${ptyInfo.rows}`);

  // Set stream dimensions for blessed
  (stream as any).rows = ptyInfo.rows;
  (stream as any).columns = ptyInfo.cols;

  // Create blessed screen with SSH stream as input/output
  const screen = blessed.screen({
    input: stream,
    output: stream,
    terminal: ptyInfo.term,
    smartCSR: true,
    fullUnicode: true,
    forceUnicode: true,
    autoPadding: true,
    warnings: false,
    grabKeys: true,
    sendFocus: true,
  });

  // Set title
  screen.title = 'Whisper Chat';

  // Handle errors
  screen.on('error', (err) => {
    logger.error('Screen error:', err);
  });

  logger.debug('Screen created successfully');

  return screen;
}
