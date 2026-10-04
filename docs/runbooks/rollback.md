# Production Rollback Runbook

**Goal**: Swift, deterministic rollback to the previously known good state when a deployment fails.

---

## 1. Rollback Trigger Criteria

Initiate immediate rollback if any of the following occur within 15 minutes of deployment:
- HTTP 5xx error rate exceeds $0.5\%$ on `/api/v1/attempts`.
- `/readyz` probe fails continuously across API pods.
- WebSocket disconnection rate surges by $> 20\%$.
- Unrecoverable database deadlock or migration failure occurs.

---

## 2. Immediate Rollback Execution

### 2.1 Re-deploy Previous Immutable Container Tags
Retrieve the previous known stable commit SHA from GitHub releases or deployment history:

```bash
PREV_TAG="<PREVIOUS_GIT_SHA>"

# 1. Export target image tags
export BACKEND_IMAGE="ghcr.io/sudeepkagi/online-exam-proctoring/backend:${PREV_TAG}"
export FRONTEND_IMAGE="ghcr.io/sudeepkagi/online-exam-proctoring/frontend:${PREV_TAG}"

# 2. Pull known stable container images
docker pull "${BACKEND_IMAGE}"
docker pull "${FRONTEND_IMAGE}"

# 3. Rolling update of API instances to previous tag
docker compose -f docker-compose.prod.yml up -d --no-deps api-1
until [ "$(docker inspect -f '{{.State.Health.Status}}' proctornet-api-1)" == "healthy" ]; do
    sleep 2
done

docker compose -f docker-compose.prod.yml up -d --no-deps api-2
until [ "$(docker inspect -f '{{.State.Health.Status}}' proctornet-api-2)" == "healthy" ]; do
    sleep 2
done

# 4. Restart worker
docker compose -f docker-compose.prod.yml up -d --no-deps worker

# 5. Reload Nginx
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 3. Database Migration Rollback Considerations

ProctorNet enforces an **expand-and-contract** migration policy:
- Code is deployed to tolerate both new and old schemas before columns are deprecated.
- If a migration added a nullable column or index, **do not roll back the schema**; the old code will run safely against the expanded schema.
- If a destructive migration failed mid-way, restore from the pre-deployment `pg_dump` snapshot:
  ```bash
  # Restore database from pre-deployment snapshot
  dropdb -h localhost -U proctornet_admin --if-exists proctornet
  createdb -h localhost -U proctornet_admin proctornet
  pg_restore -h localhost -U proctornet_admin -d proctornet -v /backups/pre_deploy_<TIMESTAMP>.dump
  ```

---

## 4. Post-Rollback Health Audit

1. Verify edge returns 200 OK:
   ```bash
   curl -fsS https://exam.university.edu/health
   ```
2. Verify candidate autosave endpoints:
   ```bash
   curl -fsS http://localhost:5000/readyz
   ```
3. Check Prometheus metrics for error rate normalization:
   ```bash
   curl -s http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])
   ```
