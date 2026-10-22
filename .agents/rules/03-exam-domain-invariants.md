---
trigger: always_on
description: Enforces the 10 critical exam-system security, timer, autosave, and scoring invariants.
---

# Rule 03: Exam-System Domain Invariants

Every exam flow MUST implement and test all 10 of these invariants:

1. **Server-Authoritative Timer:**
   - Compute `startedAt` and `expiresAt = Min(startedAt + exam.durationMinutes, exam.endTime)` exclusively on the server using the server clock. Never trust client timestamps.
2. **Auto-Submit When Time Expires (Even if Browser Closed):**
   - Run a background server job/scheduler (plus lazy expiration check on fetch) that transitions expired `IN_PROGRESS` attempts to `AUTO_SUBMITTED` and calculates the final score using saved answers even if the student's browser is closed.
3. **Mid-Exam Refresh or Crash Resume:**
   - Refreshing or reopening the browser mid-exam MUST restore all saved answers and sync the countdown timer to the server's remaining time (`expiresAt - serverNow`).
4. **Network-Drop Resilient Autosave:**
   - Autosave answers on selection change and question navigation.
   - If the network drops, persist answers locally in `IndexedDB`/`localStorage` and automatically sync the queued answers to the backend once connectivity resumes.
5. **Idempotent Submit (Double-Click Safe):**
   - Clicking submit twice or sending concurrent `POST /exams/:id/submit` requests must perform an atomic database update (`WHERE status = 'IN_PROGRESS'`) and return the single submission without creating duplicates or throwing `500` errors.
6. **One Attempt Per Student Enforced by Backend:**
   - Enforce a database `UNIQUE (exam_id, student_id)` constraint and reject repeat start requests with `409 { code: "ATTEMPT_ALREADY_EXISTS", message: "..." }`.
7. **Strict RBAC & Zero Answer Leakage:**
   - Never include `correctAnswer`, `rubric`, or `explanation` in student question payloads.
   - Reject student attempts to read other students' results, answer keys, or teacher/admin endpoints with `403 Forbidden`.
8. **Clean Expired/Tampered JWT Handling:**
   - Reject expired or tampered JWTs cleanly with `401 { code: "TOKEN_EXPIRED" | "TOKEN_INVALID", message: "..." }`.
9. **Exact Scoring Engine (Partial & Negative Marking):**
   - Compute scores deterministically on the backend across single-choice, multi-select (with partial marking and zero/negative floor rules), negative marking for wrong answers, and `0` for unattempted questions.
10. **Strict Exam Window Enforcement:**
    - Block starting an exam before `exam.startTime` (`403 EXAM_NOT_OPEN`) or after `exam.endTime` (`403 EXAM_ENDED`).
