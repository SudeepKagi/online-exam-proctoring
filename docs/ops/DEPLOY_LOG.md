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

### [2026-11-16T03:01:12.925Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase3-dump-db.sh`
- **Command ID**: `da2097ca-c79e-4142-a422-227edf6efa51`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase3-dump-db.log`

### [2026-11-16T03:03:26.687Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase2-prepare-release.sh`
- **Command ID**: `8fb8aca6-c99e-4a62-956e-cbec64cfdfd1`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase2-prepare-release.log`

### [2026-11-16T03:04:25.765Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `135e83fe-5f8d-4af4-b2b0-4939f185fd37`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/phase4-cutover.log`

### [2026-11-16T03:05:55.921Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase4-cutover.sh`
- **Command ID**: `255b39e4-7f61-4ea9-b426-9e956b631591`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase4-cutover.log`

## Active Production Release Snapshot (Post-Exam-Creation-Flow Deploy)
- **Active Release Directory**: `/opt/proctornet/releases/release-5a46abfb2172d364ef2f5541ccd1a1976821f2f2`
- **Current Symlink**: `/opt/proctornet/current -> /opt/proctornet/releases/release-5a46abfb2172d364ef2f5541ccd1a1976821f2f2`
- **Release Commit SHA**: `5a46abfb2172d364ef2f5541ccd1a1976821f2f2`
- **Database Migrations Applied**: `0006_exam_drafts` verified
- **Service Status**: `active` (`proctornet.service`)
- **Main Branch Head**: Merged PR #47 (`5a46abf`)
- **Health Checks**: 
  - Internal `/healthz` (port 5000): 200 OK
  - Proxy `/healthz` (Caddy): 200 OK
  - Public Domain `/healthz`: 200 OK
  - SEB Ping `/api/v1/seb/ping`: 200 OK
  - Frontend SPA `/`: 200 OK


### [2026-11-16T09:44:04.184Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `c0ad0a59-ad8f-4e57-ba04-8d59e2aec9c0`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/deploy-7a5bc25e16719b1e97878d3c068023d0c97a5ffc.log`

### [2026-11-16T09:46:07.018Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `c3495953-3ea7-4ebe-9a86-b69e3e2e1787`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/deploy-bb779a8f43b9aef080c6cc7730277b8862b52240.log`

### [2026-11-16T09:49:26.849Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `0fe7b70f-9ad9-47be-8571-13d0555b4ee2`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-cb370a232a19b05e09bd576e9aa78beb55cd0fa0.log`

### [2026-11-16T09:49:28.046Z] Production Deploy: `release-cb370a232a19b05e09bd576e9aa78beb55cd0fa0`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `cb370a232a19b05e09bd576e9aa78beb55cd0fa0`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-cb370a232a19b05e09bd576e9aa78beb55cd0fa0.tar.gz`
- **Duration**: 81 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-16T10:23:17.019Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\check-current.sh`
- **Command ID**: `411f3fe8-778b-49ad-b75e-bc7c89ff8668`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-current.log`

### [2026-11-16T10:24:01.908Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\evidence-collection.sh`
- **Command ID**: `5a8fd420-dbd5-47df-bcd3-25e9d448531a`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/evidence-collection.log`

### [2026-11-16T10:27:15.425Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\check-proc-env.sh`
- **Command ID**: `73b1bdfc-6a6f-4f57-92a2-49ab9a634ca3`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-proc-env.log`

### [2026-11-16T10:28:45.205Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\find-9000-remote.sh`
- **Command ID**: `2a5fabf5-8f0e-4c47-930a-bde96520101a`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/find-9000-remote.log`

### [2026-11-16T10:29:26.540Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\find-env-files.sh`
- **Command ID**: `a381b327-df48-4397-9973-c11b484ce489`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/find-env-files.log`

### [2026-11-16T10:31:52.542Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\test-prefix-access.sh`
- **Command ID**: `b7fba590-c3d9-4a0c-93a1-6abd274adeab`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/test-prefix-access.log`

### [2026-11-16T10:43:12.454Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\test-prefix-access.sh`
- **Command ID**: `eb89fc3c-2226-4f2b-ba63-1d43bcf550c9`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/verify-policy-update.log`

### [2026-11-16T10:43:56.033Z] Command on i-0d242d962823f0a89
- **Script**: `logs-deploy\fix-server-config.sh`
- **Command ID**: `4c084724-d30d-44f7-b8f6-f49f5f9d5e1f`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/fix-server-config.log`

### [2026-11-16T11:31:22.250Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `ababf48f-1208-49c1-b8dd-ca7b7cd33cbf`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-d0f82140a25003bfc2db798eee8a5fadeccfee37.log`

### [2026-11-16T11:31:23.407Z] Production Deploy: `release-d0f82140a25003bfc2db798eee8a5fadeccfee37`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `d0f82140a25003bfc2db798eee8a5fadeccfee37`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-d0f82140a25003bfc2db798eee8a5fadeccfee37.tar.gz`
- **Duration**: 89 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-16T11:35:46.742Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-ai-keys.sh`
- **Command ID**: `57713f57-aecd-443f-9356-6362c3edf1c9`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-ai-keys.log`

### [2026-11-16T12:38:24.877Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `850b3cc0-b79a-4b9f-bae8-56b8f3d88fc5`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-d08359b6423f900bbc11d392924190cb83fbb1d5.log`

### [2026-11-16T12:38:26.212Z] Production Deploy: `release-d08359b6423f900bbc11d392924190cb83fbb1d5`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `d08359b6423f900bbc11d392924190cb83fbb1d5`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-d08359b6423f900bbc11d392924190cb83fbb1d5.tar.gz`
- **Duration**: 88 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T02:32:26.651Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `99df61a4-f401-4a6f-a329-8f179d473a16`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-4f708aa1faab6050f4892a539dab260c5b824132.log`

### [2026-11-17T02:32:27.722Z] Production Deploy: `release-4f708aa1faab6050f4892a539dab260c5b824132`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `4f708aa1faab6050f4892a539dab260c5b824132`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-4f708aa1faab6050f4892a539dab260c5b824132.tar.gz`
- **Duration**: 104 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T03:29:20.232Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `a3804b6b-248b-4ac8-9433-69161b68ca07`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-10056d184edbefc392d15d854896fe949b930fb6.log`

### [2026-11-17T03:29:21.465Z] Production Deploy: `release-10056d184edbefc392d15d854896fe949b930fb6`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `10056d184edbefc392d15d854896fe949b930fb6`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-10056d184edbefc392d15d854896fe949b930fb6.tar.gz`
- **Duration**: 106 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T03:57:52.320Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `1415e8b6-9d8b-4004-ba23-b25b4a2ec508`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-cfeb5760739755be138b5cc2300c6080beab899e.log`

### [2026-11-17T03:57:53.692Z] Production Deploy: `release-cfeb5760739755be138b5cc2300c6080beab899e`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `cfeb5760739755be138b5cc2300c6080beab899e`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-cfeb5760739755be138b5cc2300c6080beab899e.tar.gz`
- **Duration**: 92 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T04:13:57.555Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\phase0-check-server.sh`
- **Command ID**: `66f183f2-c40a-4299-aa1f-b39529ac5f82`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-check-server.log`

### [2026-11-17T08:05:44.891Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-preflight-live.sh`
- **Command ID**: `da455fe4-bb0a-4e97-b7a0-79d157882eb6`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/preflight-live.log`

### [2026-11-17T08:07:41.459Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\run-live-backup.sh`
- **Command ID**: `ea2d8a55-bbd3-4dd4-bd6e-c938caa970a0`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/live-backup.log`

### [2026-11-17T08:10:06.515Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\run-live-backup.sh`
- **Command ID**: `317b257e-ecba-44ed-a2da-97913ac7dcf0`
- **Status**: `Failed` (Exit Code: 141)
- **Log File**: `logs-deploy/live-backup-toc.log`

### [2026-11-17T08:10:58.147Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\run-live-backup.sh`
- **Command ID**: `05267e7b-29dc-4654-92db-f607694238d0`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/live-backup-toc.log`

### [2026-11-17T08:14:08.715Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-caddyfile-live.sh`
- **Command ID**: `17156ba1-1883-4471-b9db-260a028eb84c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/caddy-live-check.log`

### [2026-11-17T08:15:08.379Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\update-caddyfile-live.sh`
- **Command ID**: `c365700c-2383-4cfd-8b1e-2978947afcd6`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/caddy-update-live.log`

### [2026-11-17T08:18:48.512Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `6650208b-e7f5-4076-bd68-a40fdbbf8a5c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-6ddcf96907f8e1cc5da0f4042e4421e5a07e7b3b.log`

### [2026-11-17T08:18:49.711Z] Production Deploy: `release-6ddcf96907f8e1cc5da0f4042e4421e5a07e7b3b`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `6ddcf96907f8e1cc5da0f4042e4421e5a07e7b3b`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-6ddcf96907f8e1cc5da0f4042e4421e5a07e7b3b.tar.gz`
- **Duration**: 96 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T08:19:50.975Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-cleanup-targets.sh`
- **Command ID**: `202375a6-d14e-4c0f-9df0-59c6cee4d456`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/cleanup-targets-live.log`

### [2026-11-17T08:20:24.967Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\run-automatic-cleanup.sh`
- **Command ID**: `d85dc2b3-120c-4f8f-be13-5f583098dde5`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/automatic-cleanup.log`

### [2026-11-17T08:49:25.531Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\delete-test-data.sh`
- **Command ID**: `f6ba8e01-b3c5-4232-99aa-0780d2565649`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/live-test-data-deletion.log`

### [2026-11-17T09:15:12.032Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `a44c9e4b-f9c2-418e-9f18-47b7145917ba`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-0dc5e2694c8483d3c534f8ae46c94617edd9767d.log`

### [2026-11-17T09:15:12.947Z] Production Deploy: `release-0dc5e2694c8483d3c534f8ae46c94617edd9767d`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `0dc5e2694c8483d3c534f8ae46c94617edd9767d`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-0dc5e2694c8483d3c534f8ae46c94617edd9767d.tar.gz`
- **Duration**: 86 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T09:22:31.815Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-pin-error.sh`
- **Command ID**: `a5661a91-6028-433f-8a0a-af0ab8f6249d`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/pin-error.log`

### [2026-11-17T09:45:44.325Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `7855313e-1c7e-41e9-ba75-a5b3c1dd15ee`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-185bc09e02eb16098c86a51357183909cd6c1ea0.log`

### [2026-11-17T09:45:45.458Z] Production Deploy: `release-185bc09e02eb16098c86a51357183909cd6c1ea0`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `185bc09e02eb16098c86a51357183909cd6c1ea0`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-185bc09e02eb16098c86a51357183909cd6c1ea0.tar.gz`
- **Duration**: 90 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T10:13:51.417Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `ce936fbe-17dc-4ef1-8b94-52c32a54be3d`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-4d5745e0873dec11601afd0255913606f9435cb1.log`

### [2026-11-17T10:13:52.623Z] Production Deploy: `release-4d5745e0873dec11601afd0255913606f9435cb1`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `4d5745e0873dec11601afd0255913606f9435cb1`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-4d5745e0873dec11601afd0255913606f9435cb1.tar.gz`
- **Duration**: 89 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T10:16:53.742Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\update-env-seb-mode.sh`
- **Command ID**: `e5d14d82-28b7-4cbe-aab4-00d3c6a213af`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/update-seb-mode-enforce.log`

### [2026-11-17T10:37:41.777Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-live-seb-config.sh`
- **Command ID**: `648064c8-a875-4bd3-b1fe-93912ebd3972`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/live-seb-inspect.log`

### [2026-11-17T10:38:43.941Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-recent-logs.sh`
- **Command ID**: `55ff30de-8e94-415f-be02-ac971d4caf6c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/recent-backend-logs.log`

### [2026-11-17T10:39:36.891Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-seb-requests.sh`
- **Command ID**: `5c4bf2d7-7f0d-42a3-9575-5801a23d9c69`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/seb-caddy-requests.log`

### [2026-11-17T10:40:50.541Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-ping-logs.sh`
- **Command ID**: `40fa4f47-b7bf-4931-b0ba-bf4a85c1f0a3`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/seb-ping-logs.log`

### [2026-11-17T10:41:32.445Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-service.sh`
- **Command ID**: `2354e6a2-1a5b-4f9c-a9fb-d61ab818d9a5`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/service-def.log`

### [2026-11-17T10:42:14.093Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-proctornet-logs.sh`
- **Command ID**: `422abce5-c189-42bd-9544-45df109ea697`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/proctornet-journal.log`

### [2026-11-17T15:12:08.824Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `9da6ed56-5fbc-4854-9ba5-a7443be8f9f3`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-220de68dd8d0891da2b653147d2ab99ef0552e0b.log`

### [2026-11-17T15:12:10.249Z] Production Deploy: `release-220de68dd8d0891da2b653147d2ab99ef0552e0b`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `220de68dd8d0891da2b653147d2ab99ef0552e0b`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-220de68dd8d0891da2b653147d2ab99ef0552e0b.tar.gz`
- **Duration**: 95 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T15:57:08.569Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\inspect-seb-logs.sh`
- **Command ID**: `21f85264-ff4b-477a-99e9-6b234c2228ce`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/inspect-seb-logs.log`

### [2026-11-17T16:02:24.854Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-db-seb.sh`
- **Command ID**: `37d78fe8-0d86-4c08-9f3f-9b3d2b282043`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/check-db-seb.log`

### [2026-11-17T16:03:32.231Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-db-seb.sh`
- **Command ID**: `7db52b5a-a15a-4178-a918-5df602692faf`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-db-seb.log`

### [2026-11-17T16:04:02.878Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-db-seb.sh`
- **Command ID**: `1e1d73c6-980d-4a9e-be90-33a8befaa3a7`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-db-seb.log`

### [2026-11-17T16:04:31.542Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-db-seb.sh`
- **Command ID**: `52325960-168e-43dd-a1fc-61b9b0ab92b5`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-db-seb.log`

### [2026-11-17T16:05:01.948Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-caddy-seb.sh`
- **Command ID**: `20f86460-d9ea-447b-9ca1-576b7eab08ab`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-caddy-seb.log`

### [2026-11-17T16:06:06.614Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-exchange-caddy.sh`
- **Command ID**: `be01d749-736b-4048-89f4-ddcb1675643e`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-exchange-caddy.log`

### [2026-11-17T16:20:50.206Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `12680eae-16fb-412f-b1dc-e27ce71d2e67`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-68428e6128bbe0c1ccd5141de2ab01341bf30a58.log`

### [2026-11-17T16:20:51.969Z] Production Deploy: `release-68428e6128bbe0c1ccd5141de2ab01341bf30a58`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `68428e6128bbe0c1ccd5141de2ab01341bf30a58`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-68428e6128bbe0c1ccd5141de2ab01341bf30a58.tar.gz`
- **Duration**: 93 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-17T16:21:45.800Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\check-version.sh`
- **Command ID**: `ae55aaf5-1af0-46d9-b7fe-efe36c41f780`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-version.log`

### [2026-11-17T17:40:01.492Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `9a9c00be-fe2f-403e-bfb8-72903e658678`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-7056a33b9e8a13bc5c4bd8327e47261ee6c8db70.log`

### [2026-11-17T17:40:03.664Z] Production Deploy: `release-7056a33b9e8a13bc5c4bd8327e47261ee6c8db70`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `7056a33b9e8a13bc5c4bd8327e47261ee6c8db70`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-7056a33b9e8a13bc5c4bd8327e47261ee6c8db70.tar.gz`
- **Duration**: 105 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-18T04:20:02.077Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `5f52b248-c563-4af6-b01d-0a4dc138f679`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-940d6b21491e79f502cfc599470a89fcd2c60bba.log`

### [2026-11-18T04:20:03.375Z] Production Deploy: `release-940d6b21491e79f502cfc599470a89fcd2c60bba`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `940d6b21491e79f502cfc599470a89fcd2c60bba`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-940d6b21491e79f502cfc599470a89fcd2c60bba.tar.gz`
- **Duration**: 115 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-18T06:10:43.917Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `71c41dd8-8e7b-44cf-8e75-5c988ea8eed4`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-05e94ee2dd79203597899ba22ef7ace80f7175bd.log`

### [2026-11-18T06:10:45.074Z] Production Deploy: `release-05e94ee2dd79203597899ba22ef7ace80f7175bd`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `05e94ee2dd79203597899ba22ef7ace80f7175bd`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-05e94ee2dd79203597899ba22ef7ace80f7175bd.tar.gz`
- **Duration**: 106 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-18T07:11:30.968Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `4639af5b-bdcb-438c-bca0-e30fab1d0bd2`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-a75e1377d6a502d8811c98e32b21d587df4953f3.log`

### [2026-11-18T07:11:32.053Z] Production Deploy: `release-a75e1377d6a502d8811c98e32b21d587df4953f3`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `a75e1377d6a502d8811c98e32b21d587df4953f3`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-a75e1377d6a502d8811c98e32b21d587df4953f3.tar.gz`
- **Duration**: 98 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-18T08:59:09.656Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `979e5a8d-c71c-4dc7-b858-8b79368a5508`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-22aacd8eff5fdbd6490d24336b60ddda203da180.log`

### [2026-11-18T08:59:11.126Z] Production Deploy: `release-22aacd8eff5fdbd6490d24336b60ddda203da180`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `22aacd8eff5fdbd6490d24336b60ddda203da180`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-22aacd8eff5fdbd6490d24336b60ddda203da180.tar.gz`
- **Duration**: 85 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-18T14:19:45.723Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\automated-cutover.sh`
- **Command ID**: `6559a8ab-0877-4a85-9225-eca6ce90cf40`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/deploy-09f4e4becef0fadba87830cbbc3871f1397e5213.log`

### [2026-11-18T14:19:47.450Z] Production Deploy: `release-09f4e4becef0fadba87830cbbc3871f1397e5213`
- **Target Server**: `i-0d242d962823f0a89` (proctornet.duckdns.org)
- **Git SHA**: `09f4e4becef0fadba87830cbbc3871f1397e5213`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-09f4e4becef0fadba87830cbbc3871f1397e5213.tar.gz`
- **Duration**: 101 seconds
- **Status**: SUCCESS
- **Automated Rollback Safeguard**: Active
- **Smoke Check**: 8/8 Passed Cleanly

### [2026-11-19T11:46:07.358Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0.sh`
- **Command ID**: `52bff556-c681-4190-9edb-22d2b622e8d7`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/phase0-evidence.log`

### [2026-11-19T11:50:56.904Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0a.sh`
- **Command ID**: `b26f75e3-0558-4591-bc4b-2f0dc6117a82`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/phase0a-evidence.log`

### [2026-11-19T11:52:24.072Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\check-service.sh`
- **Command ID**: `9c2fb3d5-a029-4855-906a-aeb69377776c`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/check-service.log`

### [2026-11-19T12:00:48.137Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0-full.sh`
- **Command ID**: `b2abe3b5-b348-4147-b4e4-72504bd2601a`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/phase0-full-evidence.log`

### [2026-11-19T12:02:51.333Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0-full.sh`
- **Command ID**: `6ca3a77e-bc73-4f4b-89f2-08f993659b4c`
- **Status**: `Failed` (Exit Code: 1)
- **Log File**: `logs-deploy/phase0-full-evidence.log`

### [2026-11-19T12:04:26.375Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0-full.sh`
- **Command ID**: `fe8b28ec-88d2-47d5-9603-e535b40364fa`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-full-evidence.log`

### [2026-11-19T12:09:28.013Z] Command on i-0d242d962823f0a89
- **Script**: `scripts\ops\remote\query-phase0-full.sh`
- **Command ID**: `05927f71-d49a-4275-b753-223cfed130b2`
- **Status**: `Success` (Exit Code: 0)
- **Log File**: `logs-deploy/phase0-full-evidence.log`
