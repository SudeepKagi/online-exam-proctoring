# ProctorNet Scale & Resilience Architectural Roadmap

> **Phase C8 Deliverable**: Definitive architectural roadmap addressing concurrency bounds, capacity tiers, burst handling, WebRTC firewall traversal, AWS Rekognition cost control, and lifecycle integrity.
> **References**: Prompt 6 §2 C8, §1.5, ADR-008, ADR-010

---

## 1. Honest Capacity & Hardware Sizing Tiers

10,000 concurrent exam-takers on a single node is fundamentally impossible without unbounded tail-latency and CPU exhaustion. ProctorNet defines three realistic, benchmark-supported deployment tiers:

| Tier | Infrastructure Specification | Concurrency Target (Active Candidates) | Architectural Characteristics |
|---|---|:---:|---|
| **Lite Profile** | 1–2 vCPU, 2–4 GB RAM (e.g. AWS t4g.small / lightsail), external PostgreSQL | **100 – 250** | Single Node.js process (`START_WORKERS=true`), `MEDIA_DRIVER=snapshot`, in-memory cache fallback (`CACHE_DRIVER=memory`), strict admission control (`MAX_CONCURRENT_ATTEMPTS=250`). Zero WebRTC SFU overhead. |
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
- **Zero Redis Distributed Locks for Financial/State Correctness**: Redis locks are subject to network split-brain and clock skew. Correctness is enforced strictly via PostgreSQL:
  - Conditional atomic state machine writes: `UPDATE exam_attempts SET status = 'ACTIVE' WHERE id = $id AND status = 'READY' RETURNING id;`
  - Idempotency via database `UNIQUE` constraints (`attempt_id, question_id` on `answers`).
  - `pg_advisory_xact_lock(bigint)` scoped to transactions where strict serialization across processes is required.
  - Redis is used strictly for non-authoritative deduplication, rate limiting, and ephemeral cooldowns.

### 2.4 Fair Start Admission & Staggered Entry
- `MAX_CONCURRENT_ATTEMPTS` limits active candidate intake.
- When an exam goes `LIVE`, the server issues start slots with randomized jitter ($\pm 15$ seconds) using HTTP 429 / 503 `Retry-After` headers and frontend countdown timers, preventing microsecond thundering herds.
- Exam question papers and option sets are prewarmed in Redis at publication time ($T-15\text{ min}$).

### 2.5 Ordered Load Shedding Hierarchy
Under CPU or event loop lag saturation ($\text{lag} > 200\text{ms}$ or $\text{RAM} > 85\%$), the `loadShed` middleware sheds requests in strict priority order:
1. **Shed First (Drop P3)**: Background media snapshots, candidate evidence uploads, and bulk telemetry.
2. **Shed Second (Drop P2)**: Non-critical reads (invigilator roster searches, reporting exports).
3. **NEVER Shed (P0 Protected)**: Candidate answer autosaves (`PUT /api/v1/attempts/:id/answers/:qid`) and exam final submissions (`POST /api/v1/attempts/:id/submit`).

### 2.6 Frontend Autosave Discipline & S3 Presign Backpressure
- Autosave Manager retains dirty state in browser `sessionStorage`. If the network hiccups, it queues updates and flushes on `visibilitychange` or `pagehide`.
- S3 presigned URLs are issued as **batched upload tickets** (e.g. 5 tickets valid for 10 minutes) rather than making an API roundtrip per 30-second snapshot. If ticket issuance encounters load shedding, snapshots skip a cycle without retry-storming.

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

### 3.3 8-Second Automatic ICE Fallback
- The candidate pre-exam diagnostic page evaluates connectivity in order: UDP $\rightarrow$ TCP $\rightarrow$ TURN/TLS.
- If ICE fails to connect within **8 seconds**, the client automatically falls back to `snapshot` mode and emits `media:fallback` over the WebSocket. The invigilator UI dynamically replaces the video tile with periodic JPEG snapshots, ensuring the exam continues without disqualification.

---

## 4. Pillar 3: AWS Rekognition Cost & Rate Discipline

Calling AWS Rekognition on an interval timer across hundreds of students quickly exhausts AWS TPS quotas (default 5–50 TPS) and incurs unsustainable API costs (~$0.001 per call).

### 4.1 Client-Side Pre-Filtering Gate
- Client executes lightweight browser-side face detection (Face-API.js / MediaPipe) before network transmission:
  - Rejects frames with no face detected.
  - Rejects frames with multiple faces (handled locally as candidate warnings).
  - Rejects blurred or poorly lit frames ($\text{brightness} < 40$ or Laplacian variance $< 100$).
  - Only high-confidence, single-face keyframes are submitted for server evaluation.

### 4.2 Event-Driven Verification (Zero Timer Polling)
Face verification is triggered strictly on critical exam events, **never on a recurring timer**:
1. Pre-exam identity onboarding (initial baseline match).
2. First frame captured after candidate resume/reconnection.
3. Sudden gaze/pose change exceeding 45 degrees.
4. Face regained after absence longer than 15 seconds.

### 4.3 Server-Side Token Bucket & Bounded Quotas
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
