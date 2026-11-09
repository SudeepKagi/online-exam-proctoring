# ProctorNet Deployment & Release Progress Tracker

## Deployment Target
- **Target Branch:** `release/rc1`
- **Release Version:** `v0.9.0-rc1`
- **Environment Focus:** Staging instance (New dedicated EC2 instance & subdomain, never touching live production)

---

## Phases Overview

| Phase | Description | Status | Verification & Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 0: Baseline Verification** | Fresh test runs, SEB journey, release pipeline, middleware audit, privacy verification, gitleaks | **IN PROGRESS** | `backend-test`, `e2e-test`, `seb-simulated-test`, `release:check`, gitleaks pass |
| **Phase 1: Variables & Configuration** | Complete process.env/import.meta/compose audit, `VARIABLES.md`, `.env.*.example`, `init-env.js` | PENDING | Comprehensive audit, generator script, missing values check |
| **Phase 2: Hardening Audit** | Production cookies/CORS/CSP, NAT rate-limits, Docker health/rotation, DB pool, OIDC | PENDING | Security hardening, load readiness, zero high/critical vulnerabilities |
| **Phase 3: Local Production Rehearsal** | Image build, Caddy local TLS, container migrations, admin creation, full SEB load test (200 students) | PENDING | Rehearsal pass, metrics recorded, backup/restore drill |
| **Phase 4: Guided Staging Deployment** | Step-by-step interactive cloud rollout (GitHub, AWS, DNS, SSM, Caddy, SEB pilot) | PENDING | Interactive execution with rollbacks and kill switches verified |

---

## Phase 0 Execution Status
- [x] Branch `release/rc1` created from HEAD.
- [x] SEB middleware audit: `backend/src/middleware/seb.js` verified as active wired middleware; zero dead files in `backend/src/middleware/`.
- [x] Privacy & Biometrics audit: `faceDescriptor` confirmed 0 matches in code/schema; `docs/privacy/DATA_MAP.md` updated; `utils/crypto.js` confirmed "available, unused".
- [x] Secrets & Gitignore audit: 0 tracked `.env` files; `.gitleaks.toml` updated with SEB test fixture key; `gitleaks` clean on `main..HEAD` (0 leaks).
- [ ] Fresh verification runs:
  - Backend test suite -> `test-results/phase0-backend.txt`
  - Playwright E2E suite -> `test-results/phase0-e2e.txt`
  - SEB simulated journey -> `test-results/phase0-seb-e2e.txt`
  - Release check pipeline -> `test-results/phase0-release-check.txt`
