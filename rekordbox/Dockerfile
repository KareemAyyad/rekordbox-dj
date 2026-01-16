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
COPY packages/cli/package.json ./packages/cli/

# Install dependencies
RUN npm install

# Copy the rest of the source code
COPY . .

# Run the build
# We set memory limits for Node to prevent crashes on smaller Render plans
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build:web

# Set environment variables
ENV PORT=8787
ENV NODE_ENV=production
EXPOSE 8787

# Start the application
CMD ["npm", "run", "serve:web"]
