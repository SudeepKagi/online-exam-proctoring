# Changelog

All notable changes to the ProctorNet platform will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.0-rc1] - 2026-11-09

### Added
- **Safe Exam Browser (SEB) Kiosk Hardening:**
  - Strict enforce-mode verification of `X-SafeExamBrowser-ConfigKeyHash` computed per URL via SHA-256.
  - Non-blocking SEB inspection endpoint (`/api/v1/attempts/exams/:id/seb-status`).
  - Friendly kiosk prerequisite guidance page (`/student/exams/:id/seb-required`) with direct download and protocol handler launch.
  - Cancelable 5-second auto-exit after exam submission.
  - Dedicated Playwright simulated SEB enforcement E2E test suite (`playwright.seb.config.ts`).
- **Privacy Consent & Data Minimization:**
  - Mandatory pre-check candidate privacy consent screen explaining captured data, access rights, and 90-day retention.
  - Minimal categorical student readiness telemetry ingestion (`osFamily`, `browserFamily`, `cameraOk`, `latencyBucket`, `sebVerified`) strictly excluding IP addresses, hardware serials, and screenshots.
  - Faculty Portal dedicated **Readiness** tab featuring summary metric counters, filters (`ALL`, `READY`, `NOT_READY`, `NOT_REPORTED`), and CSV export.
  - Admin single-student data export endpoint (`GET /api/v1/admin/users/:userId/data-export`) formatted as structured JSON.
  - Admin one-click candidate evidence deletion endpoint (`DELETE /api/v1/admin/users/:userId/evidence`).
  - Field-level AES-256-GCM envelope encryption utilities (`backend/src/utils/crypto.js`) and comprehensive personal data map (`docs/privacy/DATA_MAP.md`).
- **Incident Review & Invigilator Adjudication:**
  - Chronological per-attempt incident timeline modal with snapshot thumbnail previews, zoom overlay, and severity filtering.
  - Invigilator adjudication workflow supporting `PENDING`, `REVIEWED`, `DISMISSED`, and `CONFIRMED` statuses with persistent review notes and manual integrity flag toggling.
  - Single-attempt and exam-wide violation incident CSV export.
  - Legacy violation type compatibility mapping (`SCREEN_SHARE_ENDED` -> `Screen share ended (legacy)`).
- **Automated Retention Worker:**
  - Automated retention worker (`runRetentionCleanup`) purging S3 evidence objects, `proctoring_logs`, and `student_readiness_reports` older than `RETENTION_DAYS` (default: 90 days) for closed exams.
  - Legal review hold protection automatically skipping attempts marked with `isFlagged: true` or `reviewStatus: 'PENDING'`.
  - Operational CLI runner (`backend/scripts/ops/run-retention-cleanup.js`) with `--dry-run` and `--days` options.
- **Student Arena Resilience & Offline Recovery:**
  - Immediate three-state autosave indicator in exam arena header (`Saved`, `Saving...`, `Offline, will sync`).
  - Offline response buffering with exponential backoff and non-dismissible connection recovery banner.
  - Multi-tab conflict prevention using `BroadcastChannel` with duplicate tab blocking overlay.
  - In-place credential re-authentication modal resuming exam progress seamlessly on expired access tokens without state loss.
  - Server-authoritative countdown timer with accessible announcements at 5 minutes and 1 minute.
  - Submit button locking with stable `Idempotency-Key` headers preventing concurrent duplicate grading.
- **Operations, Verification & Deployment:**
  - Preflight environment verification CLI (`scripts/ops/preflight-env.js`) enforcing production variable presence, secret lengths, known default rejection, bare origin validation, and non-production database guards.
  - Sequential release verification pipeline (`npm run release:check`) validating lint, typecheck, build, backend tests, e2e, audit, and migration drift into `test-results/`.
  - Comprehensive operational Go-Live checklist (`docs/ops/GO_LIVE_CHECKLIST.md`) with automated gates and human pilot requirements.
  - Ephemeral database backup and restore validation scripts (`scripts/ops/backup-postgres.sh`, `scripts/ops/restore-postgres-test.sh`).

### Changed
- Refactored student pre-exam check into a streamlined 2-step verification flow (Identity Facial Verification -> Kiosk Fullscreen Lock), fully eliminating deprecated WebRTC screen-sharing streams.
- Reconciled edge topology around a single committed Caddy reverse proxy on ports 80/443 with automatic TLS and WebSocket upgrades.
- Modernized project `README.md` to reflect current 2-tier architecture and light enterprise design system invariants.

### Security
- Added Gitleaks configuration with explicit development default allowlist.
- Replaced all legacy fallback passwords with single-use cryptographically random passwords requiring password reset upon first login.
- Guarded database seeding scripts against execution in production environments.

