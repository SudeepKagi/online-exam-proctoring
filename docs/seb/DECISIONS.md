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

## Decision 5: Canonical URL Normalization via `PUBLIC_ORIGIN`
- **Context:** SEB client generates `X-SafeExamBrowser-ConfigKeyHash` using the absolute request URL without fragment: `sha256_hex(url + key)`. Relying on incoming `Host` or `X-Forwarded-Host` headers creates server-side request forgery (SSRF) and cache poisoning risks.
- **Decision:** The backend normalizes `PUBLIC_ORIGIN` at boot time as a bare origin (no path, no query, no fragment) using the standard `URL` class to drop default HTTP/HTTPS ports (80/443). The canonical URL is reconstructed strictly as `PUBLIC_ORIGIN + req.originalUrl.split('#')[0]`.

## Decision 6: Process-Memory Secret Caching (Zero Redis Key Storage)
- **Context:** Active exam sessions perform frequent hot-path autosave operations (`POST/PUT /attempts/:id/answers`). Looking up exam settings on every keystroke/autosave causes database strain. Storing raw keys in Redis introduces secondary exfiltration vectors.
- **Decision:** Exam settings (`sebRequired`, `sebConfigKey`) are cached strictly in process memory (`Map`) with a 60-second TTL and immediate invalidation on `updateExam` or `publishExam`. The `attemptId -> examId` mapping uses a bounded in-memory LRU cache (`size = 5000`). The raw `sebConfigKey` is never written to Redis under any circumstance.

## Decision 7: Verification Failure Isolation (Saved Answers Untouched)
- **Context:** If a student encounters a transient network glitch, proxy corruption, or corrupted header on submit/autosave in enforce mode, the attempt answers already recorded in PostgreSQL must not be deleted or rolled back.
- **Decision:** The SEB verification middleware runs before request handlers and rejects unauthorized requests with `403 Forbidden` (`{ code: "SEB_REQUIRED" }`). Because the controller is never reached, existing database state and previously saved candidate answers remain intact.

## Decision 8: Gated Route Scoping vs Ungated Discovery
- **Context:** Students must be able to view basic exam metadata and check system readiness (camera, audio, browser checks) without being blocked by SEB.
- **Decision:** `GET /exams/:id` and `POST /attempts/.../readiness` remain ungated. Only attempt activation (`POST .../start`), answer mutations (`POST/PUT .../answers`), attempt finalization (`POST .../submit`), and student attempt fetching (`GET /attempts/:attemptId`) are gated by SEB verification.

## Decision 9: Two-Phase Gated Verification for WebSocket Attempt Join
- **Context:** Socket.IO WebSocket connections do not carry custom HTTP headers like `X-SafeExamBrowser-ConfigKeyHash` on individual socket events.
- **Decision:** In `enforce` mode, `socket.on('attempt:join')` checks whether the attempt was previously verified by a gated HTTP request (such as `startAttempt` or `getAttempt`). A non-secret boolean flag (`isAttemptSebVerified`) is tracked in-process and in Redis with a 4-hour TTL. If the attempt has not passed HTTP verification, `attempt:join` is refused with `{ success: false, code: "SEB_REQUIRED" }`.
