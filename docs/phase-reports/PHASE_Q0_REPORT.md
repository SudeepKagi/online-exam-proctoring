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
| **DOD-12** | Golden-Path Playwright E2E Suite harness setup & red test verification | `npx playwright test tests/e2e/golden-path-student.spec.js` | 2026-10-04T16:54:30Z | BASELINE_ESTABLISHED (RED) | `tests/e2e/golden-path-student.spec.js` |
| **BUG-A01** | Red test reproduction: autosave bypasses v1 and crashes on legacy endpoint | `npx playwright test tests/e2e/golden-path-student.spec.js` | 2026-10-04T16:54:30Z | REPRODUCED | `tests/e2e/golden-path-student.spec.js` |
| **BUG-B01** | Red test reproduction: studentService.js calls deleted model studentExam | `npx playwright test tests/e2e/golden-path-student.spec.js` | 2026-10-04T16:54:30Z | REPRODUCED | `proctornet/backend/src/services/studentService.js` |

---

## 5. Next Phase Handoff (Phase Q1)

With the golden-path Playwright harness in place to act as runtime arbiter, Phase Q1 will focus on:
1. Converting all database timestamps to `@db.Timestamptz(3)` with strict UTC session enforcement (E-02).
2. Generating and locking clean database migration history (`0003_timestamptz_utc_invariants`) with zero migration drift (E-01).
3. Enforcing attempt activation SQL guards and dropping redundant `TIMED_OUT` enum (E-03, E-09).
4. Adding missing composite index on `answers(attempt_id)` (E-04).
