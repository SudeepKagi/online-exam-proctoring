# Production Deployment Runbook

**Goal**: Execute reliable, zero-downtime deployments with safe rolling restarts and secret management.

---

## 1. Pre-Deployment Verification

1. **Verify Git & CI Status**:
   - Ensure the deployment commit has passed all CI checks (linting, test suites, migration diff, Trivy security scan).
2. **Review Database Migration Compatibility**:
   - Backward-compatible migrations only (expand before contract).
   - If columns are being removed or renamed, ensure the running application no longer references them.
3. **Backup Check**:
   - Ensure a fresh `pg_dump` exists before running migrations:
     ```bash
     bash ops/scripts/backup-restore.sh
     ```

---

## 2. One-Command Deployment Workflow

Pull immutable container image tags published by the CI pipeline and deploy:

```bash
# 1. Pull latest immutable tags
docker compose -f docker-compose.prod.yml pull

# 2. Apply pending Prisma migrations
docker compose -f docker-compose.prod.yml run --rm api-1 npx prisma migrate deploy

# 3. Rolling update for API instances (Zero Downtime)
# Update api-1 first while api-2 serves live candidate traffic
docker compose -f docker-compose.prod.yml up -d --no-deps --build api-1

# Wait for api-1 healthcheck to pass
until [ "$(docker inspect -f '{{.State.Health.Status}}' proctornet-api-1)" == "healthy" ]; do
    echo "Waiting for api-1 to become healthy..."
    sleep 2
done
echo "[✓] api-1 is healthy and taking traffic."

# Update api-2 while api-1 serves live traffic
docker compose -f docker-compose.prod.yml up -d --no-deps --build api-2

until [ "$(docker inspect -f '{{.State.Health.Status}}' proctornet-api-2)" == "healthy" ]; do
    echo "Waiting for api-2 to become healthy..."
    sleep 2
done
echo "[✓] api-2 is healthy and taking traffic."

# 4. Update Worker pod
docker compose -f docker-compose.prod.yml up -d --no-deps worker

# 5. Reload Nginx configuration without dropping connections
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 3. Post-Deployment Verification Drill

Run the post-deployment health audit:

```bash
# 1. Verify Edge Nginx Liveness
curl -fsS http://localhost/health

# 2. Verify Internal Readiness Probe
docker compose -f docker-compose.prod.yml exec nginx curl -fsS http://api-1:5000/readyz
docker compose -f docker-compose.prod.yml exec nginx curl -fsS http://api-2:5000/readyz

# 3. Verify Background Outbox Delivery
docker compose -f docker-compose.prod.yml logs --tail=50 worker | grep "outboxPublisher"
```

---

## 4. Secret Rotation Protocol (Task 3)

### 4.1 Database Password (`POSTGRES_PASSWORD`)
1. In PostgreSQL, create a temporary secondary credential:
   ```sql
   ALTER USER proctornet_admin WITH PASSWORD 'new_strong_password';
   ```
2. Update `.env` (or AWS Secrets Manager) with `POSTGRES_PASSWORD=new_strong_password`.
3. Restart backend API pods sequentially (`api-1`, then `api-2`, then `worker`).

### 4.2 JWT Secret (`JWT_SECRET`)
- To avoid invalidating active candidate sessions, use key versioning if supported or rotate during scheduled maintenance windows between examination periods.
- Update `JWT_SECRET` in `.env` and restart application pods.

### 4.3 LiveKit API Credentials (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`)
1. Generate new 32-byte secret:
   ```bash
   openssl rand -base64 32
   ```
2. Update `ops/livekit/livekit.yaml` and `.env`.
3. Restart LiveKit container and backend pods.
