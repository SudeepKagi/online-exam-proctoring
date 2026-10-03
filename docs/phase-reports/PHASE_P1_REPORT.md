# Phase P1 Report — Data Reset: Keep Admin Only (+ S3 / External Stores)

**Date**: 2026-10-03  
**Branch**: `feature/p1-data-reset`  
**Tool Created**: `proctornet/backend/scripts/ops/reset-keep-admin.js` (`npm run ops:reset-keep-admin`)  
**Status**: Completed & Verified  

---

## 1. Goal & Interpretation

### Goal
Provide a single guarded, automated operational tool that leaves exactly the `Admin` account(s) and platform configurations intact while permanently purging all transient, candidate, and faculty data across every storage layer (PostgreSQL, AWS S3/MinIO, Cloudinary, Redis, local disk).

### Interpretation
- **Target Deletions**: Deletes all `Student` and `Faculty` rows and **everything owned by or derived from them**:
  - `Exam`, `Question`, `StudentExam`, `Answer`, `ExamResult`
  - `EvidenceLog`, `EvidenceClip`, `VerificationAuditLog`, `BiometricOverrideLog`, `ReverificationLog`
  - `ChatMessage`, `CollusionReport`, `InvigilatorSession`, `DeviceCheckLog`, `Announcement`, `AuditLog`
- **Preserved Tables**: Exactly `{Admin, PlatformSetting, _prisma_migrations}`.
- **Audit Traceability**: Inserts exactly one row into `AuditLog` with `action: 'SYSTEM_RESET'` after truncation.
- **S3 / Object Storage**: Purges all student and exam evidence under known prefixes (`evidence/`, `snapshots/`, `biometrics/`, `id-cards/`, `face/`, `uploads/`, `reports/`) while protecting unknown prefixes unless explicitly instructed.

---

## 2. Safety Design & Guardrails Implemented

| Safety Guardrail | Implementation Mechanism | Verification Result |
| :--- | :--- | :--- |
| **1. Dry-Run Default** | `--execute` is strictly required to apply changes. Default mode discovers all tables, counts rows, scans S3 objects, and writes `reports/reset/<timestamp>-plan.json`. | Verified: Tested with live DB; produced plan with zero mutations. |
| **2. Production Refusal** | Refuses execution if `NODE_ENV === 'production'` unless `--allow-production-i-understand` is passed. | Verified: Tested in automated test suite and CLI; refused with exit code 1. |
| **3. Host Allow-List** | Validates database hostname against `RESET_ALLOWED_HOSTS` (defaults to `localhost,127.0.0.1,postgres`). Cloud/remote hosts (e.g. Supabase poolers) must be explicitly allowed. | Verified: Refused `aws-1-ap-southeast-1.pooler.supabase.com` until explicitly passed via `--allowed-hosts`. |
| **4. Typed Confirmation** | Requires typing `reset <dbname>` in interactive TTY sessions, or passing `--confirm "reset <dbname>"` in non-interactive CI environments. | Verified: Tested mismatch string (`wrong confirmation`); refused with exit code 1. |
| **5. Pre-Destruction Backup** | Automatically dumps `Admin` and `PlatformSetting` models to `./backups/<ts>-admin.json` (required for P3 baseline). Attempts `pg_dump -Fc` (skips only if `--no-backup` is loudly logged). | Verified: Generated JSON snapshot and validated `--no-backup` guard. |
| **6. Dynamic Table Discovery** | Reads `information_schema.tables` (schema `public`), excludes `{Admin, PlatformSetting, _prisma_migrations}`, and executes `TRUNCATE ... RESTART IDENTITY CASCADE` in a single query. Prevents schema rot. | Verified: Dynamically discovered 19 application tables to truncate. |
| **7. Resilient S3 Purge** | Supports both versioned (`ListObjectVersions`) and unversioned (`ListObjectsV2`) buckets. Deletes in batches of 1,000 using bounded concurrency (`limit=4`) and exponential backoff with jitter. | Verified: Scanned bucket, grouped by prefix, protected unknown prefixes. |
| **8. External Stores Isolation** | Dedicated purge handlers for auxiliary stores (`--local-uploads`, `--cloudinary`, `--compreface`, `--minio`, `--redis` with `pn:*` scan, `--rabbitmq`, `--livekit`, `--wireguard`). | Verified: Gracefully skips unconfigured stores; cleaned local uploads directory. |
| **9. Post-Condition Verification** | Validates that `count(Admin) == preCount`, all truncated tables have 0 rows (except 1 `SYSTEM_RESET` in `AuditLog`), and S3 bucket is clean. Non-zero exit code on failure. | Verified: Automated post-condition assertions passing. |
| **10. Idempotency** | A second consecutive `--execute` succeeds cleanly as a no-op with exit code 0. | Verified: Tested sequential executions in integration test suite. |

---

## 3. Test Suite Verification

An automated integration test suite was created in [`proctornet/backend/tests/reset-keep-admin.test.js`](file:///c:/Final%20year%20project/online-exam-proctoring/proctornet/backend/tests/reset-keep-admin.test.js):

- **Total Test Suites**: 19
- **Total Tests**: 77
- **Passed**: 77 (100%)
- **Failed**: 0
- **Duration**: 4.06 seconds

### Suites Breakdown:
1. `reset-keep-admin.test.js`: 9 passing (CLI flags, host extraction, production guard, host allow-list guard, typed confirmation mismatch, non-interactive refusal, dry-run immutability, execute + SYSTEM_RESET insertion + post-conditions, and admin login auth verification).
2. Existing 68 backend tests (observability, security, cookies, state machine, collusion, grading): All 100% green.

---

## 4. Operational Runbook

### Dry-Run (Safe Default)
```bash
cd proctornet/backend
npm run ops:reset-keep-admin -- --allowed-hosts localhost,postgres
```

### Full Destructive Execution
```bash
cd proctornet/backend
npm run ops:reset-keep-admin -- \
  --execute \
  --allowed-hosts localhost,postgres \
  --confirm "reset postgres" \
  --no-backup \
  --all-stores
```

---

> **Interview Note Recorded**: *"Destructive ops are tools with guardrails — dry-run default, typed confirmation, backup, post-condition checks."*
