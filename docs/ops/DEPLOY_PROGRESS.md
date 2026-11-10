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
| **Phase 2: Hardening Audit** | Production cookies/CORS/CSP, NAT rate-limits, Docker health/rotation, DB pool, OIDC | PENDING | Security hardening, load readiness, zero high/critical vulnerabilities |
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

