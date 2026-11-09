# ProctorNet Privacy & Data Map (FERPA & GDPR Compliance)

## 1. Overview & Architectural Principles

ProctorNet follows strict data minimization, purpose limitation, and storage limitation principles:
1. **Minimal Telemetry:** Client hardware and network checks record only coarse categorical buckets (e.g. OS family, browser family, latency category) without MAC addresses, serial numbers, IP logs, or arbitrary system inspection.
2. **Ephemeral Biometrics:** Facial verification performs 1:1 identity checks. Raw 128-dimensional biometric embeddings/descriptors are not persisted to relational storage or vector databases.
3. **Role-Based Access Control (RBAC):** Students can only view their own records; faculty can inspect assigned cohorts and assessment evidence; administrators hold system audit authority. Zero public or unauthenticated data exposure.
4. **Finite Retention & Deletion:** All automated proctoring snapshots, reference photos, and proctoring logs are subject to institutional retention rules (default 90 days) with scheduled purge automation.

---

## 2. Personal Data Inventory & Storage Map

| Data Element | Specific Fields | Storage Location | Encryption at Rest | Access / Read Permissions | Retention Period | Deletion Path |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Student Identity & Profile** | Full Name, University Email, Institution ID / USN, Role (`STUDENT`), Account Status | PostgreSQL `users` table | Database-level disk encryption (AWS RDS AES-256) | Student (own), Faculty (enrolled courses), Admin | Duration of institutional enrollment + 1 year | Admin user deletion or institutional sync offboarding |
| **Authentication Credentials** | Scrypt / Bcrypt `password_hash`, Session Refresh Tokens | PostgreSQL `users` table; HTTP-only Secure SameSite Cookies (`pn_rt`) | One-way cryptographic hash with salt; signed HMAC-SHA256 tokens | System authentication service only (never exposed in API responses) | Active account lifetime; refresh tokens expire in 7 days | Overwritten on password reset; cleared on logout |
| **Institutional Reference Photo** | Student onboarding webcam portrait | AWS S3 (`reference-photos/{userId}/*`) or fallback `users.profile_metadata` | S3 Server-Side Encryption (SSE-S3 / SSE-KMS); TLS in transit | Student (own profile), Faculty & Invigilators during live exam pre-check | Duration of student enrollment or till re-verification | Admin student evidence purge (`DELETE /admin/users/:id/evidence`) |
| **Identity Verification Card** | Student University ID card photo | AWS S3 (`id-cards/{userId}/*`) or fallback `users.profile_metadata` | S3 Server-Side Encryption (SSE-S3 / SSE-KMS); TLS in transit | Administrator approval panel only | Until account approval is finalized (max 30 days) | Auto-purged post-approval or admin evidence deletion |
| **Pre-Exam Consent Records** | Student ID, Exam ID, Consent Version (`v1.0`), Policy Agreement Text, Agreed Timestamp | PostgreSQL `student_consents` table | PostgreSQL RDS AES-256 encryption at rest | Student (own), Faculty owner, Admin | Preserved for compliance audit duration (same as exam records) | Cascades on student account or exam deletion |
| **System Readiness Telemetry** | OS family (`windows`, `macos`, `linux`), Browser family, Camera status (`true`/`false`), Latency category (`good`, `fair`, `poor`), SEB Verified status | PostgreSQL `student_readiness_reports` table | PostgreSQL RDS AES-256 encryption at rest | Student (own), Faculty exam owner, Admin | 90 days post-exam completion | Purged with exam archival or retention scheduler |
| **Exam Assessment Answers** | Selected option indices, bookmarks, answer timestamp, final calculated score | PostgreSQL `exam_attempts`, `attempt_answers` tables | PostgreSQL RDS AES-256 encryption at rest | Student (own after publish), Faculty exam creator, Invigilator, Admin | Academic grade retention period (e.g. 1 to 5 years per university policy) | Institutional exam lifecycle archival |
| **Proctoring Violation Evidence** | Webcam violation snapshots (`evidenceKey`), Event type (e.g. `MULTIPLE_FACES`, `NO_FACE`, `WINDOW_BLUR`), Severity | AWS S3 (`evidence/{attemptId}/*`), PostgreSQL `proctoring_logs` | S3 SSE-KMS at rest, presigned URLs (600s TTL); TLS 1.3 in transit | Faculty exam creator, Assigned Invigilators, Admin | Configurable via `RETENTION_DAYS` (default: 90 days) | Automated nightly retention cron job (`cleanExpiredEvidence`) or admin purge |
| **Incident Review Notes** | Review Status (`PENDING`, `REVIEWED`, `DISMISSED`, `CONFIRMED`), Invigilator/Faculty Notes, Reviewer ID, Reviewed Timestamp | PostgreSQL `exam_attempts` table (`review_status`, `review_notes`, `reviewed_at`) | PostgreSQL RDS AES-256 encryption at rest | Faculty exam owner, Invigilator, Admin | Same as exam results record | Retained with academic audit trail |

### 2.1 Cryptographic Utilities & Biometrics Storage Verification
- **Application Envelope Encryption Utility (`backend/src/utils/crypto.js`):** Available, unused in production schema as photos and violation snapshots leverage AWS S3 Server-Side Encryption (SSE-KMS / SSE-S3) with database-level AWS RDS disk encryption at rest. Callers count: 0 (reserved for future field-level PII encryption if mandated by institutional jurisdiction).
- **Biometric Vector Persistence Audit (`faceDescriptor`):** Zero storage. Grep across `backend/src`, `backend/prisma/schema.prisma`, and all database migrations confirms 0 occurrences of `faceDescriptor`. Biometric embeddings are ephemeral in-memory representations and never saved to persistent storage. Relational tables store only the boolean verification flag (`exam_attempts.face_verified: Boolean`) and the S3 photo pointer (`users.reference_photo_key: String`).

---

## 3. Telemetry Exclusions (Data We Explicitly Do NOT Collect)

To protect student privacy and minimize attack surface, the platform is strictly configured to **prohibit**:
- **Zero IP Address Logging in Business Tables:** Telemetry reports do not store client public/private IP addresses.
- **Zero Device Fingerprints or Hardware Serial Numbers:** CPU serials, MAC addresses, and persistent device GUIDs are never probed or recorded.
- **Zero Raw Biometric Descriptor Storage:** 128-dimensional facial vector descriptors are ephemeral in-memory variables and never saved to persistent storage.
- **Zero Screen Video Streaming / Continuous Screen Capture:** Full-screen kiosk lockdown (Safe Exam Browser / Fullscreen API) eliminates continuous screen recording.

---

## 4. Retention & Deletion Architecture

### 4.1 Automated Retention Job (`node-cron`)
- **Schedule:** Runs nightly (default `0 2 * * *` at 02:00 AM server time).
- **Grace Period:** `RETENTION_DAYS` environment variable (default: `90`).
- **Target Selection:** Attempts from exams whose completion date is older than `now() - RETENTION_DAYS`.
- **Review Hold Exception:** Any attempt with `review_status = 'PENDING'` or `review_status = 'CONFIRMED'` or `is_flagged = true` is automatically excluded from deletion until human staff marks it `DISMISSED` or resolves the incident.
- **Actions:**
  1. Identifies S3 evidence object keys linked to expired `proctoring_logs`.
  2. Permanently removes objects from S3 bucket via batch deletion (`DeleteObjectsCommand`).
  3. Purges corresponding `proctoring_logs` rows from PostgreSQL.
  4. Emits structured log with counts only: `[Retention] Purged N evidence objects and M log records across K attempts.` (Zero PII logged).

### 4.2 Right to Erasure / Student Evidence Deletion Tool
- **Endpoint:** `DELETE /api/v1/admin/users/:userId/evidence`
- **Authorization:** `requireRole('ADMIN')`
- **Actions:** Deletes student reference photo, ID card, and all candidate violation snapshots across all attempts. Resets `referencePhotoKey` and `idCardPhotoKey` to `null`.

### 4.3 Right of Access / Student Data Export Tool
- **Endpoint:** `GET /api/v1/admin/users/:userId/data-export`
- **Authorization:** `requireRole('ADMIN')`
- **Actions:** Compiles a complete, machine-readable JSON archive containing the student profile, enrolled courses, consent timestamps, exam attempts, scores, readiness reports, and incident logs.

