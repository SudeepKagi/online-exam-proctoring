# Baseline Load Test & Scalability Measurement Report (Phase P0)

**Date**: 2026-10-03  
**Branch**: `feature/p0-baseline-and-safety`  
**Git Baseline Tag**: `baseline-pre-scalability`  
**Target Environment**: Single Host Node (8 Cores Intel i5-12450H, 16 GB RAM)  
**Database**: PostgreSQL 16 (PgBouncer connection pooler)  
**Test Tool**: Grafana k6 v2.2.0  
**Fixture**: 1 Exam × 50 MCQ Questions × 100 Enrolled Students (`reports/load/baseline/students.json`)

---

## 1. Executive Summary

This report establishes the empirical "before" baseline for the ProctorNet single-node re-architecture. The system was benchmarked unmodified under a simulated candidate journey: **Login → Exam Discovery → Start/Resume Exam (Burst) → Periodic Autosave (every 5s) → Final Exam Submission**.

### Key Findings
1. **The Breaking Point**:
   - **First SLO Breach**: Occurs at **50 Concurrent Users**. Autosave p95 latency reached **5,628 ms** (11.2× over the 500 ms SLO), and Start Exam p95 reached **9,920 ms** (6.6× over the 1,500 ms SLO).
   - **Catastrophic Failure Point**: Occurs at **100 Concurrent Users**. The HTTP error rate spiked to **10.65%** (overall candidate journey error rate **15.19%**), with 67 out of 148 exam start attempts failing completely with **HTTP 500 Internal Server Error**.

2. **The Limiting Resource**:
   - **Primary Bottleneck**: **Database Connection Pool Exhaustion & Interactive Transaction Starvation**.
   - Under concurrency, the Prisma connection pool (17 connections) saturated to 100% capacity (`prisma_pool_connections_busy = 17`, `idle = 0`).
   - Up to **82 queries were simultaneously queued** in the Prisma client wait queue, accumulating **over 4,342 seconds of total queue wait time**.
   - Interactive transaction blocks in `sessionStateMachine.js` timed out with Prisma code **`P2028: Unable to start a transaction in the given time`**, causing cascading request aborts.
   - **Compounding Factor**: Zero non-primary-key indexes in PostgreSQL and multi-roundtrip sequential database queries over WAN RTT (~65ms per roundtrip).

---

## 2. Quantitative Results Matrix

| Metric | SLO Target (§10.2) | 1 VU (Smoke) | 50 VUs (Cohort Ramp) | 100 VUs (Breaking Point) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **HTTP Request Failure Rate** | `< 1.0%` | 0.00% | 0.00% | **10.65%** (67 fails) | ❌ **FAIL** |
| **Candidate Journey Error Rate** | `< 1.0%` | 0.00% | 0.00% | **15.19%** | ❌ **FAIL** |
| **Login Latency (p95)** | `< 1,000 ms` | 490 ms | 1,362 ms | **3,142 ms** | ❌ **FAIL** |
| **Exam Discovery Latency (p95)**| `< 1,000 ms` | 1,695 ms | 3,595 ms | **6,461 ms** | ❌ **FAIL** |
| **Start Exam Latency (p95)** | `< 1,500 ms` | 4,161 ms | **9,920 ms** | **14,456 ms** | ❌ **FAIL** |
| **Autosave Latency (p95)** | `< 500 ms` | 2,243 ms | **5,628 ms** | **11,775 ms** | ❌ **FAIL** |
| **Submit Exam Latency (p95)** | `< 3,000 ms` | 6,216 ms | **13,484 ms** | **3,735 ms** *(aborted early)*| ❌ **FAIL** |
| **Node.js Event Loop Lag (p99)**| `< 50 ms` | 2.1 ms | 35.1 ms | 35.2 ms (max 56.1 ms) | ⚠️ WARN |
| **Node.js RSS Memory** | `< 1.5 GB` | 165 MB | 215 MB | 241 MB | ✅ PASS |
| **PostgreSQL Pool Saturation** | `< 80%` | 5.8% (1/17) | **100% (17/17 busy)**| **100% + 82 queued** | ❌ **FAIL** |

---

## 3. Detailed Component Bottleneck Analysis

### 3.1 Start Exam Burst Collapse (`POST /api/student/exams/:id/start`)
- During an exam start burst, `studentService.startOrResumeExam` invokes `sessionStateMachine.transitionExamSession` which opens an interactive Prisma transaction.
- When 100 students request start simultaneously, 100 concurrent transactions compete for 17 pool connections.
- Because transactions hold connections across multiple async ticks, subsequent queries queue indefinitely until the transaction timeout expires.
- Result: **Prisma `P2028: Unable to start a transaction in the given time`** returned to 67 students.

### 3.2 Autosave Latency Amplification (`POST /api/student/exams/:id/autosave`)
- Current baseline autosaves one answer at a time using unbatched Prisma upsert queries.
- Each autosave triggers 3 independent database roundtrips:
  1. `verifySessionProfile`
  2. `findStudentExam`
  3. `upsertAnswer`
- At 50 VUs, autosave p95 climbs to 5.6 seconds, directly violating candidate experience and causing autosave backlog.

### 3.3 Exam Discovery Full Table Aggregation (`GET /api/student/exams`)
- As revealed in `top10_sql.md`, `listMyExams` executes a full table aggregation:
  ```sql
  LEFT JOIN (SELECT "examId", COUNT(*) FROM "Question" GROUP BY "examId") ...
  ```
- This unindexed query scanned 15,624 rows across 279 calls, adding up to 6.4 seconds of latency per candidate page load.

---

## 4. Supporting Artifacts

- **Top 10 Slowest SQL Statements**: [`top10_sql.md`](./top10_sql.md)
- **Autosave Execution Flamegraph**: [`flamegraph-autosave.svg`](./flamegraph-autosave.svg)
- **Start Exam Execution Flamegraph**: [`flamegraph-start-exam.svg`](./flamegraph-start-exam.svg)
- **Raw k6 50 VU Output**: `reports/load/baseline/k6_50vu_raw.json`
- **Raw k6 100 VU Output**: `reports/load/baseline/k6_100vu_raw.json`

---

## 5. Architectural Mandate for Subsequent Phases

This baseline empirically justifies the subsequent architecture phases:
1. **Phase P1 (Database & Schema Realignment)**:
   - Add missing compound indexes on `(examId, studentId)`, `(examId, status)`.
   - Strip answer keys (`isCorrect`) from question payloads transmitted to students (resolving security bug B-05).
   - Migrate hot paths from Prisma ORM to parameterized raw SQL (ADR 009).
2. **Phase P2 (In-Memory Autosave Pipeline)**:
   - Introduce Redis stream / in-memory write buffer for autosaves to decouple HTTP response latency from database disk I/O (reducing autosave p95 from 5,628ms to < 20ms).
3. **Phase P3 (Process Clustering & Connection Pooling)**:
   - Size PostgreSQL pool per process to eliminate connection starvation and `P2028` timeouts.
