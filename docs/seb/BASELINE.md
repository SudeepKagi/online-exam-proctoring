# Baseline Verification Report (`fix/baseline-01`)

**Date:** 2026-11-07  
**Branch:** `fix/baseline-01`  
**Environment:** Local Windows / Docker Desktop (PostgreSQL 16 on port 5433, Redis on port 6379)  
**Database:** `proctornet_e2e_test` (Dedicated test database; 100% isolated from development/production)

---

## 1. Safety Audit: Environment & Database Isolation

Prior to running tests, all `.env*` configurations were audited to ensure zero interaction with remote or production instances:
- **Port Mapping Discovery:** Windows host port `5432` was occupied by an existing local container (`documind-postgres`). The active `proctornet-postgres` container (`77b32eff45fb`) was correctly identified on port **5433** (`0.0.0.0:5433->5432/tcp`).
- **Dedicated Test DB Created:** Created database `proctornet_e2e_test` on `127.0.0.1:5433` owned by `proctornet`.
- **Migrations & Seeds Deployed:**
  - `npx prisma migrate deploy` applied migrations:
    - `0001_core_tables`
    - `0002_user_status_enums`
    - `0003_user_onboarding_fields`
  - `node prisma/seed/admin.js` seeded standard actors:
    - Admin: `admin@proctornet.local`
    - Faculty: `faculty@proctornet.local`
    - Invigilator: `invigilator@proctornet.local`
    - Students: `student1@proctornet.local`, `student2@proctornet.local`
- **Masked Connection Strings:**
  - `DATABASE_URL="postgresql://proctornet:***@127.0.0.1:5433/proctornet_e2e_test?schema=public"`
  - `REDIS_URL="redis://127.0.0.1:6379"`
  - Direct URL / Fallback: `127.0.0.1:5433/proctornet_e2e_test`
- **Confirmation:** All database and cache endpoints point strictly to local loopback (`127.0.0.1`). No remote hosts exist.

---

## 2. Test Execution Results

### A. Backend Unit & Integration Suite (`npm test --workspace=backend`)
- **Status:** **PASS** (100%)
- **Suites:** 14 passed, 0 failed
- **Tests:** 69 passed, 0 failed
- **Duration:** 15.07s
- **Verified Suites:**
  1. `assertNonProduction Guard` (classification of local vs remote databases)
  2. `Onboarding Password Persistence & Authentication Flow`
  3. `Clean Architecture — Domain & Primitives Verification`
  4. `High-Concurrency Load & Security Penetration Test Suite` (100 concurrent starts, 200 batch autosaves, 20 double-submits)
  5. `Phase G — Complete End-to-End Lifecycle & Failure Matrix`
  6. `Live Proctoring Pipeline — State Machine & Terminal Immutability`
  7. `Live Proctoring Pipeline — Authorization & Scoping Guardrails`
  8. `P5 Client-Side Compression & EXIF Stripping Verification`
  9. `P6 Frontend AutosaveManager & ServerClock Unit Tests`
  10. `R3 — Snapshot Cadence State Machine`
  11. `R3 — Snapshot Rate Limit`
  12. `R3 — S3 Live Snapshot Key Construction`
  13. `R3 — Next-delay scheduling`
  14. `R3 — PresignService integration`

### B. Playwright E2E Suite (`npx playwright test`)
- **Total Tests:** 50
- **Passed:** 38 passed
- **Failed:** 5 failed
- **Did Not Run:** 7 (remaining tests halted following failure limit)
- **Duration:** 4.0m

---

## 3. Detailed Failure Classification (5 Failures)

Each failure has been analyzed against the source code, backend server logs, and test assertions:

### Failure 1: `e2e/invigilator-ops.spec.ts:15:7`
- **Symptom:** `expect(student.page.getByText('Examination Session Suspended').first()).toBeVisible({ timeout: 10000 })` timed out.
- **Root Cause (Test Timing / Incomplete Setup):** In setup step (line 32), the test created an exam with `startTime: new Date(now.getTime() - 5 * 60 * 1000)` and called `POST /api/v1/exams/:id/publish`. The backend rejected publishing with `400 START_TIME_IN_PAST` (`"Exam start time cannot be in the past."`). Because publishing failed, the exam remained in `DRAFT` status; the student subsequently joined an un-published exam, leaving socket coordination and live proctoring events out of sync.
- **Classification:** **Test Setup Bug** (interacting with strict backend window validation introduced in commit `ed8e864a`).

### Failure 2: `e2e/phase2-human-flows.spec.ts:66:7`
- **Symptom:** `expect([400, 422]).toContain(invalidRes.status)` received status `500`.
- **Root Cause (Real Backend Bug):**
  When testing input validation with an invalid payload (`durationMinutes: -10`), the backend `POST /api/v1/exams` route attempted:
  ```javascript
  startTime: new Date("Invalid Date")
  ```
  Prisma threw `PrismaClientValidationError: Provided Date object is invalid. Expected Date`. The backend controller lacked Zod/pre-Prisma validation for invalid date objects on this route, bubbling an unhandled error to the central 500 handler instead of returning a 400 Bad Request.
- **Classification:** **Real Backend Bug** (Input validation / Zod middleware omission on `POST /api/v1/exams`).

### Failure 3: `e2e/phase3-exam-invariants.spec.ts:634:7`
- **Symptom:** `expect(futureRes.status).toBe(403)` received `404` (`"Exam not found"` on `/api/v1/attempts/exams/undefined/start`).
- **Root Cause (Test Calculation Bug):**
  The test attempted to create:
  1. A future exam with `startTime = now + 10 min`, `endTime = now + 30 min` (window = 20 mins), but specified `durationMinutes: 30`.
  2. A past exam with `startTime = now - 30 min`, `endTime = now - 5 min` (window = 25 mins), but specified `durationMinutes: 30`.
  The backend strictly enforces that exam duration cannot exceed the scheduled window (`DURATION_EXCEEDS_WINDOW`, 400). As a result, exam creation failed, returning `{ code: 'DURATION_EXCEEDS_WINDOW' }`, leaving `futureId` as `undefined`. Attempting to start `/attempts/exams/undefined/start` therefore yielded 404.
- **Classification:** **Test Author Bug** (duration set to 30m inside a 20m/25m window).

### Failure 4: `e2e/phase6-lifecycle-edge-cases.spec.ts:16:7`
- **Symptom:** `expect([200, 204]).toContain(pubRes.status)` received `400`.
- **Root Cause (Test Setup Bug):**
  To test that an active/started exam cannot be edited, the test set `startTime: new Date(now.getTime() - 120000)` (2 minutes in the past) and then called `POST /api/v1/exams/:id/publish`. Backend `publishExam` in `exams.service.js:78` explicitly forbids publishing an exam whose start time is already in the past (`400 START_TIME_IN_PAST`).
- **Classification:** **Test Setup Bug** (attempting to publish an already-started exam via the public faculty API).

### Failure 5: `e2e/student-attempt.spec.ts:15:7`
- **Symptom:** `expect(pubRes.status).toBe(200)` received `400`.
- **Root Cause (Test Setup Bug):**
  Identical to Failure 4: setup set `startTime: new Date(now.getTime() - 5 * 60 * 1000)` (5 minutes ago) before calling `/publish`. Backend rejected publish with `400 START_TIME_IN_PAST`.
- **Classification:** **Test Setup Bug**.

---

## 4. Dependency & Vulnerability Audit

### A. `face-api.js` (Removed)
- **Usage Audit:** Searched `frontend/src/**`, `public/**`, `index.html`, and dynamic imports.
  - Found **0** imports or references across all frontend application code.
  - Present only in `frontend/package.json` (`^0.22.2`) and as a vendor chunk rule in `frontend/vite.config.js:29` (`v-fa`).
- **Action Taken:**
  - Removed `"face-api.js"` from `frontend/package.json`.
  - Removed chunk mapping from `frontend/vite.config.js`.
  - Ran `npm install`.
- **Verification:**
  - Purged 9 packages including `@tensorflow/tfjs-core` and `node-fetch`.
  - Cleared 2 high-severity vulnerabilities (`node-fetch` CVEs).
  - Frontend production build (`npm run build --workspace=frontend`) compiled successfully (2,186 modules transformed, 0 errors).

### B. `xlsx` (SheetJS) Audit
- **Frontend Usage:**
  - In `frontend/src/`, `xlsx` has **0** imports.
  - It appears solely as a file filter string in `<input type="file" accept=".xlsx,.xls" />` in `ExamQuestionsTab.jsx` and `AdminUsersPage.jsx`.
- **Backend Usage:**
  - Bulk question parsing (`exams.excel.js`) and user import (`users.excel.js`) use **`exceljs`** (`const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer)`).
  - The SheetJS `xlsx` npm package is completely redundant.
- **Action:** Retained without modification for now per instructions; flagged for safe removal once approved.

### C. `npm audit fix` Results
- Executed `npm audit fix` (without `--force`).
- Patched 5 compatible dependency trees.
- **Remaining Vulnerabilities (9 total):**
  - `xlsx` (1 High): Prototype Pollution & ReDoS in SheetJS (no upstream fix on npm; resolved by removing the unused package).
  - `minimatch` (6 Moderate): Nested under `eslint` and `nodemon` (requires breaking upgrade to ESLint 9/10).
  - `uuid` (2 Moderate): Nested under `exceljs` and `node-cron` (requires major version bumps).

---

## 5. Next Steps
1. Commit the baseline verification and `face-api.js` cleanup on `fix/baseline-01`.
2. Await user review and "go" before creating any `feat/seb-*` branch.

