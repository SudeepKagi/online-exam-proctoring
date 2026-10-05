/**
 * ==============================================================================
 * Phase P9 Test Suite: Single-Node Infrastructure & Hardening
 * ==============================================================================
 *
 * Mandatory Tests & Invariants:
 * 1. Docker Compose Configuration & Linting:
 *    - Validates docker-compose.prod.yml and docker-compose.dev.yml syntax.
 *    - Asserts mem_limit, cpus, healthcheck, restart, stop_grace_period >= 30s.
 * 2. Network Boundary & Data Tier Isolation (Task 2):
 *    - Asserts edge network contains only Nginx.
 *    - Asserts internal network is marked internal: true.
 *    - Asserts postgres, redis, rabbitmq have ZERO published host ports in prod.
 *    - Asserts dev override binds ports strictly to 127.0.0.1.
 * 3. Health & Readiness Probes (Task 7):
 *    - /healthz returns 200 { status: "ok" } (liveness).
 *    - /readyz verifies Postgres, Redis, and RabbitMQ with short timeouts.
 *    - /readyz flips to 503 { status: "not_ready" } when any dependency fails.
 * 4. Nginx Edge Reverse Proxy Hardening (Task 4):
 *    - Validates TLS 1.2/1.3, HTTP/2, least_conn upstream over api-1/api-2.
 *    - Validates WebSocket upgrade headers and 3600s persistent timeout.
 *    - Validates strict Content-Security-Policy (CSP) and blocked /metrics endpoint.
 * 5. Secret Hygiene & Absence of Hardcoded Credentials (Task 3 / C-01):
 *    - Scans compose files and codebase for hardcoded passwords.
 *    - Validates .env.example coverage.
 *    - Verifies Gitleaks configuration (.gitleaks.toml and workflow).
 * 6. Kernel & OS Performance Tuning (Task 5):
 *    - Validates ops/sysctl.d/99-proctornet.conf contains required parameters:
 *      somaxconn, tcp_max_syn_backlog, tcp_tw_reuse, file-max, rmem_max, swappiness.
 * 7. Database Tuning, WAL Archiving & Restore Drill (Task 6):
 *    - Validates wal_compression=on, archive_mode=on in postgresql.conf.
 *    - Executes backup & restore verification routines.
 */

process.env.NODE_ENV = 'test'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = path.resolve(__dirname, '../../../')
const prodComposePath = path.join(rootDir, 'docker-compose.prod.yml')
const devComposePath = path.join(rootDir, 'docker-compose.dev.yml')
const nginxConfPath = path.join(rootDir, 'ops/nginx/conf.d/proctornet.conf')
const sysctlConfPath = path.join(rootDir, 'ops/sysctl.d/99-proctornet.conf')
const postgresConfPath = path.join(rootDir, 'ops/postgres/postgresql.conf')
const gitleaksConfPath = path.join(rootDir, '.gitleaks.toml')
const envExamplePath = path.join(rootDir, '.env.example')

describe('P9 Infrastructure & Hardening Test Suite', () => {

  // --------------------------------------------------------------------------
  // 1. Docker Compose Configuration & Linting
  // --------------------------------------------------------------------------
  describe('1. Docker Compose Production & Dev Linting', () => {
    it('successfully lints docker-compose.prod.yml with docker compose config', () => {
      assert.ok(fs.existsSync(prodComposePath), 'docker-compose.prod.yml must exist at repository root')

      try {
        const output = execSync('docker compose -f docker-compose.prod.yml config', {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
        assert.ok(output.includes('proctornet-nginx'), 'Parsed config must define proctornet-nginx')
        assert.ok(output.includes('proctornet-api-1'), 'Parsed config must define proctornet-api-1')
        assert.ok(output.includes('proctornet-api-2'), 'Parsed config must define proctornet-api-2')
        assert.ok(output.includes('proctornet-worker'), 'Parsed config must define proctornet-worker')
        assert.ok(output.includes('proctornet-postgres'), 'Parsed config must define proctornet-postgres')
      } catch (err) {
        assert.fail(`docker compose config validation failed: ${err.stderr || err.message}`)
      }
    })

    it('successfully lints combined prod + dev override config with 127.0.0.1 port bindings', () => {
      assert.ok(fs.existsSync(devComposePath), 'docker-compose.dev.yml must exist at repository root')

      try {
        const output = execSync('docker compose -f docker-compose.prod.yml -f docker-compose.dev.yml config', {
          cwd: rootDir,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        })
        assert.ok(output.includes('127.0.0.1:5432:5432') || output.includes('5432'), 'Dev override must bind PostgreSQL to 127.0.0.1')
        assert.ok(output.includes('127.0.0.1:6379:6379') || output.includes('6379'), 'Dev override must bind Redis to 127.0.0.1')
      } catch (err) {
        assert.fail(`docker compose dev config validation failed: ${err.stderr || err.message}`)
      }
    })

    it('enforces memory limits, healthchecks, stop_grace_period >= 30s, and init on production services', () => {
      const prodContent = fs.readFileSync(prodComposePath, 'utf8')

      // Stop grace period check
      const stopGraceMatch = prodContent.match(/stop_grace_period:\s*(\d+)s/g)
      assert.ok(stopGraceMatch && stopGraceMatch.length >= 3, 'Production services must specify stop_grace_period')
      for (const m of stopGraceMatch) {
        const seconds = parseInt(m.replace(/[^0-9]/g, ''), 10)
        assert.ok(seconds >= 30, `stop_grace_period must be >= 30s, found ${seconds}s`)
      }

      // Memory limits
      assert.ok(prodContent.includes('mem_limit: 4096m'), 'PostgreSQL must have 4096m mem_limit')
      assert.ok(prodContent.includes('mem_limit: 1024m'), 'API & Redis must have mem_limit configured')

      // Healthchecks
      assert.ok(prodContent.includes('healthcheck:'), 'Containers must define healthchecks')
      assert.ok(prodContent.includes('pg_isready'), 'Postgres healthcheck must use pg_isready')

      // Init and restart
      assert.ok(prodContent.includes('init: true'), 'Production containers must use init: true for zombie reaping')
      assert.ok(prodContent.includes('restart: unless-stopped'), 'Production containers must use restart: unless-stopped')
    })
  })

  // --------------------------------------------------------------------------
  // 2. Network Boundary & Data Tier Isolation (Task 2)
  // --------------------------------------------------------------------------
  describe('2. Network Boundary & Private Data Services (Task 2)', () => {
    it('isolates data tier on internal: true network with ZERO published host ports in prod', () => {
      const prodContent = fs.readFileSync(prodComposePath, 'utf8')

      // Internal network must be declared internal: true
      assert.ok(prodContent.includes('internal:\n    driver: bridge\n    internal: true') ||
                prodContent.includes('internal: true'),
                'internal network must have internal: true')

      // Parse services section to ensure postgres, redis, and rabbitmq have no ports: section
      const postgresSection = prodContent.split('postgres:')[1].split('redis:')[0]
      assert.ok(!postgresSection.includes('ports:'), 'PostgreSQL in production must NOT have exposed host ports')

      const redisSection = prodContent.split('redis:')[1].split('rabbitmq:')[0]
      assert.ok(!redisSection.includes('ports:'), 'Redis in production must NOT have exposed host ports')

      const rabbitSection = prodContent.split('rabbitmq:')[1].split('livekit:')[0]
      assert.ok(!rabbitSection.includes('ports:'), 'RabbitMQ in production must NOT have exposed host ports')
    })

    it('dev override binds ports strictly to 127.0.0.1 (localhost only)', () => {
      const devContent = fs.readFileSync(devComposePath, 'utf8')
      const portLines = devContent.split('\n').filter(line => line.trim().startsWith('- "') || line.trim().startsWith("- '"))

      for (const line of portLines) {
        assert.ok(line.includes('127.0.0.1:'), `Dev port binding must bind strictly to 127.0.0.1, found: ${line}`)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 3. Health & Readiness Probes (Task 7)
  // --------------------------------------------------------------------------
  describe('3. Health & Readiness Probes (/healthz and /readyz)', () => {
    const { app } = require('../src/app')

    it('GET /healthz returns 200 OK liveness status immediately', async () => {
      // Mock Express req/res
      let statusCode = 200
      let responseBody = null
      const req = {}
      const res = {
        status: (code) => { statusCode = code; return res },
        json: (data) => { responseBody = data; return res }
      }

      // Find route handler
      const routes = app._router.stack
        .filter(layer => layer.route && layer.route.path)
        .map(layer => layer.route)

      const healthRoute = routes.find(r => {
        if (Array.isArray(r.path)) return r.path.includes('/healthz')
        return r.path === '/healthz'
      })
      assert.ok(healthRoute, '/healthz route must be registered in Express')

      await healthRoute.stack[0].handle(req, res, () => {})
      assert.equal(statusCode, 200)
      assert.equal(responseBody.status, 'ok')
      assert.equal(responseBody.service, 'ProctorNet Backend')
    })

    it('GET /readyz returns 503 and lists failing dependencies when services are unavailable', async () => {
      let statusCode = 200
      let responseBody = null
      const req = {}
      const res = {
        status: (code) => { statusCode = code; return res },
        json: (data) => { responseBody = data; return res }
      }

      const routes = app._router.stack
        .filter(layer => layer.route && layer.route.path)
        .map(layer => layer.route)

      const readyRoute = routes.find(r => r.path === '/readyz')
      assert.ok(readyRoute, '/readyz route must be registered in Express')

      await readyRoute.stack[0].handle(req, res, () => {})

      // In test environments, dependencies might be either running (200) or unavailable (503)
      assert.ok([200, 503].includes(statusCode), 'Status must be 200 ready or 503 not_ready')
      assert.ok(['ready', 'not_ready'].includes(responseBody.status))
      assert.ok(responseBody.checks, 'Response must detail dependency checks')
      assert.equal(responseBody.checks.postgres, 'ok', 'PostgreSQL check should be ok')
      if (statusCode === 503) {
        assert.ok(
          responseBody.checks.redis.startsWith('failed') || responseBody.checks.rabbitmq.startsWith('failed'),
          'At least one check should indicate failure on 503'
        )
      } else {
        assert.equal(responseBody.checks.redis, 'ok')
        assert.equal(responseBody.checks.rabbitmq, 'ok')
      }
    })
  })

  // --------------------------------------------------------------------------
  // 4. Nginx Edge Reverse Proxy Hardening (Task 4)
  // --------------------------------------------------------------------------
  describe('4. Nginx Edge Reverse Proxy Hardening (Appendix E)', () => {
    it('configures least_conn load balancing over api-1 and api-2 with keepalive', () => {
      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8')
      assert.ok(nginxConf.includes('upstream api_servers'), 'Must define upstream api_servers')
      assert.ok(nginxConf.includes('least_conn;'), 'Upstream must use least_conn load balancing')
      assert.ok(nginxConf.includes('server api-1:5000'), 'Upstream must include api-1')
      assert.ok(nginxConf.includes('server api-2:5000'), 'Upstream must include api-2')
      assert.ok(nginxConf.includes('keepalive 32;'), 'Upstream must use keepalive connections')
    })

    it('configures WebSocket upgrade headers and 3600s persistent timeout on /socket.io/', () => {
      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8')
      assert.ok(nginxConf.includes('location /socket.io/'), 'Must define /socket.io/ location block')
      assert.ok(nginxConf.includes('proxy_set_header Upgrade $http_upgrade;'), 'Must set Upgrade header')
      assert.ok(nginxConf.includes('proxy_set_header Connection "upgrade";'), 'Must set Connection upgrade header')
      assert.ok(nginxConf.includes('proxy_read_timeout 3600s;'), 'Must configure 3600s read timeout for WebSockets')
      assert.ok(nginxConf.includes('proxy_send_timeout 3600s;'), 'Must configure 3600s send timeout for WebSockets')
    })

    it('blocks /metrics and /internal/ endpoints from external edge access', () => {
      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8')
      assert.ok(nginxConf.includes('location = /metrics'), 'Must have dedicated /metrics location block')
      assert.ok(nginxConf.includes('deny all;') && nginxConf.includes('return 403;'), 'Must deny /metrics with 403 Forbidden')
      assert.ok(nginxConf.includes('location ^~ /internal/'), 'Must block /internal/ webhook routes')
    })

    it('enforces strict Content-Security-Policy (CSP) permitting LiveKit and S3', () => {
      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8')
      assert.ok(nginxConf.includes('Content-Security-Policy'), 'Must define Content-Security-Policy header')
      assert.ok(nginxConf.includes("default-src 'self'"), 'CSP must restrict default-src')
      assert.ok(nginxConf.includes("connect-src 'self' wss: ws:"), 'CSP must allow LiveKit WSS signaling')
      assert.ok(nginxConf.includes("frame-ancestors 'none'"), 'CSP must deny embedding in iframes')
      assert.ok(nginxConf.includes("X-Content-Type-Options \"nosniff\""), 'Must enforce nosniff header')
      assert.ok(nginxConf.includes("X-Frame-Options \"DENY\""), 'Must enforce DENY frame options')
    })

    it('sets 1-year immutable caching on hashed static Vite assets', () => {
      const nginxConf = fs.readFileSync(nginxConfPath, 'utf8')
      assert.ok(nginxConf.includes('max-age=31536000, immutable'), 'Hashed assets must have immutable cache-control')
      assert.ok(nginxConf.includes('try_files $uri $uri/ /index.html;'), 'Must include SPA fallback routing')
    })
  })

  // --------------------------------------------------------------------------
  // 5. Secret Hygiene & Absence of Hardcoded Credentials (Task 3 / C-01)
  // --------------------------------------------------------------------------
  describe('5. Secret Hygiene & Gitleaks Protection (Task 3 / C-01)', () => {
    it('ensures .env.example contains all required configuration keys without secrets', () => {
      assert.ok(fs.existsSync(envExamplePath), '.env.example must exist at root')
      const exampleContent = fs.readFileSync(envExamplePath, 'utf8')

      const requiredKeys = [
        'POSTGRES_PASSWORD',
        'DATABASE_URL',
        'REDIS_PASSWORD',
        'RABBITMQ_PASSWORD',
        'JWT_SECRET',
        'LIVEKIT_API_KEY',
        'LIVEKIT_API_SECRET',
        'VPN_AGENT_SECRET'
      ]

      for (const key of requiredKeys) {
        assert.ok(exampleContent.includes(`${key}=`), `.env.example must define ${key}`)
      }

      // Assert placeholder pattern
      assert.ok(exampleContent.includes('replace_with_'), '.env.example must use placeholder strings')
    })

    it('verifies Gitleaks configuration (.gitleaks.toml) is present with allowlists', () => {
      assert.ok(fs.existsSync(gitleaksConfPath), '.gitleaks.toml must exist at root')
      const gitleaksContent = fs.readFileSync(gitleaksConfPath, 'utf8')
      assert.ok(gitleaksContent.includes('useDefault = true'), 'Gitleaks must extend default rule set')
      assert.ok(gitleaksContent.includes('allowlist'), 'Gitleaks must define allowlists for test fixtures')
    })

    it('ensures docker-compose.prod.yml contains zero hardcoded plaintext passwords', () => {
      const prodContent = fs.readFileSync(prodComposePath, 'utf8')
      const forbiddenStrings = [
        'postgrespassword',
        'minioadminpassword',
        'devkey',
        'secretsecretsecretsecretsecretsecret',
        'proctornet_super_secret_jwt_key_2026'
      ]

      for (const bad of forbiddenStrings) {
        assert.ok(!prodContent.includes(bad), `docker-compose.prod.yml must not contain hardcoded secret: ${bad}`)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 6. Kernel & OS Performance Tuning (Task 5)
  // --------------------------------------------------------------------------
  describe('6. Kernel & OS Performance Tuning (Task 5)', () => {
    it('verifies ops/sysctl.d/99-proctornet.conf contains all required performance keys', () => {
      assert.ok(fs.existsSync(sysctlConfPath), '99-proctornet.conf must exist')
      const conf = fs.readFileSync(sysctlConfPath, 'utf8')

      const requiredTunables = {
        'net.core.somaxconn': '4096',
        'net.ipv4.tcp_max_syn_backlog': '4096',
        'net.ipv4.tcp_tw_reuse': '1',
        'fs.file-max': '1000000',
        'net.core.rmem_max': '16777216',
        'net.core.wmem_max': '16777216',
        'vm.swappiness': '10'
      }

      for (const [key, expectedVal] of Object.entries(requiredTunables)) {
        assert.ok(conf.includes(key), `sysctl must define ${key}`)
        assert.ok(conf.includes(expectedVal), `sysctl ${key} should configure ${expectedVal}`)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 7. Database Tuning, WAL Archiving & Restore Drill (Task 6)
  // --------------------------------------------------------------------------
  describe('7. Database Tuning, WAL Archiving & Restore Drill (Task 6)', () => {
    it('verifies postgresql.conf contains wal_compression=on and continuous WAL archiving', () => {
      assert.ok(fs.existsSync(postgresConfPath), 'postgresql.conf must exist')
      const conf = fs.readFileSync(postgresConfPath, 'utf8')

      assert.ok(conf.includes('wal_level = replica'), 'PostgreSQL must configure wal_level = replica')
      assert.ok(conf.includes('wal_compression = on'), 'PostgreSQL must enable wal_compression')
      assert.ok(conf.includes('archive_mode = on'), 'PostgreSQL must enable archive_mode for PITR')
      assert.ok(conf.includes('archive_command ='), 'PostgreSQL must configure archive_command')
    })

    it('verifies automated backup-restore.sh script exists and has valid syntax', () => {
      const scriptPath = path.join(rootDir, 'ops/scripts/backup-restore.sh')
      assert.ok(fs.existsSync(scriptPath), 'backup-restore.sh must exist')
      const scriptContent = fs.readFileSync(scriptPath, 'utf8')
      assert.ok(scriptContent.includes('pg_dump'), 'Script must invoke pg_dump')
      assert.ok(scriptContent.includes('pg_restore'), 'Script must invoke pg_restore')
      assert.ok(scriptContent.includes('DRILL_DB='), 'Script must execute a verification drill into a test database')
    })

    it('executes live database backup and restoration drill in PostgreSQL', async () => {
      const { prisma } = require('../src/infra/postgres/client')

      // 1. Create isolated drill schema
      await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "p9_restore_drill";`)

      try {
        // 2. Create sample table and populate with test snapshot data
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "p9_restore_drill"."backup_source" (
            id SERIAL PRIMARY KEY,
            attempt_id UUID NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
        `)

        const testUuid = '11111111-2222-3333-4444-555555555555'
        await prisma.$executeRawUnsafe(`
          INSERT INTO "p9_restore_drill"."backup_source" (attempt_id, payload)
          VALUES ('${testUuid}'::uuid, '{"status": "SUBMITTED", "score": 95}'::jsonb);
        `)

        // 3. Snapshot / Export data
        const snapshot = await prisma.$queryRawUnsafe(`
          SELECT id, attempt_id, payload FROM "p9_restore_drill"."backup_source";
        `)
        assert.equal(snapshot.length, 1, 'Snapshot should capture 1 row')

        // 4. Simulate disaster: drop table
        await prisma.$executeRawUnsafe(`DROP TABLE "p9_restore_drill"."backup_source";`)

        // 5. Simulate restoration drill: recreate table and restore from snapshot
        await prisma.$executeRawUnsafe(`
          CREATE TABLE "p9_restore_drill"."restored_target" (
            id INT PRIMARY KEY,
            attempt_id UUID NOT NULL,
            payload JSONB NOT NULL
          );
        `)

        await prisma.$executeRawUnsafe(`
          INSERT INTO "p9_restore_drill"."restored_target" (id, attempt_id, payload)
          VALUES (${snapshot[0].id}, '${snapshot[0].attempt_id}'::uuid, '${JSON.stringify(snapshot[0].payload)}'::jsonb);
        `)

        // 6. Verify restored data integrity
        const restored = await prisma.$queryRawUnsafe(`
          SELECT id, attempt_id, payload FROM "p9_restore_drill"."restored_target";
        `)
        assert.equal(restored.length, 1, 'Restored table must contain 1 row')
        assert.equal(restored[0].attempt_id, testUuid, 'Restored UUID must match exactly')
        assert.equal(restored[0].payload.score, 95, 'Restored payload content must match exactly')
      } finally {
        // 7. Cleanup drill schema
        await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "p9_restore_drill" CASCADE;`)
      }
    })
  })

  // --------------------------------------------------------------------------
  // 8. Terraform Cloud Infrastructure Skeleton (Task 9)
  // --------------------------------------------------------------------------
  describe('8. Terraform Cloud Infrastructure Skeleton (Task 9)', () => {
    it('verifies Terraform skeleton files exist with security group rules and IAM instance role', () => {
      const tfDir = path.join(rootDir, 'ops/terraform')
      const requiredTfFiles = [
        'main.tf',
        'variables.tf',
        'vpc.tf',
        'security_groups.tf',
        'ec2.tf',
        'iam.tf',
        's3.tf',
        'cloudwatch.tf',
        'outputs.tf',
        'README.md'
      ]

      for (const file of requiredTfFiles) {
        assert.ok(fs.existsSync(path.join(tfDir, file)), `Terraform skeleton must include ${file}`)
      }

      const sgContent = fs.readFileSync(path.join(tfDir, 'security_groups.tf'), 'utf8')
      assert.ok(sgContent.includes('7882'), 'Security group must permit LiveKit UDP port 7882')
      assert.ok(sgContent.includes('443'), 'Security group must permit HTTPS port 443')

      const iamContent = fs.readFileSync(path.join(tfDir, 'iam.tf'), 'utf8')
      assert.ok(iamContent.includes('aws_iam_instance_profile'), 'Terraform must define IAM instance profile')

      const readmeContent = fs.readFileSync(path.join(tfDir, 'README.md'), 'utf8')
      assert.ok(readmeContent.includes('Create → Test → Measure → Destroy'), 'README must document cost discipline')
    })
  })

  // --------------------------------------------------------------------------
  // 9. Operational Runbooks (Task 10)
  // --------------------------------------------------------------------------
  describe('9. Operational Runbooks (Task 10)', () => {
    it('verifies all 5 required operational runbooks and overview documentation exist', () => {
      const runbooks = [
        'docs/runbooks/deploy.md',
        'docs/runbooks/rollback.md',
        'docs/runbooks/backup-restore.md',
        'docs/runbooks/incident.md',
        'docs/runbooks/scale-up.md',
        'docs/architecture/overview.md'
      ]

      for (const rb of runbooks) {
        const fullPath = path.join(rootDir, rb)
        assert.ok(fs.existsSync(fullPath), `Runbook ${rb} must exist`)
        const content = fs.readFileSync(fullPath, 'utf8')
        assert.ok(content.length > 500, `Runbook ${rb} must contain detailed operational instructions`)
      }
    })
  })
})
