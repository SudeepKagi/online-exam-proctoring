# Deployment Execution Log

This document records every remote execution, command ID, invocation status, and audit trails for the deployment of ProctorNet to the live production server (`i-0d242d962823f0a89`, `43.204.45.86`).
All sensitive data and secrets are redacted in accordance with deployment security standards.

## Remote Command Log

### [2026-11-10T04:14:11.724Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-recon.sh`
- **Command ID**: `aef906a1-9dd6-4308-8fba-325637132a6a`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-recon.log`

### [2026-11-10T04:15:18.764Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-details.sh`
- **Command ID**: `ca9669fb-46c6-4bf2-b9dc-fedaa6a9ed9c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-details.log`

### [2026-11-10T04:16:14.844Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-check-db.sh`
- **Command ID**: `ad467a50-1aff-49bb-9517-03e8ed55bff4`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-check-db.log`

### [2026-11-10T04:17:41.100Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-check-env-keys.sh`
- **Command ID**: `f7c6dfc6-a266-462f-821f-271415c344d6`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-check-env-keys.log`

### [2026-11-10T04:41:32.176Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase2-prepare-release.sh`
- **Command ID**: `8a23a978-98b2-408b-9a8e-dfc402b4cf2b`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase2-prepare-release.log`

### [2026-11-10T04:44:45.546Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase2-preflight-run.sh`
- **Command ID**: `2eaf5d39-b95d-44c0-97cf-4e42f026a268`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase2-preflight-run.log`

### [2026-11-10T04:45:48.285Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `eb940445-beb5-4c2a-8614-e6ba949a9dbe`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-dump-db.log`

### [2026-11-10T04:47:18.523Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `2711e579-2732-4556-a9d9-34a1b7442f79`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-dump-db.log`

### [2026-11-10T04:48:42.824Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `8633a687-dfb5-4927-a6ba-e90544adcc0c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-dump-db.log`

### [2026-11-10T05:05:44.861Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `823e9283-3772-4a38-94de-96e2f513171b`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase4-cutover.log`

### [2026-11-10T05:08:04.259Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `d196d667-9f64-4495-b54e-18e95d1c54ba`
- **Status**: `Failed` (Exit Code: 35)
- **Log File**: `logs-deploy/phase4-cutover.log`

### [2026-11-10T05:10:59.689Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase5-hardening.sh`
- **Command ID**: `532c315e-1166-4be1-8432-772514a4f55e`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase5-hardening.log`

### [2026-11-10T05:12:20.981Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-backup-service.sh`
- **Command ID**: `a764afca-80be-48b1-bae0-533433cb3894`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-backup-service.log`

### [2026-11-10T05:13:28.126Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase5-hardening.sh`
- **Command ID**: `a9b5c1c8-88d3-4a77-8f0f-0d124ddf20a7`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase5-hardening.log`

### [2026-11-10T05:14:27.662Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\debug-backup.sh`
- **Command ID**: `5d7e2e4b-0c92-4700-ad0c-caa14f1d9bc0`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/debug-backup.log`

### [2026-11-10T05:16:05.054Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase5-hardening.sh`
- **Command ID**: `da3b79fe-cc7a-45e8-a442-b25681b21b98`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase5-hardening.log`
