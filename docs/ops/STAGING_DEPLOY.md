# ProctorNet Staging Deployment & Migration Runbook (`docs/ops/STAGING_DEPLOY.md`)

> **Document Type:** Operations Architecture & Deployment Manual  
> **Classification:** Confidential — ProctorNet Engineering & DevOps  
> **Target Scope:** Staging Environment Setup, DNS, SSL/TLS, and Database Migration Baselining  

---

## 1. Staging Deployment Architecture

ProctorNet standardizes on a single, unified deployment topology for both Staging and Production:

### Dedicated Staging EC2 Instance (Single Supported Topology)
Staging runs the exact production Docker Compose stack (`docker-compose.prod.yml`) driven by a staging environment file (`/opt/proctornet-staging/.env`) on a dedicated AWS EC2 instance.
- **Topology Parity:** 100% architectural parity with production. Uses Caddy (automatic HTTPS via ACME / DuckDNS), backend API, isolated Postgres 16, Redis 7, RabbitMQ, and the containerized frontend asset-sync volume.
- **Instance Sizing:** AWS EC2 `t3.small` (2 vCPU, 2 GB RAM, 20 GB gp3 storage) in `ap-south-1`.
- **Estimated Infrastructure Cost:**
  - `t3.small` on-demand: ~\$0.0208 / hour ≈ **\$15.18 / month**.
  - 20 GB gp3 EBS: ~**\$1.60 / month**.
  - Total Monthly Run Rate: ~**\$16.78 / month** (or ~\$9.80 / month with a 1-year Savings Plan).
- **Network Isolation:** Dedicated elastic IP, dedicated security group (inbound 80, 443; zero public database ports), own Caddy instance binding directly to 80/443 for `staging.proctornet.duckdns.org`.
- **Zero Drift:** By deploying `docker-compose.prod.yml` to both environments, staging tests the exact container orchestration, networking, and volume lifecycle deployed to production.

---

## 2. DNS & Domain Configuration

For dynamic DNS setups (DuckDNS) or custom domains:

1. **DuckDNS Configuration:**
   - Primary domain: `proctornet.duckdns.org` points to production IP (e.g., `43.204.45.86`).
   - Staging subdomain: DuckDNS supports single token multi-domain accounts. Create a dedicated subdomain `proctornet-staging.duckdns.org` or `staging.proctornet.duckdns.org` pointing to the staging host IP.
2. **Custom Institutional Domain (CNAME):**
   ```text
   staging.exam.institution.edu.  IN  CNAME  staging.proctornet.duckdns.org.
   ```

---

## 3. Caddy Reverse Proxy Configuration

When co-located with production on the same EC2 instance, add the following site block to `/etc/caddy/Caddyfile` on the host:

```caddy
# Staging Environment Site Block (Co-located with Production)
staging.proctornet.duckdns.org {
    encode zstd gzip

    # Block internal telemetry publicly
    handle /metrics* {
        respond "Not Found" 404
    }

    handle /readyz* {
        respond "Not Found" 404
    }

    # Security Headers (HSTS without preload for shared domain safety)
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(self), microphone=(self), display-capture=()"
        ?X-Request-ID "{uuid}"
    }

    request_body {
        max_size 25MB
    }

    # Route all traffic to staging edge container
    reverse_proxy 127.0.0.1:8081 {
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
}
```

Reload Caddy without dropping connections:
```bash
caddy reload --config /etc/caddy/Caddyfile
```

---

## 4. Environment Variables & Secret Generation

### Generating Cryptographic Secrets
Run the following commands to generate non-default, high-entropy (256-bit) credentials for staging:

```bash
# JWT Secrets (minimum 64 characters hex)
openssl rand -hex 32

# SEB HMAC Link Secret
openssl rand -hex 32

# Postgres Password
openssl rand -hex 24

# Redis Password
openssl rand -hex 24

# RabbitMQ Password
openssl rand -hex 24
```

### Staging Environment File Template (`.env.staging`)
Save this file at `/opt/proctornet-staging/.env` with strict permissions (`chmod 600 /opt/proctornet-staging/.env`):

```bash
# ==============================================================================
# ProctorNet Staging Configuration (.env.staging)
# ==============================================================================

# Node Environment
NODE_ENV=staging
PORT=5000

# Canonical Public Origin (no trailing slash)
STAGING_PUBLIC_ORIGIN=https://staging.proctornet.duckdns.org
STAGING_ALLOWED_ORIGINS=https://staging.proctornet.duckdns.org

# Database Credentials (Isolated Staging Database)
POSTGRES_USER=proctornet_staging
STAGING_POSTGRES_PASSWORD=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
POSTGRES_DB=proctornet_staging
DATABASE_URL=postgresql://proctornet_staging:<PASSWORD>@postgres:5432/proctornet_staging?schema=public
DIRECT_URL=postgresql://proctornet_staging:<PASSWORD>@postgres:5432/proctornet_staging?schema=public

# Redis L2 Cache & PubSub
STAGING_REDIS_PASSWORD=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
REDIS_URL=redis://:<PASSWORD>@redis:6379

# RabbitMQ Broker
STAGING_RABBITMQ_DEFAULT_PASS=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
RABBITMQ_URL=amqp://proctornet_staging:<PASSWORD>@rabbitmq:5672

# Application Secrets (Must be unique, never reused from production or git defaults)
STAGING_JWT_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>
STAGING_JWT_REFRESH_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>
STAGING_SEB_LINK_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>

# Safe Exam Browser Configuration
SEB_MODE=log
SEB_CONFIG_KEY=

# Storage & Infrastructure Drivers
CACHE_DRIVER=redis
FACE_DRIVER=off
MEDIA_DRIVER=snapshot
S3_BUCKET=proctornet-staging-evidence
AWS_REGION=ap-south-1
```

---

## 5. Existing-Database Migration Baselining Procedure

> [!CAUTION]
> **Production Safety Rule:** Never execute untested migrations or `prisma migrate dev` against an active production database. Always perform a read-only audit and rehearsal first.

### Step 5.1: Read-Only Database Audit (Live Production DB)
Execute these read-only SQL queries to determine the current migration state without locking or altering tables:

```sql
-- 1. Check if the Prisma migrations tracking table exists
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = '_prisma_migrations'
) AS has_prisma_migrations;

-- 2. If table exists, inspect applied migrations
SELECT 
    id,
    migration_name,
    finished_at,
    applied_steps_count
FROM _prisma_migrations 
ORDER BY finished_at ASC;

-- 3. Check existing core tables to verify schema version
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'exams', 'questions', 'system_settings')
ORDER BY table_name;
```

**Interpretation of Results:**
- If `has_prisma_migrations` is `false`, the database was created using raw SQL scripts or `prisma db push`. You **must** baseline before applying new migrations.
- If `has_prisma_migrations` is `true`, check if `0001_core_tables`, `0002_user_status_enums`, and `0003_user_onboarding_fields` are recorded.
- If `system_settings` does not exist, migration `0004_system_settings` is pending.

### Step 5.2: Safe Baselining Procedure (for Unversioned DBs)
When transitioning an existing database to Prisma Migrate, mark historical migrations as already applied without re-running their DDL:

```bash
# 1. Baseline initial core schema
npx prisma migrate resolve --applied 0001_core_tables

# 2. Baseline user status enums
npx prisma migrate resolve --applied 0002_user_status_enums

# 3. Baseline onboarding profile fields
npx prisma migrate resolve --applied 0003_user_onboarding_fields

# 4. Check migration status to verify pending migrations
npx prisma migrate status

# Expected output:
# 3 migrations found in prisma/migrations
# 3 migrations applied
# 1 migration pending (0004_system_settings)

# 5. Apply the additive pending migration
npx prisma migrate deploy
```

### Step 5.3: Mandatory Rehearsal on Restored Backup
Before applying any migration to staging or production, rehearse on an ephemeral copy:

1. **Create Ephemeral Scratch Database:**
   ```bash
   createdb -h localhost -p 5434 -U proctornet proctornet_scratch
   ```
2. **Restore Live Production Backup:**
   ```bash
   pg_restore -h localhost -p 5434 -U proctornet -d proctornet_scratch /var/backups/proctornet/latest.dump
   ```
3. **Execute Baseline & Deploy Against Scratch:**
   ```bash
   DATABASE_URL="postgresql://proctornet:pass@localhost:5434/proctornet_scratch?schema=public" \
   npx prisma migrate resolve --applied 0001_core_tables

   DATABASE_URL="postgresql://proctornet:pass@localhost:5434/proctornet_scratch?schema=public" \
   npx prisma migrate resolve --applied 0002_user_status_enums

   DATABASE_URL="postgresql://proctornet:pass@localhost:5434/proctornet_scratch?schema=public" \
   npx prisma migrate resolve --applied 0003_user_onboarding_fields

   DATABASE_URL="postgresql://proctornet:pass@localhost:5434/proctornet_scratch?schema=public" \
   npx prisma migrate deploy
   ```
4. **Verify Application Functionality:**
   Point backend test runner or smoke script against `proctornet_scratch` to confirm zero regression.
5. **Tear Down Scratch Database:**
   ```bash
   dropdb -h localhost -p 5434 -U proctornet proctornet_scratch
   ```

---

## 6. Staging Launch Sequence

```bash
# 1. Navigate to staging directory
cd /opt/proctornet-staging

# 2. Pull container images
docker compose -f docker-compose.staging.yml pull

# 3. Run database migrations in ephemeral container
docker run --rm \
  --network proctornet-staging_internal \
  --env-file /opt/proctornet-staging/.env \
  ghcr.io/proctornet/online-exam-proctoring/backend:staging \
  npx prisma migrate deploy

# 4. Start staging containers
docker compose -f docker-compose.staging.yml up -d --remove-orphans

# 5. Execute automated smoke verification
node scripts/ops/smoke-staging.js --origin https://staging.proctornet.duckdns.org
```

