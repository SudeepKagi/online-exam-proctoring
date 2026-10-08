# CI Fix Log & Diagnostic Ledger

> **Anti-Loop Protocol (§0.2):** Max two attempts per failure class. Record every hypothesis, evidence, and outcome.

---

## Log Entries

### Entry 001: Historical Failing Run 37727595263
* **Date/Time:** 2026-10-08 04:30:11 UTC
* **Workflow:** `ProctorNet CI/CD Pipeline`
* **Trigger:** `push` on `main` (commit `3b2b266`)
* **Job:** `Full Test Suite Execution` (job ID: `113149455315`)
* **Step:** `Run Backend Integration & Security Tests`
* **Command:** `node --test --test-force-exit tests/r2-evidence-invigilator.test.js`
* **Exact Failure:**
  ```text
  not ok 2 - returns invId and oneTimePassword on exam creation and publish, valid until exam end + 24h
  location: 'proctornet/backend/tests/r2-evidence-invigilator.test.js:341:5'
  error:
    Invalid `prisma.authSession.create()` invocation in
    src/modules/auth/tokenService.js:149:30

    data: {
      id: "7eaafba9-ef15-47f7-b24c-bbec6391db33",
      userId: "c92c5cc8-8642-4ad0-8dcf-8f7aeeae00b7",
      role: "INVIGILATOR",
            ~~~~~~~~~~~~~
    }
    Invalid value for argument `role`. Expected Role.
  ```
* **Root Cause Class:** `CI-A` (fail-fast shell masking failures) & `Schema-Drift` (Prisma schema enum `Role` in commit `3b2b266` lacked `INVIGILATOR`, while `tokenService.js` persisted `INVIGILATOR`).
* **Status:** Resolved in commit `9407731` (`fix(schema): add INVIGILATOR to Role enum`), but exposed the next failure class in line.

---

### Entry 002: Run 37763533024
* **Date/Time:** 2026-10-08 10:27:26 UTC
* **Workflow:** `ProctorNet CI/CD Pipeline`
* **Trigger:** `push` on `main` (commit `d44583c`)
* **Job:** `Lint & Architecture Gates` (job ID: `113149455315`)
* **Step:** `Backend Lint`
* **Command:** `npm run lint --prefix proctornet/backend`
* **Exact Failure:**
  ```text
  /home/runner/work/online-exam-proctoring/online-exam-proctoring/proctornet/backend/src/app.js
    192:18  error  Forbidden comparison with role string literal. Use canonical ROLES from src/shared/roles.js instead  no-restricted-syntax
    193:18  error  Forbidden comparison with role string literal. Use canonical ROLES from src/shared/roles.js instead  no-restricted-syntax
    193:38  error  Forbidden comparison with role string literal. Use canonical ROLES from src/shared/roles.js instead  no-restricted-syntax
    194:18  error  Forbidden comparison with role string literal. Use canonical ROLES from src/shared/roles.js instead  no-restricted-syntax
  ✖ 47 problems (4 errors, 43 warnings)
  ```
* **Root Cause Class:** `Lint-Rule Violation` (Custom AST rule `no-restricted-syntax` forbids literal role string comparisons like `'invigilator'`, `'student'`, `'faculty'`; requires `ROLES.INVIGILATOR` from `src/shared/roles.js`).
* **Status:** Resolved in Phase C1 (`app.js:192-194` converted to canonical `ROLES.*` constants).

---

### Entry 003: Phase C1 Honest & Safe Tests Verification
* **Date/Time:** 2026-10-08 11:45:00 UTC
* **Workflow / Test Run:** Clean-Room Autodiscovery Test Suite (`node scripts/ci/run-tests.js`)
* **Branch:** `feature/c1-honest-safe-tests`
* **Test Inventory:** 57 tests autodiscovered across root (`tests/`), backend (`proctornet/backend/tests/`), and device agent (`proctornet/device-agent/test/`). Zero active exclusions in `tests/EXCLUDED.md`.
* **Discovered Issues & Resolutions:**
  1. **Test DB Safety Guard (C1.1):** Enforced in `tests/helpers/env.js` and `proctornet/backend/tests/helpers/env.js`. Blocks any run targeting non-test database with exit code 2.
  2. **Deterministic Releases Overwrite Bug (C1.2):** `tests/helpers/seed.js` upserted multiple releases against `@@unique([version, os, arch])` with identical keys, overwriting `test-build-hash-a1` with subsequent hashes. Resolved by assigning unique arch descriptors (`x64-lifecycle`, `x64-sweeper`) and UUID primary keys.
  3. **Open TCP Handles & Keepalive Leaks (C1.4):**
     - S3 `@smithy/node-http-handler` keepalive socket pools cleanly destroyed via `s3Client.destroy()`.
     - Redis `client` and `subClient` cleanly disconnected via `disconnect(false)`.
     - Socket.IO Redis adapter (`socket.server.js`) and worker emitter (`emitter.js`) error handlers added and hooked into `lifecycle.closeAll()`.
     - All `process.exit(0)` calls removed across tests.
  4. **Autodiscovery Runner (C1.6 / C1.7):** Replaced hardcoded lists in `.github/workflows/ci.yml` and `package.json` with `node scripts/ci/run-tests.js`.
* **Outcome:** **57 passed, 0 failed (100% pass rate)** in clean-room replica with zero hanging handles or unhandled rejections.

---

### Entry 004: Phase C2 Hermetic Environment & Configuration Verification
* **Date/Time:** 2026-10-08 11:50:00 UTC
* **Workflow / Test Run:** Clean-Room Autodiscovery Test Suite (`node scripts/ci/run-tests.js`)
* **Branch:** `feature/c2-hermetic-environment`
* **Test Inventory:** 58 tests autodiscovered. Added `tests/hermetic_environment.test.js`. Zero active exclusions.
* **Discovered Issues & Resolutions:**
  1. **Production Fake Secret Fallback Elimination:** In `src/shared/config.js`, removed hardcoded default bucket fallback `'proctornet-evidence'` in non-test environments. In production, missing `S3_BUCKET` or `JWT_SECRET` triggers fail-closed startup halt via `validateConfig.js`.
  2. **Zero `cp .env.example .env` in CI:** Verified that all CI workflows run hermetically using explicit environment variables without creating or copying `.env` files.
  3. **OIDC & IAM Instance Role Invariants:** Verified that in `IS_PROD` mode, AWS clients never use static keys, relying exclusively on IAM instance roles / OIDC.
  4. **Hermetic Test Gate:** Created `tests/hermetic_environment.test.js` covering all 5 core integrity rules (JWT secret length/rejection, absence of dummy fallbacks, fail-closed cookies, S3 IAM enforcement, zero `.env.example` copying).
* **Outcome:** **58 passed, 0 failed (100% pass rate)**.


