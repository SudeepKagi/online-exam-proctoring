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

## Decision 10: Removal of WebRTC Screen Sharing in Favor of Camera-Only Proctoring and Safe Exam Browser Lockdown
- **Context:** WebRTC screen sharing (`getDisplayMedia`) introduced continuous user UX friction (browser permission prompts, accidental cancellation of screen sharing), high client CPU/bandwidth consumption, and redundant security coverage when combined with Safe Exam Browser lockdown.
- **Decision:** Completely removed WebRTC screen sharing across the frontend and backend. Pre-exam verification is streamlined to 2 stages (1. Face Match, 2. Fullscreen Lock). The active exam relies on continuous camera proctoring (with hardware stream handoff from pre-check to avoid re-prompting) and browser lockdown violation events (`TAB_SWITCH`, `FULLSCREEN_EXIT`, `WINDOW_BLUR`, `CAMERA_DISCONNECTED`).
- **Data Persistence:** Existing database schemas remain untouched (no disruptive migrations); screen data writes and socket frame broadcasts are eliminated.

## Decision 11: Non-Blocking SEB Status Endpoint (`/api/v1/attempts/exams/:examId/seb-status`)
- **Context:** Frontend clients and pre-exam readiness checks need to inspect whether an exam mandates Safe Exam Browser and whether the active browser session has passed hash verification, without triggering a blocking 403 response.
- **Decision:** Created non-blocking inspection middleware `verifySebNonBlocking` that resolves the exam, evaluates hash integrity, and populates `req.seb = { required, mode, verified, examId }` without ever returning an error. The dedicated endpoint returns `{ status: "success", required, mode, verified }` cleanly across all runtime modes (`off`, `log`, `enforce`).

## Decision 12: Enterprise Light-Only UX & Client Interceptor Redirection
- **Context:** Students who attempt to launch an SEB-enforced assessment from standard browsers receive 403 `SEB_REQUIRED`. Leaving them on a dead-end error modal degrades test-taker trust.
- **Decision:** A global Axios response interceptor intercepts 403 responses bearing `code: "SEB_REQUIRED"` and routes to `/student/exams/:id/seb-required`. The guidance page provides download links (`VITE_SEB_DOWNLOAD_URL`), an optional protocol launch action (`VITE_SEB_CONFIG_URL`), and setup checklists. The entire flow adheres to the Light-Only Enterprise design system (Rule 05: `#fbfcfd` canvas, `#edecfb` and `#fbfbff` cards, zero box outlines on cards, font weights <= 500, single primary CTA). Pre-exam check detects SEB requirement: verified browsers show "Secure browser verified" in lieu of viewport fullscreen locks, while unverified browsers are routed to the prerequisite download view. Upon exam submission, an "Exit secure browser" button allows students to cleanly quit the locked kiosk session.

## Decision 13: Student Journey & Self-Service Readiness Check (Zero-Config, Plain Language)
- **Context:** Students should encounter zero technical jargon (no mentions of 'config key', 'hash', 'SHA256'). Before starting an exam, students need immediate feedback on camera, connectivity, clock skew, and operating system without administrative friction.
- **Decision:**
  1. **Readiness Check Card:** Added a 'Check your computer' card on the Student Dashboard that tests camera permission, performs round-trip ping for latency measurement, checks clock synchronization, and caches the passing result in `localStorage` under `proctornet_readiness_check`.
  2. **Live Start Checklist (`/student/exams/:id/start`):** A dedicated live verification checklist before pre-check. Shows 4 checks: Camera preview & permissions, Internet connection latency in ms, System clock sync, and Computer compatibility. Clock skew above 2 minutes displays a soft warning with instructions but never blocks the student.
  3. **Launch Fallback:** When launching Safe Exam Browser via protocol handler (`seb://` or `sebs://`), a 4-second timeout reveals a helpful fallback card ('Nothing opened?') offering download links, a 'Try again' action, and Windows installation guidance.
  4. **Single-Stage Verification Inside SEB:** Inside a verified Safe Exam Browser session (`/api/v1/seb/ping` returns `verified: true`), the login page displays a 'Secure browser ✓' indicator and redirects post-login directly to the target exam. The pre-check is collapsed into a single step: Identity Verification (facial match), skipping redundant fullscreen prompts since SEB is already kiosk locked.
  5. **Cancelable 5-Second Auto-Exit:** Upon exam submission, a 5-second countdown timer initiates automatic redirection (navigating to `VITE_SEB_QUIT_URL` in SEB or `/student/dashboard` in a standard browser). Students are provided an explicit 'Cancel auto-exit' button to review submission confirmation at their leisure.

## Decision 14: Student Resilience, Autosave, Multi-Tab & In-Place Re-Authentication
- **Context:** Mid-exam candidate stress is acutely amplified by invisible network fluctuations, session timeout logouts, or accidental duplicate tabs. Students require clear, visible system status and uninterrupted local state preservation.
- **Decision:**
  1. **Visible Autosave Indicator:** The exam arena header displays an immediate three-state indicator (`Saved`, `Saving...`, `Offline, will sync`).
  2. **Offline Buffering & Connection-Lost Banner:** When the network drops or HTTP 500/503 errors occur, candidate answers are safely retained in `localStorage` under `pn_offline_answers_{attemptId}` with exponential backoff (1s, 2s, 4s, 8s, 16s). A non-dismissible banner alerts the student that answers are safe locally and offers a manual 'Retry sync' button. When connectivity resumes, answers flush automatically and a confirmation banner verifies synchronization.
  3. **Server-Authoritative Countdown & Accessibility Warnings:** Exam timer synchronizes against the server clock offset (`Date` header delta). Visual and accessible announcements are broadcast at 5 minutes (`role="alert" aria-live="polite"`) and 1 minute (`role="alert" aria-live="assertive"`). Upon expiration, a full-screen submitting overlay prevents further edits while finalizing responses.
  4. **Duplicate Tab Protection:** The arena uses `BroadcastChannel` with instance session identifiers. When a student opens a second tab, the second tab detects the active master session and renders a blocking overlay (`data-testid="duplicate-tab-overlay"`). The primary tab continues running without disruption or answer loss.
  5. **Silent Refresh & In-Place Re-Auth:** If an access token expires mid-exam (HTTP 401), an Axios interceptor attempts a silent refresh (`POST /api/v1/auth/refresh`). If refresh fails, rather than redirecting away and purging storage, an in-place modal (`data-testid="reauth-modal"`) prompts for credentials, resumes the exam at the exact question index, and flushes pending answers.
  6. **Idempotent Submit Locking:** On submit, the client generates a stable `Idempotency-Key` attached to headers and body, locking the submission button to prevent double-submits. Retries preserve the identical key, ensuring deterministic single grading on the backend.
