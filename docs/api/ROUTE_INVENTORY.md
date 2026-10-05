# ProctorNet API Route Inventory (Canonical v1 Monolith)

> **Auto-generated from code:** Generated via `scripts/ci/generate-route-inventory.js` from mounted Express routers.
> **Generation Timestamp:** `2026-10-05T07:22:01.977Z`
> **Total Endpoints:** `178` across `14` domain modules.

## Modules Summary

| Module | Route Count |
| :--- | :--- |
| `admin` | 40 |
| `attempts` | 15 |
| `audit` | 1 |
| `auth` | 10 |
| `deviceCheck` | 6 |
| `exams` | 11 |
| `faculty` | 33 |
| `invigilator` | 12 |
| `media` | 3 |
| `notifications` | 1 |
| `proctoring` | 10 |
| `questions` | 1 |
| `student` | 28 |
| `system` | 7 |

## Master Route Matrix

| Method | Path | Auth | Role(s) | Owner Check | Module |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/admin/announcements` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/announcements` | Required | `admin` | No (Admin Scope) | `admin` |
| `DELETE` | `/api/v1/admin/announcements/:id` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/audit-logs` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/bulk-upload/confirm` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/bulk-upload/parse` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/dashboard` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/enrollments` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/enrollments/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/enrollments/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/enrollments/override` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/exams` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/exams/:id` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/exams/:id/invigilator-credentials` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/exams/:id/invigilator-credentials/regenerate` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/exams/:id/invigilator-credentials/reset` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/exams/:id/pause` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/exams/:id/resume` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/exams/all` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/faculty` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/faculty` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/faculty/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/faculty/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/faculty/:id/suspend` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/faculty/:id/unsuspend` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/faculty/pending` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/invigilator-sessions` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/invigilator-sessions/:id/revoke` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/reports` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/settings` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/settings` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/students` | Required | `admin` | No (Admin Scope) | `admin` |
| `POST` | `/api/v1/admin/students` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/students/:id/approve` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/students/:id/reject` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/students/:id/suspend` | Required | `admin` | No (Admin Scope) | `admin` |
| `PATCH` | `/api/v1/admin/students/:id/unsuspend` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/students/pending` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/violations` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/admin/violations/summary` | Required | `admin` | No (Admin Scope) | `admin` |
| `GET` | `/api/v1/attempts/:attemptId` | Required | `Any Authenticated` | No | `attempts` |
| `PUT` | `/api/v1/attempts/:attemptId/answers` | Required | `student` | Yes (Candidate Identity) | `attempts` |
| `PUT` | `/api/v1/attempts/:attemptId/answers/:attemptQuestionId` | Required | `student` | Yes (Candidate Identity) | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/pause` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` |
| `GET` | `/api/v1/attempts/:attemptId/result` | Required | `Any Authenticated` | No | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/resume` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` |
| `GET` | `/api/v1/attempts/:attemptId/state` | Required | `Any Authenticated` | No | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/state` | Required | `admin, faculty` | Yes | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/submission` | Required | `student` | Yes (Candidate Identity) | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/terminate` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `attempts` |
| `GET` | `/api/v1/attempts/:attemptId/timeline` | Required | `Any Authenticated` | No | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/violations` | Required | `student` | Yes (Candidate Identity) | `attempts` |
| `DELETE` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` |
| `GET` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` |
| `POST` | `/api/v1/attempts/:attemptId/vpn` | Required | `Any Authenticated` | No | `attempts` |
| `GET` | `/api/v1/audit/logs` | Required | `admin` | No (Admin Scope) | `audit` |
| `POST` | `/api/v1/auth/admin/login` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/change-password` | Required | `Any Authenticated` | No | `auth` |
| `POST` | `/api/v1/auth/faculty/login` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/faculty/register` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/invigilator/login` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/login` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/logout` | Public | `Public` | No | `auth` |
| `GET` | `/api/v1/auth/me` | Required | `Any Authenticated` | No | `auth` |
| `POST` | `/api/v1/auth/student/login` | Public | `Public` | No | `auth` |
| `POST` | `/api/v1/auth/student/register` | Public | `Public` | No | `auth` |
| `GET` | `/api/v1/config` | Public | `Public` | No | `system` |
| `POST` | `/api/v1/device-check` | Required | `student` | Yes | `deviceCheck` |
| `POST` | `/api/v1/device-check/run` | Required | `student` | Yes | `deviceCheck` |
| `POST` | `/api/v1/evidence-clip` | Required | `student` | Yes | `system` |
| `POST` | `/api/v1/exam/device-check` | Required | `student` | Yes | `deviceCheck` |
| `POST` | `/api/v1/exam/evidence-clip` | Required | `student` | Yes | `deviceCheck` |
| `POST` | `/api/v1/exam/livekit-token` | Required | `student, invigilator, faculty, admin` | Yes | `deviceCheck` |
| `POST` | `/api/v1/exam/snapshot` | Required | `student` | Yes | `deviceCheck` |
| `POST` | `/api/v1/exams` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `GET` | `/api/v1/exams/:examId` | Required | `Any Authenticated` | No | `exams` |
| `PUT` | `/api/v1/exams/:examId` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `POST` | `/api/v1/exams/:examId/attempt` | Required | `student` | Yes (Candidate Identity) | `exams` |
| `GET` | `/api/v1/exams/:examId/chat` | Required | `Any Authenticated` | No | `exams` |
| `POST` | `/api/v1/exams/:examId/chat` | Required | `Any Authenticated` | No | `exams` |
| `POST` | `/api/v1/exams/:examId/prewarm` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `POST` | `/api/v1/exams/:examId/publish` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `POST` | `/api/v1/exams/:examId/questions` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `GET` | `/api/v1/exams/:examId/results` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `POST` | `/api/v1/exams/:examId/results/release` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `exams` |
| `GET` | `/api/v1/faculty/dashboard` | Required | `faculty` | Yes | `faculty` |
| `GET` | `/api/v1/faculty/exams` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:examId/ai-generate` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:examId/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:examId/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:examId/questions/import-excel` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:examId/results/:studentId` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `DELETE` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `PATCH` | `/api/v1/faculty/exams/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id/collusion` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id/credentials` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:id/duplicate` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id/export-csv` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `PATCH` | `/api/v1/faculty/exams/:id/publish` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:id/publish` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:id/publish-alt` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id/results` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `PATCH` | `/api/v1/faculty/exams/:id/results/release` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/exams/:id/students` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/:id/students` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/exams/ai-generate-preview` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/questions` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `DELETE` | `/api/v1/faculty/questions/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `PUT` | `/api/v1/faculty/questions/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/questions/bulk` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `POST` | `/api/v1/faculty/questions/import-excel` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/results` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/results/:id` | Required | `faculty` | Yes (Faculty Exam Owner) | `faculty` |
| `GET` | `/api/v1/faculty/students` | Required | `faculty` | Yes | `faculty` |
| `PATCH` | `/api/v1/faculty/students/:id/approve` | Required | `faculty` | Yes | `faculty` |
| `GET` | `/api/v1/health` | Public | `Public` | No | `system` |
| `GET` | `/api/v1/invigilator/exam/:examId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/exam/:examId/terminate/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/exam/:examId/warn/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `GET` | `/api/v1/invigilator/exams/:examId/students` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `GET` | `/api/v1/invigilator/live-grid/:examId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/login` | Required | `invigilator, faculty, admin` | Yes | `invigilator` |
| `POST` | `/api/v1/invigilator/pause-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/resume-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/send-warning` | Required | `invigilator, faculty, admin` | Yes | `invigilator` |
| `POST` | `/api/v1/invigilator/terminate-student/:studentId` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `GET` | `/api/v1/invigilator/violations` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/invigilator/violations/:id/action` | Required | `invigilator, faculty, admin` | Yes (Exam Session Scoped) | `invigilator` |
| `POST` | `/api/v1/livekit-token` | Required | `student, invigilator, faculty, admin` | Yes | `system` |
| `POST` | `/api/v1/media/complete-upload` | Required | `Any Authenticated` | No | `media` |
| `POST` | `/api/v1/media/presign-upload` | Required | `Any Authenticated` | No | `media` |
| `GET` | `/api/v1/media/view` | Required | `Any Authenticated` | No | `media` |
| `GET` | `/api/v1/notifications` | Required | `Any Authenticated` | No | `notifications` |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/pause` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/resume` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/terminate` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `GET` | `/api/v1/proctoring/attempts/:attemptId/violations` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `POST` | `/api/v1/proctoring/attempts/:attemptId/warn` | Required | `admin, faculty, invigilator` | Yes | `proctoring` |
| `GET` | `/api/v1/proctoring/exams/:examId/roster` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `GET` | `/api/v1/proctoring/exams/:examId/summary` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `GET` | `/api/v1/proctoring/exams/:examId/violations` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `POST` | `/api/v1/proctoring/token` | Required | `Any Authenticated` | No | `proctoring` |
| `POST` | `/api/v1/proctoring/violations/:violationId/acknowledge` | Required | `admin, faculty, invigilator` | Yes (Exam Session Scoped) | `proctoring` |
| `DELETE` | `/api/v1/questions/:questionId` | Required | `admin, faculty` | Yes (Faculty Exam Owner) | `questions` |
| `POST` | `/api/v1/snapshot` | Required | `student` | Yes | `system` |
| `POST` | `/api/v1/student/enrollment/consent` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/enrollment/face` | Required | `student` | Yes | `student` |
| `POST` | `/api/v1/student/enrollment/id` | Required | `student` | Yes | `student` |
| `GET` | `/api/v1/student/enrollment/status` | Required | `student` | Yes | `student` |
| `GET` | `/api/v1/student/exams` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/exams/:id` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/acknowledge` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/answer` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/autosave` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/exams/:id/chat` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/chat` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/evidence` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/identity-verify` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/exams/:id/lobby` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/exams/:id/start` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/start` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/submit` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/verify-face` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/verify-id` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/exams/:id/violation` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` |
| `PATCH` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` |
| `PUT` | `/api/v1/student/profile` | Required | `student` | Yes (Candidate Identity) | `student` |
| `GET` | `/api/v1/student/results` | Required | `student` | Yes | `student` |
| `POST` | `/api/v1/student/support/ticket` | Required | `student` | Yes | `student` |
| `GET` | `/api/v1/student/support/tickets` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/verify-face` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/student/verify-id` | Required | `student` | Yes (Candidate Identity) | `student` |
| `POST` | `/api/v1/uploads/complete` | Required | `Any Authenticated` | No | `system` |
| `POST` | `/api/v1/uploads/presign` | Required | `Any Authenticated` | No | `system` |
