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

# Install ffmpeg + fpcalc + libsndfile (for audio processing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl libchromaprint-tools libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

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

# Create data directories
RUN mkdir -p /data/inbox /data/segments

ENV PORT=10000
ENV DROPCRATE_INBOX_DIR=/data/inbox
ENV DROPCRATE_DATABASE_PATH=/data/dropcrate.db
ENV DROPCRATE_STATIC_DIR=/app/static
ENV DROPCRATE_SEGMENTS_DIR=/data/segments

EXPOSE 10000

CMD ["uvicorn", "dropcrate.main:app", "--host", "0.0.0.0", "--port", "10000"]
