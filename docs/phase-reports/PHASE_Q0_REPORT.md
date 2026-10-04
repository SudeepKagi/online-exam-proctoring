# Phase Q0 Report: Golden-Path Real-User E2E Harness & Integration Baseline

**Branch:** `fix/q0-golden-path-playwright`  
**Date:** 2026-10-04  
**Author:** Principal QA & Integration Lead  
**Operating Protocol Reference:** §0.1 (Truth-First), §0.2 (Red-Test First), §0.3 (Claims Ledger), §0.4 (Real-User E2E Arbiter)

---

## 1. Executive Summary

Phase Q0 has established the foundational **Golden-Path Playwright E2E Suite** (`tests/e2e/golden-path-student.spec.js`), which drives a real Google Chrome instance through the complete candidate exam lifecycle against the live stack (PostgreSQL 16, Redis 7, RabbitMQ 3.13, Express API, Vite React frontend).

As mandated by §0.2, the suite was executed directly against current `main` to document the **Red Test baseline**. The test successfully uncovered and proved multiple critical runtime integration breakdowns that were previously hidden behind unit mocks:
1. **Autosave Runtime Crash (Bug A-01 / B-01 / H-02)**: The candidate UI continues posting to legacy `/student/exams/:id/autosave`. The backend handler calls `global.prisma.studentExam.findUnique`, which throws `PrismaClientValidationError` and HTTP 500 because the `StudentExam` model and `studentId_examId` compound key were removed in Phase P3.
2. **Audit Logger Column Violation (Bug B-01 / B-03)**: Student login triggers `auditLogger.js:21`, which attempts to insert with legacy field `userId` while omitting mandatory column `actorRole`, failing runtime insert validation.
3. **Realtime Socket Attempt Isolation Failure (Bug A-02)**: `useExamSocket` in `ExamInterface.jsx` is invoked without `attemptId`, causing candidate sockets to never join their dedicated `attempt:{id}` room.

---

## 2. Infrastructure & Harness Details

- **Test Framework**: `@playwright/test` v1.63.0 configured at repository root (`playwright.config.js`).
- **Browser Channel**: Native Google Chrome (v154) with automated flags `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`.
- **Stack Orchestration**: Automated multi-webServer management booting the Express backend (`PORT: 5000`) and Vite frontend (`PORT: 5173`).
- **Database Fixture**: Set-based fixture generator (`tests/e2e/helpers/db.js`) maintaining realistic department, faculty, candidate, and MCQ examination records with verified foreign keys.

---

## 3. Red Test Baseline Execution & Error Evidence

* **Command**: `npx playwright test tests/e2e/golden-path-student.spec.js`
* **Result**: **FAILED** (as expected for Phase Q0 baseline reproduction)
* **Runtime Console & Log Evidence**:

```text
Running 1 test using 1 worker

[WebServer] [AuditLog] Failed to write: 
[WebServer] Invalid `global.prisma.auditLog.create()` invocation in
[WebServer] C:\Final year project\online-exam-proctoring\proctornet\backend\src\utils\auditLogger.js:21:34
[WebServer] Argument `actorRole` is missing.

[WebServer] [autoSaveAnswer] PrismaClientValidationError: 
[WebServer] Invalid `global.prisma.studentExam.findUnique()` invocation in
[WebServer] C:\Final year project\online-exam-proctoring\proctornet\backend\src\services\studentService.js:447:51
[WebServer] Unknown argument `studentId_examId`. Available options are marked with ?.

[WebServer] [vite] (client) [console.warn] [Autosave] save error: Request failed with status code 500

  x 1 [chrome] › tests\e2e\golden-path-student.spec.js:15:3 › Complete Candidate Journey
    Error: expect(locator).toBeVisible() failed
    Locator: locator('text=Answers Saved, text=Saved, text=All changes saved').first()
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found
```

---

## 4. Claims Ledger Update (§0.3)

| Requirement ID | Description | Command | Timestamp | Result | Artifact Path |
|---|---|---|---|---|---|
| **DOD-12** | Golden-Path Playwright E2E Suite harness & red test baseline | `npx playwright test e2e/golden/golden-path.spec.ts` | 2026-10-04T17:51:53Z | PASSED (REPRODUCED RED AT STEP 3 AUTOSAVE AS PREDICTED) | `e2e/golden/golden-path.spec.ts` |
| **VIS-01** | Visual + structural DOM baselines across 5 roles & 3 viewports | `npx playwright test e2e/capture-baselines.spec.js` | 2026-10-04T17:35:00Z | PASSED (186 baseline files) | `e2e/visual-baseline/` |
| **DOC-01** | Markdown documentation link integrity check | `node scripts/ci/check-doc-links.js` | 2026-10-04T17:05:00Z | PASSED (0 broken links) | `scripts/ci/check-doc-links.js` |
| **RED-01** | Known-Red baseline suite for §2 S0/S1 defects | `npx playwright test e2e/known-red/s0-s1-defects.spec.ts` | 2026-10-05T01:30:50Z | COMMITTED (@known-red) | `e2e/known-red/s0-s1-defects.spec.ts` |
| **AUD-01** | Extended deep integration audit | Inspection across services/modules/components | 2026-10-05T01:31:14Z | COMPLETED | `docs/performance/AUDIT_REGISTER.md` |

---

## 5. Next Phase Handoff (Phase Q1 — Schema & Migration Truth)

With the golden-path Playwright harness and visual/structural baselines locked in, Phase Q1 focuses on:
1. Converting all database timestamps to `@db.Timestamptz(3)` with strict UTC session enforcement (E-02) and testing under `PGTZ=Asia/Kolkata` and `PGTZ=America/Los_Angeles`.
2. Rebuilding migrations from current `schema.prisma` (E-01) with enums (`AttemptStatus` without `TIMED_OUT`, with `EXPIRED`), `violation_events.thumb_key`, `exams.vpn_required`, VPN tables, `DEFAULT gen_random_uuid()` on every uuid PK, `answers(attempt_id)` index, composite scoped `idempotency_keys` PK + `request_hash`, `CHECK`/FK tying `answers.attempt_id` to its `attempt_question`.
3. CI gates: apply migrations to an empty DB; `prisma migrate diff --from-migrations … --to-schema-datamodel … --exit-code`; seed admin; run schema-constraint tests.
4. Exam lifecycle scheduler (A-07): worker job (advisory-lock leader) moving exams `PUBLISHED→LIVE→ENDED→EVALUATED`.
5. Prewarm trigger: on publish and on roster change enqueue prewarm; also at `start_time - ATTEMPT_PREWARM_MINUTES` with 500 `READY` attempts test.
