# Whisper - Anonymous P2P CLI Chat

A secure, anonymous, peer-to-peer command-line chat application. Users connect via SSH and immediately enter an encrypted chat room. Messages are end-to-end encrypted, ephemeral (exist only in memory), and routed through a decentralized peer network.

## Features

- **SSH-First Design**: Connect using any standard SSH client - no app installation needed
- **P2P Networking**: Decentralized messaging using libp2p with WebSocket transport
- **End-to-End Encryption**: Noise protocol encryption for all P2P traffic
- **Ephemeral Identity**: New cryptographic identity generated per session
- **Anonymous**: Choose any nickname, identified only by key fingerprint
- **No Message Persistence**: Messages exist only in memory, never stored to disk

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd whisper-chat

# Install dependencies
npm install

# Generate SSH host key
npm run generate-host-key

# Start the server
npm run dev
```

### Connect

```bash
# Connect from any SSH client
ssh -p 2222 localhost
```

## Commands

Once connected, use these slash commands:

| Command | Description |
|---------|-------------|
| `/nick <name>` | Change your nickname |
| `/join <room>` | Join a different room |
| `/users` | List users in current room |
| `/rooms` | List known rooms |
| `/me <action>` | Send an action message |
| `/clear` | Clear the screen |
| `/help` | Show all commands |
| `/quit` | Disconnect |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Ctrl+C` | Quit |
| `Ctrl+D` | Quit |
| `Page Up` | Scroll messages up |
| `Page Down` | Scroll messages down |
| `Escape` | Clear input |

## Running Modes

### Chat Server

Run the full chat server with SSH interface:

```bash
# Development
npm run dev

# Production
npm run build
npm start

# With options
npm run dev -- --ssh-port 2222 --p2p-port 4001 --bootstrap /ip4/.../ws/p2p/...
```

### Bootstrap Node

Run a dedicated bootstrap/relay node for peer discovery:

```bash
# Development
npm run dev:bootstrap

# Production
npm run build
npm run start:bootstrap

# With persistent identity
npm run dev:bootstrap -- --port 4001 --key ./keys/bootstrap.key
```

## Configuration

Configuration can be set via environment variables or CLI options. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SSH_PORT` | 2222 | SSH server port |
| `SSH_HOST_KEY_PATH` | ./keys/host.key | Path to SSH host key |
| `P2P_PORT` | 4001 | libp2p WebSocket port |
| `BOOTSTRAP_NODES` | | Comma-separated bootstrap addresses |
| `DEFAULT_ROOM` | lobby | Default room for new users |
| `MAX_MESSAGE_SIZE` | 4096 | Maximum message size in bytes |
| `RATE_LIMIT` | 10 | Messages per second limit |
| `LOG_LEVEL` | info | Logging level (debug/info/warn/error) |

## Deployment

### Docker

```bash
# Build image
docker build -t whisper-chat .

# Run container
docker run -p 2222:2222 -p 4001:4001 -v whisper-keys:/app/keys whisper-chat
```

### Fly.io

```bash
# Launch (first time)
fly launch

# Create volume for host key
fly volumes create whisper_keys --size 1

# Deploy
fly deploy

# Generate host key on the instance
fly ssh console -C "node dist/scripts/generate-host-key.js"
```

## Architecture

```
┌─────────────┐     SSH      ┌─────────────────┐
│ SSH Client  │─────────────▶│   SSH Server    │
│  (User A)   │              │   (blessed TUI) │
└─────────────┘              └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │    Chat Core    │
                             │  (State/Session)│
                             └────────┬────────┘
                                      │
                                      ▼
┌─────────────┐   GossipSub  ┌─────────────────┐   GossipSub  ┌─────────────┐
│  libp2p     │◀────────────▶│    libp2p       │◀────────────▶│   libp2p    │
│  (User A)   │              │  (Bootstrap)    │              │  (User B)   │
└─────────────┘              └─────────────────┘              └─────────────┘
```

## Security

- **Transport Encryption**: All P2P traffic encrypted with Noise protocol
- **Ephemeral Keys**: New Ed25519 keypair generated each session
- **No Persistence**: Messages never written to disk
- **Rate Limiting**: Prevents spam (10 msg/sec default)
- **Input Sanitization**: Nicknames and room names sanitized
- **Anonymous Auth**: SSH accepts any authentication

## Development

```bash
# Run in development mode with hot reload
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build
```

## Project Structure

```
src/
├── index.ts          # CLI entry point
├── config.ts         # Configuration management
├── crypto/           # Cryptographic identity
├── network/          # libp2p P2P networking
├── chat/             # Chat state and session management
├── ssh/              # SSH server
├── tui/              # Terminal UI (blessed)
├── bootstrap/        # Bootstrap node
└── utils/            # Logging and utilities
```

## License

MIT
