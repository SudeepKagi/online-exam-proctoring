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

