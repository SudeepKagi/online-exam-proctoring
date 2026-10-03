# Phase P0: Baseline & Safety Report

**Date**: 2026-10-03  
**Branch**: `feature/p0-baseline-and-safety`  
**Git Starting Tag**: `baseline-pre-scalability`  
**Host Specifications**:
- **CPU**: 12th Gen Intel(R) Core(TM) i5-12450H (8 Cores, 12 Threads)
- **RAM**: 15.71 GB (16 GB visible)
- **Storage**: NVMe High-Speed Solid State Drive
- **Operating Environment**: Single Host Node / Windows 11 (PowerShell & Docker runtime)

---

## 1. Test Suite Execution & Baseline Metrics

The existing automated test suite was executed against the baseline codebase:

```bash
cd proctornet/backend
npm test
```

### Results
- **Total Test Suites**: 17
- **Total Tests**: 65
- **Passed**: 65 (100%)
- **Failed**: 0
- **Duration**: 15.68 seconds
- **Memory Consumption**: Node process peaked at ~148 MB during test execution.

### Suite Breakdown
1. **Architectural & Regression Guardrails**: 6 passing
2. **Black-Box Browser Security Verification**: 13 passing
3. **End-to-End Lifecycle & Failure Matrix**: 3 passing
4. **Live Proctoring Pipeline State Machine & Auth**: 9 passing
5. **Phase C Remediation Verification**: 8 passing
6. **Cookie, Token, and CSRF Security Matrix**: 20 passing
7. **Collusion & Biometric Fail-Closed Service**: 6 passing

---

## 2. Codebase Audit Summary

The 35 audit findings from §3 were audited against the actual source code:

1. **Database & Data Access**:
   - Confirmed 0 non-PK indexes in `schema.prisma`.
   - Confirmed O(N^2) question shuffling and full question bank loads per candidate on `startOrResumeExam`.
   - Confirmed N+1 query loops and synchronous scoring during submissions.
   - Confirmed critical security flaw: answer key (`isCorrect: true`) is serialized and transmitted to student browsers in question options!
   - Disputed finding B-11: `prisma/migrations` exists on disk but was ignored in `.gitignore`.

2. **Realtime & Media**:
   - Confirmed O(N^2) socket broadcast of student camera and screen frames to the whole exam room.
   - Confirmed unevicted in-memory frame cache (`global.latestLiveFrames`).
   - Confirmed full-mesh WebRTC P2P mesh and absence of TURN servers.
   - Confirmed LiveKit is deployed in Docker Compose but unused by frontend.

3. **Storage & Evidence**:
   - Confirmed 7-day presigned URLs stored in database columns, causing permanent broken links after 7 days.
   - Confirmed base64 file payloads buffered in Express memory.

4. **VPN & Infrastructure**:
   - Confirmed hardcoded Azure IP and synchronous shell executions during database transactions.
   - Confirmed plaintext client private keys in DB.
   - Confirmed development credentials committed in `docker-compose.yml`.

---

## 3. P0 Hygiene Actions Completed

1. **Tagging**: Tagged baseline `baseline-pre-scalability` on `main`.
2. **Branching**: Created `feature/p0-baseline-and-safety`.
3. **ADRs**: Created all 12 Architecture Decision Records (`001` through `012`) in `docs/adr/`.
4. **Codebase Audit Register**: Extended audit across unread services (`verificationService`, `ocr.service`, `collusionService`, `python.service`, `compreface.service`, `chat.socket`, `deviceCheck.controller`, `notification.controller`, `device-agent`) and documented findings in `docs/performance/AUDIT_REGISTER.md`.
5. **Observability Scaffolding**: Integrated `pino` + `pino-http` (JSON logs, AsyncLocalStorage request-id propagation), `prom-client` exposing `/metrics`, `perf_hooks.monitorEventLoopDelay`, Prisma `$metrics` exporter, and provisioned Prometheus + Grafana dashboards (`compose --profile observability`).
6. **Dependency & Workspace Hygiene**:
   - Moved `@prisma/client` from `devDependencies` to `dependencies` in `backend/package.json`.
   - Un-ignored `backend/prisma/migrations/` in `proctornet/.gitignore`.
   - Removed 24 scratch scripts from `proctornet/backend/scripts/scratch/`.
   - Relocated project docx and sample excel templates to `docs/assets/` and `docs/samples/`.
   - Added `.editorconfig`, `.prettierrc`, ESLint config, `.nvmrc` (Node 22.14.0 LTS), and `commitlint` + `husky`.

---

## 4. Empirical Baseline Load Test (Unmodified System)

- **Test Fixture**: 1 Exam × 50 MCQ Questions × 100 Enrolled Students
- **Harness**: Grafana k6 (`proctornet/backend/scripts/k6_exam_simulation.js`)
- **Simulated Journey**: Login → List Exams → Start Exam (Burst) → Periodic Autosave (every 5s) → Submit Exam

### 4.1 Quantitative Results Matrix

| Metric | SLO (§10.2) | 1 VU (Smoke) | 50 VUs (Cohort Ramp) | 100 VUs (Breaking Point) | Status |
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

### 4.2 The Breaking Point & Limiting Resource

- **First SLO Breach**: **50 Concurrent Users**. Autosave p95 latency reached **5,628 ms** (11.2× over SLO), and Start Exam p95 reached **9,920 ms** (6.6× over SLO).
- **Catastrophic Failure Point**: **100 Concurrent Users**. The HTTP error rate spiked to **10.65%** with 67 request failures out of 629.
- **The Limiting Resource**: **PostgreSQL Connection Pool Exhaustion & Interactive Transaction Starvation**.
  - All 17 pool connections remained 100% saturated with 82 queries backed up in the Prisma queue, accumulating 4,342 seconds of total queue wait time.
  - Interactive transaction blocks in `sessionStateMachine.js` timed out with Prisma code **`P2028: Unable to start a transaction in the given time`**, causing cascading 500 errors.
  - Compounding factors: Zero non-PK indexes and sequential queries over WAN round-trips.

Detailed artifacts committed in `reports/load/baseline/`:
- [`summary.md`](../../reports/load/baseline/summary.md)
- [`top10_sql.md`](../../reports/load/baseline/top10_sql.md)
- [`flamegraph-autosave.svg`](../../reports/load/baseline/flamegraph-autosave.svg)
- [`flamegraph-start-exam.svg`](../../reports/load/baseline/flamegraph-start-exam.svg)

