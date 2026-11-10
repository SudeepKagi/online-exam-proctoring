# ProctorNet Deployment & Release Progress Tracker

## Deployment Target
- **Target Branch:** `release/rc1`
- **Release Version:** `v0.9.0-rc1`
- **Environment Focus:** Staging instance (New dedicated EC2 instance & subdomain, never touching live production)

---

## Phases Overview

| Phase | Description | Status | Verification & Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 0: Baseline Verification** | Fresh test runs, SEB journey, release pipeline, middleware audit, privacy verification, gitleaks | **COMPLETED** | `backend-test` (257/257 pass), `e2e-test` (75/75 pass), `seb-simulated-test` (3/3 pass), `release:check` (7/7 pass), gitleaks pass (0 leaks) |
| **Phase 1: Variables & Configuration** | Complete process.env/import.meta/compose audit, `VARIABLES.md`, `.env.*.example`, `init-env.js` | **COMPLETED** | Comprehensive audit, generator script, missing values check, 264/264 backend tests pass |
| **Phase 2: Hardening Audit** | Production cookies/CORS/CSP, NAT rate-limits, Docker health/rotation, DB pool, OIDC | **COMPLETED** | Security hardening, load readiness, zero high/critical vulnerabilities, 272/272 backend tests pass |
| **Phase 3: Local Production Rehearsal** | Image build, Caddy local TLS, container migrations, admin creation, full SEB load test (200 students) | PENDING | Rehearsal pass, metrics recorded, backup/restore drill |
| **Phase 4: Guided Staging Deployment** | Step-by-step interactive cloud rollout (GitHub, AWS, DNS, SSM, Caddy, SEB pilot) | PENDING | Interactive execution with rollbacks and kill switches verified |

---

## Phase 0 Execution Status
- [x] Branch `release/rc1` created from HEAD.
- [x] SEB middleware audit: `backend/src/middleware/seb.js` verified as active wired middleware; zero dead files in `backend/src/middleware/`.
- [x] Privacy & Biometrics audit: `faceDescriptor` confirmed 0 matches in code/schema; `docs/privacy/DATA_MAP.md` updated; `utils/crypto.js` confirmed "available, unused".
- [x] Secrets & Gitignore audit: 0 tracked `.env` files; `.gitleaks.toml` updated with SEB test fixture key; `gitleaks` clean on `main..HEAD` (0 leaks).
- [x] Fresh verification runs:
  - Backend test suite -> `test-results/phase0-backend.txt` (257 passed, 0 failed, 53.1s)
  - Playwright E2E suite -> `test-results/phase0-e2e.txt` (75 passed, 0 failed, 5.1m)
  - SEB simulated journey -> `test-results/phase0-seb-e2e.txt` (3 passed, 0 failed, 13.6s)
  - Release check pipeline -> `test-results/phase0-release-check.txt` (7/7 steps passed, 396.5s)

---

## Phase 1 Execution Status
- [x] Complete environment variable audit: 92 backend `process.env` references, 7 Vite `import.meta.env` references, docker-compose and GitHub Actions secrets/vars analyzed.
- [x] Deliverable `docs/ops/VARIABLES.md` created with 7 exhaustive groups (Group A secrets, Group B host identity & operational policies, Group C AWS cloud credentials, Group D GitHub Actions secrets, Group E GitHub Actions variables, Group F compose build args & internal networking, Group G Vite frontend client variables), exact host paths, validation rules, failure impacts, and non-secret examples.
- [x] Reconciled and cleaned `.env.example`, `backend/.env.example`, `frontend/.env.example`, purging dead/stale legacy variables (`PYTHON_SERVICE_URL`, `COMPREFACE_URL`, `LIVEKIT_API_KEY`, `VPN_SERVER_IP`).
- [x] Created `.env.production.example` and `.env.staging.example`; updated `.gitignore` to track `*.example` files.
- [x] Implemented host bootstrapper `scripts/ops/init-env.js`:
  - Generates 7 cryptographically secure 256-bit secrets using `crypto.randomBytes` without printing them to console.
  - Enforces mode 0600 (owner read/write only).
  - Supports `--staging` for staging DB, staging domain (`staging.proctornet.duckdns.org`), and `SEB_MODE=log`.
  - Flags missing cloud variables (`S3_BUCKET`, etc.) without revealing any secret material.
  - Refuses to overwrite existing files without `--force`.
- [x] Implemented comprehensive unit tests in `backend/tests/init-env.test.js` verifying all 7 invariants.
- [x] Full backend test suite executed: 264 passed, 0 failed, 59.2s (`test-results/phase1-backend.txt`).

---

## Phase 2 Execution Status
- [x] Production runtime hardening:
  - Cookies enforce `Secure=true`, `HttpOnly=true`, `SameSite=lax`, and `path=/` in production mode (`backend/src/utils/cookies.js`).
  - CORS and CSP restrict origins to HTTPS canonical origins (`https://proctornet.duckdns.org`, `PUBLIC_ORIGIN`), wildcard S3 hosts (`https://*.s3.${awsRegion}.amazonaws.com`), and camera access restricted to `camera=(self)` (`backend/src/middleware/security.js`, `ops/caddy/Caddyfile`).
  - Express `trust proxy` configured to exactly 1 hop matching Caddy edge reverse proxy (`backend/src/app.js`).
  - Error envelope guarantees `stack` is never exposed in API responses (`backend/src/shared/errors.js`).
- [x] Campus NAT-resilient Rate Limiting:
  - Keyed by authenticated `req.user.id` for attempts and hot-path student answers (`/api/v1/attempts/*`), so candidates in the same room never exhaust each other's quota (`backend/src/middleware/security.js`).
  - Login endpoints protected by account-keyed `loginLimiter` (`auth_login_<email>`), preventing brute-force attacks against one account without locking out other candidates in the computer lab (`backend/src/modules/auth/auth.routes.js`).
  - Unauthenticated coarse IP rate limit increased to 1500 / 15min and SEB ping limit increased to 1200 / min to accommodate 200+ candidate concurrent computer lab arrivals (`backend/src/modules/seb/seb.routes.js`).
- [x] Container & Infrastructure hardening (`docker-compose.prod.yml`):
  - Standardized JSON-file log rotation (`max-size: "20m"`, `max-file: "5"`) across all services.
  - Defined memory limits and reservations for Caddy (512M/64M), Backend (1536M/256M), Postgres (1024M/256M), Redis (512M/64M), and RabbitMQ (768M/128M).
  - Pinned service image tags to fixed minor/patch versions (`caddy:2.8-alpine`, `postgres:16-alpine`, `redis:7-alpine`, `rabbitmq:3.13-alpine`).
  - Verified non-root user execution (`USER proctornet` in backend, `USER nginx` in frontend).
- [x] Database Connection Pool & Query Timeout:
  - Standardized Prisma pool limit to `connection_limit=20` and connection pool timeout to 20s (`backend/src/infra/postgres/client.js`).
  - Injected `statement_timeout=10000` (10s) on all database sessions to kill runaway queries during exam start surges.
  - Verified idempotent single-execution migrations via container entrypoint and CD deployment steps.
- [x] CI/CD AWS OIDC & EC2 Instance Roles:
  - Switched CD workflows (`cd-staging.yml`, `cd-production.yml`) to GitHub OIDC federation via `aws-actions/configure-aws-credentials` with `role-to-assume`.
  - Documented complete AWS IAM OIDC Trust Policy and EC2 Instance Role in `docs/ci/SECRETS.md`.
- [x] Time, Retention & Monitoring Documentation:
  - Documented host NTP synchronization via `systemd-timesyncd` in `docs/ops/RUNBOOK.md`.
  - Documented S3 lifecycle policies (multipart abort after 7 days, evidence expiration after 90 days, backup transition to Glacier) in `docs/ops/BACKUPS.md`.
  - Documented public health probe `GET https://proctornet.duckdns.org/healthz`, alert thresholds (5xx rate > 1%, disk > 85%, TLS cert < 14 days), and log inspection commands in `docs/ops/RUNBOOK.md`.
- [x] Security Audit: `npm audit --audit-level=high` verified with 0 high and 0 critical vulnerabilities (`test-results/audit-phase2.txt`).
- [x] Automated Test Verification:
  - Added `backend/tests/production-hardening.test.js` (5 tests passing).
  - Added `backend/tests/campus-nat-ratelimit.test.js` (3 tests passing).
  - Full backend test suite executed: 272 passed, 0 failed, 46.2s (`test-results/phase2-backend.txt`).

