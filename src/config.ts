import { config as loadEnv } from 'dotenv';

loadEnv();

export interface Config {
  // SSH Server
  sshPort: number;
  sshHostKeyPath: string;

  // P2P Network
  p2pPort: number;
  bootstrapNodes: string[];

  // Chat Settings
  defaultRoom: string;
  maxMessageSize: number;
  maxMessagesInMemory: number;
  rateLimit: number; // messages per second
  maxNickLength: number;
  maxRoomNameLength: number;

  // Bootstrap Node
  isBootstrap: boolean;
}

function parseBootstrapNodes(envValue: string | undefined): string[] {
  if (!envValue) return [];
  return envValue.split(',').map(s => s.trim()).filter(Boolean);
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    // SSH Server
    sshPort: overrides.sshPort ?? parseInt(process.env.SSH_PORT ?? '2222', 10),
    sshHostKeyPath: overrides.sshHostKeyPath ?? process.env.SSH_HOST_KEY_PATH ?? './keys/host.key',

    // P2P Network
    p2pPort: overrides.p2pPort ?? parseInt(process.env.P2P_PORT ?? '4001', 10),
    bootstrapNodes: overrides.bootstrapNodes ?? parseBootstrapNodes(process.env.BOOTSTRAP_NODES),

    // Chat Settings
    defaultRoom: overrides.defaultRoom ?? process.env.DEFAULT_ROOM ?? 'lobby',
    maxMessageSize: overrides.maxMessageSize ?? parseInt(process.env.MAX_MESSAGE_SIZE ?? '4096', 10),
    maxMessagesInMemory: overrides.maxMessagesInMemory ?? parseInt(process.env.MAX_MESSAGES_IN_MEMORY ?? '100', 10),
    rateLimit: overrides.rateLimit ?? parseInt(process.env.RATE_LIMIT ?? '10', 10),
    maxNickLength: overrides.maxNickLength ?? parseInt(process.env.MAX_NICK_LENGTH ?? '32', 10),
    maxRoomNameLength: overrides.maxRoomNameLength ?? parseInt(process.env.MAX_ROOM_NAME_LENGTH ?? '32', 10),

    // Bootstrap Node
    isBootstrap: overrides.isBootstrap ?? process.env.IS_BOOTSTRAP === 'true',
  };
}

export const config = loadConfig();
