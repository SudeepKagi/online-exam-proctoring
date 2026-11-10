# ProctorNet Enterprise Go-Live Checklist & Verification Protocol

This document governs the mandatory verification gates required before authorizing any live examination on the ProctorNet platform. Every automated check must exit `0`, and all items marked **`[HUMAN REQUIRED]`** must be physically executed, witnessed, and signed off.

---

## 1. Automated Verification Gates

These automated gates are verified locally or in CI prior to any release or deployment.

- [ ] **Sequential Release Check (`npm run release:check`)**
  - **Linting:** ESLint across frontend and backend workspaces (0 errors).
  - **Typecheck:** TypeScript compiler check (`tsc --noEmit`) across all workspaces (0 errors).
  - **Production Build:** Vite production bundle minification, gzip & brotli compression (0 errors).
  - **Backend Test Suite:** All 248 unit and integration tests passing (`npm test --workspace=backend`).
  - **Default E2E Suite:** Playwright end-to-end journey tests passing in default mode.
  - **Security Audit:** `npm audit --audit-level=high` executed and recorded.
  - **Prisma Migration Drift:** `npx prisma migrate status` confirms 0 unapplied or drifted migrations.

- [ ] **Environment Preflight Validation (`scripts/ops/preflight-env.js`)**
  - Command: `node scripts/ops/preflight-env.js /opt/proctornet/shared/.env --prod`
  - Verifies presence of all required variables: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PUBLIC_ORIGIN`, `SEB_MODE`, `REDIS_URL`, `S3_BUCKET`, `AWS_REGION`, `SEB_LINK_SECRET`.
  - Verifies minimum length >= 32 characters for all cryptographic secrets.
  - Verifies zero matches against repository known defaults.
  - Verifies `PUBLIC_ORIGIN` is a bare origin (`https://domain.com` without trailing slash, path, query, or hash).
  - Verifies `SEB_MODE` is strictly `'off'`, `'log'`, or `'enforce'`.
  - Verifies `DATABASE_URL` contains no non-production identifiers (`_test`, `_pilot`, `_dev`, `localhost`, `127.0.0.1`).

- [ ] **Safe Exam Browser Enforce-Mode E2E Simulation**
  - Command: `npx playwright test --config=playwright.seb.config.ts`
  - Validates that a plain browser without `X-SafeExamBrowser-ConfigKeyHash` is blocked with HTTP 403 and routed to the friendly kiosk requirement page.
  - Validates that an incorrect or tampered hash header is rejected with HTTP 403.
  - Validates that a client injecting the dynamically calculated SHA-256 hash can start, autosave answers, and submit cleanly.

- [ ] **Secret Leak Detection (`gitleaks`)**
  - Command: `gitleaks detect --no-git --source . --config .gitleaks.toml`
  - Zero unallowlisted high-entropy strings or private tokens in source code.

---

## 2. Infrastructure & Network Gates

- [ ] **Single Committed Reverse Proxy (Caddy on Host or Compose)**
  - Caddy binds exclusively to ports 80 and 443; backend (`:5000`) and frontend (`:5173`/`:8080`) are not exposed externally.
  - Automatic HTTPS certificate issued and active.
  - HSTS header configured: `Strict-Transport-Security "max-age=31536000; includeSubDomains"` (without `preload` on dynamic/subdomain hosts).
  - WebSocket upgrade proxying active for `/socket.io/*`.
  - Max request body limit configured to `25MB`.

- [ ] **Database & Cache Topology**
  - Production PostgreSQL database using private subnet or host socket.
  - Production Redis running with password protection (`requirepass`).
  - Connection pool limits configured appropriately in `DATABASE_URL` (`connection_limit=20`).

---

## 3. Human Verification Gates (`[HUMAN REQUIRED]`)

The following verification steps **CANNOT** be automated and require human operators to perform on staging or production infrastructure:

### [HUMAN REQUIRED] 1. Real Safe Exam Browser Pilot
- [ ] **Target Device:** Physical Windows 10/11 laptop (not a virtual machine).
- [ ] **Installation:** Official Safe Exam Browser 3.7+ installed.
- [ ] **Configuration Import:** Download and launch the institutional `.seb` configuration file.
- [ ] **Lockdown Verification:**
  - Verify full-screen kiosk window locks the display.
  - Attempt keyboard shortcuts: `Alt + Tab`, `Windows Key`, `Ctrl + Esc`, `Ctrl + Alt + Del`, `PrintScreen`. Confirm all are suppressed.
  - Verify second monitor is disabled or triggers SEB exit block.
- [ ] **Hardware & Auth:**
  - Log in as a student candidate inside SEB.
  - Verify camera preview starts without browser permission prompts.
  - Complete face verification check.
- [ ] **Clean Exit:** Submit exam and verify the 5-second auto-exit cleanly closes SEB or returns to the designated exit URL.

---

### [HUMAN REQUIRED] 2. Database Restore Drill
- [ ] **Backup Execution:** Run the automated backup script:
  ```bash
  bash scripts/ops/backup-postgres.sh
  ```
- [ ] **Archive Verification:** Confirm the `.pgdump` archive is created, non-empty, and encrypted/copied to off-site storage.
- [ ] **Dry-Run Restoration:** Run the test restore script on an isolated database:
  ```bash
  bash scripts/ops/restore-postgres-test.sh /path/to/backup.pgdump
  ```
- [ ] **Validation:** Confirm table counts match production (`users`, `exams`, `questions`, `_prisma_migrations`).

---

### [HUMAN REQUIRED] 3. Class-Size Surge Load Test
- [ ] **Simulation Scale:** 200+ concurrent virtual students using k6:
  ```bash
  k6 run --vus 200 --duration 5m tests/load/exam-lifecycle-seb.k6.js
  ```
- [ ] **Pass Criteria:**
  - `http_req_failed`: `0.00%`
  - `p(95)` request duration: `< 500ms`
  - Backend CPU usage: `< 75%`
  - Zero database deadlocks or Redis connection drops.

---

### [HUMAN REQUIRED] 4. Candidate Cohort Dry Run
- [ ] **Trial Examination:** Publish a 5-question, zero-credit mock quiz 48 hours prior to the real examination.
- [ ] **Student Participation:** Have at least 10–20 students log in from their own computers.
- [ ] **Diagnostic Check:** Verify students complete the "Check your computer" diagnostic:
  - Camera permissions granted.
  - Latency bucket rated Good or Fair.
  - Clock skew verified within 2 minutes.
- [ ] **Privacy Consent:** Verify all participating candidates submit the required Privacy Consent checkbox.
- [ ] **Readiness Review:** Faculty inspects the **Readiness** tab in the Faculty Portal, confirming candidates appear as "Ready".

---

### [HUMAN REQUIRED] 5. Kill-Switch Rehearsal
- [ ] **Context:** If a large student cohort experiences SEB configuration errors, the proctoring team must be able to soften enforcement without restarting the database.
- [ ] **Procedure:**
  1. In the production `.env` file, change:
     ```env
     SEB_MODE=log
     ```
  2. Reload the application process:
     ```bash
     pm2 reload proctornet-backend
     # or
     docker compose exec backend kill -USR2 1
     ```
  3. Verify that standard web browsers can now start the exam while warning logs continue to record hash mismatches.
  4. Restore `SEB_MODE=enforce` once testing completes.

---

### [HUMAN REQUIRED] 6. Live Production Secret Rotation
- [ ] **Generate Fresh Secrets:** Execute on the live server:
  ```bash
  openssl rand -hex 32  # for JWT_SECRET
  openssl rand -hex 32  # for JWT_REFRESH_SECRET
  openssl rand -hex 32  # for SEB_LINK_SECRET
  openssl rand -hex 16  # for DB & Redis passwords
  ```
- [ ] **Apply to `.env`:** Ensure none of the generated values match repository commit history or test files.
- [ ] **Audit Admin Credentials:** Create the primary institution administrator using:
  ```bash
  node scripts/ops/create-admin.js --email=admin@university.edu
  ```
  Note down the single-use temporary password securely; verify forced password change occurs on first login.

---

### [HUMAN REQUIRED] 7. S3 Bucket Policy & Evidence Lifecycle Review
- [ ] **Block Public Access:** Verify all 4 Amazon S3 Block Public Access settings are turned **ON** for `proctornet-storage`.
- [ ] **Encryption:** Confirm default encryption is set to SSE-KMS or SSE-S3.
- [ ] **CORS Rules:** Confirm `AllowedOrigins` strictly lists `PUBLIC_ORIGIN` (e.g. `https://proctornet.university.edu`).
- [ ] **Retention Dry-Run:** Run the retention cleanup tool in dry-run mode:
  ```bash
  node backend/scripts/ops/run-retention-cleanup.js --dry-run
  ```
  Confirm it correctly identifies finalized attempts older than `RETENTION_DAYS` (default 90) and preserves all attempts marked with an active review hold (`isFlagged: true` or `reviewStatus: 'PENDING'`).

---

## 4. Final Sign-Off Matrix

| Role | Name | Signature / Approval | Date |
| :--- | :--- | :--- | :--- |
| **Lead DevOps / System Engineer** | | | |
| **Lead Academic Invigilator** | | | |
| **Chief Information Security Officer (CISO)** | | | |
| **Department Head / Dean** | | | |

