import type { UserSession } from './session.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('chat:commands');

export interface CommandContext {
  session: UserSession;
  args: string[];
  rawInput: string;
}

export interface Command {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  execute: (ctx: CommandContext) => Promise<void>;
}

/**
 * Sanitize nickname: alphanumeric, underscore, dash only.
 */
export function sanitizeNick(nick: string): string {
  return nick.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

/**
 * Sanitize room name: alphanumeric, underscore, dash only.
 */
export function sanitizeRoomName(room: string): string {
  return room.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32).toLowerCase();
}

/**
 * Validate nick format and length.
 */
export function isValidNick(nick: string, maxLength: number = 32): boolean {
  if (nick.length === 0 || nick.length > maxLength) return false;
  return /^[a-zA-Z0-9_-]+$/.test(nick);
}

/**
 * Validate room name format and length.
 */
export function isValidRoomName(room: string, maxLength: number = 32): boolean {
  if (room.length === 0 || room.length > maxLength) return false;
  return /^[a-zA-Z0-9_-]+$/.test(room);
}

// Command implementations
const nickCommand: Command = {
  name: 'nick',
  aliases: ['n'],
  description: 'Change your nickname',
  usage: '/nick <new_name>',
  async execute(ctx: CommandContext): Promise<void> {
    if (ctx.args.length < 1) {
      ctx.session.showSystemMessage('Usage: /nick <new_name>');
      return;
    }

    const newNick = sanitizeNick(ctx.args[0]);

    if (!newNick) {
      ctx.session.showSystemMessage('Invalid nickname. Use alphanumeric characters, underscores, and dashes only.');
      return;
    }

    if (newNick.length > ctx.session.config.maxNickLength) {
      ctx.session.showSystemMessage(`Nickname too long (max ${ctx.session.config.maxNickLength} characters)`);
      return;
    }

    await ctx.session.changeNick(newNick);
  },
};

const joinCommand: Command = {
  name: 'join',
  aliases: ['j'],
  description: 'Join a room',
  usage: '/join <room_name>',
  async execute(ctx: CommandContext): Promise<void> {
    if (ctx.args.length < 1) {
      ctx.session.showSystemMessage('Usage: /join <room_name>');
      return;
    }

    const roomName = sanitizeRoomName(ctx.args[0]);

    if (!roomName) {
      ctx.session.showSystemMessage('Invalid room name. Use alphanumeric characters, underscores, and dashes only.');
      return;
    }

    if (roomName.length > ctx.session.config.maxRoomNameLength) {
      ctx.session.showSystemMessage(`Room name too long (max ${ctx.session.config.maxRoomNameLength} characters)`);
      return;
    }

    await ctx.session.joinRoom(roomName);
  },
};

const usersCommand: Command = {
  name: 'users',
  aliases: ['who', 'w'],
  description: 'List users in the current room',
  usage: '/users',
  async execute(ctx: CommandContext): Promise<void> {
    ctx.session.showUserList();
  },
};

const roomsCommand: Command = {
  name: 'rooms',
  aliases: ['r'],
  description: 'List known rooms',
  usage: '/rooms',
  async execute(ctx: CommandContext): Promise<void> {
    ctx.session.showRoomList();
  },
};

const helpCommand: Command = {
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  usage: '/help',
  async execute(ctx: CommandContext): Promise<void> {
    const helpText = commands
      .map(cmd => `  ${cmd.usage.padEnd(25)} - ${cmd.description}`)
      .join('\n');

    ctx.session.showSystemMessage('Available commands:\n' + helpText);
  },
};

const quitCommand: Command = {
  name: 'quit',
  aliases: ['q', 'exit'],
  description: 'Disconnect from chat',
  usage: '/quit',
  async execute(ctx: CommandContext): Promise<void> {
    ctx.session.showSystemMessage('Goodbye!');
    await ctx.session.disconnect();
  },
};

const meCommand: Command = {
  name: 'me',
  aliases: [],
  description: 'Send an action message',
  usage: '/me <action>',
  async execute(ctx: CommandContext): Promise<void> {
    if (ctx.args.length < 1) {
      ctx.session.showSystemMessage('Usage: /me <action>');
      return;
    }

    const action = ctx.args.join(' ');
    await ctx.session.sendAction(action);
  },
};

const clearCommand: Command = {
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear the screen',
  usage: '/clear',
  async execute(ctx: CommandContext): Promise<void> {
    ctx.session.clearMessages();
  },
};

// All commands
const commands: Command[] = [
  nickCommand,
  joinCommand,
  usersCommand,
  roomsCommand,
  helpCommand,
  quitCommand,
  meCommand,
  clearCommand,
];

// Build command lookup map
const commandMap = new Map<string, Command>();
for (const cmd of commands) {
  commandMap.set(cmd.name, cmd);
  for (const alias of cmd.aliases) {
    commandMap.set(alias, cmd);
  }
}

/**
 * Parse and execute a command string.
 * Returns true if the input was a command, false if it's a regular message.
 */
export async function executeCommand(
  session: UserSession,
  input: string
): Promise<boolean> {
  if (!input.startsWith('/')) {
    return false;
  }

  const parts = input.slice(1).split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const command = commandMap.get(commandName);

  if (!command) {
    session.showSystemMessage(`Unknown command: /${commandName}. Type /help for available commands.`);
    return true;
  }

  logger.debug(`Executing command: /${commandName} with args: ${args.join(' ')}`);

  try {
    await command.execute({
      session,
      args,
      rawInput: input,
    });
  } catch (err) {
    logger.error(`Command execution failed: ${commandName}`, err);
    session.showSystemMessage(`Command failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return true;
}

export { commands };
