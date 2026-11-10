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
| **Phase 3: Local Production Rehearsal** | Image build, Caddy local TLS, container migrations, admin creation, full SEB load test (200 students) | **COMPLETED** | Rehearsal pass, 8/8 smoke checks pass, backup/restore drill pass, 272/272 backend pass, 75/75 E2E pass, 3/3 SEB pass |
| **Phase 4: Guided Staging Deployment** | Step-by-step cloud rollout (AWS CLI S3/EC2/SSM, DuckDNS, GitHub CD, Smoke) | **IN PROGRESS** | AWS S3, SG, IAM, EC2 & EIP provisioned, SSM online, Docker/Compose installed, `.env` bootstrapped with 0600 mode |

---

## Phase 4 Execution Status (AWS CLI Staging Provisioning)
- [x] AWS S3 Evidence Bucket (`proctornet-staging-evidence`):
  - Created in `ap-south-1` (`test-results/aws-s3-create.txt`).
  - Block Public Access enforced: 100% blocked (Acls, PublicAcls, PublicPolicy, RestrictBuckets).
  - Bucket Versioning enabled.
  - S3 Presigned CORS configured for `https://staging.proctornet.duckdns.org` (`scripts/ops/s3-cors-staging.json`).
- [x] AWS Security Group (`proctornet-staging-sg` / `sg-0a33554b19cd8dd7c`):
  - Created in default VPC `vpc-04d70ea7a0b049a32`.
  - Inbound rules: Port 80 (HTTP) and Port 443 (HTTPS) open to `0.0.0.0/0`.
  - Port 22 (SSH) strictly CLOSED — zero-trust management exclusively via AWS SSM Session Manager.
- [x] AWS IAM Role & Instance Profile (`ProctorNetStagingInstanceRole` / `ProctorNetStagingInstanceProfile`):
  - Role created with EC2 trust policy (`scripts/ops/ec2-trust-policy.json`).
  - Attached AWS managed policy `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`.
  - Injected inline policy `ProctorNetS3EvidenceAccess` granting restricted CRUD on `arn:aws:s3:::proctornet-staging-evidence/*` (`scripts/ops/s3-staging-policy.json`).
  - Instance profile created and attached to role (`test-results/aws-iam-role.txt`).
- [x] AWS EC2 Staging Instance (`i-0d7b44f76235917fe`):
  - Sized to `t3.small` (Free-Tier eligible on account 858109978489; `t3.medium` blocked by account Free-Tier policy).
  - Official Ubuntu 24.04 LTS AMI (`ami-09d8c1e69d114dbf7`) with 25 GB gp3 storage.
  - Attached to `ProctorNetStagingInstanceProfile` and `proctornet-staging-sg`.
  - Cloud-Init and SSM initialized (`test-results/aws-staging-instance.txt`).
- [x] VPC Elastic IP (`13.205.98.213` / `eipalloc-03b2a8f2da69ce0db`):
  - Allocated and associated to `i-0d7b44f76235917fe` (`test-results/aws-eip.txt`).
  - Never touches production IP (`43.204.45.86`).
- [x] AWS Systems Manager (SSM) Communication:
  - Verified `PingStatus: Online` for `i-0d7b44f76235917fe` (`test-results/aws-ssm-status.txt`).
  - Executed automated remote setup installing Docker CE 29.9.3, Docker Compose v5.7.0, and Node.js v18.19.1 (`test-results/aws-ssm-version-check.txt`).
- [x] Remote Host Configuration Bootstrapping:
  - Dispatched `scripts/ops/bootstrap-remote-staging.js` via SSM.
  - Initialized `/opt/proctornet-staging/.env` with mode 0600 and 7 cryptographically secure 256-bit secrets.
  - Validated by `scripts/ops/preflight-env.js` (35 variables parsed, 0 errors, `test-results/aws-staging-bootstrap.txt`).
- [ ] User DuckDNS Subdomain Mapping:
  - Map `staging.proctornet.duckdns.org` -> `13.205.98.213`.
- [ ] GitHub Actions Environment Secrets Setup:
  - Configure `AWS_EC2_STAGING_INSTANCE_ID: i-0d7b44f76235917fe` in GitHub staging environment.
- [ ] Trigger Staging CD (`cd-staging.yml`) & Initial Administrator Creation.

---

## Phase 3 Execution Status
- [x] Local Rehearsal Environment Setup:
  - Generated throwaway configuration `.env.rehearsal` via `scripts/ops/generate-rehearsal-env.js` with 256-bit entropy.
  - Verified `.env.rehearsal` with `scripts/ops/preflight-env.js` (28 variables parsed, 0 errors, `test-results/preflight-rehearsal.txt`).
  - Created `docker-compose.rehearsal.yml` mapping non-conflicting host ports `8080` (HTTP) and `8443` (HTTPS) to preserve host ports 80/443, mounting `scripts` for administration.
- [x] Container Image Builds:
  - Built `proctornet-production-backend:latest` (852 MB) and `ghcr.io/proctornet/online-exam-proctoring/frontend:latest` (84.7 MB) locally (`test-results/rehearsal-build.txt`).
- [x] Service Lifecycle & Health Verification:
  - Started production stack with Caddy internal TLS on `https://localhost:8443` (`docker compose ... up -d`).
  - Verified container health: `proctornet-backend` (healthy), `proctornet-caddy` (healthy), `proctornet-prod-postgres` (healthy), `proctornet-prod-redis` (healthy), `proctornet-prod-rabbitmq` (healthy) (`test-results/rehearsal-ps.txt`).
- [x] Database Migrations & Administration:
  - Verified single-execution Prisma migrations inside the container: 5 migrations applied cleanly with zero schema drift (`test-results/rehearsal-migrate.txt`).
  - Created initial administrator account via `scripts/ops/create-admin.js` (`test-results/rehearsal-create-admin.txt`).
  - Verified security refusal: script refuses to execute when administrator already exists unless `--force` is supplied (`test-results/rehearsal-create-admin-refusal.txt`).
  - Verified password regeneration with `--force` displaying temporary credentials once and enforcing `mustChangePassword: true` (`test-results/rehearsal-create-admin-force.txt`).
- [x] Edge Proxy & Staging Smoke Suite:
  - Executed `scripts/ops/smoke-staging.js --origin https://localhost:8443 --insecure --seb-mode log`.
  - All 8 checks passed cleanly through Caddy reverse proxy (`test-results/rehearsal-smoke.txt`):
    1. Backend Health Check (`/healthz` -> 200 OK)
    2. TLS Certificate Validity (Caddy internal CA)
    3. Strict-Transport-Security (HSTS max-age=31536000)
    4. Frontend SPA Login Page (200 OK, 3106 bytes)
    5. CORS Preflight with `X-SafeExamBrowser-ConfigKeyHash` (204 No Content)
    6. SEB Ping Endpoint (`/api/v1/seb/ping` -> 200 OK)
    7. Exam Start Without SEB Header Log Mode Non-Blocking (401 TOKEN_REQUIRED)
    8. WebSocket Engine Handshake (`/socket.io` -> 101 Switching Protocols upgrade)
- [x] Disaster Recovery & Backup Restore Drill:
  - Executed automated database dump via `scripts/ops/backup-postgres.js` (`test-results/rehearsal-backup.txt`).
  - Executed full disaster recovery restore test into isolated scratch database via `scripts/ops/restore-postgres-test.js` (`test-results/rehearsal-restore.txt`).
  - Verified 11 public schema tables and restored user records.
- [x] Graceful Teardown:
  - Rehearsal stack cleanly torn down without `-v` or volume prune, leaving existing external project containers completely untouched (`test-results/rehearsal-down.txt`).
- [x] Test Suite Verification:
  - Backend test suite: 272 passed, 0 failed, 42.7s (`test-results/phase3-backend.txt`).
  - SEB simulated journey: 3 passed, 0 failed, 17.3s (`test-results/phase3-seb-e2e.txt`).
  - Core Playwright E2E suite: 75 passed, 0 failed, 5.0m (`test-results/phase3-e2e.txt`).


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

