# ProctorNet Re-Architecture — System Design Interview Notes

## Core Philosophy: Empirical Engineering vs. Intuition

> *"I didn't optimise on intuition — I produced a baseline, found the breaking point at 50 concurrent users (first SLO breach) and 100 concurrent users (system collapse), and identified the limiting resource as PostgreSQL connection pool starvation and interactive transaction timeouts compounded by sequential unindexed WAN round-trips."*

---

## 1. Phase P0: The Baseline & Measurement Harness

### Interview Question: *"How did you know what to optimize first in an existing production codebase?"*

**Answer:**
1. **Safety Net First**: Before touching a single line of business logic, we established a reproducible safety net:
   - Tagged `baseline-pre-scalability` so any regression was instantly diffable and reversible.
   - Pinned Node 22 LTS, standardized code formatting and linting (Prettier, ESLint, EditorConfig), and enforced Conventional Commits.
   - Audited the entire codebase systematically into an `AUDIT_REGISTER.md` cataloging 35 architectural flaws across data access, real-time media, security, and VPN.
2. **Measurement Harness**:
   - Instrumented production observability using `pino` structured JSON logging with `AsyncLocalStorage` request-id propagation, `prom-client` exposing `/metrics` with custom gauges for `nodejs_eventloop_delay_seconds`, HTTP duration histograms, and Prisma engine metrics (`prisma_pool_connections_busy`, `idle`, `wait_histogram_ms`).
   - Provisioned Prometheus and Grafana dashboards under `docker compose --profile observability`.
3. **The Empirical Baseline**:
   - Built a deterministic load fixture generator seeding 1 exam, 50 MCQs, and 100 student accounts.
   - Executed a realistic k6 test simulating the complete candidate journey: Login → Exam Discovery → Burst Start → Periodic Autosave every 5s → Final Exam Submission.
   - At **50 concurrent users**, autosave latency p95 exploded to **5,628 ms** (11.2× over our 500 ms SLO), and start exam p95 climbed to **9,920 ms**.
   - At **100 concurrent users**, the system suffered a catastrophic failure: **10.65% HTTP request failure rate** and **15.19% candidate session failure rate**.
   - **The Limiting Resource**: We proved through live Prometheus metrics and Postgres `pg_stat_statements` that the bottleneck was **PostgreSQL connection pool exhaustion** (17/17 connections saturated, 82 queries queued, 4,342 seconds of total pool wait time) and interactive Prisma `$transaction` blocks throwing **`P2028: Unable to start a transaction in the given time`**.
   - This baseline directed our engineering priorities: Phase P1 targets schema indexes and query consolidation; Phase P2 implements an in-memory/Redis write buffer for autosaves to decouple database I/O from the request loop; Phase P3 optimizes connection pooling and clustering.

---

## 2. Key Architecture Decision Records (ADRs) Snapshot

- **ADR 001**: Single-Node Topology with Horizontal-Ready Boundaries (vertical scale on single 8-core host node first).
- **ADR 002**: Scope Restriction to MCQ-Only (eliminates complex code runner / heavy sandbox overhead from exam critical path).
- **ADR 003**: Preservation of 3-Role Access Model (`admin`, `faculty`, `student`).
- **ADR 004**: Retention of Strict `SUSPENDED` Security State Machine.
- **ADR 005**: Camera and Screen Retention via SFU Media Gateway (deprecates full-mesh WebRTC P2P; introduces forward-looking media routing).
- **ADR 006**: One-Time Destructive Schema Reset (replaces haphazard migrations with a unified, index-complete, audited schema).
- **ADR 007**: Ephemeral Session State in Redis with Event-Driven Sync.
- **ADR 008**: Outbox Pattern for Audit Logs and Security Evidence.
- **ADR 009**: Hot Paths Use Parameterized Raw SQL with Strict Connection Budget.
- **ADR 010**: VPN Service Default-Off with Non-Blocking Worker Isolation.
- **ADR 011**: Store S3 Keys Never Presigned URLs (resolves 7-day expiration link rot).
- **ADR 012**: Domain Entity Realignment (`StudentExam` to `ExamAttempt` with `/api/v1` versioned routing).

---

## 3. Phase P1: Data Reset & Guarded Operations

### Interview Question: *"How do you design a destructive operations tool for multi-store enterprise environments without risking catastrophic data loss?"*

**Answer:**
> *"Destructive ops are tools with guardrails — dry-run default, typed confirmation, backup, post-condition checks."*

1. **Safety First with Inverted Defaults**:
   - Every invocation defaults to a non-mutating **dry-run** that reports table row counts and S3 object counts per prefix, saving an auditable JSON plan to `reports/reset/`. Mutating operations strictly require `--execute`.
   - **Production Refusal Guard**: Automatically halts if `NODE_ENV === 'production'` unless accompanied by `--allow-production-i-understand`.
   - **Host Allow-List Guard**: Compares database connection host against `RESET_ALLOWED_HOSTS` (default: `localhost,127.0.0.1,postgres`). Accidental runs against production cloud poolers (e.g. Supabase) abort immediately.
   - **Typed Confirmation Guard**: Forces typing `reset <dbname>` in interactive sessions or passing `--confirm "reset <dbname>"` in CI.
2. **Pre-Destruction Backup**:
   - Always writes a JSON snapshot of preserved models (`Admin` and `PlatformSetting`) to `backups/` prior to any deletion.
   - Attempts `pg_dump -Fc` binary backup, allowing skip only when `--no-backup` is loudly logged.
3. **Dynamic Table Discovery**:
   - Instead of maintaining a brittle hardcoded list of tables that rots across migrations, the tool queries PostgreSQL `information_schema.tables`, subtracts the preserved allow-list (`{Admin, PlatformSetting, _prisma_migrations}`), and runs a single atomic `TRUNCATE ... RESTART IDENTITY CASCADE`.
   - An immutable audit trail entry (`action: 'SYSTEM_RESET'`) is inserted into `AuditLog` immediately after truncation.
4. **Multi-Store Purge & Post-Conditions**:
   - Purges S3 object storage across known prefixes in batches of 1,000 using bounded concurrency (`limit=4`) and exponential backoff with jitter, while safeguarding unknown prefixes.
   - Extends cleanup across auxiliary stores (`--local-uploads`, `--cloudinary`, `--redis` prefix `pn:*`, `--compreface`).
   - Asserts post-conditions: `Admin` count is unchanged, all truncated tables have 0 rows (except 1 `SYSTEM_RESET` row in `AuditLog`), and S3 bucket is empty. Non-zero exit code on any failure.
   - **Idempotency**: Consecutive runs are guaranteed safe no-ops that exit 0.

---

## 4. Phase P2: MCQ-Only Scope Restriction & Attack Surface Elimination

### Interview Question: *"Why did you deliberately remove question types like coding problems and long-form written responses instead of supporting them alongside MCQs?"*

**Answer:**
> *"Narrowing scope is a scalability decision: grading became one set-based SQL and the attack surface (code execution) disappeared."*

1. **Scalability Rationale**:
   - In the legacy implementation, grading non-MCQ questions required heuristic similarity calculations, sequential manual scoring workflows, and remote containerized code execution runtimes. Under high concurrency (hundreds or thousands of students submitting simultaneously), these paths caused main-thread event loop blocking and database lock contention.
   - By constraining the system to single-correct-option MCQ format, grading transforms into a **single, set-based SQL join**: comparing student selected options directly against authoritative `QuestionOption.isCorrect = true`.
2. **Security & Attack Surface Elimination**:
   - Supporting in-browser coding environments required embedding heavy client editor packages and accepting arbitrary user code execution payloads.
   - Removing non-MCQ types completely eliminated the remote code execution (RCE) vector, container escape vulnerabilities, memory exhaustion, and runaway loop attacks on backend grading workers.
3. **Database-Level Integrity Constraints**:
   - Rather than relying solely on application-layer validation, we enforced domain invariants directly at the database engine level via a **PostgreSQL partial unique index**:
     ```sql
     CREATE UNIQUE INDEX idx_question_single_correct ON "QuestionOption" ("questionId") WHERE "isCorrect" = true;
     ```
   - This makes it physically impossible for any race condition, rogue service call, or manual SQL script to insert more than one correct option for any question.
4. **Publish-Time Rejection (Eliminating Silent Fallbacks)**:
   - Defect B-04 in the legacy system silently defaulted missing question answers to Option A, skewing examination integrity.
   - In P2, publishing an exam is hard-rejected (`400 Bad Request`) if any question violates validation rules: 2–6 options, exactly one correct option, positive marks, non-negative penalty bounded by marks, and non-empty text.
5. **DTO Security Leak Prevention**:
   - Student-facing endpoints (`startOrResumeExam`) explicitly strip `isCorrect` from every serialized option object. Students cannot discover answers through browser devtools, network inspection, or DOM state.
6. **Frontend Footprint Reduction**:
   - Purged the code editor packages and their transitive dependencies, reducing production JS bundle size by 21.46 kB raw (7.07 kB gzip) and freeing client main-thread CPU.

---

## 5. Phase P3: Schema & Data Layer Invariants, Query Indexes & Postgres Tuning

### Interview Question: *"How do you defend data integrity against race conditions and concurrent writes in a distributed or multi-core web environment?"*

**Answer:**
> *"Encode invariants in the database, then make the app's job easier: constraints are the last line of defence against races."*

1. **Why Application-Level Checks Are Insufficient**:
   - In a concurrent Node.js cluster or multi-replica environment, application checks like `if (await checkDuplicate()) return err;` fail to prevent race conditions during simultaneous network requests (time-of-check to time-of-use / TOCTOU bugs).
   - Two concurrent candidate requests to start an exam or answer a question will both pass validation and insert duplicate rows.
   - By placing hard relational constraints directly in the PostgreSQL engine (`UNIQUE(exam_id, student_id)`, `UNIQUE(attempt_id, display_order)`, `CHECK (marks > 0)`, `CHECK (0 <= negative_marks <= marks)`), the database becomes the infallible arbiter of truth. Even if an application bug or race condition occurs, PostgreSQL rejects the conflicting transaction with an immediate, deterministic error.

2. **Partial Indexes for Asymmetric Hot Workloads**:
   - In an active examination session, hundreds of background processes need to find *only* active attempts expiring soon or pending evidence items needing upload.
   - Traditional b-tree indexes index every row across millions of historical records, incurring unnecessary write overhead and disk space.
   - We created **PostgreSQL partial indexes**:
     ```sql
     CREATE INDEX idx_exam_attempts_active_expiry ON exam_attempts(status, expires_at) WHERE status = 'ACTIVE';
     CREATE INDEX idx_violation_events_pending ON violation_events(evidence_status) WHERE evidence_status = 'PENDING';
     ```
   - These indexes remain tiny in memory, execute in sub-millisecond index scans, and add zero indexing cost to completed attempts or resolved evidence.

3. **HOT Updates & Storage Tuning (`fillfactor = 80`)**:
   - The `answers` table absorbs candidate autosave updates every few seconds. In standard PostgreSQL, every `UPDATE` writes a new tuple and must update all table indexes, causing index bloat and write amplification.
   - We set `fillfactor = 80` on `answers` and `exam_attempts` and lowered autovacuum scale factors to `0.02`:
     ```sql
     ALTER TABLE answers SET (fillfactor = 80, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
     ```
   - Because the updated columns (`revision`, `selected_option_id`, `saved_at`) are not part of an index, PostgreSQL places new row versions on the **same page** (Heap-Only Tuple / HOT updates), completely bypassing index writes and reducing disk I/O by orders of magnitude.

4. **Query-Driven Index Verification (`EXPLAIN Gate`)**:
   - We rejected speculative indexing. Every single index was validated against query plans using an automated Node.js test fixture executing `EXPLAIN (FORMAT JSON)` on a 100k-row dataset.
   - The test asserts that every query in our 8 core hot paths (`exam_attempts`, `attempt_questions`, `violation_events`, `chat_messages`, `audit_logs`) resolves to an `Index Scan` rather than a sequential table scan.

5. **Single Connection Management & Bounded Timeouts**:
   - Eliminated rogue `new PrismaClient()` instantiations across the codebase in favor of a singleton dependency-injected client with mathematical pool sizing:
     $$\text{Pool Size} = ((\text{CPU Cores} \times 2) + \text{Spindle Count}) \times 1.25$$
   - Enforced tight session timeouts (`statement_timeout = 8s`, `lock_timeout = 3s`, `idle_in_transaction_session_timeout = 15s`) and bounded interactive transactions `{ maxWait: 2000, timeout: 5000 }` to permanently prevent pool starvation deadlocks under heavy load.

---

## 6. Phase P4: Concurrency Controls & Hot-Path Isolation

### Interview Question: *"Where did you use SELECT FOR UPDATE, where optimistic compare-and-set (CAS), where unique constraints — and why is READ COMMITTED isolation level sufficient?"*

**Answer:**
> *"You don't need heavy SERIALIZABLE isolation if you deliberately choose the right concurrency primitive for each specific write pattern: pessimistic row locking for irreversible lifecycle transitions, optimistic CAS for high-frequency low-contention updates, unique constraints for exactly-once idempotency, and SKIP LOCKED for work queues."*

1. **Where We Used `SELECT FOR UPDATE` (Pessimistic Locking)**:
   - **Use Case**: Candidate Exam Submission (`POST /api/v1/attempts/:attemptId/submission`).
   - **Why Pessimistic**: Exam submission is a high-stakes, irreversible terminal lifecycle transition. When a candidate clicks "Submit", multiple concurrent network requests might arrive simultaneously (rapid double-clicking, browser retry, concurrent tab).
   - **Mechanism**:
     ```sql
     SELECT id, status, expires_at FROM exam_attempts
     WHERE id = $1 AND student_id = $2
     FOR UPDATE;
     ```
   - **Impact**: It serializes access to that specific candidate attempt row for the duration of the submit transaction. The first request takes the lock, checks terminal status, flushes dirty answers, updates status to `SUBMITTED`, writes the outbox event, and commits. When the queued requests acquire the lock, they immediately read `status = 'SUBMITTED'` and execute the fast, idempotent replay path without performing redundant work.

2. **Where We Used Optimistic Compare-and-Set / CAS**:
   - **Use Case**: Candidate Answer Autosave (`PUT /api/v1/attempts/:attemptId/answers/:attemptQuestionId`).
   - **Why Optimistic**: Autosave occurs every 5 seconds per candidate across thousands of students. Using pessimistic locking (`SELECT FOR UPDATE`) on every autosave would cause severe lock contention, unnecessary transaction overhead, and threadpool exhaustion.
   - **Mechanism**:
     ```sql
     INSERT INTO answers (attempt_question_id, selected_option_id, revision, saved_at)
     SELECT attempt_question_id, $4, 1, now() FROM guard
     ON CONFLICT (attempt_question_id) DO UPDATE
       SET selected_option_id = EXCLUDED.selected_option_id,
           revision = answers.revision + 1,
           saved_at = now()
       WHERE answers.revision = $5
     RETURNING revision;
     ```
   - **Impact**: Zero locks are held. The query updates the row if and only if the stored `revision` matches the client's expected base revision `$5`. If network reordering occurs (e.g. revision 7 arrives after revision 8), the `WHERE answers.revision = 7` condition fails, 0 rows are updated, and the server returns `409 Conflict (STALE_REVISION)` with `{ currentRevision: 8 }`. The client fast-forwards its revision without corrupting the authoritative state.

3. **Where We Used Unique Constraints (Physical Invariants)**:
   - **Use Cases**:
     - Pre-warmed attempt creation: `UNIQUE(exam_id, student_id)` with `ON CONFLICT DO NOTHING`.
     - Asynchronous evaluation worker: `UNIQUE(attempt_id)` on `exam_results` with `ON CONFLICT DO NOTHING`.
     - Idempotency store: `UNIQUE(user_id, scope, target_id, key)` on `idempotency_keys`.
   - **Why Unique Constraints**: Distributed retries, outbox worker retries, and network replays inevitably send duplicate messages. By relying on relational uniqueness at the storage engine level, business operations achieve **exactly-once execution** without distributed two-phase commits.

4. **Where We Used `FOR UPDATE SKIP LOCKED` (Queue Leasing)**:
   - **Use Case**: Transactional Outbox Publisher (`OutboxPublisher`).
   - **Mechanism**:
     ```sql
     SELECT id, type, payload FROM outbox_events
     WHERE status = 'PENDING' AND next_attempt_at <= now()
     ORDER BY id ASC
     LIMIT 100
     FOR UPDATE SKIP LOCKED;
     ```
   - **Impact**: Allows multiple horizontal outbox workers to process the event queue concurrently without lock contention or duplicate publishing: each worker instantly skips rows already leased by another worker.

5. **Why `READ COMMITTED` Isolation Level Is Sufficient**:
   - Higher isolation levels (`REPEATABLE READ`, `SERIALIZABLE`) rely on First-Committer-Wins optimistic concurrency or SSI (Serializable Snapshot Isolation) locks, which throw serialization failure errors (`40001: could not serialize access due to concurrent update`) that require complex application-level retry loops under high write contention.
   - In ProctorNet, we intentionally designed our SQL statements so that **every critical write is atomic within a single statement or protected by row-level locks**:
     - State transitions use atomic conditional updates: `UPDATE ... WHERE id = $1 AND status = 'READY' RETURNING *`.
     - Autosaves use single-statement atomic CTE `ON CONFLICT DO UPDATE WHERE revision = $5`.
     - Lifecycle changes lock the specific row with `SELECT FOR UPDATE`.
   - Under `READ COMMITTED`, every SQL statement sees the latest committed snapshot. Because our predicates (`WHERE status = ...`, `WHERE revision = ...`) evaluate against the live locked row at update time, phantom reads and dirty reads are structurally impossible for these paths.
   - Result: zero serialization abort overhead, minimal lock footprints, predictable single-digit latency, and 100% data integrity under load.

---

## 6. Storage & Evidence Pipeline (ADR-011) — Move Bytes Off the App Tier

> *"Move bytes off the app tier: signed direct uploads, keys not URLs, async validation. The DB never waits for S3."*

1. **Why Direct Uploads (Presigned POST) Over Proxying Through the API?**
   - **The Bottleneck**: Proxying image binaries through Node.js Express binds memory in V8 buffer pools, consumes event loop CPU on multipart parsing, and congests application server network interfaces. Under 5,000 concurrent students triggering violation snapshots, a proxying API tier rapidly suffers socket exhaustion and high tail latency.
   - **The Architecture**: Candidates request an upload policy (`POST /api/v1/uploads/presign`) containing an S3 presigned POST policy with exact key, content-length range (evidence $\le 300\text{ KB}$, profile $\le 2\text{ MB}$), MIME type constraint (`image/webp|jpeg|png`), and SSE-S3 encryption. The client pushes directly to AWS S3/MinIO.
   - **The Benefit**: Application server CPU usage remains near zero during high-frequency snapshot streams.

2. **Why Store Keys Instead of URLs (ADR-011)?**
   - Presigned URLs are time-limited (10–15 min). Storing full URLs in database columns causes dead links once expired or forces public bucket exposure.
   - Database tables (`violation_events`, `students`) store **canonical relative keys** (`evidence/{examId}/{attemptId}/{uuid}.webp`, `identity/{studentId}/{kind}-{uuid}.webp`).
   - Read DTO mappers dynamically presign URLs with 10-minute validity. Presigning is a local HMAC calculation requiring zero S3 network calls.

3. **Why Round Signing Dates Down to 5-Minute Boundaries?**
   - If each GET request signs with the current millisecond timestamp (`X-Amz-Date`), every response produces a distinct URL query string, defeating browser and CDN caches.
   - By quantizing `signingDate = new Date(Math.floor(Date.now() / 300000) * 300000)`, all candidates and proctors loading an image within the same 5-minute interval receive bit-for-bit identical presigned URLs.
   - Result: 100% browser and edge cache reuse, zero cache thrashing.

4. **Why Decouple Image Processing with Transactional Outbox & Background Workers?**
   - After a candidate completes S3 upload, they notify `POST /api/v1/uploads/complete`. The API commits the violation row with `evidence_status = 'PENDING'` and inserts an `outbox_events` row in the **same database transaction** in $< 15\text{ ms}$.
   - The API returns durable success immediately. If S3 experiences high latency or Sharp image processing queues back up, the student's exam experience is completely insulated.
   - An asynchronous worker (`EvidenceWorker` on `pn.evidence`) inspects `HeadObject`, validates binary magic bytes, uses Sharp with concurrency 2 and pixel limits to generate a 320 px WebP thumbnail, and transitions status to `UPLOADED` with `thumb_key`. If the file is corrupted, the worker marks `FAILED`, but the violation audit row remains intact.

---

## 7. Realtime Plane & Invigilator Dashboard (ADR-008 / Notion 13.10) — WebSocket is a Notification Channel, Not a Source of Truth

> *"WebSocket is a notification channel, not a source of truth — that single rule makes reconnects, scaling and failure handling simple."*

1. **Why WebSocket Is Treated Strictly as a Best-Effort Notification Channel**:
   - Treating WebSocket connections as sources of truth introduces distributed state synchronization nightmares: missed messages during network drops require complex sequence number negotiations, message replays, and distributed queue buffering per client.
   - In ProctorNet, **all state changes happen via ACID-compliant REST write paths and database transactions**. WebSocket simply signals: *"Something changed, here is the latest delta."*
   - If a client disconnects, drops packets, or restarts, it simply issues a single `GET /api/v1/attempts/:id/state` on reconnect to fetch authoritative server state, current `expiresAt`, revision, and synchronized server clock epoch. A dropped or reordered WebSocket message can never corrupt exam state or cause data loss.

2. **Why Handshake Authentication Fails Closed**:
   - The Socket.IO connection handshake validates JWT tokens synchronously before upgrading or accepting the socket (`io.use(...)`).
   - If the token is missing, expired, forged, or belongs to an unauthorized role, the middleware rejects immediately with an explicit authentication error and severs the TCP connection. No unauthenticated client can ever bind memory or join rooms.

3. **Room Isolation & The Deletion of the Global Broadcast Room**:
   - Candidates are strictly bound to private rooms: `attempt:{attemptId}`. SQL authorization guarantees candidate ownership before socket admission.
   - Staff (invigilators, faculty, admin) join `inv:{examId}` only after database authorization verifies exam ownership or explicit invigilator assignment.
   - **Privacy Security Decision**: The legacy `exam:{examId}` student-wide broadcast room was permanently deleted. Broadcasting student flags, warnings, or roster changes across all students represents a severe privacy and compliance leak.

4. **Why 500 ms Coalescing Eliminates Invigilator Dashboard Thrashing**:
   - In an exam with 1,000 students, background violation detection (gaze diversion, tab switching, noise alerts) and heartbeats can produce hundreds of events per second.
   - Broadcasting raw events directly to proctor sockets overwhelms client-side React rendering loops and exhausts browser CPU.
   - `RosterDeltaCoalescer` buffers candidate updates in-memory per exam and flushes a consolidated batch array via a single `roster:delta` emission every 500 ms. 1,000 rapid violations are coalesced into $\le 3$ network frames per proctor, maintaining a silky-smooth 60 fps dashboard.

5. **Why Keyset Pagination on `(display_name, attempt_id)` and Zero-Media Payloads**:
   - Offset pagination (`OFFSET 2500 LIMIT 50`) degrades with quadratic page scans on PostgreSQL and produces jitter/skipped items when students sort orders shift during live exams.
   - ProctorNet uses keyset pagination on `(s.name, ea.id)` with opaque base64 cursors: queries execute via B-tree index scans in $< 2\text{ ms}$, guaranteed bounded payloads ($< 100\text{ KB}$ per page), and zero base64 image data or heavy violation evidence arrays in the roster DTO.

6. **Client-Side Resilience (Autosave Manager & Server-Clock Timer)**:
   - **Dirty Buffer & Flush**: Answers are tracked in an in-memory dirty map. The manager flushes dirty answers every 5 seconds, on window blur, and on `visibilitychange`.
   - **Optimistic Concurrency & 409 STALE_REVISION**: Responses return the updated revision counter. If a 409 conflict occurs, the client immediately updates its local revision counter to match the server and automatically retries the save.
   - **Network Backoff & Offline Retention**: Failed saves do not discard dirty state; they back off exponentially with full jitter while keeping answers safe in memory.
   - **Server-Clock Drift Offset**: The client computes `offset = serverTime − Date.now()` from every authoritative REST response, calculating remaining time against `expiresAt` immune to student local system clock tampering.



