/**
 * P8 Deployment Truth Test Suite (Q7)
 *
 * Validates infrastructure contracts without starting Docker:
 *   1. docker-compose.prod.yml structure (egress network, 3 APIs, migrate, frontend, worker, Redis no-persist, RabbitMQ non-management)
 *   2. docker-compose.override.yml: rabbitmq overrides to management image, dev ports exposed
 *   3. Nginx conf: NAT-aware limits, /media/ route, CSP, proxy_hide_header, /internal/ denied, /metrics denied
 *   4. Frontend Dockerfile: brotli stage, nginxinc/nginx-unprivileged, healthcheck
 *   5. Worker heartbeat: worker.js writes /tmp/worker.ready
 *   6. up.ps1 and up.sh exist and contain required tokens
 *   7. Makefile: smoke, build, test, backup targets present
 *   8. Backup-restore drill script: exists and contains pg_dump, pg_restore, scratch DB
 */
const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

function parseYaml(rel) {
  return yaml.load(readFile(rel))
}

// -----------------------------------------------------------------------------
describe('P8 Deployment Truth Test Suite', () => {

  // -- 1. docker-compose.prod.yml ----------------------------------------------
  describe('1. docker-compose.prod.yml structure', () => {
    let compose

    before(() => { compose = parseYaml('docker-compose.prod.yml') })

    it('1.1 egress network is defined (G-01)', () => {
      assert.ok(compose.networks?.egress, 'egress network must exist')
      // egress must NOT have internal: true so LiveKit can punch through NAT
      assert.notEqual(compose.networks.egress.internal, true,
        'egress network must not be internal:true')
    })

    it('1.2 frontend service present with multi-stage build ref (G-02)', () => {
      const svc = compose.services?.frontend
      assert.ok(svc, 'frontend service must exist')
      assert.match(svc.build?.context ?? '', /frontend/, 'build context must point to frontend')
    })

    it('1.3 one-shot migrate service with restart:"no" (G-03)', () => {
      const svc = compose.services?.migrate
      assert.ok(svc, 'migrate service must exist')
      assert.equal(svc.restart, 'no', 'migrate must have restart:no')
    })

    it('1.4 three API replica services defined', () => {
      assert.ok(compose.services?.['api-1'], 'api-1 must exist')
      assert.ok(compose.services?.['api-2'], 'api-2 must exist')
      assert.ok(compose.services?.['api-3'], 'api-3 must exist')
    })

    it('1.5 worker has heap sizing flag and healthcheck (G-04)', () => {
      const svc = compose.services?.worker
      assert.ok(svc, 'worker service must exist')
      const cmd = Array.isArray(svc.command) ? svc.command.join(' ') : (svc.command ?? '')
      assert.match(cmd, /--max-old-space-size=\d+/, 'worker must set --max-old-space-size')
      assert.ok(svc.healthcheck && !svc.healthcheck.disable, 'worker must have a healthcheck')
    })

    it('1.6 UV_THREADPOOL_SIZE=16 in api-common anchor', () => {
      // It should be on at least one API service or the anchor environment block
      const raw = readFile('docker-compose.prod.yml')
      assert.match(raw, /UV_THREADPOOL_SIZE.*16/, 'UV_THREADPOOL_SIZE must be set to 16')
    })

    it('1.7 Redis persistence off (--save "" --appendonly no)', () => {
      const svc = compose.services?.redis
      const cmd = Array.isArray(svc?.command) ? svc.command.join(' ') : (svc?.command ?? '')
      // yaml block scalar comes through as a string
      assert.match(cmd, /--save\s*["']?["']?/, 'Redis must have --save with empty string')
      assert.match(cmd, /--appendonly\s+no/, 'Redis must have --appendonly no')
    })

    it('1.8 RabbitMQ uses non-management alpine image', () => {
      const svc = compose.services?.rabbitmq
      assert.ok(svc?.image, 'rabbitmq must have an image')
      assert.doesNotMatch(svc.image, /management/, 'prod rabbitmq must NOT use management image')
      assert.match(svc.image, /rabbitmq/, 'must still be a rabbitmq image')
    })

    it('1.9 livekit is on both internal and egress networks', () => {
      const svc = compose.services?.livekit
      const nets = svc?.networks ?? []
      const netList = Array.isArray(nets) ? nets : Object.keys(nets)
      assert.ok(netList.includes('internal'), 'livekit must be on internal network')
      assert.ok(netList.includes('egress'),   'livekit must be on egress network')
    })
  })

  // -- 2. docker-compose.override.yml -----------------------------------------
  describe('2. docker-compose.override.yml', () => {
    let override

    before(() => { override = parseYaml('docker-compose.override.yml') })

    it('2.1 rabbitmq override switches to management image in dev', () => {
      const svc = override.services?.rabbitmq
      assert.ok(svc?.image, 'override must define rabbitmq image')
      assert.match(svc.image, /management/, 'dev override must use management image')
    })

    it('2.2 postgres exposes loopback port for local tools', () => {
      const svc = override.services?.postgres
      const ports = svc?.ports ?? []
      assert.ok(ports.some(p => String(p).includes('5432')), 'postgres must expose 5432 in dev')
    })

    it('2.3 api-1 exposes port 5000 loopback in dev', () => {
      const svc = override.services?.['api-1']
      const ports = svc?.ports ?? []
      assert.ok(ports.some(p => String(p).includes('5000')), 'api-1 must expose 5000 in dev')
    })
  })

  // -- 3. Nginx configuration -------------------------------------------------
  describe('3. Nginx configuration', () => {
    let mainConf, vhostConf

    before(() => {
      mainConf  = readFile('ops/nginx/nginx.conf')
      vhostConf = readFile('ops/nginx/conf.d/proctornet.conf')
    })

    it('3.1 server_tokens off in nginx.conf', () => {
      assert.match(mainConf, /server_tokens\s+off/, 'server_tokens off must be set')
    })

    it('3.2 NAT-aware rate limit zone: >=60r/s with burst >=100 (G-05)', () => {
      assert.match(mainConf, /limit_req_zone.*rate=60r\/s/, 'must have 60r/s zone')
      assert.match(vhostConf, /limit_req.*burst=\d+/, 'must use burst in location')
      const burstMatch = vhostConf.match(/limit_req.*burst=(\d+)/)
      assert.ok(burstMatch && parseInt(burstMatch[1]) >= 100,
        'burst must be >= 100 for campus NAT')
    })

    it('3.3 /media/ route proxies to livekit_sfu (F-01)', () => {
      assert.match(vhostConf, /location\s+\/media\//, '/media/ location block must exist')
      assert.match(vhostConf, /proxy_pass\s+http:\/\/livekit_sfu/, 'must proxy to livekit_sfu')
    })

    it('3.4 Content-Security-Policy does not contain unsafe-eval (D-09)', () => {
      assert.match(vhostConf, /Content-Security-Policy/, 'CSP header must be set')
      assert.doesNotMatch(vhostConf, /unsafe-eval/, 'CSP must not contain unsafe-eval')
    })

    it('3.5 proxy_hide_header X-Powered-By present', () => {
      assert.match(vhostConf, /proxy_hide_header\s+X-Powered-By/, 'must hide X-Powered-By')
    })

    it('3.6 /internal/ location returns 403 / deny all', () => {
      assert.match(vhostConf, /location.*\/internal\//, '/internal/ location must exist')
      const internalBlock = vhostConf.match(/location.*\/internal\/.*?return\s+403/s)
      assert.ok(internalBlock, '/internal/ must return 403')
    })

    it('3.7 /metrics location returns 403 / deny all', () => {
      assert.match(vhostConf, /location.*\/metrics/, '/metrics location must exist')
      const metricsBlock = vhostConf.match(/location.*metrics.*?return\s+403/s)
      assert.ok(metricsBlock, '/metrics must return 403')
    })

    it('3.8 upstream api_servers includes api-3 (three replicas)', () => {
      assert.match(vhostConf, /server\s+api-3:5000/, 'nginx must upstream to api-3')
    })
  })

  // -- 4. Frontend Dockerfile -------------------------------------------------
  describe('4. Frontend Dockerfile', () => {
    let dockerfile

    before(() => { dockerfile = readFile('proctornet/frontend/Dockerfile') })

    it('4.1 multi-stage build: builder stage with npm ci + npm run build', () => {
      assert.match(dockerfile, /AS builder/, 'must have builder stage')
      assert.match(dockerfile, /npm\s+ci/, 'must run npm ci')
      assert.match(dockerfile, /npm\s+run\s+build/, 'must run npm run build')
    })

    it('4.2 brotli pre-compression step in build stage (G-02)', () => {
      assert.match(dockerfile, /brotli/, 'must invoke brotli compression')
    })

    it('4.3 runner stage uses nginxinc/nginx-unprivileged', () => {
      assert.match(dockerfile, /nginxinc\/nginx-unprivileged/, 'must use nginx-unprivileged')
    })

    it('4.4 container exposes 8080 (unprivileged port)', () => {
      assert.match(dockerfile, /EXPOSE\s+8080/, 'must expose 8080')
    })

    it('4.5 HEALTHCHECK defined in Dockerfile', () => {
      assert.match(dockerfile, /HEALTHCHECK/, 'must define HEALTHCHECK')
    })
  })

  // -- 5. Worker heartbeat ----------------------------------------------------
  describe('5. Worker heartbeat (G-04)', () => {
    let workerSrc

    before(() => { workerSrc = readFile('proctornet/backend/src/worker.js') })

    it('5.1 worker.js writes /tmp/worker.ready heartbeat file', () => {
      assert.match(workerSrc, /worker\.ready/, 'must reference worker.ready sentinel file')
    })

    it('5.2 heartbeat is refreshed on a recurring interval', () => {
      assert.match(workerSrc, /setInterval\s*\(.*heartbeat|heartbeat.*setInterval/is,
        'must use setInterval to refresh heartbeat')
    })

    it('5.3 interval is cleared on graceful shutdown', () => {
      assert.match(workerSrc, /clearInterval\s*\(\s*heartbeatInterval/,
        'must clearInterval on shutdown')
    })
  })

  // -- 6. Dev startup scripts -------------------------------------------------
  describe('6. Dev startup scripts', () => {
    it('6.1 scripts/dev/up.ps1 exists', () => {
      assert.ok(fs.existsSync(path.join(ROOT, 'scripts/dev/up.ps1')),
        'up.ps1 must exist')
    })

    it('6.2 scripts/dev/up.sh exists', () => {
      assert.ok(fs.existsSync(path.join(ROOT, 'scripts/dev/up.sh')),
        'up.sh must exist')
    })

    it('6.3 up.ps1 waits for postgres healthcheck before seeding', () => {
      const ps1 = readFile('scripts/dev/up.ps1')
      assert.match(ps1, /pg.*healthy|healthy.*postgres/is, 'must wait for postgres healthy')
    })

    it('6.4 up.ps1 prints access URLs', () => {
      const ps1 = readFile('scripts/dev/up.ps1')
      assert.match(ps1, /localhost.*5173|localhost.*80/, 'must print frontend URL')
      assert.match(ps1, /localhost.*5000|localhost.*5173/, 'must print API URL')
    })

    it('6.5 up.sh prints access URLs', () => {
      const sh = readFile('scripts/dev/up.sh')
      assert.match(sh, /localhost/, 'up.sh must print URLs')
    })

    it('6.6 up.sh copies .env.example if .env missing', () => {
      const sh = readFile('scripts/dev/up.sh')
      assert.match(sh, /\.env\.example/, 'up.sh must reference .env.example fallback')
    })
  })

  // -- 7. Makefile ------------------------------------------------------------
  describe('7. Makefile targets', () => {
    let makefile

    before(() => { makefile = readFile('Makefile') })

    it('7.1 smoke target exists', () => {
      assert.match(makefile, /^smoke:/m, 'Makefile must have smoke target')
    })

    it('7.2 smoke target invokes playwright with @smoke grep', () => {
      assert.match(makefile, /@smoke/, 'smoke target must grep @smoke tests')
    })

    it('7.3 build target exists', () => {
      assert.match(makefile, /^build:/m, 'Makefile must have build target')
    })

    it('7.4 test target exists', () => {
      assert.match(makefile, /^test:/m, 'Makefile must have test target')
    })

    it('7.5 backup target exists', () => {
      assert.match(makefile, /^backup:/m, 'Makefile must have backup target')
    })

    it('7.6 migrate target exists', () => {
      assert.match(makefile, /^migrate:/m, 'Makefile must have migrate target')
    })
  })

  // -- 8. Backup/restore drill script -----------------------------------------
  describe('8. Backup/restore drill script', () => {
    let drillScript

    before(() => { drillScript = readFile('scripts/ops/backup-restore-drill.ps1') })

    it('8.1 script contains pg_dump invocation', () => {
      assert.match(drillScript, /pg_dump/, 'must invoke pg_dump')
    })

    it('8.2 script creates a scratch database', () => {
      assert.match(drillScript, /CREATE DATABASE/, 'must CREATE a scratch database')
    })

    it('8.3 script invokes pg_restore into scratch DB', () => {
      assert.match(drillScript, /pg_restore/, 'must invoke pg_restore')
    })

    it('8.4 script compares row counts between source and scratch DB', () => {
      assert.match(drillScript, /COUNT\(\*\)/, 'must compare row counts with COUNT(*)')
    })

    it('8.5 script drops the scratch database after drill', () => {
      assert.match(drillScript, /DROP DATABASE/, 'must DROP scratch database after drill')
    })

    it('8.6 script appends result to docs/qa/ log file', () => {
      assert.match(drillScript, /backup-restore-drill\.log/, 'must log to docs/qa/')
    })

    it('8.7 script exits 0 on PASS, 1 on FAIL', () => {
      assert.match(drillScript, /exit 0/, 'must exit 0 on pass')
      assert.match(drillScript, /exit 1/, 'must exit 1 on fail')
    })
  })
})
