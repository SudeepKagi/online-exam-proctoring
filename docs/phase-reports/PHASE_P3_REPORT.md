# Phase P3 Report — Schema & Data Layer (Migrations, Constraints, Indexes, Postgres Tuning)

**Branch:** `feature/p3-schema-and-data-layer`  
**Execution Date:** October 3, 2026  
**Status:** Completed & Validated  

---

## 1. Executive Summary

Phase P3 transitions ProctorNet from legacy schema definitions and ad-hoc query execution to an enterprise relational model that **enforces invariants directly in PostgreSQL**.

Because Phase P1 preserved only the administrative credentials and platform settings in an isolated backup (`backups/<ts>-admin.json`), no complex zero-downtime data migration was required. We established a clean baseline migration (`0001_init/migration.sql`), hand-crafted custom DDL for constraints and indexes beyond Prisma's native DSL, tuned storage parameters for high-frequency write tables, implemented a dependency-injected PostgreSQL connection layer, and provisioned single-node server configuration.

---

## 2. Invariants Encoded in Database DDL

| Invariant | Implementation Mechanism | Validation / Test Outcome |
| :--- | :--- | :--- |
| **Single Correct MCQ Option** | Partial Unique Index: `CREATE UNIQUE INDEX idx_question_single_correct ON question_options(question_id) WHERE is_correct = TRUE;` | Multiple `isCorrect = true` attempts rejected at DB level (`Unique constraint failed`). |
| **MCQ Question Marks > 0** | CHECK Constraint: `ALTER TABLE questions ADD CONSTRAINT chk_questions_marks_positive CHECK (marks > 0);` | `marks <= 0` throws DB constraint error. |
| **Negative Marks Bound** | CHECK Constraint: `ALTER TABLE questions ADD CONSTRAINT chk_questions_negative_marks_bound CHECK (negative_marks >= 0 AND negative_marks <= marks);` | `negative_marks > marks` or `< 0` rejected. |
| **Question Text Limits** | CHECK Constraint: `CHECK (length(trim(question_text)) > 0 AND length(question_text) <= 5000)` | Empty or oversized text rejected. |
| **Option Text Limits** | CHECK Constraint: `CHECK (length(trim(text)) > 0 AND length(text) <= 500)` | Empty or oversized options rejected. |
| **One Attempt Per Student per Exam** | Unique Constraint: `CONSTRAINT exam_attempts_exam_id_student_id_key UNIQUE(exam_id, student_id)` | Duplicate attempt inserts rejected with unique violation. |
| **Order Uniqueness in Candidate Exam** | Unique Constraint: `CONSTRAINT attempt_questions_attempt_id_display_order_key UNIQUE(attempt_id, display_order)` | Duplicate display order rejected with unique violation. |
| **One Answer Per Attempt Question** | Unique Constraint: `CONSTRAINT answers_attempt_question_id_key UNIQUE(attempt_question_id)` | Duplicate answers on same attempt question rejected. |
| **One Result Per Attempt** | Unique Constraint: `CONSTRAINT exam_results_attempt_id_key UNIQUE(attempt_id)` | Multiple result summaries for same attempt rejected. |
| **Temporal Coherence** | CHECK Constraint: `CHECK (expires_at >= started_at)` | Incoherent attempt end timestamp rejected. |

---

## 3. Query-Driven Index Registry & EXPLAIN Gate

All hot queries were verified via `EXPLAIN (FORMAT JSON)` on indexed columns:

| Query Pattern | Index Name & Definition | Access Method Verified |
| :--- | :--- | :--- |
| Candidate Roster / Exam Status Filter | `idx_exam_attempts_exam_status (exam_id, status)` | `Index Scan` |
| Student Dashboard Exams | `idx_exam_attempts_student_status (student_id, status)` | `Index Scan` |
| Expiry Sweeper (Active Sessions) | `idx_exam_attempts_active_expiry (status, expires_at) WHERE status = 'ACTIVE'` | `Index Scan` (Partial Index) |
| Candidate Questions Sequential Delivery | `idx_attempt_questions_attempt_display (attempt_id, display_order)` | `Index Scan` |
| Candidate Timeline / Evidence Audit | `idx_violation_events_attempt_time (attempt_id, server_timestamp DESC)` | `Index Scan` |
| Background Evidence Upload Sweeper | `idx_violation_events_pending (evidence_status) WHERE evidence_status = 'PENDING'` | `Index Scan` (Partial Index) |
| Live Proctor/Student Chat Stream | `idx_chat_messages_exam_student_id (exam_id, student_id, id)` | `Index Scan` |
| Security Actor Audit Trail | `idx_audit_logs_actor_id (actor_id, id DESC)` | `Index Scan` |
| Admin Fuzzy Candidate Search | `idx_students_name_trgm_gin / idx_students_usn_trgm_gin USING GIN(col gin_trgm_ops)` | `Bitmap Index Scan` (Trigram) |
| Eligibility Filter (Departments / Semesters) | `idx_exams_allowed_departments_gin / idx_exams_allowed_semesters_gin USING GIN` | `Bitmap Index Scan` (Array GIN) |

---

## 4. Hot Table Storage Tuning

To sustain high write frequency and autosave concurrency without catastrophic table bloat:
1. **`answers` Table**:
   - `fillfactor = 80`: Reserves 20% free space per 8KB page for Heap-Only Tuples (HOT updates) when student revisions and option selections update without touching index columns.
   - Aggressive Autovacuum: `autovacuum_vacuum_scale_factor = 0.02`, `autovacuum_analyze_scale_factor = 0.02`.
2. **`exam_attempts` Table**:
   - `fillfactor = 80`: Enables HOT updates for heartbeat updates, flag counts, and session state changes.
   - Aggressive Autovacuum: `autovacuum_vacuum_scale_factor = 0.02`, `autovacuum_analyze_scale_factor = 0.02`.
3. **Partitioning Policy**:
   - Partitioning is deferred until row-count thresholds are exceeded (`violation_events` > 50M rows or retention-driven bulk drops), documented in `docs/architecture/partitioning.md`.

---

## 5. Connection Management, Pooling & Hardening

1. **Singleton DI Prisma Client** (`src/infra/postgres/client.js` & `infra/postgres/client.js`):
   - Eliminates rogue connection pools created by ad-hoc `new PrismaClient()`.
   - Sizing formula: $\text{Pool Size} = ((\text{CPU Cores} \times 2) + \text{Effective Spindle Count}) \times 1.25$. Default connection pool set to 25.
   - Session & Lock Timeouts: API role `statement_timeout = 8000ms`, `lock_timeout = 3000ms`, `idle_in_transaction_session_timeout = 15000ms`.
   - Bounded Interactive Transactions: Enforced `{ maxWait: 2000, timeout: 5000 }` on all transactions.
2. **Server Tuning Configuration** (`ops/postgres/postgresql.conf` & `ops/postgres/tune.md`):
   - `shared_buffers = 4GB` (25% of 16GB node RAM).
   - `effective_cache_size = 12GB` (75% RAM).
   - `work_mem = 32MB`, `maintenance_work_mem = 512MB`.
   - SSD Cost Constants: `random_page_cost = 1.1`, `seq_page_cost = 1.0`.
   - Query Insights: `pg_stat_statements`, `auto_explain` (`log_min_duration = 200ms`), `log_lock_waits = on`, `deadlock_timeout = 1s`.

---

## 6. Verification Results

1. **Schema & Constraint Suite** (`tests/p3-schema-constraints.test.js`):
   - **20 / 20 tests passing**:
     - Database-level rejection of multiple correct options (partial unique index).
     - Database-level rejection of marks $\le 0$, negative marks $>$ marks, negative marks $< 0$.
     - Database-level rejection of oversized question and option text.
     - Unique constraint enforcement on duplicate attempts, duplicate display orders, and duplicate results.
     - Admin and platform settings verification.
     - All 8 hot query EXPLAIN index scans verified against database planner.
2. **Full Regression Suite** (`npm test`):
   - **117 / 117 tests passing across 26 suites with 0 failures**.
3. **Migration Integrity Verification**:
   - CI workflow `.github/workflows/migration-check.yml` deploys clean migrations and verifies datamodel diff.
