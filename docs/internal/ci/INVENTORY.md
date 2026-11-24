# ProctorNet CI/CD Infrastructure & Codebase Inventory

**Date:** November 2026  
**Target:** CI Pipeline Modernization & Staging/Production Deployment Alignment

---

## 1. Inventory of Pipeline & Infrastructure Files

### 1.1 GitHub Actions Workflows (`.github/workflows/`)
* **`ci.yml`**:
  * *Purpose*: Pull request and branch verification pipeline.
  * *Current State*: Monolithic `verify-and-test` job running PostgreSQL and Redis service containers, followed by an SSM production deployment step.
  * *Stale Elements Identified*:
    - Pinned to unpinned `node: 22` rather than `.nvmrc` (`22.14.0`).
    - Service container created `POSTGRES_DB: proctornet` (violates cleanroom `_test` suffix guard).
    - Hardcoded Redis without password requirement (`redis-cli ping` instead of authenticated ping).
    - Missing test coverage for Playwright E2E suite (`npx playwright test` not executed in CI).
    - Missing Safe Exam Browser (SEB) smoke verification job.
    - Missing `prisma migrate diff` schema drift detection job.
    - Inlined production deployment directly inside `ci.yml` rather than separated CD workflows.
* **`deploy-aws.yml`**:
  * *Purpose*: Manual AWS cutover and deployment pipeline triggered via `workflow_dispatch`.
  * *Current State*: Bundles tarball `release-${{ github.sha }}.tar.gz`, uploads to S3, executes bash script on EC2 via AWS SSM Session Manager (`AWS-RunShellScript`).
  * *Stale Elements Identified*:
    - Uses destructive `db push --accept-data-loss` as fallback when `prisma migrate deploy` fails.
    - Directly mutates host systemd unit and Caddy reverse proxy without automated rollback logic.
    - Tarball deployment model lacks containerized immutability compared to GHCR container images.

### 1.2 Dockerfiles
* **`backend/Dockerfile`**:
  * *Type*: Multi-stage Alpine container (`node:22-alpine`).
  * *Stage 1 (builder)*: Installs build-base (python3, make, g++, openssl), installs dependencies, generates Prisma client, prunes dev dependencies.
  * *Stage 2 (runner)*: Uses `tini` as init process, creates non-root `proctornet:nodejs` (UID 1001), exposes port 5000, runs `wget` healthcheck on `http://127.0.0.1:5000/healthz`.
* **`frontend/Dockerfile`**:
  * *Type*: Multi-stage build with Nginx (`node:22-alpine` builder -> `nginxinc/nginx-unprivileged:1.25-alpine` runner).
  * *Stage 1 (builder)*: Runs `npm run build` (Vite) and brotli/gzip pre-compression.
  * *Stage 2 (runner)*: Non-root Nginx listening on port 8080, serves pre-compressed assets with 1-year immutable cache, reverse-proxies `/api/` and `/socket.io/` to `http://backend:5000`, provides `/healthz` returning 200 OK.

### 1.3 Docker Compose Files
* **`docker-compose.yml`**:
  * *Services*:
    - `postgres`: `postgres:16-alpine`, exposed locally on `127.0.0.1:5434:5432`, healthcheck via `pg_isready`.
    - `redis`: `redis:7-alpine`, exposed locally on `127.0.0.1:6380:6379`, requires password via `--requirepass`.
    - `backend`: builds `./backend`, ports `5000:5000`, connects to internal postgres and redis.
    - `frontend`: builds `./frontend`, ports `5173:8080` and `80:8080`.

### 1.4 Package Scripts (`package.json`, `backend/package.json`, `frontend/package.json`)
* **Root (`package.json`)**:
  - `dev`: `concurrently "npm run dev:backend" "npm run dev:frontend"`
  - `build`: `npm run build --workspace=frontend`
  - `typecheck`: `npm run typecheck --workspace=frontend && npm run typecheck --workspace=backend`
  - `lint`: `npm run lint --workspace=frontend && npm run lint --workspace=backend`
  - `test`: `npm test --workspace=backend`
  - `test:e2e`: `playwright test`
* **Backend (`backend/package.json`)**:
  - `test`: `node --env-file=../.env.test --test --test-force-exit tests/*.test.js`
  - `test:boot-smoke`: `node ../../scripts/ci/boot-smoke.js` (stale relative path)
  - `typecheck`: `tsc -p jsconfig.json --noEmit`
  - `lint`: `eslint src/`
  - `migrate:deploy`: `npx prisma migrate deploy`
* **Frontend (`frontend/package.json`)**:
  - `dev`: `vite`
  - `build`: `vite build`
  - `lint`: `eslint .`
  - `typecheck`: `tsc -p jsconfig.json --noEmit`

---

## 2. Node.js Runtime Version Alignment

| Context | Node Version | Status & Notes |
| :--- | :--- | :--- |
| **Local Development** | `v24.12.0` | Node.js v24 current on Windows host. Supports native `--env-file`, native test runner, crypto primitives. |
| **`.nvmrc`** | `22.14.0` | Pinned Node LTS 22. Target runtime for CI and production Docker containers. |
| **Docker Images** | `node:22-alpine` | Matches `.nvmrc` major version (Node 22 LTS). |
| **Legacy Workflows** | `node-version: 22` | Unpinned minor/patch; should be pinned via `.nvmrc` (`node-version-file: '.nvmrc'`). |

---

## 3. Environment Variables for Testing (`.env.test.example`)

The following variables are required for a clean test run across backend unit tests and Playwright E2E suites:

| Variable | Recommended Test Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `test` | Activates test configuration branches and disables background queue workers. |
| `PORT` | `5000` | Backend test API server port. |
| `INTERNAL_PORT` | `9100` | Internal metrics and monitoring port. |
| `POSTGRES_PASSWORD` | *(32+ char hex string)* | PostgreSQL container password. |
| `REDIS_PASSWORD` | *(secure string)* | Redis container password. |
| `DATABASE_URL` | `postgresql://proctornet:...@127.0.0.1:5434/proctornet_e2e_test?schema=public` | Isolated test DB URL (MUST end in `_test`). |
| `DIRECT_URL` | `postgresql://proctornet:...@127.0.0.1:5434/proctornet_e2e_test?schema=public` | Unpooled test DB URL for Prisma migrations. |
| `REDIS_URL` | `redis://:...@127.0.0.1:6380` | Isolated test Redis URL. |
| `CACHE_DRIVER` | `redis` | Tests caching against real Redis instance. |
| `QUEUE_DRIVER` | `postgres` | Uses Postgres pgQueueDispatcher in test suite. |
| `START_WORKERS` | `true` | Starts queue worker threads for asynchronous jobs. |
| `FACE_DRIVER` | `off` | Disables external AWS Rekognition calls during tests. |
| `FACE_VERIFIER_DRIVER` | `off` | Disables live biometric checks during tests. |
| `COOKIE_SECURE` | `false` | Allows plain HTTP cookies for local test runners. |
| `E2E_PROFILE` | `prod-parity` | Runs full security and middleware chains in E2E journeys. |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS client origin. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS whitelist for API. |
| `PUBLIC_ORIGIN` | `http://localhost:5000` | Canonical origin used by SEB URL hash computation. |
| `JWT_SECRET` | *(32+ char string)* | Test JWT signature secret. |
| `S3_BUCKET` | `proctornet-storage` | Evidence storage bucket name. |
| `AWS_REGION` | `ap-south-1` | AWS region identifier. |
| `S3_MOCK` | `true` | Activates in-memory mock S3 adapter for offline testing. |
| `SEB_MODE` | `log` | Default SEB verification mode in test environment (`off`, `log`, `enforce`). |
| `SEB_CONFIG_KEY` | *(empty or 64-hex)* | Global fallback SEB Config Key. |
| `SEB_LINK_SECRET` | *(32+ char string)* | Secret for HMAC token signing on one-click SEB launch links. |
| `SEB_PRE_DOWNLOAD_MINUTES` | `30` | Minutes before exam start that students can download config file. |
| `EXAM_CACHE_TTL_MS` | `0` | Disables exam in-memory caching to guarantee fresh state reads. |

---

## 4. Production Deployment Topology (Current State)

* **Host**: Single AWS EC2 instance managed via AWS Systems Manager (SSM) Session Manager.
* **Domain & Ingress**: `https://proctornet.duckdns.org` terminated with Caddy web server (automatic Let's Encrypt SSL/TLS).
* **Application Process**:
  - Systemd service unit: `/etc/systemd/system/proctornet.service`.
  - Working directory: `/opt/proctornet/current/backend`.
  - Executable: `node --max-old-space-size=384 src/app.js` running on port 5000.
  - Caddy reverse-proxies `/api/*` and `/socket.io/*` to `127.0.0.1:5000`, and serves static frontend SPA assets directly from `/opt/proctornet/current/frontend/dist`.
* **Database & Persistence**:
  - PostgreSQL and Redis running on AWS (RDS/ElastiCache or local containers).
  - AWS S3 bucket `proctornet-storage-prod-858109978489` for evidence and release archives.
* **Deployment Mechanism**:
  - Release tarballs pushed to S3 -> AWS SSM command triggers deployment script on EC2 -> directory symlink swapped to `/opt/proctornet/releases/release-<SHA>` -> systemd and Caddy reloaded.

---

## 5. Audit of Stale Patterns & Identified Pipeline Deficiencies

1. **Screen Sharing Removal**:
   - `feat/seb-04-remove-screen-share` removed screen proctoring completely in favor of camera proctoring and Safe Exam Browser.
   - *Stale artifacts*: `playwright.config.ts` retained `--auto-select-desktop-capture-source=Entire screen`. (Now removed).
2. **Missing SEB Environment Variables in CI**:
   - `SEB_MODE`, `SEB_CONFIG_KEY`, `PUBLIC_ORIGIN`, `SEB_LINK_SECRET`, and `SEB_PRE_DOWNLOAD_MINUTES` were introduced in `feat/seb-01` through `feat/seb-05`.
   - CI workflows had none of these variables, risking runtime failure in enforce mode or SEB routes.
3. **Additive Migration `0004_system_settings`**:
   - Added table `system_settings` for institution-wide SEB configuration and key storage.
   - Must be migrated cleanly via `prisma migrate deploy` before any new application code boots.
4. **Cleanroom Database Name Guard (`_test`)**:
   - `e2e/helpers/cleanroom.ts` (line 44) strictly enforces that the database name must end in `_test`.
   - Legacy `ci.yml` used `POSTGRES_DB: proctornet`, which causes cleanroom initialization to fail with a safety exception. CI database MUST be `proctornet_e2e_test`.
5. **Port Mappings**:
   - Local and docker-compose testing uses port `5434` for Postgres and `6380` for Redis.
   - CI GitHub Actions service containers typically expose default ports `5432` and `6379`. The CI setup must provide `.env.test` pointing to the exact service ports mapped in GitHub Actions.
6. **`node --env-file` Fatal Crash When File is Missing**:
   - Node 22/24 throws an uncatchable fatal startup error if a file passed to `--env-file` does not exist on disk.
   - Running `npm test` without creating `../.env.test` crashes before Vitest or Node test runner even starts. CI steps must generate or copy `.env.test` prior to running test scripts.
7. **Destructive Database Fallbacks (`db push --accept-data-loss`)**:
   - Legacy `deploy-aws.yml` and `backend/Dockerfile` had fallbacks that executed `prisma db push --accept-data-loss` upon migration failure. This is dangerous for production data integrity. Migrations must be verified for drift in CI, and CD must halt safely if migration fails.
8. **Linux Portability & Case Sensitivity**:
   - Checked all 194 source files with `scripts/ci/check-import-casing.js`: **0 casing mismatches detected**.
   - No Windows-specific path separators (`\\`) or `cmd /c` invocations exist in production runtime code. All scripts use cross-platform Node.js APIs or standard POSIX shell commands.
