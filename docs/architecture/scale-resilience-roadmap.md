# ProctorNet Scale & Resilience Architectural Roadmap

> **Phase C8 Deliverable**: Definitive architectural roadmap addressing concurrency bounds, capacity tiers, burst handling, WebRTC firewall traversal, AWS Rekognition cost control, and lifecycle integrity.
> **References**: Prompt 6 §2 C8, §1.5, ADR-008, ADR-010, Prompt 7 Truth Pass

---

## 1. Honest Capacity & Hardware Sizing Tiers

10,000 concurrent exam-takers on a single node is fundamentally impossible without unbounded tail-latency and CPU exhaustion. ProctorNet defines three realistic, benchmark-supported deployment tiers:

| Tier | Infrastructure Specification | Concurrency Target (Active Candidates) | Architectural Characteristics |
|---|---|:---:|---|
| **Lite Profile** | 1–2 vCPU, 1–2 GB RAM (e.g. AWS t3.micro / t4g.small), external PostgreSQL | **80 – 100** *(Measured: `CAPACITY_t3.micro.md`)* | Single Node.js process (`START_WORKERS=true`), `MEDIA_DRIVER=snapshot`, in-memory cache fallback (`CACHE_DRIVER=memory`), strict admission control (`MAX_CONCURRENT_ATTEMPTS=80`). Zero WebRTC SFU overhead. |
| **Standard Profile** | 4–8 vCPU, 8–16 GB RAM (e.g. AWS c6i.2xlarge), dedicated internal Redis 7 + RabbitMQ 3.12 | **500 – 1,000** | Multi-process (`api-1`, `api-2`, `worker`), `MEDIA_DRIVER=livekit` or `snapshot`, selective subscribing ($O(\text{visible})$ downstream), PostgreSQL connection pool tuned via formula below. |
| **Multi-Node Cluster** | AWS Application Load Balancer + Auto Scaling Group ($\ge 2$ API nodes), RDS Aurora PostgreSQL (Multi-AZ) + PgBouncer, ElastiCache Redis, Managed LiveKit Cloud / Distributed SFU | **1,000 – 10,000** | Dedicated cluster topology; cross-AZ connection pooling, stateless horizontal scaling, off-host background compute. Requires multi-node terraform modules. |

---

## 2. Pillar 1: Exam Start & Submit Concurrency Bursts

At the start ($T=0$) and conclusion ($T=End$) of scheduled exams, hundreds of candidates hit write paths simultaneously.

### 2.1 Optimized Database Indexes
To guarantee sub-10ms queries during high-concurrency spikes, PostgreSQL queries rely on specialized composite and partial indexes:
- `exam_attempts(exam_id, status)`: Fast counting of exam load.
- Partial Index `(status, expires_at) WHERE status = 'ACTIVE'`: Eliminates table scans for `expirySweeper`.
- `attempt_questions(attempt_id, display_order)`: Sub-millisecond question retrieval.
- `answers(attempt_id)`: Rapid evaluation and aggregation.
- `violation_events(attempt_id, server_timestamp DESC)`: Invigilator timeline pagination without sort overhead.
- Partial Index `outbox_events(status, created_at) WHERE status = 'PENDING'`: High-throughput queue dispatcher poll.

### 2.2 PostgreSQL Connection Pool Mathematics
PostgreSQL processes have high per-connection memory overhead (~10MB/conn). To avoid `sorry, too many clients already` and connection pool exhaustion:
$$\text{per\_process\_pool} = \left\lfloor \frac{(\text{max\_connections} - 20) \times 0.6}{\text{api\_replicas} + \text{worker\_replicas}} \right\rfloor$$
- **Example (PostgreSQL `max_connections = 100`, 2 API pods + 1 Worker)**:
  $$\text{per\_process} = \left\lfloor \frac{80 \times 0.6}{3} \right\rfloor = 16 \text{ connections}$$
- In `src/infra/postgres/client.js`, `PRISMA_CONNECTION_LIMIT` is calculated dynamically with `pool_timeout = 20s`.
- When horizontal scale demands larger pools, **PgBouncer** is placed in transaction-pooling mode (`pgbouncer=true`), while migrations execute over `DIRECT_URL`.

### 2.3 Concurrency Correctness (No Distributed Lock Pitfalls)
- **Zero Redis Distributed Locks for State Correctness**: Redis locks are subject to network split-brain and clock skew. Correctness is enforced strictly via PostgreSQL:
  - Conditional atomic state machine writes: `UPDATE exam_attempts SET status = 'ACTIVE' WHERE id = $id AND status = 'READY' RETURNING id;`
  - Idempotency via database `UNIQUE` constraints (`attempt_id, question_id` on `answers`).
  - `pg_advisory_xact_lock(bigint)` scoped to transactions where strict serialization across processes is required.
  - Redis is used strictly for non-authoritative deduplication, rate limiting, and ephemeral cooldowns.

### 2.4 Protected Endpoints & Autosave Discipline
- Candidate answer autosaves operate via batch CAS upsert: `PUT /api/v1/attempts/:attemptId/answers` (and single answer CAS `PUT /api/v1/attempts/:attemptId/answers/:attemptQuestionId`).
- Final exam submissions are strictly protected and idempotent: `POST /api/v1/attempts/:attemptId/submission`.
- Autosave Manager retains dirty state in browser `sessionStorage` with per-question revision tracking (`revisionByAqId`).

---

## 3. Pillar 2: Firewalled Networks & WebRTC Traversal

Institutional firewalls often block UDP WebRTC ports (7880-7882).

### 3.1 Dual-Driver Strategy
- `MEDIA_DRIVER=livekit`: Standard profile for high-bandwidth environments.
- `MEDIA_DRIVER=snapshot`: Default fallback profile for low-bandwidth or restricted campus networks.

### 3.2 Firewall Traversal & Embedded TURN
- For LiveKit deployments, embedded TURN handles NAT traversal:
  - UDP `3478` (STUN/TURN)
  - TCP/TLS `5349` (TURN over TLS for strict firewalls)
  - For 443-only corporate networks, SNI proxying on port 443 routes TLS traffic directly to LiveKit TURN.

---

## 4. Pillar 3: AWS Rekognition Cost & Rate Discipline

Calling AWS Rekognition on an interval timer across hundreds of students quickly exhausts AWS TPS quotas (default 5–50 TPS) and incurs unsustainable API costs (~$0.001 per call).

### 4.1 Server-Side Token Bucket & Bounded Quotas
- API implements an in-memory / Redis token-bucket rate limiter matching the AWS Rekognition TPS quota.
- Calls are paced with jitter. If throttling (HTTP 400 `ThrottlingException`) occurs:
  - Circuit breaker (`opossum`) trips to prevent cascading retries.
  - Request outcome is marked **`REVIEW` (fail-closed)** rather than terminating the student's exam.
  - Two consecutive confirmed mismatches are required before raising an invigilator fraud alert.
  - Telemetry logs `face_calls_total{result="matched|mismatch|throttled"}` and cumulative exam cost.

---

## 5. Pillar 4: Lifecycle Integrity & Clean Handle Teardown

- All long-running background tasks (schedulers, sweepers, coalescers, micro-batchers) implement explicit `.stop()` methods and register with `lifecycle.js`.
- All `setInterval` / `setTimeout` handles must call `.unref()` if their lifespan is not strictly bound to request contexts.
- Automated leak assertions (`process.getActiveResourcesInfo()`) in integration tests verify that no open TCP sockets, timers, or child processes linger after test teardown.

---

## 6. Pillar 5: Architecture & Lifecycle State Machine Truth

The codebase adheres strictly to these canonical enum definitions:

### 6.1 Exam Attempt Lifecycle
$$\text{READY} \longrightarrow \text{ACTIVE} \longrightarrow \begin{cases} \text{SUBMITTED} \\ \text{SUSPENDED} \longleftrightarrow \text{ACTIVE} \\ \text{EXPIRED} \\ \text{TERMINATED} \end{cases}$$
*(Note: There is no `IN_PROGRESS` state).*

### 6.2 Exam Lifecycle
$$\text{DRAFT} \longrightarrow \text{PUBLISHED} \longrightarrow \text{LIVE} \longrightarrow \text{ENDED} \longrightarrow \text{EVALUATED} \longrightarrow \text{RESULT\_PUBLISHED}$$

### 6.3 Device Agent Release Allow-List
The database table registering SHA-256 binary signatures for companion desktop agents is named **`agent_releases`** *(not `agent_builds`)*.

---

## 7. Implemented Today (Production Baseline derived from Route & Code Inventory)

The following components and behaviors are actively verified and running in production code:

| Component / Path | Implementation Details | Verified In Code |
|---|---|---|
| `PUT /api/v1/attempts/:attemptId/answers` | Atomic batch answer CAS upsert (`revision = revision + 1 WHERE revision = expected`) | `src/modules/attempts/` |
| `POST /api/v1/attempts/:attemptId/submission` | Idempotent final exam submission state transition to `SUBMITTED` | `src/modules/attempts/` |
| `POST /api/v1/attempts/:attemptId/snapshots/ticket` | Rate-limited (1/s/attempt) server-issued S3 presigned PUT ticket | `src/modules/attempts/` |
| `POST /api/v1/agent/pair` | Crockford-32 pairing code verification with HMAC pepper & 5m TTL | `src/modules/agent/` |
| `POST /api/v1/agent/report` | HMAC-SHA256 authenticated desktop companion telemetry ingestion | `src/modules/agent/` |
| `MEDIA_DRIVER=snapshot\|livekit` | Dual video driver support (low-bandwidth WebP snapshots vs LiveKit SFU) | `src/infra/media/` |
| `QUEUE_DRIVER=postgres\|rabbitmq` | Multi-driver queue with in-process `SKIP LOCKED` outbox dispatcher | `src/infra/postgres/` |
| `CACHE_DRIVER=memory\|redis` | Pluggable cache driver with in-memory bounded LRU fallback | `src/infra/redis/` |
| `IPAM / vpn_ip_pool` | WireGuard $O(1)$ lease/release allocation with advisory locks | `src/modules/vpn/` |
| `expirySweeper` & `scheduler` | Automated cron lifecycle transitions (`PUBLISHED -> LIVE -> ENDED`) | `src/modules/exams/` |

---

## 8. Planned Architecture & Future Enhancements

The following capabilities are specified designs on the engineering roadmap, scheduled for phased implementation:

| Capability | Specification & Target Behavior | Owner | Target Phase |
|---|---|---|---|
| **Fair-Start Jitter** | Randomized start delay slots ($\pm 15$ seconds) via HTTP 429/503 `Retry-After` headers and countdown timers to prevent microsecond thundering herds. | Reliability Engineering | Planned (Post-v1.0) |
| **Ordered Load Shedding** | Middleware dropping requests by priority class under event loop lag $>200$ms or RAM $>85\%$ (Drop P3: snapshots; Drop P2: read queries; Protect P0: answers & submit). | Platform Reliability | Planned (Post-v1.0) |
| **8-Second ICE Fallback** | Automated diagnostic timeout falling back from WebRTC UDP/TCP to snapshot driver when ICE negotiation fails within 8 seconds. | Media Team | Planned (Post-v1.0) |
| **Client Face Quality Gate** | Browser canvas pre-filtering checking face presence, frame brightness ($>40$), and sharpness (Laplacian variance $>100$) before server transmission. | Proctoring AI | Planned (Prompt 7 T2) |
| **Event-Driven Biometric Re-Check** | Gaze and pose delta trigger ($>45^\circ$ or face absence $>15$s) initiating on-demand re-verification instead of recurring interval polling. | Biometrics Engineering | Planned (Post-v1.0) |
| **Batched Presign Tickets** | Issuing upload tickets in multi-slot blocks (e.g. 5 tickets per batch) to eliminate per-snapshot API ticket requests. | Storage Engineering | Planned (Post-v1.0) |
