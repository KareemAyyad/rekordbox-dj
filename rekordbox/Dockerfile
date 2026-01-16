# rekordbox/Dockerfile
FROM node:20-slim

# Install ffmpeg and python3 (required for yt-dlp)
RUN apt-get update && apt-get install -y ffmpeg python3 curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace configs
COPY package*.json ./
COPY apps/bridge/package.json ./apps/bridge/
COPY apps/desktop/package.json ./apps/desktop/
COPY packages/core/package.json ./packages/core/
COPY packages/cli/package.json ./packages/cli/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build the web app
RUN npm run build:web

# Set environment
ENV PORT=8787
EXPOSE 8787

# Start the bridge
CMD ["npm", "run", "serve:web"]
