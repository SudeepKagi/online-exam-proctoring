# Phase Q2 Report: Complete Migration, Delete Legacy Layer, Enforce Canonical Roles, and Verify Route Matrix

**Branch:** `fix/q2-delete-legacy-finish-migration`  
**Date:** 2026-10-05  
**Author:** Principal QA & Integration Lead  
**Operating Protocol Reference:** §0.1 (Truth-First), §0.2 (Red-Test First), §0.3 (Claims Ledger), §3 (Q2 Definition of Done)

---

## 1. Executive Summary

Phase Q2 has successfully completed the migration to the canonical modular monolith architecture, eradicated the legacy layer, enforced canonical role invariants, and established an automated route authorization matrix:

1. **Automated Route Inventory & Drift Gate (Q2.1)**:
   - Created `scripts/ci/generate-route-inventory.js` which introspects mounted Express router stacks and middleware reflections.
   - Extracted **175 canonical endpoints** across all 17 domain modules, generating `docs/api/ROUTE_INVENTORY.md` and `docs/api/route-matrix.json`.
   - CI test in `tests/route-matrix.test.js` prevents route drift by failing if any mounted Express route lacks a corresponding documentation entry.

2. **Complete Deletion of Legacy Layer (Q2.2 & Q2.3)**:
   - Completely deleted all 5 legacy directories: `src/controllers/`, `src/routes/`, `src/services/`, `src/sockets/`, and `src/validators/`.
   - Permanently deleted obsolete deployment manifests: `proctornet/render.yaml`, `proctornet/vercel.json`, and `proctornet/docker-compose.yml`.
   - Built CI check `scripts/ci/check-no-legacy.js` asserting zero forbidden directories, files, or tokens (`global.prisma`, `studentExam`, `assignedQuestionIds`, `facePhotoUrl`, `imageUrl`) in `src/`. Verified passing with exit code 0.

3. **Canonical Lowercase Roles & ESLint AST Rule (Q2.4 & D-01)**:
   - Established `src/shared/roles.js` exporting frozen `ROLES = { ADMIN: 'admin', FACULTY: 'faculty', STUDENT: 'student', INVIGILATOR: 'invigilator' }`.
   - Added `normalizeRole(input)` returning canonical lowercase or `null` for unknown roles (fail-closed).
   - Configured ESLint `no-restricted-syntax` AST rule strictly forbidding binary comparisons (`===`, `!==`, `==`, `!=`) against role string literals (`'admin'`, `'faculty'`, `'student'`, `'invigilator'`) across `src/`.
   - Refactored all controllers, services, middleware, and websocket handlers across `src/` to reference `ROLES.*`. Verified with `npm run lint` exiting cleanly with **0 errors**.

4. **Automated Route-Matrix Test Suite (Q2.5)**:
   - Authored `tests/route-matrix.test.js` executing 26 comprehensive integration tests across 7 test suites against the live Express application.
   - Verified the four access pillars: (a) unauthenticated -> 401, (b) wrong role -> 403, (c) wrong owner/exam/attempt -> 403/404, and (d) right owner -> 2xx.
   - 100% of route-matrix tests pass (`pass 26, fail 0`).

5. **Security Defect Resolutions (D-01, D-02, D-03)**:
   - **D-01**: Lowercase role normalization prevents casing bypasses and rejects bogus role tokens with 401.
   - **D-02**: Violation timeline ownership check prevents candidate A from viewing candidate B's proctoring timeline (403 BOLA guard) and restricts invigilators to their assigned exam.
   - **D-03**: Invigilator staff actions (`pause`, `resume`, `terminate`) fail-closed (403 Forbidden) if `examId` is missing or mismatched.

---

## 2. Deliverables & Artifact Inventory

| Component | Path | Description |
|---|---|---|
| **Route Inventory Generator** | `scripts/ci/generate-route-inventory.js` | Automated reflection tool generating `docs/api/ROUTE_INVENTORY.md` from mounted router layers. |
| **Route Inventory Catalog** | `docs/api/ROUTE_INVENTORY.md` | Authoritative documentation of 175 canonical API endpoints with method, auth, role, and owner-checks. |
| **Route Matrix Dataset** | `docs/api/route-matrix.json` | Machine-readable route authorization dataset for CI and automated testing. |
| **Legacy Zero CI Check** | `scripts/ci/check-no-legacy.js` | Static analysis gate verifying deletion of legacy folders and zero forbidden tokens. |
| **Canonical Roles Module** | `proctornet/backend/src/shared/roles.js` | Frozen canonical `ROLES` object and lowercase `normalizeRole()` helper. |
| **ESLint AST Configuration** | `proctornet/backend/eslint.config.mjs` | `no-restricted-syntax` rule barring binary comparisons with role string literals. |
| **Route Matrix Test Suite** | `proctornet/backend/tests/route-matrix.test.js` | 26 automated integration tests validating auth, roles, scoping, D-01, D-02, and D-03. |
| **Claims Ledger Update** | `docs/qa/CLAIMS_LEDGER.md` | Updated DOD-03, Q2-01, Q2-02, Q2-03, Q2-04, BUG-B01, BUG-B02, BUG-B04, BUG-D01, BUG-D02, BUG-D03 to `PASSED`. |
| **Interview Notes Section 13** | `docs/INTERVIEW_NOTES.md` | Comprehensive Q&A on legacy layer eradication, canonical roles, and route matrix authorization. |

---

## 3. Empirical Test Verification Logs

### 3.1 Legacy Zero CI Check (`scripts/ci/check-no-legacy.js`)
* **Command**: `node scripts/ci/check-no-legacy.js`
* **Output**:
  ```text
  🔍 [CI] Checking for forbidden legacy directories...
  🔍 [CI] Checking for forbidden legacy deployment files...
  🔍 [CI] Scanning src/ for forbidden schema & global tokens...

  ✅ Check passed: Zero legacy directories, files, or tokens detected in src/.
  ```
* **Exit Code**: 0

### 3.2 ESLint Canonical Roles Gate (`npm run lint`)
* **Command**: `npm run lint`
* **Output**:
  ```text
  > proctornet-backend@1.0.0 lint
  > eslint src/

  ✖ 43 problems (0 errors, 43 warnings)
  ```
* **Exit Code**: 0 (Zero errors; strictly satisfies `no-restricted-syntax`)

### 3.3 Route Matrix Test Suite Execution (`tests/route-matrix.test.js`)
* **Command**: `node --test --test-force-exit tests/route-matrix.test.js`
* **Output**:
  ```text
  ✔ every mounted Express route has a corresponding entry in ROUTE_INVENTORY.md
  ✔ docs/api/ROUTE_INVENTORY.md is present, non-empty, and has expected headers
  ✔ public endpoints respond without 401
  ✔ protected endpoints reject unauthenticated requests with 401
  ✔ protected endpoints reject requests with invalid/malformed tokens with 401
  ✔ admin-only endpoints reject student with 403 Forbidden
  ✔ admin-only endpoints reject faculty with 403 Forbidden
  ✔ faculty-only endpoints reject student with 403 Forbidden
  ✔ student-only endpoints reject faculty with 403 Forbidden
  ✔ student-only endpoints reject admin with 403 Forbidden
  ✔ student-only endpoints reject invigilator with 403 Forbidden
  ✔ accepts tokens with uppercase or mixed-case role and normalizes to canonical lowercase
  ✔ rejects invalid or unknown role in JWT payload with 401
  ✔ allows student to view their own attempt timeline (200)
  ✔ strictly forbids student from viewing another student attempt timeline (403)
  ✔ allows authorized invigilator to view timeline for attempt in assigned exam (200)
  ✔ strictly forbids invigilator from viewing attempt timeline outside their assigned exam (403)
  ✔ assertStaffExamAccess rejects invigilator with mismatched examId on pauseAttempt (403)
  ✔ assertStaffExamAccess rejects invigilator with mismatched examId on resumeAttempt (403)
  ✔ assertStaffExamAccess rejects invigilator with mismatched examId on terminateAttempt (403)
  ✔ assertStaffExamAccess rejects invigilator without examId (fail-closed) (403)
  ✔ admin can access dashboard (200)
  ✔ faculty can access dashboard (200)
  ✔ student can access profile (200)
  ✔ public health check is accessible without token (200)

  ℹ tests 26
  ℹ suites 7
  ℹ pass 26
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ duration_ms 13102.4793
  ```
* **Exit Code**: 0

### 3.4 Architecture & Anti-Regressive Suite Executions
* `node --test tests/architecture.test.js` -> **6/6 PASS** (confirms modular structure and deleted legacy deployment files).
* `node --test tests/phase_c_remediation.test.js` -> **8/8 PASS** (confirms modular auth, invigilator, and faculty services).
* `node --test tests/services.test.js` -> **5/5 PASS** (confirms modular collusion and biometric services).
* `node --test tests/mcq-validation.test.js` -> **20/20 PASS** (confirms question validation, attempt service, and exam service).
* `node --test tests/timezone-matrix.test.js` -> **3/3 PASS** (confirms UTC default and timestamptz invariance).
* `node --test tests/p9-infrastructure-hardening.test.js` -> **21/21 PASS** (confirms docker compose, nginx, probes, and DB restore).

---

## 4. Defect Remediations Summary (D-01, D-02, D-03)

| Defect ID | Description | Root Cause | Remediated Implementation |
|---|---|---|---|
| **D-01** | Role casing mismatch and unknown role bypass | Inconsistent casing comparisons (`=== 'STUDENT'` vs `=== 'student'`) | `normalizeRole()` normalizes to canonical lowercase (`'admin'`, `'faculty'`, `'student'`, `'invigilator'`) and rejects unrecognized strings with `null` (causing 401). ESLint AST rule bars string literals in comparisons. |
| **D-02** | BOLA on `GET /attempts/:attemptId/timeline` | Missing ownership check in timeline query path | Enforced candidate ownership check (`attempt.studentId === req.user.id`) and staff scoping check (`attempt.examId === req.user.examId`) before returning violation events. |
| **D-03** | Fail-open invigilator staff actions | `assertStaffExamAccess` did not verify `examId` on invigilator tokens | Added strict check requiring `user.examId === examId`. Invigilators with missing `examId` or mismatched exam assignments fail-closed with 403 Forbidden. |

---

## 5. Gate Sign-Off & Transition

Phase Q2 has satisfied all acceptance criteria defined in Master Implementation Plan §3 (Q2):
- [x] Route Inventory generated and verified against mounted routers (175 routes).
- [x] 100% deletion of legacy controllers, routes, services, sockets, and validators.
- [x] CI check confirms zero legacy files and zero forbidden tokens.
- [x] Canonical lowercase roles enforced via ESLint AST rule with 0 errors.
- [x] Route matrix automated test suite validates 401, 403, BOLA, and 2xx access (26/26 PASS).
- [x] Security defects D-01, D-02, D-03 verified and closed.
- [x] Claims ledger and interview notes updated with verifiable evidence.

Phase Q2 is formally marked **COMPLETED**.
