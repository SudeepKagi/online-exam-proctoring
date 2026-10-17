# ==============================================================================
# ProctorNet — Clean Architecture Makefile
# Targets: up, down, destroy, build, dev, migrate, seed, test, test-e2e, clean
# ==============================================================================
.PHONY: up down destroy build dev migrate seed test test-e2e clean

# Bring up docker-compose stack (postgres, redis, backend, frontend)
up:
	docker compose up -d

# Tear down containers (keep volumes)
down:
	docker compose down

# Destroy containers and wipe data volumes
destroy:
	docker compose down -v

# Build docker containers
build:
	docker compose build

# Start local dev servers for backend and frontend concurrently
dev:
	npm run dev

# Run Prisma database migrations
migrate:
	npm run db:migrate

# Seed baseline database admin
seed:
	npm run db:seed

# Run backend test suite
test:
	npm run test

# Run Playwright E2E journey tests
test-e2e:
	npm run test:e2e

# Clean generated build artifacts
clean:
	node -e "const fs = require('fs'); ['frontend/dist', 'backend/dist'].forEach(d => fs.rmSync(d, { recursive: true, force: true }));"
