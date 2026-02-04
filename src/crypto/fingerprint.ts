import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/**
 * Generate a human-readable fingerprint from a public key.
 * Uses SHA256 hash, takes first 4 bytes (8 hex chars) for display.
 * Example output: "A7B3C9D1"
 */
export function generateFingerprint(publicKeyBytes: Uint8Array): string {
  const hash = sha256(publicKeyBytes);
  // Take first 4 bytes (8 hex characters) for a readable fingerprint
  return bytesToHex(hash.slice(0, 4)).toUpperCase();
}

/**
 * Generate a short fingerprint for display in compact contexts.
 * Returns first 4 hex characters.
 */
export function generateShortFingerprint(publicKeyBytes: Uint8Array): string {
  const full = generateFingerprint(publicKeyBytes);
  return full.slice(0, 4);
}

/**
 * Validate that a string looks like a valid fingerprint.
 */
export function isValidFingerprint(fingerprint: string): boolean {
  return /^[A-F0-9]{8}$/i.test(fingerprint);
}
