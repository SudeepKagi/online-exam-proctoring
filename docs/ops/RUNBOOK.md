# ProctorNet Production Operations Runbook (`docs/ops/RUNBOOK.md`)

> **Document Type:** Production Runbook  
> **Classification:** Authoritative Operations & Incident Response  
> **Target Environment:** Production High-Stakes Kiosk Examination Infrastructure  

---

## 1. Secret Rotation Checklist (Burned Git Secrets)

> [!WARNING]
> All default secret strings that have ever appeared in git commit history or example configuration files must be considered **compromised/burned**. Under no circumstances may these values be utilized in any staging or production environment.

### Burned Key Inventory
The following keys are permanently banned by the `validateConfig` boot-time startup invariant:
- `proctornet_super_secret_jwt_key_local_development_fallback_2026`
- `supersecret_jwt_proctornet_production_key_32bytes`
- `supersecret_jwt_refresh_proctornet_key_32bytes`
- `dev_seb_link_secret_at_least_32_characters_long_for_hmac`
- `ci_throwaway_jwt_secret_at_least_32_characters_long_01`
- `ci_test_postgres_32char_secure_password_01`
- `ci_test_redis_32char_secure_password_01`
- `test_suite_jwt_secret_minimum_32_characters_long_for_unit_tests!`

### Production Key Rotation Procedure
1. **Generate High-Entropy Secrets (minimum 64 characters hex/alphanumeric):**
   ```bash
   # Generate cryptographic tokens
   NEW_JWT_SECRET=$(openssl rand -hex 32)
   NEW_JWT_REFRESH_SECRET=$(openssl rand -hex 32)
   NEW_SEB_LINK_SECRET=$(openssl rand -hex 32)
   NEW_POSTGRES_PASS=$(openssl rand -hex 24)
   NEW_REDIS_PASS=$(openssl rand -hex 24)
   ```
2. **Update Environment Store / Secret Manager:**
   - Inject the new values into AWS Secrets Manager, HashiCorp Vault, or the production `.env` (permissions `chmod 600 .env`).
3. **Database & Cache Credential Synchronization:**
   - Update Postgres user password:
     ```sql
     ALTER USER proctornet WITH PASSWORD 'NEW_POSTGRES_PASS';
     ```
   - Update Redis runtime configuration:
     ```bash
     redis-cli -a "$OLD_REDIS_PASS" CONFIG SET requirepass "NEW_REDIS_PASS"
     ```
4. **Zero-Downtime Rolling App Restart:**
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```
5. **Session Invalidation Notice:**
   - Rotating `JWT_SECRET` immediately invalidates existing access tokens. Active candidates will refresh transparently via the `/refresh` endpoint if `JWT_REFRESH_SECRET` is rotated in a staged rollout, or re-authenticate via the institutional portal.

---

## 2. Exam-Day Operational Checklist

### T-60 Minutes: Pre-Flight Infrastructure Audit
- [ ] **Data Stores:** Verify PostgreSQL connection pool utilization (`< 40%`) and Redis memory usage (`< 50%` of maxmemory).
- [ ] **Background Workers:** Verify `QUEUE_DRIVER=postgres` (or RabbitMQ) sweeper and batch dispatchers are active.
- [ ] **Storage Health:** Validate S3 bucket accessibility and write permissions for proctoring snapshots.

### T-30 Minutes: Network & Gateway Verification
- [ ] **Reverse Proxy:** Verify Caddy/Nginx reverse proxy is running on ports 80 and 443 with valid TLS certificate.
- [ ] **HSTS & Headers:** Ensure `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` is active.
- [ ] **Origin Parity:** Verify `PUBLIC_ORIGIN` matches canonical origin (`https://proctornet.duckdns.org`).
- [ ] **Proxy Forwarding:** Verify `app.set('trust proxy', 1)` resolves client IP and HTTPS protocol correctly.

### T-15 Minutes: SEB Configuration & Ping Sanity
- [ ] **Health Probe:** Execute `GET /api/v1/seb/ping` from a known SEB client and verify `200 OK` with `{ verified: true }`.
- [ ] **Exam Status:** Verify scheduled exam is in `PUBLISHED` state with `sebRequired: true`.
- [ ] **Config Key:** Verify the 64-hex Config Key stored on the exam matches the institutional `.seb` client configuration file.

### T-0 to Exam Close: Live Monitoring
- [ ] **Attempt Ingestion Rate:** Monitor `POST /api/v1/attempts/exams/:id/start` response latency ($p(95) < 500\text{ ms}$).
- [ ] **Autosave Batches:** Confirm answer autosaves execute without database serialization deadlocks.
- [ ] **Invigilator WebSockets:** Verify room roster coalescence and real-time violation event streams.

### Post-Exam: Finalization & Cold Backup
- [ ] **Sweeper Completion:** Verify all expired attempts transitioned to `SUBMITTED` or `TIMED_OUT`.
- [ ] **Cold Backup:** Execute `scripts/ops/backup-postgres.sh` and verify S3 upload.

---

## 3. Rollback Procedures

### Blue/Green & Container Rollback
If a critical defect is identified post-deployment:
1. **Revert to Previous Docker Image:**
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   docker compose -f docker-compose.prod.yml up -d --no-deps backend
   ```
2. **Database Migration Safety:**
   - All ProctorNet database migrations are strictly **additive** (new tables/columns only; zero drops/destructive alters during exam windows).
   - Rolling back backend application code does not require rolling back the database schema.

---

## 4. Emergency Playbook: "SEB Mismatch Flood"

### Problem Definition
Students opening Safe Exam Browser receive an unexpected `403 Forbidden` (`code: "SEB_REQUIRED"`) error when attempting to start their exam, despite using the official `.seb` configuration.

### Immediate Triage Protocol (Sub-60-Second Resolution)
1. **Switch SEB Mode from `enforce` to `log`:**
   In the production environment (or `.env` file):
   ```bash
   SEB_MODE=log
   ```
2. **Perform Rolling Backend Restart:**
   ```bash
   docker compose -f docker-compose.prod.yml restart backend
   ```
3. **Verify Candidate Recovery:**
   - In `SEB_MODE=log`, the SEB middleware verifies headers and logs discrepancies, but **NEVER blocks requests with 403**.
   - Students can immediately start their exams and submit answers without interruption.
4. **Diagnose Root Cause via Hash Logs:**
   Inspect backend server logs for the SEB verification audit line:
   ```
   [WARN] SEB request verification failed (log mode non-blocking)
   receivedPrefix8: "a1b2c3d4"
   expectedPrefix8: "e5f60718"
   urlHashed: "https://exam.institution.edu/api/v1/attempts/exams/.../start"
   ```
   - **Scenario A (Origin Mismatch):** Reverse proxy forwarded `http://` instead of `https://`, or stripped port. Fix proxy `X-Forwarded-Proto`.
   - **Scenario B (Config Key Mismatch):** Faculty updated exam settings with a different key. Update exam settings with the correct Config Key.
5. **Re-Enable Enforce Mode:**
   Once the origin/key divergence is resolved and verified via `GET /api/v1/seb/ping`, switch `SEB_MODE=enforce` and restart.

