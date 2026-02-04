import { createLibp2p, type Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { kadDHT } from '@libp2p/kad-dht';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { createEd25519PeerId, createFromPrivKey } from '@libp2p/peer-id-factory';
import { unmarshalPrivateKey } from '@libp2p/crypto/keys';
import type { Ed25519PeerId } from '@libp2p/interface';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('bootstrap');

export type BootstrapNode = Libp2p;

export interface BootstrapConfig {
  port: number;
  privateKeyPath?: string;
}

/**
 * Create a bootstrap/relay node for peer discovery.
 * Bootstrap nodes:
 * - Run DHT in server mode to help peers find each other
 * - Provide circuit relay services for NAT traversal
 * - Have persistent peer IDs for stable addresses
 */
export async function createBootstrapNode(config: BootstrapConfig): Promise<BootstrapNode> {
  logger.info(`Creating bootstrap node on port ${config.port}`);

  // Load or generate peer ID with embedded private key
  const peerId = await loadOrGeneratePeerId(config.privateKeyPath);

  logger.info(`Bootstrap node PeerId: ${peerId.toString()}`);

  const node = await createLibp2p({
    peerId,
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${config.port}/ws`,
      ],
    },
    transports: [webSockets()],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pubsub: gossipsub({
        emitSelf: false,
        fallbackToFloodsub: true,
        floodPublish: true,
        doPX: true,
      }),
      dht: kadDHT({
        clientMode: false, // Server mode for bootstrap nodes
      }),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: 128,
        },
      }),
    },
    connectionManager: {
      maxConnections: 1000,
      minConnections: 10,
    },
  });

  return node;
}

/**
 * Load peer ID from file or generate a new one.
 * Saves new peer ID private key to the specified path for persistence.
 */
async function loadOrGeneratePeerId(path?: string): Promise<Ed25519PeerId> {
  if (path && existsSync(path)) {
    logger.info(`Loading private key from ${path}`);
    const raw = readFileSync(path);
    const privateKey = await unmarshalPrivateKey(raw);
    return await createFromPrivKey(privateKey) as Ed25519PeerId;
  }

  logger.info('Generating new Ed25519 peer ID');
  const peerId = await createEd25519PeerId();

  if (path && peerId.privateKey) {
    logger.info(`Saving private key to ${path}`);
    writeFileSync(path, peerId.privateKey);
  }

  return peerId;
}

/**
 * Start the bootstrap node and log its addresses.
 */
export async function startBootstrapNode(node: BootstrapNode): Promise<void> {
  await node.start();

  logger.info('Bootstrap node started');
  logger.info('Listening on:');

  for (const addr of node.getMultiaddrs()) {
    logger.info(`  ${addr.toString()}`);
  }

  // Log peer connection events
  node.addEventListener('peer:connect', (evt) => {
    logger.info(`Peer connected: ${evt.detail.toString()}`);
  });

  node.addEventListener('peer:disconnect', (evt) => {
    logger.info(`Peer disconnected: ${evt.detail.toString()}`);
  });

  // Periodic stats logging
  setInterval(() => {
    const connections = node.getConnections();
    logger.info(`Stats: ${connections.length} connections`);
  }, 60000); // Every minute
}

/**
 * Run a standalone bootstrap node.
 */
export async function runBootstrapNode(config: BootstrapConfig): Promise<void> {
  const node = await createBootstrapNode(config);
  await startBootstrapNode(node);

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down bootstrap node...');
    await node.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Bootstrap node running. Press Ctrl+C to stop.');
}
