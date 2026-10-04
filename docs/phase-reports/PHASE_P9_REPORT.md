# Phase P9 Report — Single-Node Infrastructure & Hardening

**Branch**: `feature/p9-infrastructure-and-hardening`  
**Status**: Complete  
**Date**: October 2026  
**Reference**: ADR-001, ADR-008, ADR-010 / Notion Single-Node Topology  

---

## 1. Executive Summary

Phase P9 delivers a reproducible, production-hardened single-node infrastructure stack for ProctorNet. It resolves security, operational, and network boundary issues by replacing ad-hoc container definitions and default configurations with an enterprise-grade architecture.

### Core Architectural Principle
> *"Resource limits, healthchecks and private networks are what separate a Compose file from an operable system."*

In legacy single-node setups:
- Sensitive data services (PostgreSQL, Redis, RabbitMQ) were published directly to host interfaces, vulnerable to outside network probing.
- Plaintext secrets and default passwords were hardcoded in repository compose and source files (Flaw C-01).
- Absence of container resource limits (`mem_limit`, `cpus`) permitted runaway workloads to starve the host OS and trigger OOM kernel panics.
- Ingress lacked request shedding, WebSocket connection timeouts were default short, and Content-Security-Policy (CSP) headers were absent.
- Disaster recovery was undefined with zero automated backup verification or restore testing.

Phase P9 implements strict isolation: the public internet accesses **only** the edge reverse proxy on ports 80/443 (and LiveKit SFU media ports). All sensitive stateful engines reside strictly on an isolated `internal: true` network with zero published host ports.

---

## 2. Deliverables & Technical Implementation

### 2.1 Production Container Topology (`docker-compose.prod.yml` & `docker-compose.dev.yml`)
- **Root Compose Stack**:
  - `nginx`: Edge reverse proxy, connected to `edge` and `internal` networks, terminates TLS 1.3 / HTTP/2.
  - `api-1`, `api-2`: Horizontally scaled Node 22 API pods leveraging YAML anchor `x-api-common`.
  - `worker`: Dedicated background processing pod consuming outbox events, executing evaluations, Sharp thumbnail processing, and state expiry.
  - `postgres`: PostgreSQL 16-alpine with tuned parameters mounted from `ops/postgres/postgresql.conf`.
  - `redis`: Redis 7-alpine with password protection, volatile-LRU eviction, and AOF persistence.
  - `rabbitmq`: RabbitMQ 3.12-management-alpine with durable exchange `pn.events` and dead-letter queues.
  - `livekit`: LiveKit SFU (pinned stable `v1.13.7`) deployed with Linux host networking for zero-overhead UDP multiplexing.
  - `python-service`: Headless OpenCV and Tesseract OCR service.
  - `vpn-agent`: Privileged sidecar (profile `vpn`, `NET_ADMIN`, host network).
  - `compreface-*`: Facial recognition engines (profile `enrollment`).
  - Observability stack: `prometheus`, `grafana`, `postgres-exporter`, `redis-exporter`, `node-exporter` (profile `observability`).
  - `minio`: S3-compatible local object store (profile `dev`).
- **Hardening Safeguards**:
  - `mem_limit` and `cpus` allocated per service (e.g., PostgreSQL 4GB / 2 CPUs; API 1GB / 1.5 CPUs).
  - Healthchecks configured on all containers with retry and start-period thresholds.
  - `restart: unless-stopped`, `init: true` for zombie process reaping.
  - `stop_grace_period` $\ge 30\text{s}$ for clean connection draining and transaction completion.
  - Read-only root filesystems where possible (`read_only: true`, `tmpfs: [/tmp, /run]`).
  - Dedicated non-root users (`nodejs:1001` in API/Worker, `appuser:1002` in Python, `nginx:nginx`).
- **Dev Override (`docker-compose.dev.yml`)**:
  - Binds data services strictly to `127.0.0.1` (localhost only) for local development and debugging without external exposure.

### 2.2 Network Boundary & Data Tier Isolation
- `edge` network: Only Nginx reverse proxy connects to this public boundary.
- `internal` network: Marked `internal: true`. Containers communicate over isolated software bridges. Zero host port exposure for PostgreSQL, Redis, RabbitMQ, or MinIO in production.

### 2.3 Secret Hygiene & Gitleaks Protection (Task 3 / C-01)
- Purged all hardcoded passwords, JWT secrets, and LiveKit keys from compose files and code.
- Created root `.env.example` defining all variables with placeholder values (`replace_with_...`) and rotation documentation.
- Integrated Gitleaks secret scanner (`.gitleaks.toml` and `.github/workflows/gitleaks.yml`) preventing any future credential commits.

### 2.4 Edge Reverse Proxy & Nginx Hardening (`ops/nginx/`)
- Upstream `api_servers` using `least_conn` load balancing across `api-1` and `api-2` with 32 persistent keepalive sockets.
- Modern TLS: TLS 1.2 and TLS 1.3 only, modern AEAD cipher suites, HTTP/2 multiplexing, and OCSP stapling.
- Static SPA Asset Delivery: `gzip_static on`, Brotli precompression support, 1-year immutable caching on `/assets/*` with un-cached `index.html` fallback.
- WebSocket Upgrade Gateway: Configured on `/socket.io/` with `Upgrade` and `Connection` headers and 3600s persistent timeouts.
- Coarse Outer Shield: Rate limiting (`60r/s` with burst 100) and connection limits (`50` per IP) tuned for university campus NAT boundaries.
- Content-Security-Policy (CSP):
  ```
  default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.amazonaws.com http://localhost:9000;
  media-src 'self' blob:; connect-src 'self' wss: ws: https://*.amazonaws.com http://localhost:9000;
  frame-ancestors 'none'; object-src 'none'; base-uri 'self';
  ```
- Edge Blockade: Directly rejects `/metrics` and `/internal/` with HTTP 403 Forbidden.

### 2.5 Kernel & OS Performance Tuning (`ops/sysctl.d/99-proctornet.conf`)
- `net.core.somaxconn = 4096`
- `net.ipv4.tcp_max_syn_backlog = 4096`
- `net.ipv4.ip_local_port_range = 10240 65535`
- `net.ipv4.tcp_tw_reuse = 1`
- `fs.file-max = 1000000`
- `net.core.rmem_max = 16777216` & `net.core.wmem_max = 16777216` (UDP video buffer sizing)
- `vm.swappiness = 10`
- Transparent hugepages set to `madvise` for PostgreSQL.
- Idempotent host script `ops/scripts/apply-sysctl.sh`.

### 2.6 PostgreSQL Hardening, WAL Archiving & Restore Drill
- Updated `ops/postgres/postgresql.conf` with:
  - `wal_compression = on`
  - `wal_level = replica`
  - `archive_mode = on` with `archive_command` for continuous Point-In-Time-Recovery (PITR).
- Automated backup & restore script `ops/scripts/backup-restore.sh` executing consistent `pg_dump -Fc` snapshots, catalog validation with `pg_restore -l`, and verification restore.
- Verified live PostgreSQL restore drill in test suite.

### 2.7 Node Runtime & Health Probes
- Multi-stage Dockerfiles:
  - `proctornet/backend/Dockerfile`: Node 22 LTS, `tini` init, `npm prune --omit=dev`, non-root user `proctornet:nodejs`, `--max-old-space-size=2048`, `UV_THREADPOOL_SIZE=64`.
  - `proctornet/frontend/Dockerfile`: Vite build with gzip/brotli pre-compression + unprivileged Nginx runner.
  - `proctornet/python-service/Dockerfile`: Python 3.11 slim headless runner.
- Separate Worker Daemon: `src/worker.js` isolates background tasks; API pods skip workers when `START_WORKERS=false`.
- Health Probes:
  - `GET /healthz`: Immediate 200 liveness probe.
  - `GET /readyz`: Deep readiness probe checking PostgreSQL (`SELECT 1`), Redis (`PING`), and RabbitMQ exchange response with 1500 ms timeouts. Flips to 503 `not_ready` if any dependency is down.

### 2.8 CI/CD GitHub Actions Pipeline
- `.github/workflows/ci.yml`:
  `lint → unit & integration tests → migration diff & deploy → docker build → trivy container vulnerability scan + npm audit → push to GHCR on main with commit SHA tag`.
- `.github/workflows/gitleaks.yml` & `.gitleaks.toml`: Automated secret detection.
- `.github/dependabot.yml`: Automated weekly dependency audits.

### 2.9 Terraform Cloud Infrastructure Skeleton (`ops/terraform/`)
- Complete AWS deployment skeleton:
  - `vpc.tf`: Dedicated VPC (`10.0.0.0/16`) and subnets.
  - `security_groups.tf`: Only 80/443 + LiveKit ports public; data ports restricted to VPC.
  - `ec2.tf`: `c6i.2xlarge` (8 vCPU / 16 GB RAM) with gp3 100 GB (3,000 IOPS / 125 MB/s).
  - `iam.tf`: Instance profile role for S3 and CloudWatch (no static AWS keys on instance).
  - `s3.tf`: S3 evidence bucket with SSE-S3 encryption, CORS, public access block, and 90-day lifecycle rule.
  - `cloudwatch.tf`: CloudWatch logging and high-CPU alarms.
  - `README.md`: Documents cost discipline ("create → test → measure → destroy").

### 2.10 Operational Runbooks (`docs/runbooks/`)
- `docs/architecture/overview.md`: Mermaid topology and lifecycle flowcharts.
- `docs/runbooks/deploy.md`: Zero-downtime rolling restart and secret rotation.
- `docs/runbooks/rollback.md`: Immediate redeployment of previous immutable container tags.
- `docs/runbooks/backup-restore.md`: Nightly `pg_dump` automation, PITR WAL replay, and restore drill.
- `docs/runbooks/incident.md`: Triage runbook for CPU spikes, connection pool starvation, and media packet drops.
- `docs/runbooks/scale-up.md`: Scaling thresholds (2,500 candidates single-node $\to$ multi-node Aurora/ECS).

---

## 3. Test Suite & Verification Results

Mandatory test suite executed in `proctornet/backend/tests/p9-infrastructure-hardening.test.js`:

```
✔ P9 Infrastructure & Hardening Test Suite (6550.3742ms)
  ✔ 1. Docker Compose Production & Dev Linting (1668.3677ms)
    ✔ successfully lints docker-compose.prod.yml with docker compose config
    ✔ successfully lints combined prod + dev override config with 127.0.0.1 port bindings
    ✔ enforces memory limits, healthchecks, stop_grace_period >= 30s, and init on production services
  ✔ 2. Network Boundary & Private Data Services (Task 2) (7.3573ms)
    ✔ isolates data tier on internal: true network with ZERO published host ports in prod
    ✔ dev override binds ports strictly to 127.0.0.1 (localhost only)
  ✔ 3. Health & Readiness Probes (/healthz and /readyz) (1216.2468ms)
    ✔ GET /healthz returns 200 OK liveness status immediately
    ✔ GET /readyz returns 503 and lists failing dependencies when services are unavailable
  ✔ 4. Nginx Edge Reverse Proxy Hardening (Appendix E) (14.4525ms)
    ✔ configures least_conn load balancing over api-1 and api-2 with keepalive
    ✔ configures WebSocket upgrade headers and 3600s persistent timeout on /socket.io/
    ✔ blocks /metrics and /internal/ endpoints from external edge access
    ✔ enforces strict Content-Security-Policy (CSP) permitting LiveKit and S3
    ✔ sets 1-year immutable caching on hashed static Vite assets
  ✔ 5. Secret Hygiene & Gitleaks Protection (Task 3 / C-01) (9.1291ms)
    ✔ ensures .env.example contains all required configuration keys without secrets
    ✔ verifies Gitleaks configuration (.gitleaks.toml) is present with allowlists
    ✔ ensures docker-compose.prod.yml contains zero hardcoded plaintext passwords
  ✔ 6. Kernel & OS Performance Tuning (Task 5) (4.3144ms)
    ✔ verifies ops/sysctl.d/99-proctornet.conf contains all required performance keys
  ✔ 7. Database Tuning, WAL Archiving & Restore Drill (Task 6) (3618.2092ms)
    ✔ verifies postgresql.conf contains wal_compression=on and continuous WAL archiving
    ✔ verifies automated backup-restore.sh script exists and has valid syntax
    ✔ executes live database backup and restoration drill in PostgreSQL
  ✔ 8. Terraform Cloud Infrastructure Skeleton (Task 9) (5.1731ms)
    ✔ verifies Terraform skeleton files exist with security group rules and IAM instance role
  ✔ 9. Operational Runbooks (Task 10) (4.1863ms)
    ✔ verifies all 5 required operational runbooks and overview documentation exist

ℹ tests 21
ℹ suites 10
ℹ pass 21
ℹ fail 0
ℹ duration_ms 11770.196
```

### Full Regression Suite
- `tests/p4-state-machine.test.js`: 3 passed, 0 failed.
- `tests/p5-client-compression.test.js`: 5 passed, 0 failed.
- `tests/p6-frontend-autosave.test.js`: 6 passed, 0 failed.
- `tests/p7-media-livekit.test.js`: 20 passed, 0 failed.
- `tests/p8-vpn-wireguard.test.js`: 14 passed, 0 failed.
- `tests/p9-infrastructure-hardening.test.js`: 21 passed, 0 failed.
- **Combined total: 69 tests passed, 0 failed.**
