#!/usr/bin/env node

/**
 * Generate an Ed25519 SSH host key for the Whisper server.
 *
 * Usage:
 *   node dist/scripts/generate-host-key.js [output-path]
 *
 * Default output: ./keys/host.key
 */

import ssh2 from 'ssh2';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { dirname } from 'path';

const { utils } = ssh2;

const DEFAULT_PATH = './keys/host.key';

function main(): void {
  const outputPath = process.argv[2] || DEFAULT_PATH;

  console.log('Generating Ed25519 SSH host key...');

  // Ensure directory exists
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }

  // Delete existing key if requested via --force
  if (existsSync(outputPath)) {
    if (process.argv.includes('--force')) {
      unlinkSync(outputPath);
      console.log(`Deleted existing key at ${outputPath}`);
    } else {
      console.error(`Error: Key already exists at ${outputPath}`);
      console.error('Use --force to overwrite, or delete it first.');
      process.exit(1);
    }
  }

  // Generate Ed25519 keypair using ssh2's built-in keygen
  // Returns { private: string, public: string }
  const keys = utils.generateKeyPairSync('ed25519') as { private: string; public: string };

  // Write to file with restricted permissions
  writeFileSync(outputPath, keys.private, { mode: 0o600 });

  console.log(`Host key generated: ${outputPath}`);
  console.log('');
  console.log('Keep this key secure and do not commit it to version control!');
}

main();
