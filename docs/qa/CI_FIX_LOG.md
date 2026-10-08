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
* **Status:** Scheduled for correction in Phase C1/C2 (no product code changes permitted during C0).
