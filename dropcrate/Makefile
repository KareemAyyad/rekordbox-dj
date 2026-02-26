.PHONY: dev dev-web dev-api build docker docker-up install install-web install-api test test-api lint

# Development
dev:
	@echo "Starting dev servers..."
	cd apps/web && pnpm dev &
	cd packages/api && uvicorn dropcrate.main:app --reload --host 0.0.0.0 --port 8000

dev-web:
	cd apps/web && pnpm dev

dev-api:
	cd packages/api && uvicorn dropcrate.main:app --reload --host 0.0.0.0 --port 8000

# Install
install: install-web install-api

install-web:
	cd apps/web && pnpm install

install-api:
	cd packages/api && pip install -e ".[dev]"

# Build
build:
	cd apps/web && pnpm build

# Docker
docker:
	docker build -f docker/Dockerfile -t dropcrate .

docker-up:
	docker compose -f docker/docker-compose.yml up --build

# Test
test: test-api
	cd apps/web && pnpm test

test-api:
	cd packages/api && pytest -v

# Lint
lint:
	cd apps/web && pnpm lint
	cd packages/api && ruff check .
