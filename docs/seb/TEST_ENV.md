# ProctorNet Dedicated Test Environment Guide

## 1. Overview & Port Mapping
The ProctorNet automated testing suite (Vitest + Playwright) runs in complete isolation from development and production environments. It targets a dedicated PostgreSQL test database and an isolated Redis instance with authentication running in Docker Desktop on the Windows host:

| Service | Container Name | Host Port | Container Port | Interface | Database / Key | Auth / Password |
|---|---|---|---|---|---|---|
| PostgreSQL | `proctornet-test-postgres` | `5434` | `5432` | `127.0.0.1` (loopback only) | `proctornet_e2e_test` | Loaded from `.env.test` (`POSTGRES_PASSWORD`) |
| Redis | `proctornet-test-redis` | `6380` | `6379` | `127.0.0.1` (loopback only) | N/A | Password authentication required (`REDIS_PASSWORD` in `.env.test`) |

No test process connects to the development PostgreSQL (5432, 5433) or native Redis (6379).

---

## 2. Configuration Files
- **`.env.test`** (Gitignored): Holds active credentials for local testing.
  ```ini
  POSTGRES_PASSWORD=<32-char-random-hex>
  REDIS_PASSWORD=<32-char-random-hex>
  NODE_ENV=test
  PORT=5000
  INTERNAL_PORT=9100
  DATABASE_URL="postgresql://proctornet:<POSTGRES_PASSWORD>@127.0.0.1:5434/proctornet_e2e_test?schema=public"
  DIRECT_URL="postgresql://proctornet:<POSTGRES_PASSWORD>@127.0.0.1:5434/proctornet_e2e_test?schema=public"
  REDIS_URL="redis://:<REDIS_PASSWORD>@127.0.0.1:6380"
  CACHE_DRIVER=redis
  QUEUE_DRIVER=postgres
  START_WORKERS=true
  FACE_DRIVER=off
  FACE_VERIFIER_DRIVER=off
  COOKIE_SECURE=false
  E2E_PROFILE=prod-parity
  FRONTEND_URL=http://localhost:5173
  ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
  JWT_SECRET=supersecret_jwt_proctornet_production_key_32bytes
  S3_BUCKET=proctornet-storage
  AWS_REGION=ap-south-1
  EXAM_CACHE_TTL_MS=0
  ```
- **`.env.test.example`** (Committed): Provides the sanitized template for new clones.

---

## 3. Bringing Up the Test Environment (Fresh Start / After Reboot)
Run the following steps from the repository root:

### Step 1: Ensure Docker Desktop is Running & Start Test Services
Ensure Docker Desktop is active, then launch only the isolated test containers under project `proctornet-test`:
```powershell
docker --context desktop-linux compose --env-file .env.test -p proctornet-test up -d postgres redis
```
Verify port bindings and healthy status:
```powershell
docker ps --filter "name=proctornet-test-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Expected output:
```
proctornet-test-postgres   Up (healthy)   127.0.0.1:5434->5432/tcp
proctornet-test-redis      Up (healthy)   127.0.0.1:6380->6379/tcp
```

### Step 2: Initialize Database Schema (First Time / If Missing)
If the database `proctornet_e2e_test` is not yet created or migrated:
```powershell
cd backend
$envContent = Get-Content "../.env.test" | ConvertFrom-StringData
$env:DATABASE_URL = $envContent.DATABASE_URL.Trim('"')
$env:DIRECT_URL = $envContent.DIRECT_URL.Trim('"')
npx prisma migrate deploy
node prisma/seed/admin.js
```

### Step 3: Run the Test Suites

> [!WARNING]
> **Strict Concurrency Rule:** Backend and Playwright E2E suites share the isolated test database `proctornet_e2e_test`. Playwright uses active database resetting (`resetCleanRoom()`) between test flows. Therefore, **backend tests and Playwright E2E tests must NEVER run concurrently**. Running them at the same time causes transient database foreign key violations (`exam_attempts_student_id_fkey`) and state collisions. Always run them sequentially.

Run backend unit/integration tests:
```powershell
npm test --workspace=backend
```
Run Playwright end-to-end tests:
```powershell
npx playwright test
```
