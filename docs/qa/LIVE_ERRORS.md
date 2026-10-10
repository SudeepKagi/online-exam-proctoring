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
