# ProctorNet CI/CD Pipeline Reference & Operational Runbook

This documentation details the CI/CD architecture, job specifications, local reproduction commands, failure debugging steps, and rollback procedures for ProctorNet.

---

## 1. CI Workflow Overview (`.github/workflows/ci.yml`)

The CI workflow triggers on pushes and pull requests against `main` (and feature/pilot branches). It enforces quality gates across six independent or chained jobs:

```
                  ┌───────────────────────────────┐
                  │ 1. lint-typecheck-build       │
                  └───────────────┬───────────────┘
                                  │
          ┌───────────────────────┴───────────────────────┐
          │                                               │
          ▼                                               ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│ 2. migration-drift            │               │ 3. backend-tests              │
└───────────────────────────────┘               └───────────────┬───────────────┘
                                                                │
                                        ┌───────────────────────┴───────────────────────┐
                                        │                                               │
                                        ▼                                               ▼
                              ┌───────────────────────────────┐               ┌───────────────────────────────┐
                              │ 4. e2e (Playwright)           │               │ 5. seb-smoke                  │
                              └───────────────────────────────┘               └───────────────────────────────┘

┌───────────────────────────────┐
│ 6. security (scans & hygiene) │  (runs independently)
└───────────────────────────────┘
```

---

### Job Details & Local Reproduction

### Job 1: `lint-typecheck-build`
* **What it does**:
  1. Checks case sensitivity across all imported files (`scripts/ci/check-import-casing.js`).
  2. Runs ESLint across frontend and backend workspaces.
  3. Runs TypeScript type-checking (`tsc -p jsconfig.json --noEmit`).
  4. Generates the Prisma client.
  5. Compiles the production frontend SPA bundle with Vite.
* **Local Reproduction**:
  ```bash
  node scripts/ci/check-import-casing.js
  npm run lint
  npm run typecheck
  npx prisma generate --schema=backend/prisma/schema.prisma
  npm run build
  ```

### Job 2: `migration-drift`
* **What it does**:
  Runs `npx prisma migrate deploy` on a fresh ephemeral database, then runs `prisma migrate diff` comparing `--from-schema-datasource` against `--to-schema-datamodel` with `--exit-code`. If any uncommitted schema change or migration mismatch exists, it fails with an exit code of 2.
* **Local Reproduction**:
  ```bash
  # Ensure test Postgres is running
  export DATABASE_URL="postgresql://proctornet:your_pass@127.0.0.1:5434/proctornet_e2e_test?schema=public"
  npx prisma migrate deploy --schema=backend/prisma/schema.prisma
  npx prisma migrate diff --from-schema-datasource backend/prisma/schema.prisma --to-schema-datamodel backend/prisma/schema.prisma --exit-code
  ```

### Job 3: `backend-tests`
* **What it does**:
  1. Boots ephemeral PostgreSQL 16 and Redis 7 containers.
  2. Generates `.env.test` using throwaway CI credentials ($\ge 32$ chars).
  3. Deploys Prisma migrations and runs `prisma/seed/admin.js`.
  4. Executes the native Node test runner across all backend tests (`backend/tests/*.test.js`).
* **Local Reproduction**:
  ```bash
  # Ensure docker-compose test containers are running (ports 5434 and 6380)
  npm test --workspace=backend
  ```

### Job 4: `e2e` (Playwright)
* **What it does**:
  1. Runs after `backend-tests`.
  2. Provisions `.env.test` and seeds baseline accounts.
  3. Installs Playwright Chromium browser and system dependencies.
  4. Executes all 56 end-to-end journey specs.
  5. On failure, captures and uploads Playwright trace artifacts and HTML reports.
* **Local Reproduction**:
  ```bash
  npx playwright test
  ```

### Job 5: `seb-smoke`
* **What it does**:
  1. Provisions test environment with `SEB_MODE=enforce` and a known test SEB Config Key (`a1b2c3d4...`).
  2. Seeds an exam requiring Safe Exam Browser.
  3. Boots the backend in enforce mode.
  4. Sends an attempt start request without SEB header; asserts **HTTP 403 `SEB_REQUIRED`**.
  5. Computes the canonical hash (`sha256(canonicalUrl + key)`).
  6. Sends the request with header `X-SafeExamBrowser-ConfigKeyHash`; asserts **HTTP 200 OK**.
* **Local Reproduction**:
  ```bash
  node scripts/ci/seb-smoke-check.js
  ```

### Job 6: `security`
* **What it does**:
  1. Asserts zero `.env` or sensitive credential files are tracked in Git.
  2. Runs `npm audit --audit-level=high` for dependency vulnerability scanning.
  3. Executes `gitleaks` secret detection.
* **Local Reproduction**:
  ```bash
  # Check tracked env files
  git ls-files | grep -E '(^|/)\.env($|\..*)' | grep -v '\.example'
  npm audit --audit-level=high
  ```

---

## 2. CD Workflows Overview

### Staging Deployment (`.github/workflows/cd-staging.yml`)
* **Trigger**: Automatic on push to `main` branch (or manual dispatch).
* **Target**: Staging environment (`staging.proctornet.duckdns.org`).
* **Flow**:
  1. Builds multi-stage Docker images for backend and frontend.
  2. Pushes container images to GitHub Container Registry (`ghcr.io/repository/backend:<SHA>` and `:staging`).
  3. Dispatches deployment command to AWS EC2 instance.
  4. Stores current tag in `/opt/proctornet-staging/ACTIVE_TAG`.
  5. Runs `prisma migrate deploy` before switching containers.
  6. Replaces containers via Docker Compose.
  7. Probes `http://127.0.0.1:5001/healthz`.
  8. **Automatic Rollback**: If healthcheck probe fails within 60s, automatically restarts previous tag from `ACTIVE_TAG`.

### Production Deployment (`.github/workflows/cd-production.yml`)
* **Trigger**: Manual `workflow_dispatch` ONLY.
* **Protection Gate**: Requires manual reviewer approval via GitHub Environment Protection Rules.
* **Target**: Production environment (`proctornet.duckdns.org`).
* **Flow**:
  1. Resolves release tag (defaults to commit SHA).
  2. Builds and publishes multi-stage container images to GHCR.
  3. Connects to EC2 host via AWS SSM Session Manager.
  4. Records existing active tag in `/opt/proctornet/ACTIVE_TAG`.
  5. Runs `npx prisma migrate deploy` in a temporary container before starting the new version.
  6. Replaces containers with new release images.
  7. Probes `http://127.0.0.1:5000/healthz`.
  8. **Automatic Rollback**: If healthcheck probe fails within 75s, immediately restores previous tag from `ACTIVE_TAG` and restarts services.

---

## 3. Failure Debugging & Remediation

| Failure Mode | Symptoms | Resolution Steps |
| :--- | :--- | :--- |
| **Lint / Typecheck Failure** | `npm run typecheck` or `eslint` exits with code 1 | Inspect terminal output for specific file/line; fix type definitions in `src/` or `jsconfig.json`. |
| **Migration Drift** | `prisma migrate diff` exits with code 2 | An edit was made to `schema.prisma` without running `npx prisma migrate dev --name <migration>`. Generate migration and commit it. |
| **Backend Test Timeout** | Test runner hangs or fails with connection refused | Check that Postgres (5432) and Redis (6379) service containers are healthy. Ensure `.env.test` was generated correctly. |
| **Cleanroom Database Name Refusal** | Error: `Target database name must end in '_test'` | Ensure `DATABASE_URL` ends in `_test` (e.g. `proctornet_e2e_test`). Cleanroom refuses to operate on non-test DBs. |
| **SEB Smoke 403 / Hash Mismatch** | `Expected HTTP 200, got 403` in smoke check | Ensure `PUBLIC_ORIGIN` matches canonical request URL exactly (no trailing slash, correct scheme/port). |
| **Playwright E2E Failure** | Journey fails or timeout occurs | Download the `playwright-e2e-artifacts` zip from GitHub Actions run. Open trace in trace viewer: `npx playwright show-trace path/to/trace.zip`. |

---

## 4. Manual Rollback Procedures

If an issue occurs after a deployment has successfully completed:

### Quick Rollback via CD Workflow Dispatch
1. Open GitHub Actions -> **CD — Deploy to Production (Manual Approval)**.
2. Click **Run workflow**.
3. In the `release_tag` input field, enter the SHA or tag of the previous known-healthy release.
4. Approve the environment deployment prompt.

### Direct Host Rollback via AWS SSM / Terminal
1. Log in to the server via AWS SSM Session Manager or SSH.
2. Inspect the previous tags:
   ```bash
   cat /opt/proctornet/ACTIVE_TAG
   docker images | grep proctornet
   ```
3. Roll back Docker Compose to the previous image tag:
   ```bash
   cd /opt/proctornet
   export IMAGE_TAG="<PREVIOUS_KNOWN_GOOD_SHA>"
   docker compose up -d --remove-orphans
   ```
4. Verify health status:
   ```bash
   curl -I http://127.0.0.1:5000/healthz
   ```
