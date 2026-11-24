# ADR 006: Guarded One-Time Destructive Reset of Non-Admin Data

## Status
Accepted

## Date
2026-10-03

## Context
Over development iterations, test data, stale attempts, dummy photos, and corrupted evidence accumulated in the database and local storage. Notion Step 13 section 13.5 establishes a general principle: "do not hard-delete users or historical audit logs in normal application code."

However, project stakeholders explicitly requested a one-time clean slate before running scalability and load validation, wiping all candidate, faculty, exam, answer, and evidence records while preserving the configured administrative account(s).

## Decision
1. **Never Hard-Delete in Application Code**:
   - Production REST APIs, socket handlers, and services must never expose endpoints for cascading hard-deletion of user histories.
2. **Dedicated Guarded Operations Script (`ops:reset-keep-admin`)**:
   - Create an idempotent script `scripts/ops/reset_keep_admin.js`.
   - **Dry-run by default**: The script will only display what would be affected unless `--execute` is passed.
   - **Typed Confirmation**: In non-CI environments, requires typing `CONFIRM_PURGE_NON_ADMIN_DATA`.
   - **Safety Rails**:
     - Refuses to execute if `NODE_ENV === 'production'` or `DATABASE_URL` contains production domain patterns unless overridden by `ALLOW_PROD_PURGE=true`.
     - Executes a JSON schema/data backup dump before truncation.
   - **Wipe Scope**:
     - Truncates/deletes `Answer`, `EvidenceLog`, `VerificationAuditLog`, `ExamResult`, `ChatMessage`, `CollusionReport`, `StudentExam`, `Question`, `Exam`, `Student`, `Faculty`.
     - Preserves `Admin` credentials.
     - Optionally purges non-admin S3 evidence objects matching test prefixes.

## Consequences
### Positive
- Delivers the requested clean state for benchmarking without polluting application logic with dangerous deletion routes.
- Completely prevents accidental data loss through multiple safety barriers and automated backups.

### Negative
- Erases historical test data, requiring re-running seed fixtures to populate demo examinations.

## Notion Step-13 Alignment
Explicit project authority override to establish a clean benchmark baseline, contained strictly within guarded operations tooling.
