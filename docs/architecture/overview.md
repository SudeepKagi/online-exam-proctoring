# ProctorNet System Architecture & Production Topology

**Reference**: ADR-001, ADR-008, ADR-010 / Phase P9 Infrastructure  
**Target Hardware**: Single 8-Core Node (8 vCPU / 16 GB RAM / NVMe gp3 SSD)  

---

## 1. High-Level Production Topology

ProctorNet employs a **single-node topology with horizontally ready modular boundaries**. All external web traffic terminates at an edge Nginx reverse proxy. Sensitive data stores (PostgreSQL, Redis, RabbitMQ) reside strictly on an isolated internal container network with **zero exposed host ports**.

```mermaid
graph TD
    User["Student & Staff Browsers"] -->|HTTPS :443| Nginx["Nginx Edge Proxy (TLS 1.3 / HTTP/2)"]
    User -->|WebRTC / UDP :7882| LiveKit["LiveKit SFU (Host Network)"]
    User -->|Direct Presigned POST| S3["AWS S3 / MinIO Object Storage"]

    subgraph "Public Edge Network"
        Nginx
    end

    subgraph "Private Internal Network (No Public Ports)"
        Nginx -->|Least-Conn Upstream| API1["api-1 (Backend Pod)"]
        Nginx -->|Least-Conn Upstream| API2["api-2 (Backend Pod)"]

        API1 --> Postgres[("PostgreSQL 16 (Tuned)") ]
        API2 --> Postgres

        API1 --> Redis[("Redis 7 (AOF Cache)") ]
        API2 --> Redis

        API1 --> RabbitMQ[("RabbitMQ 3.12 (Event Bus)") ]
        API2 --> RabbitMQ

        Worker["Dedicated Worker Pod"] --> Postgres
        Worker --> RabbitMQ
        Worker --> Redis
        Worker --> S3

        API1 --> Python["Python Service (Biometrics)"]
        API2 --> Python
        Python --> CompreFace["CompreFace Engine"]
    end

    subgraph "Privileged Sidecar (Profile: vpn)"
        VPNAgent["vpn-agent (NET_ADMIN)"] -.->|Unix Socket| Worker
        VPNAgent -.->|wg0 Kernel Interface| HostKernel["Host Kernel WireGuard"]
    end
```

---

## 2. Core Architectural Subsystems

### 2.1 Edge & Ingress Tier (`nginx`)
- **TLS Termination**: Strict TLS 1.2/1.3 with modern AEAD cipher suites, HTTP/2 multiplexing, and OCSP stapling.
- **Load Balancing**: `least_conn` upstream distribution across `api-1` and `api-2` backend instances with active keepalive connections.
- **WebSocket Gateway**: Dedicated `/socket.io/` proxy block with HTTP/1.1 Upgrade headers and 1-hour persistent read/send timeouts.
- **Coarse Outer Shield**: Rate-limiting zones (`60r/s` with burst of 100) and connection limits tuned specifically for shared-NAT campus environments.
- **Zero-Trust Header Hardening**: Strict Content-Security-Policy (CSP) allowing only authorized origins (LiveKit WSS, S3 storage, local endpoints), `frame-ancestors: 'none'`, and HSTS. Edge denies public access to `/metrics` and `/internal/` endpoints.

### 2.2 Application Plane (`api-1`, `api-2`)
- **Stateless HTTP/WS Pods**: Running Node 22 LTS with `--max-old-space-size=2048` and `UV_THREADPOOL_SIZE=64`.
- **Health Probes**:
  - `/healthz`: Liveness probe (immediate 200).
  - `/readyz`: Readiness probe verifying PostgreSQL (`SELECT 1`), Redis (`PING`), and RabbitMQ exchange response within a strict 1500 ms timeout.
- **Worker Isolation**: In multi-instance deployments, `START_WORKERS=false` ensures API pods handle strictly incoming requests and WebSockets while delegating background processors to the dedicated `worker` pod.

### 2.3 Dedicated Asynchronous Worker (`worker`)
- Consumes outbox events from RabbitMQ and executes heavy I/O operations outside the HTTP request path:
  - `evaluationWorker`: Asynchronous grading of completed attempts.
  - `evidenceWorker`: Sharp image resizing, format conversion (WebP), and thumbnail generation (concurrency 2).
  - `verificationWorker`: Face embedding comparisons.
  - `expirySweeper`: State machine timeout transitions.
  - `vpnWorker` & `vpnReconciler`: WireGuard peer lifecycle management (flag-gated).

### 2.4 Private Data Tier
- **PostgreSQL 16**:
  - Memory: `shared_buffers = 4GB`, `effective_cache_size = 12GB`, `work_mem = 32MB`.
  - WAL: `wal_level = replica`, `wal_compression = on`, continuous WAL archiving for Point-In-Time-Recovery (PITR).
  - Isolation: Zero published ports to the host in production.
- **Redis 7**:
  - Volatile LRU cache, singleflight query coalescing, and persistent AOF logging.
- **RabbitMQ 3.12**:
  - Durable topic exchange `pn.events`, dead-letter queues (`pn.dlx`), and guaranteed at-least-once outbox message delivery.

### 2.5 Media Plane (`livekit`)
- **Selective Forwarding Unit (SFU)**: Candidate publishes exactly 1 media stream (`O(1)` upstream).
- **Selective Subscription**: Invigilator views only visible candidates on screen (`O(visible)` downstream) using low-bitrate VP8 simulcast thumbnails.
- Linux host networking eliminates Docker NAT overhead and UDP port-range translation bugs.

---

## 3. Data Flow Lifecycles

### 3.1 Candidate Autosave Path
1. Student frontend buffers dirty answers in-memory.
2. Flush triggers `PUT /api/v1/attempts/:id/answers/:qid` with expected `revision`.
3. Nginx passes request via `least_conn` to an active API pod.
4. Database executes single-statement atomic CTE:
   ```sql
   INSERT INTO answers ... ON CONFLICT (attempt_question_id)
   DO UPDATE ... WHERE answers.revision = $expected
   RETURNING revision;
   ```
5. If revision matches, returns HTTP 200 with updated revision. If network reordering occurred, returns HTTP 409 `STALE_REVISION` and client fast-forwards without lock contention.

### 3.2 Evidence Snapshot Upload Path (Off-App-Tier Storage)
1. Browser detects violation or takes scheduled snapshot.
2. Calls `POST /api/v1/uploads/presign` ($\le 15\text{ ms}$).
3. API signs AWS S3 presigned POST policy with strict size ($\le 300\text{ KB}$) and MIME type limits.
4. Browser uploads image **directly to S3** (zero binary bytes pass through the Node.js API tier).
5. Browser notifies `POST /api/v1/uploads/complete`. API records violation row with `evidence_status = 'PENDING'` and enqueues transactional outbox event.
6. `worker` downloads object from S3, generates 320 px WebP thumbnail via Sharp, and marks status `UPLOADED`.

---

## 4. Failure Modes & Mitigations

| Failure Mode | Impact | Architectural Mitigation |
|---|---|---|
| **API Pod Crash** | Transient socket disconnection | Nginx upstream `max_fails=3 fail_timeout=10s` instantly re-routes requests to healthy pod. Sockets auto-reconnect and sync state via REST `/state`. |
| **PostgreSQL Transient Outage** | Write paths fail | Express `/readyz` probe immediately returns 503, removing pod from load balancer. Read paths leverage Redis L1/L2 cache. |
| **RabbitMQ Unreachable** | Outbox publishing paused | API commits events to PostgreSQL `outbox_events` table inside transaction. Background publisher retries with exponential backoff once broker recovers. |
| **Redis Restart** | Cache miss surge | Singleflight pattern coalesces concurrent duplicate queries into one database query, preventing cache stampedes. In-memory local L1 fallback absorbs critical keys. |
| **Candidate Network Drop** | Temporary client disconnection | Client retains dirty answers in memory, backs off exponentially, and recalculates timer against server timestamp epoch upon reconnection. |
