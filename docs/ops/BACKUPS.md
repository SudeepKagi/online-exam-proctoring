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

## 2. Server Installation & Scheduling

### Option A: systemd Service and Timer (Recommended)
Systemd timers survive reboots, provide persistent catch-up if the server was offline, and integrate cleanly with `journalctl`.

1. Copy service and timer units to system directory:
   ```bash
   sudo cp scripts/ops/proctornet-backup.service /etc/systemd/system/
   sudo cp scripts/ops/proctornet-backup.timer /etc/systemd/system/
   ```
2. Create log directory with correct permissions:
   ```bash
   sudo mkdir -p /var/log/proctornet
   sudo chown -R proctornet:proctornet /var/log/proctornet
   ```
3. Reload systemd daemon:
   ```bash
   sudo systemctl daemon-reload
   ```
4. Enable and start timer:
   ```bash
   sudo systemctl enable --now proctornet-backup.timer
   ```
5. Verify timer status and next trigger:
   ```bash
   systemctl list-timers --all | grep proctornet-backup
   ```
6. Test one-shot backup execution manually:
   ```bash
   sudo systemctl start proctornet-backup.service
   sudo journalctl -u proctornet-backup.service -n 50 --no-pager
   ```

### Option B: Cron Scheduling
If utilizing cron instead of systemd:

1. Install cron entry:
   ```bash
   sudo cp scripts/ops/crontab.example /etc/cron.d/proctornet-backup
   sudo chmod 0644 /etc/cron.d/proctornet-backup
   ```
2. Verify cron syntax and permissions:
   ```bash
   ls -la /etc/cron.d/proctornet-backup
   ```

---

## 3. Disaster Recovery & Restoration Verification
To ensure backups are not silently corrupted, ProctorNet maintains an automated restoration test runner: `scripts/ops/restore-postgres-test.js`.

### Automated Dry-Run Verification
```bash
node scripts/ops/restore-postgres-test.js
```

### Guarantees:
1. Spawns an isolated ephemeral database: `proctornet_scratch_restore_test`.
2. Restores the backup snapshot stream into the scratch database.
3. Runs structural assertions:
   - Verifies all core schema tables exist (`users`, `exams`, `questions`, `exam_attempts`, etc.).
   - Confirms non-zero record counts across relational tables.
4. Drops the scratch database on completion.

---

## 4. Quarterly Disaster Recovery Restore-Drill Checklist

Conduct this drill quarterly or prior to high-stakes examination windows.

### Phase 1: Preparation & Backup Selection
- [ ] 1. Identify drill coordinator and note start timestamp (UTC).
- [ ] 2. Locate latest local backup in `./backups/postgres/` or fetch latest snapshot from S3:
  ```bash
  aws s3 ls s3://${OFFBOX_S3_BUCKET}/backups/postgres/ --human-readable
  aws s3 cp s3://${OFFBOX_S3_BUCKET}/backups/postgres/<SNAPSHOT_FILE>.sql.gz ./restore-drill/
  ```
- [ ] 3. Validate gzip archive integrity:
  ```bash
  gzip -t ./restore-drill/<SNAPSHOT_FILE>.sql.gz
  echo "Integrity check exit code: $?"
  ```

### Phase 2: Scratch Target Provisioning
- [ ] 4. Connect to database cluster and create a clean verification database:
  ```bash
  psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE proctornet_dr_drill;"
  ```
- [ ] 5. Run automated restore pipeline into the drill database:
  ```bash
  gunzip -c ./restore-drill/<SNAPSHOT_FILE>.sql.gz | psql -U postgres -h 127.0.0.1 -d proctornet_dr_drill
  ```

### Phase 3: Integrity & Consistency Audit
- [ ] 6. Verify table counts match production catalog:
  ```sql
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
  ```
- [ ] 7. Query core entity counts (Users, Exams, ExamAttempts, Questions):
  ```sql
  SELECT 
    (SELECT count(*) FROM users) AS user_count,
    (SELECT count(*) FROM exams) AS exam_count,
    (SELECT count(*) FROM exam_attempts) AS attempt_count,
    (SELECT count(*) FROM questions) AS question_count;
  ```
- [ ] 8. Verify foreign key constraints and index integrity:
  ```sql
  SELECT relname, indisvalid FROM pg_index JOIN pg_class ON pg_class.oid = pg_index.indexrelid WHERE NOT indisvalid;
  ```
  *(Expected: 0 invalid indexes)*

### Phase 4: Drill Sign-off & Teardown
- [ ] 9. Drop the verification drill database:
  ```bash
  psql -U postgres -h 127.0.0.1 -c "DROP DATABASE proctornet_dr_drill;"
  ```
- [ ] 10. Record drill outcome, RTO (Recovery Time Objective: actual restore duration), and RPO (Recovery Point Objective: backup age) in incident log.
- [ ] 11. Remove temporary restore drill directory:
  ```bash
  rm -rf ./restore-drill/
  ```
