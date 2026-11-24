# ADR 012: Domain Model Evolution: StudentExam to ExamAttempt and API Versioning

## Status
Accepted

## Date
2026-10-03

## Context
The legacy domain model used `StudentExam` to represent both enrollment and an active testing session. It lacked:
- Explicit expiration deadlines (`expires_at`), allowing candidates to post answers indefinitely after exam windows close (Finding B-14).
- A stable relational question assignment mapping (`assignedQuestionIds String[]`, `optionOrderMap Json`), leading to runtime array parsing and unpredictable option shuffles.
- An optimistic concurrency revision token, permitting lost updates when multiple autosaves arrive out of order (Finding B-02).
- Normalized REST resource semantics (`/api/student/exams/:id/start`, `/api/student/exams/:id/answer`).

Notion Step 13 sections 13.5 and 13.6 introduce a clean domain resource hierarchy:
`Exam -> Exam Window -> Attempt -> AttemptQuestion -> AttemptAnswer`.

## Decision
1. **Schema Mapping**:
   - Evolve the schema using Prisma `@@map`:
     - `StudentExam` maps to `exam_attempts` (or retains table mapping during transition with clean domain alias `ExamAttempt`).
     - Introduce `attempt_questions` table with `id`, `attempt_id`, `question_id`, `sequence_order`, and `option_order`.
     - Introduce `attempt_answers` with `attempt_question_id`, `selected_option_id`, `revision` (integer version counter), and `updated_at`.
2. **First-Class Expiry & Deadlines**:
   - `ExamAttempt` includes `started_at`, `expires_at`, `submitted_at`, `status`, and `revision`.
   - `expires_at` is strictly calculated at start: `MIN(started_at + exam.duration, exam.end_time)`.
3. **API Versioning Strategy**:
   - Mount new high-performance endpoints under `/api/v1/...`:
     - `POST /api/v1/attempts/:id/start`
     - `PUT  /api/v1/attempts/:id/answers/:questionId`
     - `POST /api/v1/attempts/:id/answers/batch`
     - `POST /api/v1/attempts/:id/submit` (requires `Idempotency-Key` header)
   - Maintain legacy `/api/student/...` endpoints during Phase P4 as thin adapter wrappers, and deprecate/remove them once frontend migration is verified.

## Consequences
### Positive
- Prevents late submissions with database-level deadline enforcement.
- Eliminates lost updates during concurrent autosaves via optimistic locking (`revision`).
- Stable question and option order per candidate persisted reliably in relational tables.
- Aligns API design with standard REST and idempotent enterprise patterns.

### Negative
- Requires a two-phase migration to avoid breaking running frontend builds during the transition.

## Notion Step-13 Alignment
Fully aligns with Notion 13.5 (Resource Model) and 13.6 (Attempt State & Autosave Protocol).
