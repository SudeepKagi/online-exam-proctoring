# ProctorNet API Route Inventory (Canonical v1 Monolith)

> **Auto-generated from code:** Generated via `scripts/ci/generate-route-inventory.js` from mounted Express routers.
> **Generation Timestamp:** `2026-10-17T06:37:50.584Z`
> **Total Endpoints:** `103` across `10` domain modules.

## Modules Summary

| Module | Route Count |
| :--- | :--- |
| `admin` | 1 |
| `attempts` | 17 |
| `auth` | 10 |
| `exams` | 14 |
| `faculty` | 3 |
| `invigilator` | 1 |
| `media` | 9 |
| `proctoring` | 11 |
| `student` | 7 |
| `system` | 30 |

## Master Route Matrix

| Method | Path | Auth | Role(s) | Owner Check | Module | Observable Effect | Negative Effect |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/:attemptId` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/:attemptId/answers` | Public | `Public` | No | `system` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `POST` | `/api/v1/:attemptId/answers/batch` | Public | `Public` | No | `system` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `POST` | `/api/v1/:attemptId/resume` | Public | `Public` | No | `system` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/:attemptId/submit` | Public | `Public` | No | `system` | DB row updated (exam_attempts SUBMITTED) + Outbox row (attempt.submitted) | 0 outbox events created; attempt status unchanged |
| `POST` | `/api/v1/:attemptId/suspend` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/:attemptId/suspend) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/:attemptId/vpn-status` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/:examId/readiness` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/:examId/readiness) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/:examId/start` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/:examId/start) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/:id` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/:id/assign` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/:id/assign) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/:id/publish` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/:id/publish) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/:id/questions` | Public | `Public` | No | `system` | DB row created/updated (questions) | 0 questions mutated |
| `DELETE` | `/api/v1/:id/questions/:questionId` | Public | `Public` | No | `system` | DB row deleted (questions) | 0 questions mutated |
| `POST` | `/api/v1/admin/login` | Public | `Public` | No | `admin` | DB row mutated (POST /api/v1/admin/login) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId` | Public | `Public` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/answers` | Public | `Public` | No | `attempts` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `POST` | `/api/v1/attempts/:attemptId/answers/batch` | Public | `Public` | No | `attempts` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `GET` | `/api/v1/attempts/:attemptId/identity-status` | Public | `Public` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/resume` | Public | `Public` | No | `attempts` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/attempts/:attemptId/submit` | Public | `Public` | No | `attempts` | DB row updated (exam_attempts SUBMITTED) + Outbox row (attempt.submitted) | 0 outbox events created; attempt status unchanged |
| `POST` | `/api/v1/attempts/:attemptId/suspend` | Public | `Public` | No | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/suspend) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/:attemptId/verify-identity` | Public | `Public` | No | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/verify-identity) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId/violations` | Public | `Public` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/violations` | Public | `Public` | No | `attempts` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `GET` | `/api/v1/attempts/:attemptId/vpn-status` | Public | `Public` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:examId/readiness` | Public | `Public` | No | `attempts` | DB row mutated (POST /api/v1/attempts/:examId/readiness) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/:examId/start` | Public | `Public` | No | `attempts` | DB row mutated (POST /api/v1/attempts/:examId/start) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/exams/:examId/readiness` | Public | `Public` | No | `attempts` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/attempts/exams/:examId/start` | Public | `Public` | No | `attempts` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/attempts/student/exams/:examId/start` | Public | `Public` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/student/exams/:examId/start` | Public | `Public` | No | `attempts` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/auth/admin/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/admin/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/faculty/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/faculty/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/faculty/register` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/faculty/register) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/invigilator/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/invigilator/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/login` | Public | `Public` | No | `auth` | Session token issued; cookie set | Zero tokens issued; zero cookies set |
| `POST` | `/api/v1/auth/logout` | Public | `Public` | No | `auth` | Session cookie cleared; token invalidated | Zero session changes |
| `GET` | `/api/v1/auth/me` | Public | `Public` | No | `auth` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/auth/register` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/register) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/student/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/student/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/student/register` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/student/register) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/config` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/exams` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/exams` | Public | `Public` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/readiness` | Public | `Public` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/start` | Public | `Public` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/exams/:examId/violations` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/exams/:id` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/exams/:id/assign` | Public | `Public` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:id/publish` | Public | `Public` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:id/questions` | Public | `Public` | No | `exams` | DB row created/updated (questions) | 0 questions mutated |
| `DELETE` | `/api/v1/exams/:id/questions/:questionId` | Public | `Public` | No | `exams` | DB row deleted (questions) | 0 questions mutated |
| `GET` | `/api/v1/exams/faculty/exams` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/exams/student/exams` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/exams/student/exams/:id` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/exams/student/exams/:id/lobby` | Public | `Public` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/faculty/exams` | Public | `Public` | No | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/login` | Public | `Public` | No | `faculty` | DB row mutated (POST /api/v1/faculty/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/faculty/register` | Public | `Public` | No | `faculty` | DB row mutated (POST /api/v1/faculty/register) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/health` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/invigilator/login` | Public | `Public` | No | `invigilator` | DB row mutated (POST /api/v1/invigilator/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/login` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/logout` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/logout) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/me` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/media/attempts/:attemptId/identity-status` | Public | `Public` | No | `media` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/media/attempts/:attemptId/verify-identity` | Public | `Public` | No | `media` | DB row mutated (POST /api/v1/media/attempts/:attemptId/verify-identity) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/media/media/presign-upload` | Public | `Public` | No | `media` | S3 presigned URL/POST policy issued + DB ticket created | 0 S3 policies issued; 0 DB tickets created |
| `POST` | `/api/v1/media/media/verify-face` | Public | `Public` | No | `media` | DB row mutated (POST /api/v1/media/media/verify-face) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/media/presign-upload` | Public | `Public` | No | `media` | S3 presigned URL/POST policy issued + DB ticket created | 0 S3 policies issued; 0 DB tickets created |
| `POST` | `/api/v1/media/upload-mock` | Public | `Public` | No | `media` | DB row mutated (POST /api/v1/media/upload-mock) | Rejected requests mutate zero rows |
| `PUT` | `/api/v1/media/upload-mock` | Public | `Public` | No | `media` | DB row mutated (PUT /api/v1/media/upload-mock) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/media/verify-face` | Public | `Public` | No | `media` | DB row mutated (POST /api/v1/media/verify-face) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/media/view` | Public | `Public` | No | `media` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/presign-upload` | Public | `Public` | No | `system` | S3 presigned URL/POST policy issued + DB ticket created | 0 S3 policies issued; 0 DB tickets created |
| `GET` | `/api/v1/proctoring/attempts/:attemptId/logs` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/attempts/:attemptId/violations` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/violations` | Public | `Public` | No | `proctoring` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `GET` | `/api/v1/proctoring/exams/:examId/logs` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/exams/:examId/violations` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/proctoring/attempts/:attemptId/logs` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/proctoring/exams/:examId/logs` | Public | `Public` | No | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/proctoring/proctoring/violation` | Public | `Public` | No | `proctoring` | DB row mutated (POST /api/v1/proctoring/proctoring/violation) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/proctoring/proctoring/violations` | Public | `Public` | No | `proctoring` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `POST` | `/api/v1/proctoring/violation` | Public | `Public` | No | `proctoring` | DB row mutated (POST /api/v1/proctoring/violation) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/proctoring/violations` | Public | `Public` | No | `proctoring` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `POST` | `/api/v1/register` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/register) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/student/exams` | Public | `Public` | No | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams/:examId/start` | Public | `Public` | No | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/exams/:examId/start` | Public | `Public` | No | `student` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/student/exams/:id` | Public | `Public` | No | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams/:id/lobby` | Public | `Public` | No | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/login` | Public | `Public` | No | `student` | DB row mutated (POST /api/v1/student/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/register` | Public | `Public` | No | `student` | DB row mutated (POST /api/v1/student/register) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/upload-mock` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/upload-mock) | Rejected requests mutate zero rows |
| `PUT` | `/api/v1/upload-mock` | Public | `Public` | No | `system` | DB row mutated (PUT /api/v1/upload-mock) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/verify-face` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/verify-face) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/version` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/view` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/violation` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/violation) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/violations` | Public | `Public` | No | `system` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
