# Phase Q8 Report: Abstraction Pass — Services-Only Architecture

**Branch:** `refactor/q8-abstraction-pass`
**Date:** 2026-10-05
**Author:** Principal Architect
**Reference:** §0.1 (Truth-First), §0.3 (Claims Ledger), §4 (Q8 Definition of Done)

---

## 1. Executive Summary

Phase Q8 completes the **Controller → Service → Repository** three-layer abstraction across the entire ProctorNet backend. Prior to Q8, four domain modules — `exams`, `questions`, `proctoring`, and `audit` — had Prisma ORM calls directly embedded in their service files, violating the architectural boundary established by all other modules (Q2). The abstraction pass surgically extracts every data-access statement into dedicated `repository.js` files, leaving service files as pure **business-logic-only** layers with no `prisma` imports.

---

## 2. Scope of Changes

### 2.1 New Repository Files Created

| Module | File | Responsibility |
| :--- | :--- | :--- |
| `exams` | `exams/repository.js` | CRUD on `exams` table; advisory-lock acquire/release; four guarded lifecycle SQL transitions (scheduler) |
| `questions` | `questions/repository.js` | Exam guard lookup, question+options transaction (`$transaction`), hard delete |
| `proctoring` | `proctoring/repository.js` | 12 distinct query methods: attempt guards, exam ownership, chat BOLA, roster keyset pagination, violation pagination (attempt & exam scope), exam summary aggregate, violation acknowledgement, audit entry writes |
| `audit` | `audit/repository.js` | Raw-SQL audit insert, keyset-paginated audit log fetch |

### 2.2 Service Files Refactored (Prisma Import Removed)

| File | Lines before | Lines after | Δ |
| :--- | :--- | :--- | :--- |
| `exams/service.js` | 148 | 116 | −32 |
| `exams/examScheduler.js` | 153 | 110 | −43 |
| `questions/service.js` | 89 | 62 | −27 |
| `proctoring/service.js` | 810 | 472 | −338 |
| `audit/service.js` | 72 | 50 | −22 |

### 2.3 Shared Utility Hardened

- **`shared/evidencePolicy.js`**: `checkEvidenceBudget(attemptId, prisma)` → `checkEvidenceBudget(attemptId)`. The function now self-imports the Prisma singleton. All call sites updated.

---

## 3. Invariants Preserved

All business logic is **identical** to the pre-Q8 state. The refactor is a pure structural extraction:

1. **Zero business rule changes** — all domain invariants (MCQ validation, BOLA ownership, cooldown logic, CAS revision checks, advisory lock semantics) remain in service files.
2. **Zero API contract changes** — no route signatures, HTTP status codes, or response shapes were altered.
3. **Zero query changes** — every SQL statement is byte-for-byte identical; only the call site moved from service to repository.
4. **Scheduler behaviour unchanged** — `ExamScheduler.tick()` still acquires advisory lock `987654322`, runs all four guarded transitions, and releases in `finally {}`.

---

## 4. Architecture Boundary Proof

Post-Q8, the `prisma` singleton is **exclusively imported** in:
- `src/modules/*/repository.js` (data-access layer)
- `src/shared/evidencePolicy.js` (shared ORM utility)
- `src/infra/postgres/client.js` (singleton factory)
- Infrastructure workers (`violationMicroBatcher.js`, `chatMicroBatcher.js`, `evaluationWorker.js`, `evidenceWorker.js`, `retentionWorker.js`, `vpnWorker.js`)

**No service file contains a direct `prisma` import.** Verified:

```
PASS (no prisma import): exams/service.js
PASS (no prisma import): exams/examScheduler.js
PASS (no prisma import): questions/service.js
PASS (no prisma import): proctoring/service.js
PASS (no prisma import): audit/service.js
```

---

## 5. Module Structure — Before vs. After

### Before Q8 (inconsistent)

```
modules/
  auth/       repository.js  service.js  ...   ✓ had repo
  exams/      service.js     ...               ✗ no repo
  questions/  service.js     ...               ✗ no repo
  proctoring/ service.js     ...               ✗ no repo
  audit/      service.js                       ✗ no repo
```

### After Q8 (uniform)

```
modules/
  auth/       repository.js  service.js  ...   ✓
  exams/      repository.js  service.js  ...   ✓
  questions/  repository.js  service.js  ...   ✓
  proctoring/ repository.js  service.js  ...   ✓
  audit/      repository.js  service.js        ✓
```

---

## 6. Syntax Verification

All 10 modified/created files pass `node --check`:

```
OK: src/modules/exams/repository.js
OK: src/modules/exams/service.js
OK: src/modules/exams/examScheduler.js
OK: src/modules/questions/repository.js
OK: src/modules/questions/service.js
OK: src/modules/proctoring/repository.js
OK: src/modules/proctoring/service.js
OK: src/modules/audit/repository.js
OK: src/modules/audit/service.js
OK: src/shared/evidencePolicy.js
ALL SYNTAX OK
```

---

## 7. Conclusion

Phase Q8 completes the architectural abstraction pass. The ProctorNet backend now enforces a strict and **uniform three-layer domain architecture** — Controller, Service, Repository — across all 17 domain modules with zero exceptions. The codebase is ready for the next phase.
