# Runbook: Production Database & Storage Reset (Keep Admin Only)

> **Status:** `HUMAN_REQUIRED`  
> **Risk Tier:** S0 (Destructive Data Operations)  
> **Reference Protocol:** §Prompt 7 T3, ADR-006

This runbook guides authorized operations engineers through executing a one-time clean reset of production candidate attempts, telemetry, media, and audit logs while strictly preserving administrator credentials, platform configurations, departments, device agent policies, and migration schemas.

---

## 1. Safety Envelope & Pre-Conditions

The reset engine (`scripts/ops/reset-keep-admin.js`) enforces the following automatic guards:
1. **Active Attempt Gate:** Fails immediately if any student attempt is in `ACTIVE` status.
2. **Admin Existence Guard:** Requires $\ge 1$ administrator account in `admins`.
3. **Backup Reference Requirement:** Requires `--backup-ref <id>` pointing to an RDS snapshot ID or S3 dump key.
4. **Explicit Production Opt-In:** Non-local hostnames require `--allow-production-i-understand`.
5. **Exact Typed Confirmation Token:** `--confirm "reset <database_name>"` matching the database name extracted from `DATABASE_URL`.
6. **Transaction Atomicity:** All table wipes, lease resets, and post-condition assertions run in a single Postgres transaction; any mismatch triggers immediate `ROLLBACK`.

---

## 2. Table Classification Matrix

The engine derives tables dynamically from Prisma DMMF. The classification is strictly enforced:

| Category | Tables | Action Taken |
|---|---|---|
| **`KEEP_IDENTITY`** | `admins` | **Preserved unmodified.** Verified $\ge 1$ before and after transaction. |
| **`KEEP_CONFIG`** | `platform_settings`, `departments`, `agent_rules`, `agent_policy_versions`, `agent_releases`, `_prisma_migrations` | **Preserved unmodified.** Row counts assert identical before and after. |
| **`RESET_LEASES`** | `vpn_ip_pool` | **Leases reset.** All statuses updated to `AVAILABLE`, allocations set to `NULL`. |
| **`WIPE`** | `students`, `faculties`, `exams`, `questions`, `question_options`, `exam_attempts`, `attempt_questions`, `answers`, `exam_results`, `violation_events`, `audit_logs`, `chat_messages`, `outbox_events`, `idempotency_keys`, `processed_events`, `vpn_peers`, `identity_verifications`, `verification_audit_logs`, `reverification_logs`, `device_check_logs`, `invigilator_sessions`, `collusion_reports`, `announcements`, `biometric_override_logs`, `agent_pairings`, `agent_sessions`, `agent_findings`, `device_agent_waivers`, `auth_sessions` | **Truncated with CASCADE.** Row counts assert 0 post-execution (except `audit_logs` which receives 1 `SYSTEM_RESET` row). |

---

## 3. Storage Purge Boundary

S3 storage purge executes through `S3Adapter` bounded strictly to allowed candidate data prefixes:
- **Purged Prefixes:** `identity/`, `evidence/`, `live/`, `thumbs/`, `uploads/`, `attempts/`
- **Protected Prefixes (NEVER Touched):** `agent/`, `releases/`, `backups/`
- Handles bucket versioning by deleting all object versions and delete markers.

---

## 4. Step-by-Step Production Procedure

### Step 1: Maintenance Window Announcement & Freeze
1. Announce a 30-minute maintenance window to institution stakeholders.
2. Confirm zero live examinations are in progress:
   ```bash
   node proctornet/backend/scripts/ops/active-attempts.js
   # Output must be 0
   ```

### Step 2: Trigger Pre-Reset Backup
1. **If using AWS RDS:** Create manual DB snapshot via AWS CLI:
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier proctornet-db-prod \
     --db-snapshot-identifier "pre-reset-backup-$(date +%Y%m%d%H%M)"
   ```
2. **If using standalone PostgreSQL:** Create a validated `pg_dump`:
   ```bash
   npm run ops:reset-keep-admin -- --create-backup
   # Records backup reference to reports/reset/
   ```

### Step 3: Enable Edge Maintenance Mode
Switch Caddy reverse proxy on EC2 to return 503 Maintenance Page:
```bash
sudo cp ops/caddy/Caddyfile.maintenance /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### Step 4: Perform Dry-Run
Execute the reset tool in default dry-run mode to verify table classifications and counts:
```bash
npm run ops:reset-keep-admin
```
Review output:
- Verify `admins` count matches expectation.
- Verify `KEEP_CONFIG` counts match expectation.
- Verify candidate tables to be truncated.

### Step 5: Execute Destructive Reset
Execute with typed confirmation and backup reference:
```bash
npm run ops:reset-keep-admin -- \
  --execute \
  --confirm "reset proctornet_prod" \
  --backup-ref "pre-reset-backup-202610090800" \
  --allow-production-i-understand
```
Expected output:
```
✓ Database transaction committed successfully.
✓ Global auth_epoch advanced to N+1.
✓ S3 Storage purged: N keys, M versions removed.
[RESET SUCCESS] Database wiped and admin account preserved cleanly.
```

### Step 6: Verify Admin Bootstrap & Credential Rotation
If administrative access needs rotation, bootstrap with generated single-use credential:
```bash
npm run ops:bootstrap-admin -- --email admin@proctornet.com --rotate
```
Note the generated password printed once to stdout.

### Step 7: Disable Maintenance Mode & Post-Reset Smoke
1. Restore Caddy reverse proxy:
   ```bash
   sudo cp ops/caddy/Caddyfile.prod /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```
2. In browser / curl:
   - Verify previous student/faculty cookies receive `401 Unauthorized`.
   - Log in with administrative account (`admin@proctornet.com`).
   - Create a test Department.
   - Register/create a test Faculty.
   - Register/create a test Student.
   - Verify clean persistence.

### Step 8: Archive Audit Manifest
Commit the execution manifest generated in `reports/reset/manifest-<timestamp>.json` into the operational audit record.
