# SEB Enforcement — Pre-Flight Analysis & Execution Plan
> Read-only audit completed 2026-11-07. Verified against source files, official SEB developer specification (`safeexambrowser.org/developer/seb-config-key.html`), and codebase architecture.

---

## 1. What the SEB Config Key Header Actually Is

### The HTTP Header
SEB sends:
```http
X-SafeExamBrowser-ConfigKeyHash: <64-character-hex-string>
```
*(Note: `X-SafeExamBrowser-RequestHash` belongs to the Browser Exam Key [BEK], which is platform- and build-dependent. ProctorNet primarily enforces the Config Key [CK], which is platform- and version-independent. See Section 5 for the BEK allowlist roadmap).*

### The Hash Formula
SEB generates the Config Key as a 64-character lowercase hex string from canonical settings JSON. The request verification formula is:
```
expectedHeader = sha256_hex( absoluteRequestUrlWithoutFragment + storedConfigKey )
```
Step-by-step:
1. **Canonical Request URL**: Built from `PUBLIC_ORIGIN` env (scheme + host + optional non-default port, e.g. `http://localhost:5000` or `https://proctornet.duckdns.org`) + `req.originalUrl` (which already includes `/api/v1/...`). Strip any `#fragment` anchor.
   - **Critical Rule on Origin**: Never double-append `/api/v1` by concatenating a base URL with `/api/v1` to `req.originalUrl`. Canonical URL = `PUBLIC_ORIGIN + req.originalUrl`. Never rely on the unvalidated incoming `Host` header.
   - In `SEB_MODE=log`, the system logs the exact reconstructed URL string (without secrets) so that proxy/prefix mismatches can be debugged immediately.
2. **Concatenation**: Append the 64-character hex `storedConfigKey` directly to the canonical URL string:
   $$\text{payload} = \text{url} + \text{storedConfigKey}$$
3. **Single SHA-256**: Compute `sha256(payload)` and encode as a 64-character lowercase hex string.
4. **No double-hashing**: The stored Config Key is already the hex hash from SEB Config Tool. We do not re-hash it before concatenation.

### Code-Level Proof & Verification Harness (`scripts/seb/verify-formula.js`)
To eliminate any ambiguity between single-hash and double-hash variants:
- A standalone verification CLI tool `scripts/seb/verify-formula.js` will take `(url, configKey, observedHeader)` and evaluate:
  - Variant A: `sha256_hex(url + configKey)` (single-hash)
  - Variant B: `sha256_hex(url + sha256_hex(configKey))` (double-hash)
- The formula remains marked **UNVERIFIED** in `docs/seb/CLAIMS_LEDGER.md` until tested against a live SEB client.
- The environment variable `SEB_MODE` defaults to `log` during rollout and development.

### Constant-Time Comparison Security
To prevent timing attacks while eliminating buffer truncation/padding vulnerabilities:
1. Check string length first: if `receivedHeader.length !== 64`, reject immediately.
2. Only when lengths match, allocate equal-length buffers:
   ```javascript
   const expectedBuf = Buffer.from(expectedHex, 'utf8')
   const receivedBuf = Buffer.from(receivedHex, 'utf8')
   const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf)
   ```
3. Never truncate a longer header (an attacker could exploit prefix matching) and never pad a shorter header.

### Key Validation on Save
When faculty save or update an exam configuration:
- Trim all leading/trailing whitespace.
- Validate that the input is exactly 64 hexadecimal characters (`/^[0-9a-fA-F]{64}$/`).
- Normalize to lowercase before storing.
- UI helper text must explicitly instruct: *"Copy the CONFIG KEY from SEB Config Tool, NOT the Browser Exam Key."*

### Publish Guard
An exam with `proctoringConfig.sebRequired === true` cannot be published (`POST /exams/:id/publish`) without a valid 64-hex key, checking exam-level `sebConfigKey` first and falling back to the global `SEB_CONFIG_KEY` env var. If neither is available, the publish guard rejects with `400 BAD_REQUEST: "Exam requires Safe Exam Browser but no valid Config Key is configured."`

### Setup Checklist & Configuration Prerequisites in SEB Config Tool
> [!NOTE]
> Settings marked `[UNVERIFIED IN CLAIMS_LEDGER]` are derived from documentation and memory; each must be explicitly verified in the real SEB Config Tool GUI during the pilot checkpoint.

1. **Send Config Key Header** `[UNVERIFIED IN CLAIMS_LEDGER]`: In the Exam tab, check **"Use Browser & Config Keys (send in HTTP header)"** (`sendBrowserExamKey = true`). By default, SEB sets this to `false`.
2. **Camera / Web Media Access** `[UNVERIFIED IN CLAIMS_LEDGER]`: In User Interface / Media settings, enable **"Allow video capture"** (`allowVideoCapture = true`). Without this, the browser kiosk blocks `getUserMedia` and webcam proctoring fails.
3. **Clean Quit Action & Post-Submit Quit URL**:
   - In the Exam tab, set the Quit URL to the actual post-submission URL (e.g. `https://proctornet.duckdns.org/student/exams/:id/result` or an exit confirmation page like `https://proctornet.duckdns.org/exam-ended`).
   - Disable **"Confirm quitting"** (`false`) `[UNVERIFIED IN CLAIMS_LEDGER]` so that clicking the quit link terminates SEB cleanly without trapping the student in confirmation loops.
   - The Quit URL must be included in the URL filter allowlist.
4. **URL Filter Allowlist**:
   - ProctorNet web origin: `https://proctornet.duckdns.org` (or `http://localhost:5173`)
   - ProctorNet API origin: `https://proctornet.duckdns.org` (or `http://localhost:5000`)
   - Object Storage / S3 / MinIO: `https://*.s3.ap-south-1.amazonaws.com`, `http://localhost:9000`
   - Post-submit Quit URL destination
   - Self-hosted static assets: Fonts (`/fonts/Satoshi-Variable.woff2`) and icons.

---

## 2. Current State & Route Analysis (Verified from Repo)

### Role-Scoping & Middleware Execution Order
SEB gating applies **EXCLUSIVELY to the `STUDENT` role**, and only for that student's own active attempt.
- **Staff Exemption**: Faculty, invigilators, and administrators frequently access student attempt endpoints (e.g., `GET /attempts/:attemptId` for grading/monitoring) from standard desktop browsers. They must NEVER be blocked by SEB middleware.
- **Mandatory Middleware Order**:
  1. `authenticateToken`: Validates JWT, extracts `req.user = { id, role, email }`.
  2. `requireRole(...)` or route authorization guards: Enforces basic RBAC.
  3. `sebMiddleware`: Inspects `req.user.role`. If `req.user.role !== 'STUDENT'`, bypasses SEB validation immediately (`return next()`). If role is `STUDENT`, verifies attempt ownership and checks `X-SafeExamBrowser-ConfigKeyHash`.

### Question 4: Route Identifier Resolution Map
SEB middleware resolves the target `exam` and its `proctoringConfig` across all gated student endpoints:

| Route Path | Method | Identifier Source | Resolution Mechanism | Gating Requirement |
|---|---|---|---|---|
| `/attempts/exams/:examId/start` | POST | `req.params.examId` | Direct `examId` lookup | GATED (returns questions to student) |
| `/attempts/:examId/start` | POST | `req.params.examId` | Direct `examId` lookup | GATED (returns questions to student) |
| `/attempts/student/exams/:examId/start` | POST/GET | `req.params.examId` | Direct `examId` lookup | GATED (returns questions to student) |
| `/attempts/start` | POST | `req.body.examId` | Body `examId` fallback | GATED (returns questions to student) |
| `/attempts/:attemptId/answers` | POST | `req.params.attemptId` | Cache L1/L2 -> DB fallback | GATED (student candidate answers) |
| `/attempts/:attemptId/answers/batch` | POST | `req.params.attemptId` | Cache L1/L2 -> DB fallback | GATED (student candidate answers) |
| `/attempts/:attemptId/answers` | PUT | `req.params.attemptId` | Cache L1/L2 -> DB fallback | GATED (student candidate answers) |
| `/attempts/:attemptId/submit` | POST | `req.params.attemptId` | Cache L1/L2 -> DB fallback | GATED (student final submission) |
| `/attempts/:attemptId` | GET | `req.params.attemptId` | Cache L1/L2 -> DB fallback | GATED for STUDENT only (exposes answers) |

*Resolver Design*:
```javascript
if (req.user?.role !== 'STUDENT') {
  return next()
}
const examId = req.params.examId || req.body?.examId || null
if (!examId && req.params.attemptId) {
  // Resolve exam from cached attempt mapping
}
```

### Question 5: Which Callers Depend on `GET /exams/:id`?
Audit of callers across frontend and tests:
1. `frontend/src/pages/student/PreExamCheckPage.jsx`: Calls `GET /exams/:id` to display exam title, course code, and schedule windows.
2. `frontend/src/pages/student/ExamArenaPage.jsx`: Line 94 calls `Promise.all([ apiClient.get('/exams/' + id), apiClient.post('/attempts/exams/' + id + '/start') ])`. Currently line 103 reads `qs = ensureArray(ex?.questions)`.
3. `frontend/src/pages/faculty/ExamManagePage.jsx`: Calls `GET /exams/:id` to populate exam configuration and questions table.
4. `e2e/helpers/api.ts`: Helper `getExamDetails(examId)` called during authoring and verification tests.

**Rule for Question Omission**:
- `questions` are omitted from `GET /exams/:id` **ONLY** when `exam.proctoringConfig?.sebRequired === true`, `SEB_MODE === 'enforce'`, and `req.user.role === 'STUDENT'`.
- In `SEB_MODE === 'log'`, questions are NOT omitted (log mode behaves identically to `off` for students).
- In `ExamArenaPage.jsx`, initialize questions using `startRes.data?.questions || ex?.questions`. Because `/start` is the SEB-gated entry point that always returns `{ questions }`, resume-after-refresh and initial launch will reliably receive questions inside SEB.
- Non-SEB exams and faculty/admin callers are completely unaffected.

### Question 3: Server-Side Attempt Verification & Violation Policy
- Violation events are posted by students to `POST /api/v1/proctoring/events`. This endpoint cannot be strictly SEB-gated because network disruptions, heartbeats, and client state transitions must be logged even if SEB headers are disrupted.
- **Server-Side Tracking**:
  - When any SEB-gated route (`/start`, `/answers`, `/submit`) successfully validates the `X-SafeExamBrowser-ConfigKeyHash`, the server sets:
    - In cache: `pn:v1:attempt_seb_verified:<attemptId> = true` (TTL: attempt duration + 10m).
    - Note on PostgreSQL: In accordance with working rules, **no migration will be executed**. We track the verified state in Redis/L1 cache with fallback to attempt metadata JSON if needed.
- **Strict Violation Severity Policy (No Automatic Downgrade)**:
  - Because the SEB Config Key can theoretically be forged by an adversary with access to the key string, a verified header does **not** cryptographically prove an uncompromised physical environment.
  - Automatic downgrade of `TAB_SWITCH` or `FULLSCREEN_EXIT` to `INFO` is **forbidden**, as a forged client could switch windows freely without penalty.
  - **Policy**:
    1. Retain current violation severity (`HIGH`) and normal `violationCount` incrementing.
    2. Attach `sebVerified: true/false` to the recorded event metadata as informational context for invigilators in the live proctoring console.
    3. Revisit potential threshold adjustments only after empirical evidence is gathered during the live SEB pilot.
- Severity is never determined by client request headers or body fields.

### Question 8: Cache Architecture & Secret Hygiene
- **Strict Shared Cache Policy (Zero Secret in Redis)**: The SEB Config Key (`sebConfigKey`) is a shared secret and must **NEVER** be stored in Redis or any external/shared cache. Redis/distributed cache is restricted strictly to non-secret routing and status data:
  - `pn:v1:attempt_seb:<attemptId> = examId` (immutable, TTL: duration + 10m).
  - `pn:v1:attempt_seb_verified:<attemptId> = true` (ephemeral attempt status, TTL: duration + 10m).
  - `pn:v1:exam_seb_required:<examId> = true/false` (boolean toggle, 60s TTL).
- **In-Process Memory Cache for Config Key**:
  - The actual `sebConfigKey` string is cached exclusively in an **in-process memory cache** (local Node.js process LRU / Map) with a short TTL (60s), falling back directly to PostgreSQL database lookup.
  - On exam update (`PUT /exams/:id`), the backend explicitly invalidates the local cache entry and broadcasts an invalidation event.
  - On cache miss or failure, fall back to DB lookup. In `enforce` mode, never fail open on persistent database failure.
- **Pino Redaction**: Configure `sebConfigKey` in Pino redaction rules (`backend/src/shared/logging.js`) so that keys are automatically masked in HTTP logs, bodies, and error stacks.

### Question 9: Real-Time Communication Audit (Socket.io)
- **Repo Audit**: There is no active LiveKit client in `frontend/src/` and no external WebSockets other than Socket.IO.
- **Socket.IO Gating**:
  - Students join exam rooms via `attempt:join` handled in `backend/src/infra/websocket/socketHandlers.js:70`.
  - When a student socket emits `attempt:join`, verify that the attempt has been activated via SEB (`attempt_seb_verified`).
  - If `sebRequired === true` and `SEB_MODE === 'enforce'`, reject join with `attempt:unverified` if unverified.
  - In `SEB_MODE === 'log'`, log the verification status but allow join.

---

## 3. Reordered 6-Step Implementation Plan

### Step 1 — DTO Security & Zero-Leak Guarantee (`feat/seb-01-dto-security`)
*Must be completed first so that no subsequent endpoint or query can ever leak the secret key.*
- **Payload Whitelisting**:
  - Whitelist allowed fields in `proctoringConfig` (`sebRequired`, `sebConfigKey`, `maxViolations`, `sebFileKey`).
- **Key Validation on Save**:
  - Require 64 hex characters, lowercase on save, trim whitespace.
  - If incoming `sebConfigKey` matches masked format (`••••••••...`) or is empty, treat as unchanged and preserve existing DB value.
- **Publish Guard**:
  - Reject `POST /exams/:id/publish` if `sebRequired === true` and neither exam `sebConfigKey` nor `SEB_CONFIG_KEY` env is configured.
- **Secret Key Stripping & Pino Redaction**:
  - Strip `sebConfigKey` from `findExamById`, `getExamById` (student view), `listExams`, and `startAttempt`.
  - Mask `sebConfigKey` for owner faculty / admin: `"••••••••" + key.slice(-4)`.
  - Add `sebConfigKey` to Pino logger redaction paths.
- **Question Stripping**:
  - In `getExamById`, omit `questions` for student role ONLY when `sebRequired === true` and `SEB_MODE === 'enforce'`.
- **Automated Verification**:
  - Add `tests/seb/zero-leak.test.js` verifying zero leakage across student endpoints.

### Step 2 — Formula Verification Script & Core SEB Middleware (`feat/seb-02-middleware`)
- Create `scripts/seb/verify-formula.js` CLI tool (evaluates single-hash vs double-hash against real headers).
- Create `docs/seb/CLAIMS_LEDGER.md` documenting formula verification status and `SEB_MODE=log` default.
- Create `backend/src/middleware/seb.js`:
  - Enforce role check: Apply SEB gating strictly to `STUDENT` requests; pass through staff/admin callers immediately.
  - Reconstruct canonical URL using `PUBLIC_ORIGIN + req.originalUrl` (no fragment).
  - Multi-source resolver for `examId` (params, body, or cached `attemptId`).
  - Cache lookup with 60s TTL and DB fallback.
  - Constant-time compare (`crypto.timingSafeEqual`) on exact 64-char buffers.
  - Sets `req.seb = { verified, mode }`. On success, records server-side verified flag.
  - Wire to: `POST .../start`, `POST|PUT .../answers`, `POST .../submit`, and `GET /attempts/:attemptId` (student only).
  - In `proctoring.service.js`, store server-side `sebVerified` boolean on event record as extra invigilator context (no severity downgrade).
  - Update CORS in `security.js` to allow `x-safeexambrowser-configkeyhash`.

### 🛑 PILOT CHECKPOINT
*Pause after Step 2. Verify with real SEB client running in `SEB_MODE=log` before proceeding to Steps 3-6.*

### Step 3 — SEB Config File Storage & Pre-Download Window (`feat/seb-03-config-file`)
- **Faculty Upload**:
  - `POST /api/v1/exams/:id/seb-file` (faculty/admin only).
  - Private S3 prefix `seb-files/:examId.seb` via `infra/s3/s3Adapter.js`.
  - Inspect initial file bytes: check for unencrypted XML plist (`<plist`), return warning if unencrypted.
- **Pre-Download Window (`SEB_PRE_DOWNLOAD_MINUTES = 30`)**:
  - `GET /api/v1/exams/:id/seb-file`: Allow enrolled students to download `.seb` starting 30 minutes before `exam.startTime` until `exam.endTime`.
  - Generates short-lived presigned S3 download URL and `sebs://` launch protocol link.

### Step 4 — Frontend Screen Share Removal & Camera Retention (`feat/seb-04-remove-screen-share`)
- Remove screen-share steps, `getDisplayMedia`, and screen capture listeners from `PreExamCheckPage.jsx`, `useScreenProctoring.jsx`, and `ExamArenaPage.jsx`.
- Retain webcam video stream, face capture, and `CAMERA_DISCONNECTED` proctoring.
- **E2E Spec Rewrites**: Note that existing tests exercising screen sharing (`phase6-lifecycle-edge-cases.spec.ts` Test 4: *"Screen-share disconnection triggers onended..."* and `production-bugs-regression.spec.ts` BUG 2: *"Screen share proctoring remains responsive..."*) must be rewritten in this step to verify camera-only proctoring and camera disconnect handling.

### Step 5 — Faculty Dashboard & Exam Settings UI (`feat/seb-05-faculty-ui`)
- Update `ExamSettingsModal.jsx`:
  - Add SEB section with `sebRequired` toggle (defaults to `SEB_DEFAULT_REQUIRED || false`).
  - Masked `sebConfigKey` input with helper: *"Copy the CONFIG KEY, not the Browser Exam Key"*.
  - File upload with unencrypted warning banner.
  - Checklist: "Confirm quitting should be OFF", "sendBrowserExamKey must be TRUE", "allowVideoCapture must be TRUE".
- Display SEB badges on exam management cards.

### Step 6 — Student SEB UX, Login & Quit Flow (`feat/seb-06-student-ux`)
- **SEB Start URL & Login Flow**:
  - The SEB Start URL directs students to `/student/exams/:id/lobby` (or `/login?redirect=/student/exams/:id/lobby`).
  - After login inside SEB, the student lands directly in the exam lobby.
- **Axios 403 Interceptor & `/student/exams/:id/seb-required` Page**:
  - Redirects standard browsers on 403 `SEB_REQUIRED` with config download & `sebs://` "Launch in SEB" action.
- **Adaptive Pre-Exam Check**:
  - If `sebRequired === true`: Replace fullscreen toggle with "SEB Security Environment Active" indicator.
  - If `sebRequired === false`: Keep standard fullscreen toggle.
- **Post-Submit Quit Action**:
  - Upon submission in `ExamArenaPage.jsx`, display "Exit Safe Exam Browser" button navigating to the actual post-submission Quit URL (e.g. `https://proctornet.duckdns.org/student/exams/:id/result` or `/exam-ended`), which must be configured in SEB settings and included in the URL allowlist.
  - Reminder in checklist: Ensure "Confirm quitting" is disabled in SEB Config Tool so clicking Quit cleanly closes the browser.

---

## 4. Open Decisions

1. **Default for New Exams**: Confirmed: `SEB_DEFAULT_REQUIRED=false` initially, controlled via env var.
2. **Database Migration Decision**: Confirmed: No migration will be executed. Attempt SEB-verified status is tracked via Redis cache during active exam sessions.

---

## 5. Future Architectural Roadmap: Browser Exam Key (BEK) Allowlist (Design Only)

For high-stakes examinations requiring maximum hardware-level tamper resistance, the platform can optionally support a dual-header verification mode:
- **Header**: `X-SafeExamBrowser-RequestHash` (generated using the Browser Exam Key).
- **Mechanism**: The BEK is generated from the specific SEB executable code signature, application bundle, and operating system build.
- **Allowlist Model**:
  - An institution administrator configures an approved BEK allowlist in `proctoringConfig.allowedBrowserExamKeys: string[]`.
  - The backend verifies:
    1. The Config Key matches the exam's settings file (`X-SafeExamBrowser-ConfigKeyHash`).
    2. The incoming `X-SafeExamBrowser-RequestHash` matches one of the authorized OS/version BEK combinations.
- **Trade-off**: Requires faculty to manage multiple BEK strings (one per supported OS version: Windows x64, macOS, iOS). Maintained as an optional high-security tier for future development.
