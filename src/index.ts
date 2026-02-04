#!/usr/bin/env node

import { Command } from 'commander';
import { config as loadEnv } from 'dotenv';
import { loadConfig } from './config.js';
import { generateEphemeralIdentity } from './crypto/identity.js';
import { createP2PNode } from './network/node.js';
import { connectToBootstrapNodes } from './network/discovery.js';
import { ChatState, setGlobalState } from './chat/state.js';
import { createSSHServer, startSSHServer } from './ssh/server.js';
import { runBootstrapNode } from './bootstrap/node.js';
import { logger, createLogger } from './utils/logger.js';

// Load environment variables
loadEnv();

const program = new Command();

program
  .name('whisper')
  .description('Anonymous P2P CLI chat over SSH')
  .version('0.1.0');

program
  .command('server')
  .description('Run the Whisper chat server')
  .option('-p, --ssh-port <port>', 'SSH server port', '2222')
  .option('--p2p-port <port>', 'P2P network port', '4001')
  .option('-k, --host-key <path>', 'SSH host key path', './keys/host.key')
  .option('-b, --bootstrap <addrs...>', 'Bootstrap node addresses')
  .action(async (options) => {
    const serverLogger = createLogger('server');

    try {
      // Load configuration with CLI overrides
      const config = loadConfig({
        sshPort: parseInt(options.sshPort, 10),
        p2pPort: parseInt(options.p2pPort, 10),
        sshHostKeyPath: options.hostKey,
        bootstrapNodes: options.bootstrap || [],
      });

      serverLogger.info('Starting Whisper server...');

      // Create global chat state
      const chatState = new ChatState(config.maxMessagesInMemory);
      setGlobalState(chatState);

      // Generate server identity for P2P
      serverLogger.info('Generating P2P identity...');
      const identity = await generateEphemeralIdentity();

      // Create P2P node
      serverLogger.info(`Starting P2P node on port ${config.p2pPort}...`);
      const p2pNode = await createP2PNode({
        peerId: identity.peerId,
        port: config.p2pPort,
        isBootstrap: false,
      });
      await p2pNode.start();

      serverLogger.info('P2P node started');
      for (const addr of p2pNode.getMultiaddrs()) {
        serverLogger.info(`  Listening: ${addr.toString()}`);
      }

      // Connect to bootstrap nodes
      if (config.bootstrapNodes.length > 0) {
        await connectToBootstrapNodes(p2pNode, config.bootstrapNodes);
      }

      // Create SSH server
      serverLogger.info('Starting SSH server...');
      const sshServer = createSSHServer({
        config,
        p2pNode,
        chatState,
      });

      await startSSHServer(sshServer, config.sshPort);

      serverLogger.info('='.repeat(50));
      serverLogger.info('Whisper server is running!');
      serverLogger.info(`SSH: ssh -p ${config.sshPort} <hostname>`);
      serverLogger.info(`P2P: ${p2pNode.getMultiaddrs()[0]?.toString() || 'N/A'}`);
      serverLogger.info('='.repeat(50));

      // Handle graceful shutdown
      const shutdown = async () => {
        serverLogger.info('Shutting down...');

        sshServer.close();
        await p2pNode.stop();

        serverLogger.info('Goodbye!');
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

    } catch (err) {
      serverLogger.error('Failed to start server:', err);
      process.exit(1);
    }
  });

program
  .command('bootstrap')
  .description('Run a bootstrap/relay node')
  .option('-p, --port <port>', 'P2P port', '4001')
  .option('-k, --key <path>', 'Private key path for persistent peer ID')
  .action(async (options) => {
    const bootstrapLogger = createLogger('bootstrap');

    try {
      const port = parseInt(options.port, 10);

      bootstrapLogger.info(`Starting bootstrap node on port ${port}...`);

      await runBootstrapNode({
        port,
        privateKeyPath: options.key,
      });

    } catch (err) {
      bootstrapLogger.error('Failed to start bootstrap node:', err);
      process.exit(1);
    }
  });

program.parse();
