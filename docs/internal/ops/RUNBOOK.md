# ProctorNet Bare-Metal Operations Runbook (`docs/ops/RUNBOOK.md`)

> **Document Type:** Production Runbook & Disaster Recovery Protocol  
> **Classification:** Authoritative Operations  
> **Target Environment:** AWS EC2 (`i-0d242d962823f0a89` / `43.204.45.86`), Domain: `https://proctornet.duckdns.org`  

---

## 1. Production Topology & Architecture

ProctorNet runs as a bare-metal Node.js service orchestrated under Linux `systemd`, fronted by Caddy reverse proxy with automatic TLS, connected to a cloud PostgreSQL cluster, and backed up off-box to AWS S3.

### Directory Layout (`/opt/proctornet`)
- `/opt/proctornet/releases/release-<gitSha>/` — Versioned deployment releases containing backend, built frontend (`frontend/dist`), and operational scripts.
- `/opt/proctornet/current` — Atomic symlink pointing to the currently active release directory.
- `/opt/proctornet/releases/PREVIOUS_RELEASE` — Text record pointing to the previous release for one-click rollback.
- `/opt/proctornet/shared/.env` — Master production environment variables and cryptographic secrets (`chmod 600`).
- `/opt/proctornet/backups/postgres/` — Local storage for compressed PostgreSQL database dumps (`pg_dump -Fc`).
- `/var/log/proctornet/` — Operational logs, including automated nightly backup logs (`backup.log`).

### Service Supervisor & Edge Proxy
- **Application Service:** `proctornet.service` (systemd unit running `/opt/proctornet/current/backend/src/index.js` as user `proctornet`, listening on `127.0.0.1:5000`).
- **Edge Reverse Proxy:** `caddy.service` (`/etc/caddy/Caddyfile`, terminating TLS for `proctornet.duckdns.org` on ports 80/443, proxying to `127.0.0.1:5000`).
- **Backup Automation:** `proctornet-backup.timer` and `proctornet-backup.service` (triggers daily at 02:00 UTC).

---

## 2. Repeatable Deployment Procedure

All production deployments are executed via the single automated orchestrator:
```bash
node scripts/ops/deploy-prod.js
```

### Supported CLI Flags
- `--instance <id>`: Target AWS EC2 instance ID (defaults to `i-0d242d962823f0a89`).
- `--bucket <name>`: S3 storage bucket for artifacts and backups (defaults to `proctornet-storage-prod-858109978489`).
- `--skip-build`: Skips local typecheck, lint, and frontend build (use only for quick hotfixes).
- `--force`: Bypasses active `IN_PROGRESS` exam attempts check (emergency override).
- `--skip-smoke`: Skips post-deployment smoke verification.

### Automated Deployment Stages (5 Steps)
1. **Local Preconditions & Build Gate:**
   - Runs `npm run typecheck` across workspaces.
   - Runs `npm run lint` across workspaces.
   - Compiles frontend assets via `npm run build --workspace=frontend`.
2. **Artifact Packaging & S3 Upload:**
   - Generates `VERSION` metadata file with git commit SHA and build timestamp.
   - Bundles `backend/`, `frontend/dist/`, `scripts/`, `package.json`, and `VERSION` into `release-<gitSha>.tar.gz`.
   - Uploads release archive to `s3://proctornet-storage-prod-858109978489/releases/`.
3. **Remote Cutover via AWS SSM:**
   - **Disk Space Precondition:** Checks free space on `/` is $> 2000\text{ MB}$.
   - **Automated Pre-Deployment DB Dump:** Executes `pg_dump -Fc`, verifies table-of-contents (`pg_restore --list`), computes SHA256 checksum, and uploads dump to off-box S3.
   - **Active Exam Attempts Guard:** Queries database for `status = 'IN_PROGRESS'`. Aborts immediately if students are currently taking exams.
   - **Release Unpacking:** Downloads and unpacks archive to `/opt/proctornet/releases/release-<gitSha>`.
   - **Additive Migration Check:** Scans migration SQL for destructive patterns (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`). Aborts if found.
   - **Dependencies & Schema Generation:** Runs `npm ci --omit=dev`, `npx prisma generate`, and `npx prisma migrate deploy`.
   - **Proxy Validation:** Runs `caddy validate --config /etc/caddy/Caddyfile`.
   - **Atomic Symlink Cutover:** Updates `/opt/proctornet/current` symlink.
   - **Service Reload:** Restarts `proctornet.service` and reloads `caddy.service`.
   - **Health Probes:** Tests port 5000 `/healthz`, Caddy resolve `/healthz`, external public `/healthz`, SEB ping `/api/v1/seb/ping`, and SPA root HTML.
   - **Automatic Rollback:** If any health check fails within 30 seconds of cutover, the script immediately reverts the symlink to the previous release and restarts services.
4. **Post-Deployment Smoke Verification:**
   - Executes `scripts/ops/smoke-prod.js` against `https://proctornet.duckdns.org` (8-point check).
5. **Deployment Audit Logging:**
   - Appends deployment metadata, duration, git SHA, and status to `docs/ops/DEPLOY_LOG.md`.

---

## 3. Rollback Procedures

If an unexpected runtime regression occurs after deployment, rollback is fully automated:

### Fast Automated Rollback
```bash
# Reverts to the previously recorded release
node scripts/ops/rollback-prod.js

# Or roll back to a specific known-good release tag:
node scripts/ops/rollback-prod.js --target release-5a46abfb2172d364ef2f5541ccd1a1976821f2f2
```

### Manual Emergency Rollback via SSH/SSM
If the orchestration script is unavailable:
```bash
# 1. Identify previous release
PREV=$(cat /opt/proctornet/releases/PREVIOUS_RELEASE)

# 2. Atomically point symlink back
ln -sfn "$PREV" /opt/proctornet/current

# 3. Restart application & proxy
sudo systemctl restart proctornet.service
sudo systemctl reload caddy.service

# 4. Verify health
curl -sSf http://127.0.0.1:5000/healthz
```

> [!NOTE]
> Because all ProctorNet database migrations are strictly additive, previous release binaries remain fully compatible with the current database schema without requiring schema rollbacks.

---

## 4. Database Backups, Retention & Disaster Recovery

### Automated Nightly Backups
- **Timer:** `proctornet-backup.timer` triggers every day at `02:00:00 UTC`.
- **Script:** `/opt/proctornet/current/scripts/ops/backup-postgres.sh`.
- **Retention:** Local backups older than 7 days are automatically purged.
- **Off-Box Sync:** Each dump is synchronized to `s3://proctornet-storage-prod-858109978489/backups/postgres/`.

### Checking Backup Status
```bash
systemctl list-timers proctornet-backup.timer
systemctl status proctornet-backup.service
tail -n 30 /var/log/proctornet/backup.log
```

### Manual On-Demand Backup
```bash
sudo -u proctornet /opt/proctornet/current/scripts/ops/backup-postgres.sh
```

### Disaster Recovery: Database Restoration Procedure
In the event of database corruption or data loss:
1. **Identify the Target Dump:**
   ```bash
   # List local dumps:
   ls -la /opt/proctornet/backups/postgres/

   # Or list S3 off-box dumps:
   aws s3 ls s3://proctornet-storage-prod-858109978489/backups/postgres/
   ```
2. **Download Dump from S3 (if restoring from off-box):**
   ```bash
   aws s3 cp s3://proctornet-storage-prod-858109978489/backups/postgres/<dump-filename> /tmp/restore_target.dump
   ```
3. **Verify Archive Integrity:**
   ```bash
   pg_restore --list /tmp/restore_target.dump > /dev/null
   echo "Dump TOC verified valid."
   ```
4. **Stop Application Service to Prevent Ingestion During Restore:**
   ```bash
   sudo systemctl stop proctornet.service
   ```
5. **Restore Schema & Data:**
   ```bash
   set -a
   . /opt/proctornet/shared/.env
   set +a
   CLEAN_CONN=$(echo "$DIRECT_URL" | sed 's/[?&]schema=.*//; s/[?&]sslmode=.*//')
   pg_restore --clean --if-exists --no-owner --no-privileges -d "$CLEAN_CONN" /tmp/restore_target.dump
   ```
6. **Restart Application & Run Smoke Verification:**
   ```bash
   sudo systemctl start proctornet.service
   curl -sSf http://127.0.0.1:5000/healthz
   node scripts/ops/smoke-prod.js
   ```

---

## 5. Systemd Service Management & Logging

### Service Management Commands
```bash
# Check service status
sudo systemctl status proctornet.service
sudo systemctl status caddy.service

# Restart application
sudo systemctl restart proctornet.service

# Reload reverse proxy (zero connection dropping)
sudo systemctl reload caddy.service

# View live application logs
journalctl -u proctornet.service -f -n 50

# View Caddy access & TLS logs
journalctl -u caddy.service -f -n 50
```

---

## 6. Safe Exam Browser (SEB) Operational Controls

### Emergency Kill Switch (`SEB_MODE=log`)
If students report widespread configuration hash failures during exam start:
1. Open `/opt/proctornet/shared/.env`.
2. Change `SEB_MODE=enforce` to `SEB_MODE=log`.
3. Restart backend service:
   ```bash
   sudo systemctl restart proctornet.service
   ```
4. **Effect:** In `log` mode, SEB validation continues to compute and log request hashes and browser keys for auditing, but **never rejects candidates with 403 Forbidden**. Students can immediately continue their examinations.

### Returning to Enforcement (`SEB_MODE=enforce`)
Once faculty verify the `.seb` client configuration matches the exam's Config Key:
1. Update `/opt/proctornet/shared/.env` to `SEB_MODE=enforce`.
2. Restart backend: `sudo systemctl restart proctornet.service`.
3. Confirm via smoke suite: `node scripts/ops/smoke-prod.js --seb-mode enforce`.

---

## 7. TLS Certificate & HSTS Lifecycle

- **Certificate Authority:** Let's Encrypt / ZeroSSL managed automatically by Caddy.
- **Auto-Renewal:** Caddy checks and renews certificates automatically at 30 days before expiration.
- **Verification:**
  ```bash
  node scripts/ops/smoke-prod.js
  ```
  Check 2 validates TLS expiration days remaining. Check 3 validates the `Strict-Transport-Security` header.

---

## 8. Post-Release Verification Suite

Run the full live production smoke verification suite at any time:
```bash
node scripts/ops/smoke-prod.js --origin https://proctornet.duckdns.org
```

Checks performed:
1. `GET /healthz` probe returns HTTP 200 with service metadata.
2. TLS certificate validity ($> 0$ days remaining).
3. HSTS response header present.
4. Frontend SPA login page served (HTML with DOCTYPE).
5. CORS preflight accepts `X-SafeExamBrowser-ConfigKeyHash`.
6. SEB ping endpoint `/api/v1/seb/ping` reachable.
7. Unauthenticated exam start request rejected with 401 `TOKEN_REQUIRED`.
8. WebSocket engine upgrade handshake on `/socket.io` confirmed (HTTP 101).
