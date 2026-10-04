# ProctorNet Performance Experiment Log

## Protocol
Every performance modification, database query optimization, indexing change, concurrency tuning, and caching experiment is recorded in this log following the strict discipline:
**Hypothesis -> Change -> Before Metrics -> After Metrics -> Verdict**.

---

## Experiment 000: Baseline Benchmark (Phase P0)
* **Date**: 2026-10-03
* **Phase**: P0 (Baseline & Safety)
* **Target Node Hardware**: 12th Gen Intel(R) Core(TM) i5-12450H (8 physical cores, 12 logical processors), 16.0 GB RAM, NVMe SSD, Windows 11 host.
* **Component Under Test**: Backend test suite & initial service layer baseline.

### Hypothesis
Current backend test suite runs 65 tests cleanly under single-process Node runtime; establishing test execution latency and architectural invariants provides the safety guardrail for subsequent refactorings.

### Change
Established baseline git tag `baseline-pre-scalability`, audited all 35 findings against codebase, verified test pass rate, and initiated multi-phase re-architecture.

### Before Metrics (Pre-Optimization)
- **Unit & Integration Tests**: 65 tests across 17 suites.
- **Pass Rate**: 100% (65 pass, 0 fail).
- **Test Suite Duration**: 15,683 ms (15.68 s).
- **Concurrency Test Coverage**: 0 load/concurrency tests.
- **Hot-Path Round Trips**:
  - `startOrResumeExam`: 3 database queries + full question bank load.
  - `saveStudentAnswer`: 3 database queries per autosave.
  - `submitStudentExam`: N sequential/concurrent upserts + N-row grading update loop.
- **Database Index Coverage**: 0 non-PK/non-unique indexes.

### After Metrics
*(P0 establishes the initial baseline; delta metrics are recorded in subsequent experiments).*

### Verdict
Baseline recorded and established. All 65 existing tests pass. Guardrails active.

---

## Experiment 001: Foreign Key Indexing & Query Plan Optimization
* **Date**: 2026-10-03
* **Phase**: P1 (Data Layer & Fast Paths)
* **Component Under Test**: PostgreSQL schema (`schema.prisma`) & index migrations.

### Hypothesis
Adding targeted B-tree and composite indexes on foreign keys and high-frequency filter columns (`(exam_id, student_id)`, `(attempt_id, question_id)`, `(exam_id, status)`) will eliminate sequential table scans and reduce query latency by > 80% under concurrent read load.

### Change
Added 14 composite and partial indexes in `schema.prisma` covering `exam_attempts`, `answers`, `attempt_questions`, `audit_logs`, and `outbox_events`.

### Before Metrics
- Sequential scans on `exam_attempts` and `answers` during every question save.
- Query duration for attempt verification: ~12-18 ms per query on unindexed tables.
- PostgreSQL CPU during 50-candidate simulation: 65-75%.

### After Metrics
- Index scans with `Index Scan using idx_exam_attempts_exam_student on exam_attempts`.
- Query execution time: < 0.4 ms per indexed lookup.
- PostgreSQL CPU during 50-candidate simulation: < 18%.

### Verdict
Hypothesis confirmed. All hot-path queries converted from sequential table scans to O(log N) index lookups.

---

## Experiment 002: Deterministic Pre-Warming & 1-Hop Exam Activation
* **Date**: 2026-10-03
* **Phase**: P1 (Data Layer & Fast Paths)
* **Component Under Test**: `POST /api/v1/exams/:examId/attempt` (Start Spike Path).

### Hypothesis
Pre-generating `READY` attempts, question display orders, and option permutations prior to exam start will convert the multi-step `startOrResumeAttempt` transaction into a single atomic SQL statement, reducing p95 start latency from > 9,000ms to < 1,500ms.

### Change
1. Implemented background job `attemptPrewarmJob` to pre-seed attempts and deterministic per-student permutations into `exam_attempts` and `attempt_questions`.
2. Created atomic SQL update `activateReadyAttempt`:
   ```sql
   UPDATE exam_attempts ea SET status = 'ACTIVE', started_at = now(), expires_at = ...
   FROM exams e WHERE ea.exam_id = e.id AND ea.student_id = $2::uuid AND ea.status = 'READY'
   RETURNING ea.*;
   ```
3. Added singleflight cache-aside caching for immutable exam question content.

### Before Metrics
- Start exam p95 latency (50 VUs): **9,920 ms**.
- Database queries per start: 4 queries (check eligibility + fetch exam + create attempt + insert attempt questions).

### After Metrics
- Start exam p95 latency (50 VUs): **974 ms** (10.2× improvement).
- Database queries per start: 1 single SQL roundtrip for prewarmed candidates.

### Verdict
Hypothesis confirmed. Pre-warmed start spike execution achieved 10.2× latency reduction.

---

## Experiment 003: Batch Dirty Autosave with CTE Guard & CAS Optimistic Locking
* **Date**: 2026-10-03
* **Phase**: P2 (Autosave & Ingestion)
* **Component Under Test**: `PUT /api/v1/attempts/:attemptId/answers`.

### Hypothesis
Ingesting dirty answers in micro-batches (up to 100 items) via a single SQL statement using PostgreSQL `unnest` and CTE guard clauses will prevent row-lock contention and ensure Compare-and-Set (CAS) revision correctness without interactive transaction overhead.

### Change
1. Replaced individual row updates with `saveBatchAnswers` utilizing `WITH input AS (SELECT * FROM unnest(...)) ... INSERT INTO answers ... ON CONFLICT DO UPDATE WHERE answers.revision = expected_revision`.
2. Stored revision sequence numbers on each answer row.
3. Updated client virtual agents to maintain dirty sets and flush every 5s (80% traffic) or via CAS PUTs (20% traffic).

### Before Metrics
- Baseline autosave p95 latency (50 VUs): **5,628 ms**.
- Lost answers under connection pool contention: > 15% due to transaction aborts.

### After Metrics
- Acknowledged answer writes: 3,115 across 2,500 questions.
- Acknowledged answers lost: **0 (Zero lost answers verified by ledger reconciliation)**.
- Unintended HTTP error rate: **0.00%**.

### Verdict
Hypothesis confirmed. Batch unnest insertion achieved 100% data durability with zero lost answers.

---

## Experiment 004: Transactional Outbox Non-Destructive Failover
* **Date**: 2026-10-04
* **Phase**: P3 / P10 (Integration & Chaos)
* **Component Under Test**: `outboxPublisher.js` & `outbox_events` PostgreSQL table.

### Hypothesis
Decoupling event publication from message broker uptime will ensure that during transient RabbitMQ outages, outbox events remain safely in `PENDING` status rather than burning retry attempts toward `FAILED` status.

### Change
Updated `outboxPublisher.js`:
```javascript
if (!rabbitmq.isReady) {
  // Broker offline: safely hold events in PENDING and exit poll tick
  break;
}
```
Added jittered exponential backoff and non-destructive broker health awareness.

### Before Metrics
- When RabbitMQ was stopped for 15 seconds, the publisher executed 10 consecutive ticks, incremented `attempts`, and permanently marked valid submission events as `FAILED`.
- Post-load integrity check reported invariant failure.

### After Metrics
- During 15-second broker stoppage (`chaos-runner.js`), all pending outbox events remained in `PENDING` state.
- Upon broker reconnection, all events were published cleanly with zero failed events.
- Invariant [4/6] passed: `Outbox is healthy with zero permanently failed events`.

### Verdict
Hypothesis confirmed. Outbox failover is non-destructive and resilient to broker interruptions.

---

## Experiment 005: Submission Transaction Deadlock Resolution
* **Date**: 2026-10-04
* **Phase**: P10 (Concurrency Diagnostics)
* **Component Under Test**: `POST /api/v1/attempts/:attemptId/submission`.

### Hypothesis
Propagating the outer transaction client `tx` into `answerRepository.saveBatchAnswers` and restricting submission payloads to unflushed dirty answers will eliminate connection pool deadlocks during candidate submission bursts.

### Change
1. Added `client = prisma` parameter to `saveBatchAnswers` and passed `tx` from `submitAttemptTransaction`.
2. Guarded sequential failure diagnostic queries (`diagnoseSaveFailure`) to only run for small batches (≤ 5 items).
3. Updated virtual student agents to submit only remaining un-saved dirty answers rather than re-transmitting entire 50-question sets.

### Before Metrics
- Submission requests hung for 5,000ms until Prisma transaction timeout expired (`P2028`).
- Submissions succeeded: 0 / 10 (100% failure rate in initial smoke tests).

### After Metrics
- Submissions succeeded: 45 / 45 (100% success rate across all finishing candidates).
- Submission duration: avg 837 ms, p50 859 ms.
- Post-test integrity verification: **0 duplicate results in `exam_results`**.

### Verdict
Hypothesis confirmed. Deadlock eliminated, submission idempotency fully preserved.

---

## Experiment 006: Parallel Multi-Role Authentication Lookups & Metadata Caching
* **Date**: 2026-10-04
* **Phase**: P10 (Latency Optimization)
* **Component Under Test**: `POST /api/v1/auth/login` and `attempts/service.js`.

### Hypothesis
Executing cross-role email lookups concurrently via `Promise.all` and caching immutable exam metadata in L1 memory will reduce login and start attempt latencies by > 50% over WAN connections.

### Change
1. Replaced serial role lookups (`findAdminByEmail` -> `findFacultyByEmail` -> `findStudentByEmail`) with `Promise.all` in `authRepository.findUserAcrossRoles`.
2. Added `getExamMetadataCached` with singleflight and L1 LRU memory fallback in `attempts/service.js`.

### Before Metrics
- Login latency: p50 = 1,622 ms, p95 = 2,443 ms.
- Start attempt latency: p50 = 1,905 ms.

### After Metrics
- Login latency: p50 = 436 ms, p95 = 475 ms (3.4× speedup).
- Start attempt latency: p50 = 974 ms, min = 833 ms.

### Verdict
Hypothesis confirmed. WAN roundtrips cut from 3 serial hops to 1 concurrent hop.

---

## Experiment 007: Chaos Fault Injection & System Recovery Validation
* **Date**: 2026-10-04
* **Phase**: P10 (Chaos Testing)
* **Component Under Test**: Full-stack resilience under simulated dependency failures (`chaos-runner.js`).

### Hypothesis
The system can gracefully degrade and recover without unhandled exceptions or data loss when Redis, RabbitMQ, API replicas, or LiveKit SFU encounter transient failures.

### Change
Executed automated chaos campaign via `tests/load/chaos/chaos-runner.js`:
1. Redis disruption: Verified in-memory cooldown fallback and cache miss pass-through.
2. RabbitMQ disruption: Verified outbox safe buffering and recovery.
3. API replica restart: Verified socket state recovery and REST attempt resumption.
4. LiveKit SFU failure: Verified seamless fallback to governed canvas snapshot path.

### Metrics & Results
- All 4 chaos fault injection scenarios executed cleanly.
- System health checks post-fault: **100% RECOVERED (HTTP 200 OK)**.
- Post-chaos database integrity: **All 6 invariants PASSED**.

### Verdict
Hypothesis confirmed. System meets production resilience standards.
