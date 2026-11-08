# ProctorNet Database Backup, Disaster Recovery & Retention Policy

## 1. Overview & Architecture
ProctorNet mandates point-in-time and nightly cold backups of the primary PostgreSQL relational datastore.
All persistent examination state—including candidates, exam configurations, question banks, candidate answers, proctoring events, and violation audits—resides in PostgreSQL.

| Component | Policy | Target | Tooling |
| :--- | :--- | :--- | :--- |
| **Backup Frequency** | Nightly (02:00 UTC) | `./backups/postgres/` | `pg_dump` with Gzip (`-9`) compression |
| **Local Retention** | 7 days rolling | Auto-pruned by timestamp | `scripts/ops/backup-postgres.sh` / `.js` |
| **Off-box Storage** | Encrypted S3 Bucket | `s3://$OFFBOX_S3_BUCKET/backups/postgres/` | AWS CLI v2 / IAM Role S3 sync |
| **Disaster Recovery** | Automated scratch test | `proctornet_scratch_restore_test` | `scripts/ops/restore-postgres-test.js` |

---

## 2. Nightly Backup Execution
The automated backup is executed nightly via system cron or container scheduler:

```bash
# Crontab schedule (nightly at 02:00 AM)
0 2 * * * root /opt/proctornet/scripts/ops/backup-postgres.sh >> /var/log/proctornet-backup.log 2>&1
```

### Script Workflow:
1. Emits a timestamped, gzipped SQL stream: `proctornet_backup_YYYYMMDD_HHMMSS.sql.gz`.
2. Verifies non-zero byte size and gzip format integrity.
3. Automatically deletes local archives older than `RETENTION_DAYS` (default 7 days).
4. Copies the archive off-box to AWS S3 (`s3://${OFFBOX_S3_BUCKET}/backups/postgres/`) with AES-256 server-side encryption.

---

## 3. Disaster Recovery & Restoration Verification
To ensure backups are not silently corrupted, ProctorNet maintains an automated restoration test runner: `scripts/ops/restore-postgres-test.js`.

### Restoration Run Procedure:
```bash
node scripts/ops/restore-postgres-test.js
```

### Test Guarantees:
1. Spawns an isolated ephemeral database: `proctornet_scratch_restore_test`.
2. Restores the backup snapshot stream into the scratch database.
3. Runs structural assertions:
   - Verifies all 9 core schema tables exist (`users`, `exams`, `questions`, `exam_attempts`, etc.).
   - Confirms non-zero record counts across relational tables.
4. Drops the scratch database on completion.

