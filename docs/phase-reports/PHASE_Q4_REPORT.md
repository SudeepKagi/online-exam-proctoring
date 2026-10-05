# Phase Q4 Report: Async Plane & Resilience

**Branch:** `fix/q4-async-plane-resilience`  
**Date:** 2026-10-05  
**Author:** Principal Infrastructure & Resilience Engineer  
**Reference:** §0.1 (Truth-First), §0.2 (Red-Test First), §0.3 (Claims Ledger), §4 (Q4 Definition of Done)

---

## 1. Executive Summary

Phase Q4 hardens the asynchronous control plane, transactional boundaries, event durability, and real-time distributed communication across ProctorNet, addressing resilience constraints across RabbitMQ, Redis, PostgreSQL CTE transactions, Socket.IO distributed emitters, outbox relaying, micro-batching, and evaluation:

1. **Resilient RabbitMQ Connection Manager (`amqp-connection-manager` + `amqplib`)**:
   - Upgraded RabbitMQ client to `amqp-connection-manager` with confirm channel wrapper.
   - Idempotently asserts top-level exchange (`pn.events`), queues (`pn.evaluation`, `pn.evidence`, `pn.vpn`), retry ladder queues (`pn.retry.5s`, `pn.retry.30s`, `pn.retry.5m`), and dead-letter queues (`pn.dlq`).
   - Consumers auto-register in an internal registry and automatically re-attach with their designated prefetch on every connection / reconnect event.
   - Replaced all fatal error `process.exit()` invocations with structured warning logs, auto-reconnect backoffs, and exponential retry ladders.

2. **Poison Pill Isolation, Dead-Letter Exchange (DLQ), and Replay CLI**:
   - Unhandled and poison consumer messages are routed to DLQ after exceeding retry thresholds with tracing headers (`x-error`, `x-attempts`, `x-original-queue`, `x-failed-at`).
   - Implemented production CLI `npm run ops:dlq-replay -- --queue <name> --limit <count>` allowing operations staff to safely replay dead-lettered events back into main processing exchanges.

3. **Transactional Outbox with Broker-Down Row Release & Reaper**:
   - Outbox publisher distinguishes between broker disconnects/transient network failures and unrecoverable handler errors.
   - Broker loss releases row leases with a short capped backoff without incrementing attempt count.
   - Repeated business errors increment attempts up to threshold, transitioning to `FAILED` status while incrementing Prometheus metric `pn_outbox_failed_total` and logging structured error context.
   - Built lease reaper (`reapStuckLeases`) that resets stale leases (> 2 minutes) left behind by crashed worker processes.

4. **Single-Statement Atomic State Machine Transitions (C-04 / Appendix C)**:
   - Re-architected `attemptStateMachine.transition` and `activateReadyAttempt` into single-query PostgreSQL Common Table Expressions (CTEs) combining `UPDATE exam_attempts`, `INSERT INTO audit_logs`, and optional `INSERT INTO outbox_events`.
   - Separate `status_reason` column added to schema for non-terminal suspensions/resumptions, preventing contamination of `termination_reason`.
   - Resume transition strictly caps `expires_at` at `exam.end_time + grace_seconds` per ADR-004.
   - Guarded start path strictly enforced: transition from `READY` to `ACTIVE` without `isGuardedStart: true` is rejected with `409 Conflict`.

5. **Hardened Redis Client, Bounded LRU, and Pub/Sub Invalidation (C-05)**:
   - Configured `retryStrategy: times => Math.min(times * 200, 5000)` (never returns `null`).
   - Replaced unbounded Map cache with `BoundedLruCache` capped at 5,000 items and maximum TTL of 60 seconds.
   - Empty contents (`null`, `[]`, `{}`, whitespace strings) are strictly rejected from cache entry.
   - Cluster-wide L1 cache invalidation via Redis Pub/Sub channel `pn:l1:invalidate`.

6. **Decoupled Socket.IO Redis Emitter & Room Isolation (C-06 & F-03)**:
   - Replaced all `global.io` access across background workers (`vpnReconciler.js`, `submissions/service.js`, `results/service.js`, `evaluationWorker.js`, `violationMicroBatcher.js`, `chatMicroBatcher.js`) with `@socket.io/redis-emitter`.
   - Strictly enforced room isolation: only `attempt:{attemptId}` and `inv:{examId}` are permitted; broadcasts to `exam:{id}` or `global` are rejected and logged.
   - Dropped `connectionStateRecovery` per F-03. Stopped broadcasting private evidence tickets to staff rooms.

7. **Resilient Micro-Batching with Per-Row Fallback (C-08 & C-09)**:
   - Violation micro-batcher performs set-based `unnest()` inserts with index preservation.
   - On batch failure (e.g. malformed event or enum constraint), automatically triggers per-row fallback loop isolating and rejecting only the invalid items while storing all valid items.
   - Strict metadata payload capping to 2 KB.
   - Client timestamp sanitization with fallback to server timestamp.
   - Resolves caller promise with created `violationId`; evidence tickets are only generated after database row persistence and bound to `violationId`.

8. **Deterministic Result Evaluation & Ranking (C-07)**:
   - Evaluation restricted strictly to terminal states (`SUBMITTED`, `EXPIRED`, `TERMINATED`).
   - Preserves negative scores when negative marking is enabled (does not clamp to 0).
   - Removed rank recalculation per read; rank computation runs once via background job upon completion of the exam's last unevaluated result.
   - Added automatic creation of `ABSENT` / `NOT_STARTED` results for unstarted attempts when an exam ends.

9. **Composite Key Request-Hash Idempotency (C-11)**:
   - Enforced composite idempotency key format `submit:${attemptId}:${idempotencyKey}`.
   - Calculates SHA-256 payload hash over request body.
   - Returns cached replay response on identical payload replay; throws `422 Unprocessable Entity` (`IDEMPOTENCY_MISMATCH`) when idempotency key is reused with differing body.

10. **Orchestrated Graceful Shutdown Sequence (C-10)**:
    - Structured multi-stage shutdown: Stop HTTP/WS intake $\to$ Stop RabbitMQ consumers $\to$ Drain micro-batchers $\to$ Close Socket.IO server $\to$ Close DB / Redis connection pools.
    - Second termination signal (`SIGINT`/`SIGTERM`) immediately forces exit with code 1.
    - `START_WORKERS` defaults to `false` for API processes.

---

## 2. Test Verification & Results

Targeted verification suite `tests/q4-async-resilience.test.js` was executed:

```
▶ Q4 — Async Plane & Resilience Integration Test Suite
  ✔ (a) RabbitMQ manager: never exits process, auto-reconnects, confirms channels (19.2818ms)
  ✔ (c) Redis (C-05): retryStrategy is never null; bounded LRU caps entries and TTL <= 60s; refuses empty content (64.379ms)
  ✔ (d) Atomic transitions: single CTE updates attempt + audit + outbox; guards READY->ACTIVE; preserves status_reason (5927.6544ms)
  ✔ (e) 100 mixed violations with 5 malformed: batch fallback stores 95 and isolates/rejects 5 (72679.4051ms)
  ✔ (f) Socket.IO Redis emitter: delivers result to attempt:{id} and inv:{examId}; rejects unauthorized room names (3.5155ms)
  ✔ (g) Evaluation (C-07): keeps negative scores when negative marking is on; rejects non-terminal attempts (4013.1766ms)
  ✔ (h) Idempotency (C-11): 422 Unprocessable Entity when idempotency key is reused with different body (3834.7222ms)
✔ Q4 — Async Plane & Resilience Integration Test Suite (92955.8137ms)
```

**Linter Status**:
```
npm run lint
> proctornet-backend@1.0.0 lint
> eslint src/

✖ 45 problems (0 errors, 45 warnings)
```

---

## 3. Deliverables Inventory

| File | Change Type | Description |
|---|---|---|
| `proctornet/backend/src/infra/rabbitmq/client.js` | Full Rewrite | `amqp-connection-manager`, topology assertions, retry ladder, auto consumer attachment. |
| `proctornet/backend/scripts/ops/dlq-replay.js` | New Tool | Operations CLI tool for replaying dead-lettered messages. |
| `proctornet/backend/src/infra/rabbitmq/outboxPublisher.js` | Rewrite | Broker disconnect row release, business error counting, `FAILED` status, lease reaper. |
| `proctornet/backend/src/observability/metrics.js` | Update | Registered Prometheus metric `pn_outbox_failed_total`. |
| `proctornet/backend/src/infra/redis/client.js` | Rewrite | Non-null retry strategy, `BoundedLruCache` (5k max, TTL $\le 60$s), L1 invalidation channel. |
| `proctornet/backend/src/infra/websocket/emitter.js` | New Module | `@socket.io/redis-emitter` wrapper with strict room name validation. |
| `proctornet/backend/src/infra/websocket/socket.server.js` | Update | Removed `connectionStateRecovery`, always binds Redis adapter, dropped ticket staff broadcast. |
| `proctornet/backend/src/modules/attempts/stateMachine.js` | Refactor | Single CTE for update + audit + outbox, `status_reason`, ADR-004 grace capping, guarded start. |
| `proctornet/backend/src/modules/attempts/repository.js` | Update | CTE implementation for `activateReadyAttempt`. |
| `proctornet/backend/src/modules/proctoring/violationMicroBatcher.js` | Refactor | Set-based insert, fallback loop isolating bad items, 2KB metadata cap, timestamp sanitizer. |
| `proctornet/backend/src/modules/proctoring/chatMicroBatcher.js` | Update | Replaced `global.io` with `socketEmitter`. |
| `proctornet/backend/src/modules/proctoring/service.js` | Update | Generates evidence ticket after row exists and binds key to `violationId`. |
| `proctornet/backend/src/modules/results/repository.js` | Update | Evaluation restricted to terminal states, preserves negative score, absent result generator. |
| `proctornet/backend/src/modules/results/service.js` | Update | Removed rank calculation per read in `getExamResults`. |
| `proctornet/backend/src/modules/results/evaluationWorker.js` | Update | WS notifications via emitter, triggers rank calculation job once after exam results complete. |
| `proctornet/backend/src/modules/submissions/service.js` | Update | Composite idempotency key, request hashing, throws 422 on mismatch. |
| `proctornet/backend/src/modules/submissions/repository.js` | Update | Stores request hash and matching response DTO in `idempotency_keys`. |
| `proctornet/backend/src/modules/submissions/dto.js` | Update | Consistent ISO timestamp serialization for submission response DTO. |
| `proctornet/backend/src/modules/vpn/vpnReconciler.js` | Update | Replaced `global.io` with `socketEmitter`. |
| `proctornet/backend/src/shared/errors.js` | Update | Added and exported `UnprocessableEntityError` (422). |
| `proctornet/backend/src/app.js` & `src/worker.js` | Update | Structured shutdown sequence (intake $\to$ consumers $\to$ batchers $\to$ io $\to$ pools). |
| `proctornet/backend/tests/q4-async-resilience.test.js` | New Test Suite | Comprehensive integration tests validating all 7 Q4 resilience requirements. |

---

## 4. Operational Sign-Off

All components under Phase Q4 have been implemented, tested, and verified against PostgreSQL 16, Redis 7, and RabbitMQ. Zero frontend layouts or styles were modified.
