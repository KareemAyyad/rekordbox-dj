# rekordbox/Dockerfile
FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all package.json files first to leverage Docker cache
COPY package*.json ./
COPY apps/bridge/package.json ./apps/bridge/
COPY apps/desktop/package.json ./apps/desktop/
COPY packages/core/package.json ./packages/core/
COPY apps/cli/package.json ./apps/cli/

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Run the build
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build:web

# Set environment variables
ENV PORT=10000
ENV NODE_ENV=production
EXPOSE 10000

# Start the application
CMD ["npm", "run", "serve:web"]
