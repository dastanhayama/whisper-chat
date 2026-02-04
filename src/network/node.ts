import { createLibp2p, type Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { kadDHT } from '@libp2p/kad-dht';
import { webSockets } from '@libp2p/websockets';
import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import type { Ed25519PeerId, PubSub } from '@libp2p/interface';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('network:node');

// Extended Libp2p type with pubsub service
export type P2PNode = Libp2p & { services: { pubsub: PubSub } };

export interface P2PNodeConfig {
  peerId: Ed25519PeerId;
  port: number;
  isBootstrap: boolean;
}

/**
 * Create a libp2p node for P2P communication.
 * Bootstrap nodes run DHT in server mode and provide relay services.
 * Regular nodes run DHT in client mode.
 */
export async function createP2PNode(config: P2PNodeConfig): Promise<P2PNode> {
  logger.info(`Creating P2P node on port ${config.port} (bootstrap: ${config.isBootstrap})`);

  const baseServices = {
    identify: identify(),
    pubsub: gossipsub({
      emitSelf: false,
      fallbackToFloodsub: true,
      floodPublish: true,
      doPX: true,
    }),
    dht: kadDHT({
      clientMode: !config.isBootstrap,
    }),
  };

  // Only bootstrap nodes provide relay services
  const services = config.isBootstrap
    ? {
        ...baseServices,
        relay: circuitRelayServer({
          reservations: {
            maxReservations: 128,
          },
        }),
      }
    : baseServices;

  const node = await createLibp2p({
    peerId: config.peerId,
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${config.port}/ws`],
    },
    transports: [
      webSockets(),
      circuitRelayTransport(),
    ],
    connectionEncryption: [noise()],
    streamMuxers: [yamux()],
    services,
    connectionManager: {
      maxConnections: config.isBootstrap ? 1000 : 50,
      minConnections: config.isBootstrap ? 10 : 2,
    },
  });

  logger.info(`P2P node created with PeerId: ${node.peerId.toString()}`);

  return node as P2PNode;
}

/**
 * Get the multiaddrs that this node is listening on.
 */
export function getListenAddresses(node: P2PNode): string[] {
  return node.getMultiaddrs().map(addr => addr.toString());
}
