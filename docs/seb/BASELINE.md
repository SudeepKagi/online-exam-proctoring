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
- **Cleanroom Wipe Guard Added:** `resetCleanRoom` in `e2e/helpers/cleanroom.ts` validates that the target database ends strictly with `_test`, aborting if pointed at a development or production database.
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

## 2. Test Execution Results (100% Pass)

### A. Backend Unit & Integration Suite (`npm test --workspace=backend`)
- **Status:** **PASS** (100%)
- **Suites:** 20 passed, 0 failed
- **Tests:** 87 passed, 0 failed
- **Duration:** 12.3s
- **Verified Suites:**
  1. `assertNonProduction Guard` (classification of local vs remote databases)
  2. `Onboarding Password Persistence & Authentication Flow`
  3. `Baseline Review Tasks Verification Suite` (Task 2.1 Mass Assignment, Task 4 Cleanroom Wipe Safety, Task C Cache TTL Configuration, Task B Draft Exam Guard and Cache Invalidation)
  4. `Clean Architecture — Domain & Primitives Verification`
  5. `High-Concurrency Load & Security Penetration Test Suite` (100 concurrent starts, 200 batch autosaves, 20 double-submits)
  6. `Phase G — Complete End-to-End Lifecycle & Failure Matrix`
  7. `Exam Creation Input & Schedule Window Validation Regression Suite` (6 regression tests)
  8. `Live Proctoring Pipeline — State Machine & Terminal Immutability`
  9. `Live Proctoring Pipeline — Authorization & Scoping Guardrails`
  10. `P5 Client-Side Compression & EXIF Stripping Verification`
  11. `P6 Frontend AutosaveManager & ServerClock Unit Tests`
  12. `R3 — Snapshot Cadence State Machine`
  13. `R3 — Snapshot Rate Limit`
  14. `R3 — S3 Live Snapshot Key Construction`
  15. `R3 — Next-delay scheduling`
  16. `R3 — PresignService integration`

### B. Playwright E2E Suite (`npx playwright test`)
- **Spec Files:** 10 files
- **Total Tests:** 51 tests
- **Status:** **PASS** (51 passed, 0 failed)
- **Verified Spec Files (10/10 verbatim from `npx playwright test --list`):**
  1. `e2e/auth-onboarding.spec.ts` (4 tests)
  2. `e2e/exam-authoring.spec.ts` (1 test)
  3. `e2e/invigilator-ops.spec.ts` (1 test)
  4. `e2e/phase2-human-flows.spec.ts` (3 tests)
  5. `e2e/phase3-exam-invariants.spec.ts` (10 tests)
  6. `e2e/phase4-design-audit.spec.ts` (6 tests)
  7. `e2e/phase5-red-team.spec.ts` (15 tests)
  8. `e2e/phase6-lifecycle-edge-cases.spec.ts` (7 tests)
  9. `e2e/production-bugs-regression.spec.ts` (2 tests)
  10. `e2e/student-attempt.spec.ts` (2 tests)

### C. Frontend Production Build (`npm run build --workspace=frontend`)
- **Status:** **PASS** (0 errors)
- **Transform:** 2,186 modules transformed cleanly via Vite

---

## 3. Root Cause Analysis & Resolved Bugs

During the stabilization of `fix/baseline-01`, two genuine application bugs and three test authoring issues were identified and resolved without compromising domain invariants:

### 1. `POST /api/v1/exams` Date Validation (Real Backend Bug — Commit `693f024`)
- **Symptom:** Submitting malformed date strings or invalid scheduling parameters produced unhandled Prisma rejections returning `500 Internal Server Error`.
- **Fix:** Added strict pre-database validation in `exams.service.js` verifying that `startTime` and `endTime` are present and valid Dates, `endTime > startTime`, `durationMinutes > 0`, and `durationMinutes <= window`. Added 6 regression tests in `backend/tests/exam-creation-validation.test.js`.

### 2. `publishExam` Silent No-Op Status Update (Real Backend Bug — Commit `4bae652`)
- **Symptom:** Calling `publishExam(id)` called `examsSql.updateExam(id, { status: 'PUBLISHED' })`, but `updateExam` in `backend/src/modules/exams/exams.sql.js` omitted `status` from its update field mapping. Consequently, the database retained `status = 'DRAFT'`.
- **Fix:** Added `if (data.status !== undefined) updateData.status = String(data.status).toUpperCase()` to `updateExam`.

### 3. MediaStream Teardown on StrictMode Arena Mount (Real Frontend Bug — Commit `ea551f9`)
- **Symptom:** In `ExamArenaPage.jsx`, the initialization `useEffect` cleanup hook invoked `clearScreenStream()` and `clearCameraStream()`. In React 18 / development mode, StrictMode unmounts and remounts components on initial render, causing the active MediaStream tracks to be stopped and cleared before the exam started.
- **Fix:** Removed stream clearing from the `initArena` cleanup; streams are cleanly cleared upon explicit exam completion or termination.

### 4. Test Fixtures & Route Alignments (Test Setup Fixes — Commit `30f72b3`, `6417e41`, `32c4249`)
- Added `setExamScheduleDates` test-only database helper in `e2e/helpers/cleanroom.ts` to allow testing already-started and ended states while maintaining backend public API window validation (`START_TIME_IN_PAST`).
- Added missing `deleteRaw` method to `ApiReadHelper` in `e2e/helpers/api.ts`.
- Updated test locators to standard component testids (`data-testid="suspended-overlay"`, `data-testid="proctoring-interrupted-overlay"`).
- Corrected route mismatches (`/faculty/exams/:id` instead of `/faculty/exams/:id/manage`).

---

## 4. Dependency & Vulnerability Audit

### A. `face-api.js` (Removed — Commit `f33e70d` & `30f72b3`)
- **Usage Audit:** Audited `frontend/src/**`, `public/**`, `index.html`, and dynamic imports. 0 application references found.
- **Action:** Removed `"face-api.js"` from `frontend/package.json` and chunk splitting config in `vite.config.js`. Cleared 2 high-severity vulnerabilities (`node-fetch` CVEs).

### B. `xlsx` (Removed — Commit `e2dddc9`)
- **Usage Audit:** Confirmed 0 imports across frontend and backend application code. Bulk Excel parsing uses `exceljs`.
- **Action:** Removed `"xlsx"` from `frontend/package.json` and `frontend/vite.config.js`. Cleared the high-severity Prototype Pollution & ReDoS advisory.

### C. Vulnerability Summary (`npm audit`)
- **Critical Severity:** 0
- **High Severity:** 0
- **Moderate Severity:** 8 (All in dev dependencies: `minimatch` under `eslint`/`nodemon`, and `uuid` under `exceljs`/`node-cron`; resolution requires major version upgrades which are deliberately deferred per project rules).

---

## 5. Summary & Next Steps
Baseline stabilization is complete. All 87 backend unit/integration tests and all 51 Playwright E2E browser tests pass with 100% reliability. The branch `fix/baseline-01` is stable and ready for user review. No `feat/seb-*` branch has been created.
