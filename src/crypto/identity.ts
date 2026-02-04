import { createEd25519PeerId, createFromPrivKey } from '@libp2p/peer-id-factory';
import { unmarshalPrivateKey } from '@libp2p/crypto/keys';
import type { Ed25519PeerId } from '@libp2p/interface';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('crypto:identity');

export interface EphemeralIdentity {
  peerId: Ed25519PeerId;
  publicKeyBytes: Uint8Array;
}

/**
 * Generate a new ephemeral Ed25519 identity for a session.
 * This creates a unique cryptographic identity that exists only for the duration of the session.
 * The peerId includes an embedded private key that libp2p will use.
 */
export async function generateEphemeralIdentity(): Promise<EphemeralIdentity> {
  logger.debug('Generating ephemeral Ed25519 identity');

  // createEd25519PeerId creates a peerId with embedded private key
  const peerId = await createEd25519PeerId();

  // Extract public key bytes for fingerprint generation
  // The publicKey is stored as bytes in the peer ID
  const publicKeyBytes = peerId.publicKey!;

  logger.debug(`Generated identity with PeerId: ${peerId.toString()}`);

  return {
    peerId,
    publicKeyBytes,
  };
}

/**
 * Load identity from raw private key bytes.
 * Useful for persistent bootstrap node identities.
 */
export async function loadIdentityFromRaw(rawPrivateKey: Uint8Array): Promise<EphemeralIdentity> {
  const privateKey = await unmarshalPrivateKey(rawPrivateKey);
  const peerId = await createFromPrivKey(privateKey) as Ed25519PeerId;
  const publicKeyBytes = peerId.publicKey!;

  return {
    peerId,
    publicKeyBytes,
  };
}
