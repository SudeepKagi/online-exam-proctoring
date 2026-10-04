# Database Backup, Disaster Recovery & PITR Runbook

**Reference**: Phase P9 Task 6 / Appendix C  
**HA Target**: Recovery Point Objective (RPO) $\le 5\text{ minutes}$, Recovery Time Objective (RTO) $\le 15\text{ minutes}$.  

---

## 1. Backup Strategy Overview

ProctorNet implements a dual-layer backup architecture on single-node deployments:

1. **Nightly Logical Snapshots (`pg_dump`)**:
   - Compressed custom-format binary snapshots (`-Fc -Z 6`) captured every night at 02:00 UTC.
   - Retained locally for 7 days, and synced to off-site encrypted AWS S3 (`s3://proctornet-backups/daily/`) with 90-day retention.
2. **Continuous WAL Archiving (Point-In-Time-Recovery / PITR)**:
   - Configured in `ops/postgres/postgresql.conf`:
     ```ini
     wal_level = replica
     wal_compression = on
     archive_mode = on
     archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'
     archive_timeout = 300
     ```
   - Every 16MB WAL segment (or every 5 minutes via `archive_timeout`) is archived, enabling replay to any arbitrary second before a disaster.

---

## 2. Automated Nightly Backup Cron

On the host node, configure `/etc/cron.d/proctornet-backup`:

```bash
# Nightly consistent binary pg_dump at 02:00 UTC
0 2 * * * root docker compose -f /opt/proctornet/docker-compose.prod.yml exec -T postgres /bin/bash /opt/proctornet/ops/scripts/backup-restore.sh >> /var/log/proctornet-backup.log 2>&1

# Sync archives to AWS S3 at 03:00 UTC
0 3 * * * root aws s3 sync /var/lib/docker/volumes/proctornet-postgres-wal/_data s3://proctornet-backups/wal/ --delete
```

---

## 3. Disaster Recovery Restoration Drill

To restore a database snapshot into production or a staging verification environment:

### Step 1: Locate Target Backup File
```bash
ls -lh /backups/proctornet_*.dump
TARGET_BACKUP="/backups/proctornet_20261004_020000.dump"
```

### Step 2: Stop Ingress Traffic
Prevent new writes during restoration by setting Nginx to maintenance mode:
```bash
docker compose -f docker-compose.prod.yml stop api-1 api-2 worker
```

### Step 3: Terminate Active Connections & Recreate Database
```bash
docker compose -f docker-compose.prod.yml exec -T postgres psql -U proctornet_admin -d postgres << 'EOF'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'proctornet';
DROP DATABASE IF EXISTS proctornet;
CREATE DATABASE proctornet OWNER proctornet_admin;
EOF
```

### Step 4: Execute Restoration (`pg_restore`)
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U proctornet_admin -d proctornet -v --no-owner "$TARGET_BACKUP"
```

### Step 5: Point-In-Time-Recovery (PITR) WAL Replay (If Replaying to Specific Timestamp)
Create `/var/lib/postgresql/data/recovery.signal` and configure `postgresql.conf`:
```ini
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
recovery_target_time = '2026-10-04 14:32:00 UTC'
recovery_target_action = 'promote'
```
Start PostgreSQL container. It will replay WAL segments up to the exact millisecond requested, then promote itself to primary read-write mode.

### Step 6: Post-Restore Verification
Verify table count and key records:
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U proctornet_admin -d proctornet -c "SELECT count(*) FROM exam_attempts;"
```

### Step 7: Restart Application Pods
```bash
docker compose -f docker-compose.prod.yml start api-1 api-2 worker
curl -fsS http://localhost:5000/readyz
```
