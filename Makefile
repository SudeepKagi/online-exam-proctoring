# ==============================================================================
# ProctorNet — Makefile
# Targets: smoke, up, down, build, migrate, seed, lint, test, backup
# ==============================================================================
.PHONY: up down build migrate seed smoke lint test backup restore

COMPOSE_FILES := -f docker-compose.prod.yml -f docker-compose.override.yml
COMPOSE := docker compose $(COMPOSE_FILES) --profile dev

# Bring up the full dev stack
up:
	.\scripts\dev\up.ps1

# Tear down all containers (keep volumes)
down:
	$(COMPOSE) down

# Tear down including volumes (destructive)
destroy:
	$(COMPOSE) down -v

# Build / rebuild images
build:
	$(COMPOSE) build

# Run prisma migrations against the running DB
migrate:
	$(COMPOSE) run --rm migrate

# Seed admin from .env or backup
seed:
	cd proctornet\backend && node prisma\seed\admin.js

# --------------------------------------------------------------------------
# smoke: golden path test against the running nginx edge (port 80)
# Runs Playwright "smoke" tagged tests that exercise the nginx-fronted stack.
# --------------------------------------------------------------------------
smoke:
	@echo "Running smoke tests against http://localhost:80 ..."
	npx playwright test --grep "@smoke" --reporter=line

# Lint backend + frontend
lint:
	cd proctornet\backend && npx eslint src --max-warnings 0
	cd proctornet\frontend && npx eslint src --max-warnings 0

# Unit + integration tests (node --test)
test:
	cd proctornet\backend && node --test tests

# Backup: pg_dump + admin JSON export
backup:
	.\scripts\ops\backup.ps1

# Restore: pg_restore into scratch DB and verify counts
restore:
	.\scripts\ops\backup-restore-drill.ps1
