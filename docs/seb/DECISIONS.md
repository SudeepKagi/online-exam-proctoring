# SEB Architecture & Design Decisions

## Decision 1: Raw 64-Hex Storage for `sebConfigKey`
- **Context:** Unlike user passwords, Safe Exam Browser config validation requires computing `SHA256(requestUrl + rawKey)` at request time for incoming SEB header verification.
- **Decision:** `sebConfigKey` is validated as a 64-character hex string and stored in raw lowercase format inside `exam.proctoringConfig`.
- **Mitigation:** Zero leakage to client via `toExamDto` (stripped for students/unauthenticated/unknown viewers, masked for faculty owner and admin as `••••••••<last4>`). Redacted from logs via Pino redaction paths and string scrubbing regex `/\b([0-9a-fA-F]{8})[0-9a-fA-F]{56}\b/g -> $1...`.

## Decision 2: Cache Immutability via Deep Clone in `toExamDto`
- **Context:** `exams.sql.js` caches exam objects in-memory (`examCache`). If `toExamDto` mutated its argument directly, the cached record would have its credentials stripped or masked, corrupting subsequent backend operations.
- **Decision:** `toExamDto` clones the source exam before transformation (`JSON.parse(JSON.stringify(exam))`), guaranteeing the in-memory cache retains the authoritative raw data.

## Decision 3: Student Question Omission in Enforce Mode
- **Context:** In `enforce` mode with `sebRequired: true`, students must not be able to bypass SEB restrictions by inspecting the `/exams/:id` pre-flight response.
- **Decision:** Questions are stripped from `GET /exams/:id` responses for students when `sebRequired && SEB_MODE === 'enforce'`. `questionCount` and `totalMarks` are calculated prior to omission and included in the payload. During `startAttempt`, questions are provided directly in the start response (`startRes.data.questions`), which `ExamArenaPage.jsx` prefers.

## Decision 4: Masked Round-Trip & Clear Flag Handling
- **Context:** Faculty editing exam details in UI receive the masked key `••••••••<last4>`. Submitting the form with this masked key must not overwrite the real key in the database.
- **Decision:** Any key beginning with `•` or passed as empty/undefined in `updateExam` is treated as unchanged. The explicit boolean request flag `clearSebConfigKey: true` sets stored `sebConfigKey` to `null` and is stripped so it is never persisted to the database.
