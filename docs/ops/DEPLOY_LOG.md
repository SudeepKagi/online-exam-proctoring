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

### [2026-11-10T07:58:23.987Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-current-release.sh`
- **Command ID**: `b97b2eef-623e-4e81-9af1-9bba8b0019ad`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-current-release.log`

## Active Production Release Snapshot (Post-PR #42 Merge)
- **Active Release Directory**: `/opt/proctornet/releases/release-ace92878effc7d9b335f7877d98d685b7a6fed39`
- **Current Symlink**: `/opt/proctornet/current -> /opt/proctornet/releases/release-ace92878effc7d9b335f7877d98d685b7a6fed39`
- **Release Commit SHA**: `ace92878effc7d9b335f7877d98d685b7a6fed39`
- **Tagged Release Candidate**: `v0.9.0-rc1` (created at commit `5fc3b53`, retained without moving/re-pushing)
- **Service Status**: `active` (`proctornet.service`)
- **Main Branch Head**: Merged PR #42 (`0948a98`)


### [2026-11-10T09:40:27.089Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-current-release.sh`
- **Command ID**: `d0a4a896-e6e6-4f3e-abdf-be43049870e8`
- **Status**: `Failed` (Exit Code: 127)
- **Log File**: `logs-deploy/check-current-pre-deploy.log`

### [2026-11-10T09:42:02.840Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-current-release.sh`
- **Command ID**: `ffe1befb-7ccc-418b-b3f2-af18ad7b4be5`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-current-pre-deploy.log`

### [2026-11-10T09:42:49.032Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-check-db.sh`
- **Command ID**: `cdf57ec2-9b31-4f5b-aa6f-00aece7f8497`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-db-pre-deploy.log`

### [2026-11-10T09:44:01.169Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `c7b439af-380e-46d7-ad69-d390ae418346`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-backup-camera-hotfix.log`

### [2026-11-10T09:51:04.680Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase2-prepare-release.sh`
- **Command ID**: `ebdb01b1-618d-4f52-8307-19450d713eb1`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase2-prepare-camera-hotfix.log`

### [2026-11-10T09:51:53.509Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `4b7c705c-37b6-4b69-a3c4-5dd1cb785894`
- **Status**: `Failed` (Exit Code: 35)
- **Log File**: `logs-deploy/phase4-cutover-camera-hotfix.log`

### [2026-11-10T09:53:25.863Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `bf6bf38c-27b7-4a38-a84d-3eb2593bbb43`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase4-cutover-clean.log`

### [2026-11-10T10:03:56.668Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-prod-data.sh`
- **Command ID**: `51bb77a9-48cb-4f66-9793-05936a90fd07`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-prod-data.log`

### [2026-11-10T11:26:05.867Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-current-release.sh`
- **Command ID**: `62c55fbc-fd8b-4304-9e28-d96c208be90e`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-current-release.log`

### [2026-11-10T11:27:55.627Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-prod-data.sh`
- **Command ID**: `ea1cb43c-76f0-4f98-bf39-c4885992ebcd`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-prod-data.log`

### [2026-11-10T11:35:30.973Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `f27e5fec-2f61-4229-974b-41cfe5c7d05f`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-dump-db-cleanup.log`

### [2026-11-10T11:37:56.759Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase2-prepare-release.sh`
- **Command ID**: `be244030-4ba1-46a8-bd41-53672e3191c6`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase2-prepare-cleanup.log`

### [2026-11-10T11:39:14.878Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `a1721788-c3c5-42d0-ba7b-fd4115364d2c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase4-cutover-cleanup.log`

## Active Production Release Snapshot (Post-Cleanup Deploy)
- **Active Release Directory**: `/opt/proctornet/releases/release-c3fb95349adf6a7d9113bee73305359f1822ade6`
- **Current Symlink**: `/opt/proctornet/current -> /opt/proctornet/releases/release-c3fb95349adf6a7d9113bee73305359f1822ade6`
- **Release Commit SHA**: `c3fb95349adf6a7d9113bee73305359f1822ade6`
- **Service Status**: `active` (`proctornet.service`)
- **Main Branch Head**: Merged PR #44 (`c3fb953`)


### [2026-11-10T12:22:22.648Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\clean-demo-accounts.sh`
- **Command ID**: `e5180e44-3b6a-43ce-9bb6-53e526968159`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/clean-demo-accounts.log`

### [2026-11-10T12:27:31.589Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-check-env-keys.sh`
- **Command ID**: `bd7a52d1-750b-4e88-93b8-0e02dbbbab76`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-live-env-keys.log`
