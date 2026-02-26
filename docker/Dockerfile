# Stage 1: Build Next.js static export
FROM node:20-slim AS frontend
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /build

# Copy workspace config + lockfile first for caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# Copy web app source and build
COPY apps/web/ apps/web/
RUN pnpm --filter @dropcrate/web build

# Stage 2: Python runtime
FROM python:3.12-slim

# Install ffmpeg + fpcalc + libsndfile + git + Node.js 18 (for PO token provider)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg curl libchromaprint-tools libsndfile1 git gnupg ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

# Build bgutil PO token server (auto-generates YouTube PO tokens for yt-dlp)
RUN git clone https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil && \
    cd /opt/bgutil/server && \
    npm install && \
    npx tsc

WORKDIR /app

# Install Python dependencies from requirements.txt
COPY packages/api/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install the package itself
COPY packages/api/pyproject.toml ./
RUN pip install --no-cache-dir -e . 2>/dev/null || true

# Copy API source
COPY packages/api/ ./

# Copy Next.js static build
COPY --from=frontend /build/apps/web/out /app/static

# Copy startup script
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Create data directories
RUN mkdir -p /data/inbox /data/segments

ENV PORT=10000
ENV DROPCRATE_INBOX_DIR=/data/inbox
ENV DROPCRATE_DATABASE_PATH=/data/dropcrate.db
ENV DROPCRATE_STATIC_DIR=/app/static
ENV DROPCRATE_SEGMENTS_DIR=/data/segments

EXPOSE 10000

CMD ["/app/start.sh"]
