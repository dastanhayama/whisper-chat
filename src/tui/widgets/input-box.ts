import blessed, { Widgets } from 'blessed';

export type InputHandler = (value: string) => void;

/**
 * Text input widget for chat messages.
 */
export class InputBox {
  readonly widget: Widgets.TextboxElement;
  private onSubmit: InputHandler | null = null;
  private screen: Widgets.Screen;

  constructor(parent: Widgets.Screen) {
    this.screen = parent;
    this.widget = blessed.textbox({
      parent,
      label: ' Type message (Enter to send, /help for commands) ',
      bottom: 1,
      left: 0,
      width: '100%',
      height: 3,
      keys: true,
      mouse: true,
      inputOnFocus: true,
      border: {
        type: 'line',
      },
      style: {
        border: {
          fg: 'cyan',
        },
        focus: {
          border: {
            fg: 'green',
          },
        },
      },
    });

    // Handle submit
    this.widget.on('submit', (value: string) => {
      this.widget.clearValue();
      this.screen.render();

      if (this.onSubmit && value.trim()) {
        this.onSubmit(value);
      }

      // Re-enable input mode after submit
      setImmediate(() => {
        this.widget.readInput();
      });
    });

    // Handle cancel (Escape)
    this.widget.on('cancel', () => {
      this.widget.clearValue();
      this.screen.render();
      // Re-enable input mode after cancel
      setImmediate(() => {
        this.widget.readInput();
      });
    });
  }

  /**
   * Set the submit handler.
   */
  setOnSubmit(handler: InputHandler): void {
    this.onSubmit = handler;
  }

  /**
   * Focus this widget and enable input.
   */
  focus(): void {
    this.widget.focus();
    this.widget.readInput();
  }

  /**
   * Clear the input value.
   */
  clear(): void {
    this.widget.clearValue();
    this.widget.screen.render();
  }

  /**
   * Set the input value.
   */
  setValue(value: string): void {
    this.widget.setValue(value);
    this.widget.screen.render();
  }

  /**
   * Get the current input value.
   */
  getValue(): string {
    return this.widget.getValue();
  }
}
