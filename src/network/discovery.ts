import { multiaddr } from '@multiformats/multiaddr';
import type { P2PNode } from './node.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('network:discovery');

/**
 * Connect to bootstrap nodes for peer discovery.
 */
export async function connectToBootstrapNodes(
  node: P2PNode,
  bootstrapAddrs: string[]
): Promise<void> {
  if (bootstrapAddrs.length === 0) {
    logger.warn('No bootstrap nodes configured');
    return;
  }

  logger.info(`Connecting to ${bootstrapAddrs.length} bootstrap node(s)`);

  const results = await Promise.allSettled(
    bootstrapAddrs.map(async (addr) => {
      try {
        const ma = multiaddr(addr);
        logger.debug(`Dialing bootstrap node: ${addr}`);
        await node.dial(ma);
        logger.info(`Connected to bootstrap node: ${addr}`);
        return addr;
      } catch (err) {
        logger.error(`Failed to connect to bootstrap node ${addr}:`, err);
        throw err;
      }
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  logger.info(`Bootstrap connection results: ${successful} successful, ${failed} failed`);

  if (successful === 0 && bootstrapAddrs.length > 0) {
    logger.warn('Failed to connect to any bootstrap nodes - operating in isolated mode');
  }
}

/**
 * Get the count of connected peers.
 */
export function getConnectedPeerCount(node: P2PNode): number {
  return node.getConnections().length;
}

/**
 * Get list of connected peer IDs.
 */
export function getConnectedPeers(node: P2PNode): string[] {
  return node.getConnections().map(conn => conn.remotePeer.toString());
}

/**
 * Setup event handlers for connection lifecycle.
 */
export function setupConnectionEvents(
  node: P2PNode,
  onPeerConnect?: (peerId: string) => void,
  onPeerDisconnect?: (peerId: string) => void
): void {
  node.addEventListener('peer:connect', (evt) => {
    const peerId = evt.detail.toString();
    logger.debug(`Peer connected: ${peerId}`);
    onPeerConnect?.(peerId);
  });

  node.addEventListener('peer:disconnect', (evt) => {
    const peerId = evt.detail.toString();
    logger.debug(`Peer disconnected: ${peerId}`);
    onPeerDisconnect?.(peerId);
  });
}
