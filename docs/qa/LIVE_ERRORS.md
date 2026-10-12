# Live Site Error Inventory & Resolution Ledger (Prompt 11 / V1.7)

> **Incident Context:** Errors observed by real users on the live production environment (`https://proctornet.duckdns.org`) that were previously masked by test doubles or unparameterized happy-path checks.

---

## Error Catalog & Root Cause Analysis

### 1. Student Enrollment Photo Upload Failure (403 Forbidden)
* **Observed Symptoms:**
  - Route `/student/enrollment` fails when capturing selfie or uploading ID card.
  - Toast displayed: Generic "Access denied. You do not have permission to access this resource."
  - Browser console logs:
    - `POST /api/student/enrollment/face 403`
    - `POST /api/v1/auth/refresh 401`
    - `/api/auth/me 401 & 404`
    - `/api/notifications 401`
* **Root Causes:**
  1. **Direct Base64 Submission vs Presigned Ticket:** `StudentEnrollment.jsx` passed the raw canvas base64 data URL (`data:image/jpeg;base64,...`) directly into the payload. The backend `studentService.enrollFace` enforced R-06/R-07 by verifying the key with `pendingUploadRegistry.verifyAndConsumeUpload()`. Since no server ticket was ever requested or issued for that key, `pendingUploads.js` threw `ForbiddenError("Invalid or unissued upload key")` (403).
  2. **Unversioned API Base Path:** `frontend/src/utils/api.js` had `baseURL: '/api'` instead of `/api/v1`, forcing requests through an unversioned URL rewrite shim.
  3. **Ghost Session Shell on Refresh Expiry:** When tokens expired or DB auth epoch bumped, `POST /api/v1/auth/refresh` returned 401, but the SPA remained in a half-authenticated state without clearing session storage and redirecting.
* **Resolution:**
  - Updated `StudentEnrollment.jsx` to request a presigned ticket from `POST /media/presign-upload` (`purpose: 'FACE_ENROLLMENT'` / `'ID_ENROLLMENT'`), upload the JPEG blob directly to S3 / MinIO via presigned URL, and submit the server-validated storage key.
  - Migrated `baseURL` in `api.js` to `/api/v1` and completely deleted the Express `/api/* -> /api/v1/*` rewrite shim.
  - Added full session cleanup (`localStorage`, `sessionStorage`, `authChannel`, custom event) on 401 refresh failure with immediate navigation to `/student/login`.
  - Added specific error catalog codes (`PROFILE_LOCKED`, `RE_ENROLLMENT_REQUIRED`, `CONSENT_REQUIRED`, `UPLOAD_REJECTED`) so toasts explain the exact cause instead of generic "Access denied".

---

### 2. Misleading Anti-Spoofing & Tech Badge Copy
* **Observed Symptoms:**
  - Two people visible in the frame yet UI claimed "Anti-spoofing liveness check passed".
  - UI displayed technical badge: "FaceVerifier Engine Active".
* **Root Causes:**
  - Client webcam capture had no quality pre-check and unconditionally set status string to "Anti-spoofing liveness check passed".
  - Exposed internal technology names violating abstraction guidelines (§4.1).
* **Resolution:**
  - Added client-side frame luminance analysis on canvas capture to verify sufficient and balanced illumination before allowing capture.
  - Renamed user-facing status to "Live camera check passed".
  - Removed "FaceVerifier Engine Active" badge in favor of clean, services-only copy ("Candidate Verification Active").

---

### 3. Faculty Exam Detail Page Crash (`TypeError: Cannot read properties of undefined`)
* **Observed Symptoms:**
  - Navigating to `/faculty/exams/:id` displayed "Something went wrong" crash screen.
  - Console: `TypeError: Cannot read properties of undefined (reading 'length')` in `ExamDetail.jsx`.
* **Root Causes:**
  - In `faculty/service.js`, `getExam(id, facultyId)` transformed the database record using `toFacultyExamDTO()`.
  - `toFacultyExamDTO` did not map the `questions` array, leaving `res.data.exam.questions` as `undefined`.
  - `ExamDetail.jsx` evaluated `exam.questions.length`, immediately throwing a TypeError.
* **Resolution:**
  - Updated `toFacultyExamDTO` to always return an array for `questions` (`Array.isArray(e.questions) ? e.questions.map(toFacultyQuestionDTO) : []`), ensuring `questions` is never `undefined`.
  - Defensively guarded all array references in `ExamDetail.jsx` with `(exam?.questions ?? []).length` and `(exam?.questions ?? []).map()`.
  - Added friendly ErrorBoundary fallback rendering with action links.

---

### 4. Invigilator Credentials Modal Missing Fields & Empty Password
* **Observed Symptoms:**
  - Admin → Exams → "Invigilator Access Credentials" modal showed blank Subject, Faculty, and Time Window.
  - Password displayed as `••••••••`, and clicking "Copy Full Credentials Package" copied `undefined` / empty string.
* **Root Causes:**
  - `GET /api/v1/admin/exams/:id/invigilator-credentials` only returned `{ success: true, examId, invId }`, omitting all scheduling metadata.
  - Passwords are one-time unambiguous strings hashed with bcrypt upon creation; existing exams do not retain plaintext passwords in the database.
  - The UI attempted to display a password for existing exams where none existed in plaintext, leading to blank copies.
* **Resolution:**
  - Updated backend controller to return complete exam metadata (`title`, `subject`, `facultyName`, `startTime`, `endTime`, `duration`, `status`, `invId`, `passwordMasked: true`).
  - Updated modal UX: Existing exams display "Password hidden for security (stored as one-time hash)" with an explicit "Reset Password" action.
  - When the administrator clicks "Reset Password", a new one-time password is generated, audit-logged, and revealed once with full copy capabilities.
  - Disabled "Copy Full Credentials Package" unless a password was freshly generated.

---

### 5. Automated AI Question Generation Provider Configuration
* **Observed Symptoms:**
  - Question generator showed ambiguous errors when `LLM_PROVIDER` was unconfigured or set to `none`.
* **Root Causes:**
  - Server defaults `LLM_PROVIDER='none'`. Missing provider credentials were not communicated clearly to faculty users.
* **Resolution:**
  - When `!llmEnabled`, UI displays clear, friendly notice: "Question assistant isn't enabled — ask the administrator", cleanly disabling the action without throwing runtime errors.
  - Documented secure AWS SSM Parameter Store storage (`/proctornet/prod/LLM_PROVIDER`, `/LLM_API_KEY`) and IAM permissions in `docs/runbooks/secrets.md` and Terraform `iam.tf`.

---

### 6. Profile Photo Truth & Dynamic Status Badges (S-1)
* **Observed Symptoms:**
  - Student profile, sidebar, and admin/faculty student lists showed broken image icons (404) or failed to load photos.
  - Badges showed "Registered" even when biometric photos had not been uploaded or presigned URLs were invalid.
* **Root Causes:**
  - `Profile.jsx` had a bug (`s.facePhotoKey || s.facePhotoUrl`) that passed the raw storage key (e.g. `identity/...webp`) as the image src, prompting the browser to query the frontend URL and failing with 404.
  - DTOs and API endpoints did not verify actual existence of S3 objects before declaring them available.
* **Resolution:**
  - Created centralized presenter (`proctornet/backend/src/modules/student/presenter.js`) with cached `HeadObject` validation (10 min TTL) and 1-hour presigned URLs. Returns `photoAvailable: false` and `facePhotoUrl: null` when storage objects are missing.
  - Implemented `<SignedImage>` component with automatic refresh on expiration and neutral initials avatar placeholder.
  - Profile status badge dynamically computes "Registered", "ID Uploaded", "Re-upload Required", or "Not Registered" strictly based on verifiable storage truth.
  - Verified with unit tests (`tests/w1-student-presenter.test.js`).

---

### 7. Exam Device Companion Gating & Rehydration Isolation (S-2 & S-3)
* **Observed Symptoms:**
  - New exam attempt showed "Companion: HEALTHY" even though the device companion was closed, because an earlier practice `PRECHECK` session from hours earlier was still open.
  - Terminated sessions rehydrated with fresh `Date.now()` on reconnect.
  - Dev bypass allowed arbitrary scripts to simulate companion passes.
* **Root Causes:**
  - `agentStatusService.js` fell back to `getSessionByStudentId(attempt.studentId)` which matched stale `PRECHECK` sessions.
  - Session rehydration used `lastSeenAt: Date.now()` instead of database `lastSeenAt`.
  - Production code retained hardcoded dev hash bypass.
* **Resolution:**
  - Created centralized `agentGate.js` (`evaluateDeviceGate` & `assertDeviceGate`): strictly requires attempt-scoped session, fresh heartbeat (`< 45s`), and active release build hash. `PRECHECK` practice sessions are isolated and never satisfy attempt gates.
  - Rehydration restored from database timestamp.
  - Removed dev build hash bypass in production; requires verified `agent_releases` row.
  - Sessions automatically terminated on exam submission or expiry.
  - Verified with consecutive exams test suite (`tests/w2-agent-gate.test.js`).

---

### 8. Fullscreen Gesture Expiration & Misleading Start Error (S-4)
* **Observed Symptoms:**
  - If entering an exam failed due to server reasons (e.g. companion not started), UI displayed: "Full-screen mode required to enter exam."
  - Fullscreen API call failed because it was called after an asynchronous network await, losing browser user gesture activation.
* **Root Causes:**
  - Catch-all block in `handleLockAndStartExam` assumed every failure was a fullscreen error.
  - Fullscreen requested after `await api.post(...)`.
* **Resolution:**
  - Synchronously request fullscreen immediately on the click event before any network `await`.
  - Unpacked distinct error codes in catch block: maps `AGENT_REQUIRED` to companion instructions (redirecting to Step 1), `IDENTITY_REQUIRED` to biometric check, `EXAM_NOT_OPEN`, `ROOM_FULL`, and `SESSION_EXPIRED`.
  - Added live `fullscreenchange` listener with dynamic "Locked" status and F11 hint.

---

### 9. Groq LLM Question Generation Integration (S-5)
* **Observed Symptoms:**
  - AI question generation required real LLM integration with fast inference and cost discipline.
* **Resolution:**
  - Added `groq` provider driver (`llama-3.3-70b-versatile`) via Groq Chat Completions API with strict `json_object` format and schema validation.
  - Supported `GROQ_API_KEY` alias for `LLM_API_KEY`.
  - Configured secure header `x-goog-api-key` for Google provider.
  - Implemented in-memory rate limiting & cost capping fallback when Redis is offline.
  - Sanitized provider errors to return clean user-facing notices with reference IDs.
  - Verified with unit tests (`tests/w3-groq-llm.test.js`).

---

### 10. Plain, Professional Educational Terminology Standardization (S-6 & S-7)
* **Observed Symptoms:**
  - UI displayed confusing engineering jargon: "Dossier", "Live Grid", "Violations", "Console", "Diagnostic Log", "Live Probe".
* **Resolution:**
  - Created `proctornet/frontend/src/lib/labels.js` and canonical reference `docs/ux/TERMINOLOGY.md`.
  - Replaced terms across student, faculty, invigilator, and administrator pages ("Dossier" -> "Student Profile", "Live Grid" -> "Live Monitoring", "Violations" -> "Incidents", "Console" -> "Workspace", "Diagnostic Log" -> "Readiness Check").
  - Added static analysis ratchet check to `scripts/ci/scan-banned-terms.js` and `scripts/ci/quality.js` to ensure zero deprecated jargon regressions in CI.

