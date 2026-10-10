# ProctorNet API Route Inventory (Canonical v1 Monolith)

> **Auto-generated from code:** Generated via `scripts/ci/generate-route-inventory.js` from mounted Express routers.
> **Generation Timestamp:** `2026-10-10T03:13:18.562Z`
> **Total Endpoints:** `200` across `13` domain modules.

## Modules Summary

| Module | Route Count |
| :--- | :--- |
| `admin` | 49 |
| `attempts` | 25 |
| `audit` | 1 |
| `auth` | 12 |
| `exams` | 13 |
| `faculty` | 35 |
| `invigilator` | 12 |
| `media` | 3 |
| `notifications` | 1 |
| `proctoring` | 11 |
| `questions` | 1 |
| `student` | 25 |
| `system` | 12 |

## Master Route Matrix

| Method | Path | Auth | Role(s) | Owner Check | Module | Observable Effect | Negative Effect |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/agent/releases` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/agent/releases) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/admin/agent/releases/:id/revoke` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/agent/releases/:id/revoke) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/admin/agent/releases/revoke` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/agent/releases/revoke) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/agent/rules` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PUT` | `/api/v1/admin/agent/rules/:id` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PUT /api/v1/admin/agent/rules/:id) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/announcements` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/announcements` | Required | `admin` | No (Admin Scope) | `admin` | DB row inserted (announcements) | 0 announcements mutated |
| `DELETE` | `/api/v1/admin/announcements/:id` | Required | `admin` | No (Admin Scope) | `admin` | DB row deleted (announcements) | 0 announcements mutated |
| `GET` | `/api/v1/admin/audit-logs` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/bulk-upload/confirm` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/bulk-upload/confirm) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/admin/bulk-upload/parse` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/bulk-upload/parse) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/dashboard` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/departments` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/departments` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/departments) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/enrollments` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/enrollments/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `POST` | `/api/v1/admin/enrollments/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `POST` | `/api/v1/admin/enrollments/override` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `GET` | `/api/v1/admin/exams` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/exams/:id` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/exams/:id/invigilator-credentials` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/exams/:id/invigilator-credentials/regenerate` | Required | `admin` | No (Admin Scope) | `admin` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/admin/exams/:id/invigilator-credentials/reset` | Required | `admin` | No (Admin Scope) | `admin` | DB row created/updated (exams) | 0 exams mutated |
| `PATCH` | `/api/v1/admin/exams/:id/pause` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (exam_attempts SUSPENDED) + audit log | Attempt status untouched; 0 audit logs |
| `PATCH` | `/api/v1/admin/exams/:id/resume` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/admin/exams/all` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/faculty` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/faculty` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (POST /api/v1/admin/faculty) | Rejected requests mutate zero rows |
| `PATCH` | `/api/v1/admin/faculty/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/faculty/:id/approve) | Rejected requests mutate zero rows |
| `PATCH` | `/api/v1/admin/faculty/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/faculty/:id/reject) | Rejected requests mutate zero rows |
| `PATCH` | `/api/v1/admin/faculty/:id/suspend` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/faculty/:id/suspend) | Rejected requests mutate zero rows |
| `PATCH` | `/api/v1/admin/faculty/:id/unsuspend` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/faculty/:id/unsuspend) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/faculty/pending` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/invigilator-sessions` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/admin/invigilator-sessions/:id/revoke` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/invigilator-sessions/:id/revoke) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/reports` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/settings` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/admin/settings` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (platform_settings) | 0 settings mutated |
| `GET` | `/api/v1/admin/students` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/admin/students` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `PATCH` | `/api/v1/admin/students/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `PATCH` | `/api/v1/admin/students/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `PATCH` | `/api/v1/admin/students/:id/suspend` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `PATCH` | `/api/v1/admin/students/:id/unsuspend` | Required | `admin` | No (Admin Scope) | `admin` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `GET` | `/api/v1/admin/students/pending` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/support/tickets` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/admin/support/tickets/:id` | Required | `admin` | No (Admin Scope) | `admin` | DB row mutated (PATCH /api/v1/admin/support/tickets/:id) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/admin/violations` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/admin/violations/summary` | Required | `admin` | No (Admin Scope) | `admin` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/agent/download` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/agent/manifest` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/agent/pair` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/agent/pair) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/agent/report` | Public | `Public` | No | `system` | DB row mutated (POST /api/v1/agent/report) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/agent/pairing-code` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/agent/pairing-code) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId/agent/status` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PUT` | `/api/v1/attempts/:attemptId/answers` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `PUT` | `/api/v1/attempts/:attemptId/answers/:attemptQuestionId` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row upserted (answers) with CAS revision increment | 0 answer rows mutated; revision unchanged |
| `POST` | `/api/v1/attempts/:attemptId/identity-override` | Required | `admin, invigilator` | Yes | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/identity-override) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId/identity-status` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/attempts/:attemptId/liveness-challenge` | Required | `student` | Yes (Candidate Identity) | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/pause` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` | DB row updated (exam_attempts SUSPENDED) + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/attempts/:attemptId/result` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/resume` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/attempts/:attemptId/snapshots/read` | Required | `admin, invigilator, faculty` | Yes | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/snapshots/ticket` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/snapshots/ticket) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/attempts/:attemptId/state` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/state` | Required | `admin, faculty` | Yes | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/state) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/:attemptId/submission` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/submission) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/:attemptId/terminate` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` | DB row updated (exam_attempts TERMINATED) + Outbox row + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/attempts/:attemptId/timeline` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/verify-identity` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row mutated (POST /api/v1/attempts/:attemptId/verify-identity) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/attempts/:attemptId/violations` | Required | `student` | Yes (Candidate Identity) | `attempts` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `POST` | `/api/v1/attempts/:attemptId/violations/:violationId/evidence/complete` | Required | `Any Authenticated` | No | `attempts` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `DELETE` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` | DB row mutated (vpn_peers / vpn_ip_pool leased or released) | 0 VPN leases modified |
| `GET` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` | DB row mutated (vpn_peers / vpn_ip_pool leased or released) | 0 VPN leases modified |
| `GET` | `/api/v1/attempts/:attemptId/vpn-status` | Required | `Any Authenticated` | No | `attempts` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/audit/logs` | Required | `admin` | No (Admin Scope) | `audit` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/auth/admin/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/admin/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/change-password` | Required | `Any Authenticated` | No | `auth` | DB row mutated (POST /api/v1/auth/change-password) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/faculty/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/faculty/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/faculty/register` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/faculty/register) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/invigilator/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/invigilator/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/login` | Public | `Public` | No | `auth` | Session token issued; cookie set | Zero tokens issued; zero cookies set |
| `POST` | `/api/v1/auth/logout` | Public | `Public` | No | `auth` | Session cookie cleared; token invalidated | Zero session changes |
| `POST` | `/api/v1/auth/logout-all` | Required | `Any Authenticated` | No | `auth` | Session cookie cleared; token invalidated | Zero session changes |
| `GET` | `/api/v1/auth/me` | Required | `Any Authenticated` | No | `auth` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/auth/refresh` | Public | `Public` | No | `auth` | Rotated token pair issued | Zero tokens rotated; zero session changes |
| `POST` | `/api/v1/auth/student/login` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/student/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/auth/student/register` | Public | `Public` | No | `auth` | DB row mutated (POST /api/v1/auth/student/register) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/config` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/exams` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/exams/:examId` | Required | `Any Authenticated` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PUT` | `/api/v1/exams/:examId` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/attempt` | Required | `student` | Yes (Candidate Identity) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/exams/:examId/chat` | Required | `Any Authenticated` | No | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/exams/:examId/chat` | Required | `Any Authenticated` | No | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/invigilator-credentials/regenerate` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/prewarm` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/publish` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/exams/:examId/questions` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row created/updated (questions) | 0 questions mutated |
| `POST` | `/api/v1/exams/:examId/readiness` | Required | `student` | Yes (Candidate Identity) | `exams` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/exams/:examId/results` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/exams/:examId/results/release` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` | DB row updated (exam_results is_released=true) + Redis emit | 0 results modified; 0 emits dispatched |
| `GET` | `/api/v1/faculty/dashboard` | Required | `faculty` | Yes | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/faculty/exams` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/exams` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/faculty/exams/:examId/ai-generate` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/exams/:examId/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/exams/:examId/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `POST` | `/api/v1/faculty/exams/:examId/questions/import-excel` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `GET` | `/api/v1/faculty/exams/:examId/results/:studentId` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `DELETE` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row deleted (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/exams/:id/collusion` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/faculty/exams/:id/credentials` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/exams/:id/duplicate` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/exams/:id/export-csv` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/exams/:id/invigilator-credentials/regenerate` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `PATCH` | `/api/v1/faculty/exams/:id/publish` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/faculty/exams/:id/publish` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/faculty/exams/:id/publish-alt` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/faculty/exams/:id/regenerate-invigilator` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/exams/:id/results` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/faculty/exams/:id/results/release` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row updated (exam_results is_released=true) + Redis emit | 0 results modified; 0 emits dispatched |
| `GET` | `/api/v1/faculty/exams/:id/students` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/exams/:id/students` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `POST` | `/api/v1/faculty/exams/ai-generate-preview` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/faculty/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/faculty/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `DELETE` | `/api/v1/faculty/questions/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row deleted (questions) | 0 questions mutated |
| `PUT` | `/api/v1/faculty/questions/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `POST` | `/api/v1/faculty/questions/bulk` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `POST` | `/api/v1/faculty/questions/import-excel` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | DB row created/updated (questions) | 0 questions mutated |
| `GET` | `/api/v1/faculty/results` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/faculty/results/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/faculty/students` | Required | `faculty` | Yes | `faculty` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/faculty/students/:id/approve` | Required | `faculty` | Yes | `faculty` | DB row updated (students/enrollments approval_status mutated) | 0 student records mutated |
| `GET` | `/api/v1/health` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/invigilator/exam/:examId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/invigilator/exam/:examId/terminate/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | DB row updated (exam_attempts TERMINATED) + Outbox row + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/invigilator/exam/:examId/warn/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | Audit log row created + Socket notification dispatched | 0 audit logs created; 0 notifications dispatched |
| `GET` | `/api/v1/invigilator/exams/:examId/students` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/invigilator/live-grid/:examId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/invigilator/login` | Required | `invigilator, faculty, admin` | Yes | `invigilator` | DB row mutated (POST /api/v1/invigilator/login) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/invigilator/pause-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | DB row updated (exam_attempts SUSPENDED) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/invigilator/resume-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/invigilator/send-warning` | Required | `invigilator, faculty, admin` | Yes | `invigilator` | DB row mutated (POST /api/v1/invigilator/send-warning) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/invigilator/terminate-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | DB row updated (exam_attempts TERMINATED) + Outbox row + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/invigilator/violations` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/invigilator/violations/:id/action` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `POST` | `/api/v1/media/complete-upload` | Required | `Any Authenticated` | No | `media` | DB row mutated (POST /api/v1/media/complete-upload) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/media/presign-upload` | Required | `Any Authenticated` | No | `media` | S3 presigned URL/POST policy issued + DB ticket created | 0 S3 policies issued; 0 DB tickets created |
| `GET` | `/api/v1/media/view` | Required | `Any Authenticated` | No | `media` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/notifications` | Required | `Any Authenticated` | No | `notifications` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/pause` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | DB row updated (exam_attempts SUSPENDED) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/resume` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | DB row updated (exam_attempts ACTIVE) + audit log | Attempt status untouched; 0 audit logs |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/terminate` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | DB row updated (exam_attempts TERMINATED) + Outbox row + audit log | Attempt status untouched; 0 audit logs |
| `GET` | `/api/v1/proctoring/attempts/:attemptId/violations` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/warn` | Required | `admin, faculty, invigilator` | Yes | `proctoring` | Audit log row created + Socket notification dispatched | 0 audit logs created; 0 notifications dispatched |
| `GET` | `/api/v1/proctoring/exams/:examId/roster` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/exams/:examId/summary` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/proctoring/exams/:examId/violations` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/proctoring/exams/:id/snapshots/read` | Required | `admin, faculty, invigilator` | Yes (Faculty Exam Owner) | `proctoring` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/proctoring/token` | Required | `Any Authenticated` | No | `proctoring` | DB row mutated (POST /api/v1/proctoring/token) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/proctoring/violations/:violationId/acknowledge` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
| `DELETE` | `/api/v1/questions/:questionId` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `questions` | DB row deleted (questions) | 0 questions mutated |
| `POST` | `/api/v1/staff/attempts/:attemptId/agent/recheck` | Required | `faculty, invigilator, admin` | Yes | `system` | DB row mutated (POST /api/v1/staff/attempts/:attemptId/agent/recheck) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/staff/attempts/:attemptId/agent/waiver` | Required | `faculty, invigilator, admin` | Yes | `system` | DB row mutated (POST /api/v1/staff/attempts/:attemptId/agent/waiver) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/agent/pairing-code` | Required | `student` | Yes | `student` | DB row mutated (POST /api/v1/student/agent/pairing-code) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/student/agent/status` | Required | `student` | Yes | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/enrollment/consent` | Required | `student` | Yes (Candidate Identity) | `student` | DB row mutated (POST /api/v1/student/enrollment/consent) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/enrollment/face` | Required | `student` | Yes | `student` | DB row mutated (POST /api/v1/student/enrollment/face) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/enrollment/id` | Required | `student` | Yes | `student` | DB row mutated (POST /api/v1/student/enrollment/id) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/student/enrollment/status` | Required | `student` | Yes | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams/:id` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams/:id/chat` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/exams/:id/chat` | Required | `student` | Yes (Candidate Identity) | `student` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/student/exams/:id/identity-verify` | Required | `student` | Yes (Candidate Identity) | `student` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/student/exams/:id/lobby` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `GET` | `/api/v1/student/exams/:id/start` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/exams/:id/start` | Required | `student` | Yes (Candidate Identity) | `student` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/student/exams/:id/verify-face` | Required | `student` | Yes (Candidate Identity) | `student` | DB row created/updated (exams) | 0 exams mutated |
| `POST` | `/api/v1/student/exams/:id/verify-id` | Required | `student` | Yes (Candidate Identity) | `student` | DB row created/updated (exams) | 0 exams mutated |
| `GET` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `PATCH` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` | DB row mutated (PATCH /api/v1/student/profile) | Rejected requests mutate zero rows |
| `PUT` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` | DB row mutated (PUT /api/v1/student/profile) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/re-enrollment-request` | Required | `student` | Yes | `student` | DB row mutated (POST /api/v1/student/re-enrollment-request) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/student/results` | Required | `student` | Yes | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/support/ticket` | Required | `student` | Yes | `student` | DB row mutated (POST /api/v1/student/support/ticket) | Rejected requests mutate zero rows |
| `GET` | `/api/v1/student/support/tickets` | Required | `student` | Yes (Candidate Identity) | `student` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/student/verify-face` | Required | `student` | Yes (Candidate Identity) | `student` | DB row mutated (POST /api/v1/student/verify-face) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/student/verify-id` | Required | `student` | Yes (Candidate Identity) | `student` | DB row mutated (POST /api/v1/student/verify-id) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/uploads/complete` | Required | `Any Authenticated` | No | `system` | DB row mutated (POST /api/v1/uploads/complete) | Rejected requests mutate zero rows |
| `POST` | `/api/v1/uploads/presign` | Required | `Any Authenticated` | No | `system` | S3 presigned URL/POST policy issued + DB ticket created | 0 S3 policies issued; 0 DB tickets created |
| `GET` | `/api/v1/version` | Public | `Public` | No | `system` | None (Read-only query) | None (Zero DB/storage mutation) |
| `POST` | `/api/v1/violations/:violationId/evidence/complete` | Required | `Any Authenticated` | No | `system` | DB row inserted (violation_events) + flag_count incremented | 0 violation_events inserted; 0 flag counts mutated |
