# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Create keys directory
RUN mkdir -p /app/keys

# Set environment variables
ENV NODE_ENV=production
ENV SSH_PORT=2222
ENV P2P_PORT=4001
ENV SSH_HOST_KEY_PATH=/app/keys/host.key

# Expose ports
EXPOSE 2222 4001

# Run the server
CMD ["node", "dist/index.js", "server"]
