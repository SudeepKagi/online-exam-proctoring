# ProctorNet Load, Concurrency & Chaos Simulation Model

**Reference**: Phase P10 / Section 10.1 & 10.2  
**Purpose**: Mathematical specification of student, invigilator, and administrator behavioral dynamics under live concurrent examination conditions. Every behavioral metric is encoded as an explicit, configurable parameter.

---

## 1. Mathematical Behavioral Model

### 1.1 Arrival & Lobby Entry
- **Distribution**: Log-normal distribution spanning $T - 10\text{ min}$ to $T + 0\text{ min}$.
- **Late Arrivals**: $5\%$ of candidates arrive late, uniformly distributed between $T + 0\text{ min}$ and $T + 10\text{ min}$.
- **Config Parameters**:
  - `LOBBY_WINDOW_MINUTES = 10`
  - `LATE_ARRIVAL_RATIO = 0.05`
  - `LATE_WINDOW_MINUTES = 10`

### 1.2 Authentication & Token Minting
- **Frequency**: Exactly 1 login per candidate session.
- **Optimization Guard**: Precomputed bcrypt password hashes in fixtures to isolate and measure application server throughput, avoiding bcrypt worker saturation on the generator host.
- **Config Parameters**:
  - `LOGINS_PER_STUDENT = 1`
  - `PRECOMPUTED_BCRYPT_HASH = "$2a$08$..."`

### 1.3 Synchronized Examination Start Spike
- **Distribution**: Gaussian / Normal distribution centered at `start_time` ($T_0$).
  - Standard deviation $\sigma = 8\text{ seconds}$ (standard synchronized cohort start).
  - Pathological spike $\sigma = 2\text{ seconds}$ (stress condition representing bell ring / proctor announcement).
- **Endpoint**: `POST /api/v1/attempts/:id/start` (atomic transition `READY` $\to$ `ACTIVE`).
- **Config Parameters**:
  - `START_SPIKE_SIGMA_SECONDS = 8`
  - `START_SPIKE_PATHOLOGICAL_SIGMA = 2`

### 1.4 Question Answering & Think Times
- **Structure**: 50 Multiple Choice Questions (single correct option, positive marks, negative penalty).
- **Think Time**: Log-normal distribution with median $\mu = 40\text{ seconds}$ ($\sigma_{\text{log}} = 0.5$).
- **Answer Revisions**:
  - $20\%$ of questions are revised once ($1\text{ answer change}$).
  - $5\%$ of questions are revised twice ($2\text{ answer changes}$).
- **Config Parameters**:
  - `TOTAL_QUESTIONS = 50`
  - `THINK_TIME_MEDIAN_SECONDS = 40`
  - `REVISION_RATE_ONCE = 0.20`
  - `REVISION_RATE_TWICE = 0.05`

### 1.5 Autosave Write Path
- **Batch Endpoint (Modern Clients, 80%)**: Flushes dirty answers in memory every $5\text{ seconds}$ via batch REST endpoint `PUT /api/v1/attempts/:id/answers/batch`.
- **Individual PUT (Legacy Clients, 20%)**: Emits individual `PUT /api/v1/attempts/:id/answers/:qid` with optimistic concurrency CAS (`WHERE answers.revision = $revision`).
- **Config Parameters**:
  - `AUTOSAVE_INTERVAL_SECONDS = 5`
  - `BATCH_CLIENT_RATIO = 0.80`
  - `INDIVIDUAL_PUT_RATIO = 0.20`

### 1.6 WebSocket Heartbeat & Presence
- **Frequency**: Every $15\text{ seconds}$ over Socket.IO connection.
- **Payload**: Minimal JSON `{ attemptId, timestamp, clientEpoch }`.
- **Config Parameters**:
  - `HEARTBEAT_INTERVAL_SECONDS = 15`

### 1.7 Proctoring Violations & Evidence Tickets
- **Arrival Process**: Poisson process with rate $\lambda = 0.4\text{ violations/minute/student}$.
- **Noisy Subset**: $5\%$ "noisy" students exhibit elevated alerts at $\lambda_{\text{noisy}} = 3.0\text{ violations/minute}$.
- **Evidence Flow**: Calls `POST /api/v1/uploads/presign` ($\le 300\text{ KB}$ limit), uploads directly to S3/MinIO, then calls `POST /api/v1/uploads/complete` triggering async Sharp thumbnail worker via transactional outbox.
- **Config Parameters**:
  - `VIOLATION_POISSON_LAMBDA = 0.4`
  - `NOISY_STUDENT_RATIO = 0.05`
  - `NOISY_STUDENT_LAMBDA = 3.0`
  - `EVIDENCE_MAX_BYTES = 307200` (300 KB)

### 1.8 Candidate Chat
- **Frequency**: $1\%$ of candidates send $1 - 3$ text messages to the exam proctor room.
- **Config Parameters**:
  - `CHAT_STUDENT_RATIO = 0.01`
  - `CHAT_MESSAGES_MIN = 1`
  - `CHAT_MESSAGES_MAX = 3`

### 1.9 Network Faults & Mid-Exam Drops
- **Transient Disconnect**: $3\%$ of students experience a temporary network blackout lasting $5 - 30\text{ seconds}$, then reconnect and execute a single REST state resynchronization (`GET /api/v1/attempts/:id/state`).
- **Browser Refresh**: $2\%$ of students refresh or reopen their browser mid-exam, restoring cached answers from server state.
- **Config Parameters**:
  - `NETWORK_FAULT_RATIO = 0.03`
  - `NETWORK_FAULT_MIN_SECONDS = 5`
  - `NETWORK_FAULT_MAX_SECONDS = 30`
  - `BROWSER_REFRESH_RATIO = 0.02`

### 1.10 Examination Submission Burst
- **Timing**:
  - $65\%$ submit in the final $2\text{ minutes}$ of the exam window (the submission surge).
  - $25\%$ submit early, uniformly distributed between $T + 30\text{ min}$ and $T + 88\text{ min}$.
  - $10\%$ never manually click submit; handled automatically by the asynchronous `expirySweeper`.
- **Locking**: Row-level pessimistic locking (`SELECT ... FOR UPDATE`) with outbox grading event emission.
- **Config Parameters**:
  - `SUBMIT_BURST_RATIO = 0.65`
  - `SUBMIT_BURST_WINDOW_MINUTES = 2`
  - `SUBMIT_EARLY_RATIO = 0.25`
  - `SUBMIT_EXPIRED_RATIO = 0.10`

### 1.11 Invigilator Proctors
- **Ratio**: Exactly 1 invigilator per 50 students.
- **Behavior**: Connects to `inv:{examId}`, renders 12-tile paginated grid, cycles pages every $30\text{ seconds}$, promotes 1 candidate to high-quality focus, and $10\%$ issue a warn or pause action.
- **Config Parameters**:
  - `STUDENTS_PER_INVIGILATOR = 50`
  - `ROSTER_PAGE_SIZE = 12`
  - `PAGE_CYCLE_SECONDS = 30`
  - `INVIGILATOR_ACTION_RATIO = 0.10`

### 1.12 Administrative Background Traffic
- **Operations**: Constant low-frequency queries on exam catalogs and results summaries ($1\text{ req/sec}$).
- **Config Parameters**:
  - `ADMIN_BACKGROUND_QPS = 1`

---

## 2. Capacity Tiers & Concurrency Ladder

### 2.1 Single-Node Capacity Tiers
- **Tier A (Standard Campus Cohort)**: $500\text{ concurrent students}$ on $1\text{ exam}$.
- **Tier B (Multi-Exam Departmental)**: $1,000\text{ concurrent students}$ across $2\text{ simultaneous exams}$.
- **Tier C (Stretch Limit)**: $2,000\text{ concurrent students}$ across $4\text{ simultaneous exams}$.

### 2.2 Concurrency Ladder Progression
The load test suite steps through the ladder:
$$\mathbf{100 \longrightarrow 250 \longrightarrow 500 \longrightarrow 1,000 \longrightarrow 1,500 \longrightarrow 2,000 \longrightarrow \text{Breakpoint}}$$

---

## 3. Service Level Objectives (SLOs) & Pass-Fail Thresholds

| Metric | Target SLO (§10.2) | Rationale |
|---|---|---|
| **Answer Save Latency (p95)** | $< 150\text{ ms}$ | Immediate UI responsiveness for autosaves |
| **Answer Save Latency (p99)** | $< 400\text{ ms}$ | Upper tail latency under lock-free CAS |
| **Start Exam Latency (p95)** | $< 800\text{ ms}$ | Bounded during synchronized start spike |
| **Submit Exam Latency (p95)** | $< 500\text{ ms}$ | Fast submission acknowledgment |
| **Login Latency (p95)** | $< 400\text{ ms}$ | Auth throughput with precomputed hashes |
| **Roster Page Latency (p95)** | $< 300\text{ ms}$ | Smooth keyset pagination for proctors |
| **WebSocket Delta Delivery (p95)** | $< 300\text{ ms}$ | Roster delta coalescing latency |
| **HTTP Error Rate** | $< 0.1\%$ | Excludes intentional 409/429 conflict codes |
| **Lost Acknowledged Answers** | **$0$ (Zero)** | Absolute data integrity invariant |
| **Duplicate Submissions / Results** | **$0$ (Zero)** | Exactly-once grading invariant |
| **Outbox Drain Time** | $< 60\text{ s}$ | All events processed within 60s of last submit |
| **API Event Loop Delay (p99)** | $< 100\text{ ms}$ | Prevents main thread starvation |
| **PostgreSQL Pool Wait (p95)** | $< 20\text{ ms}$ | Prevents pool exhaustion deadlocks |
| **PostgreSQL CPU Utilization** | $< 70\%$ | Sustained headroom for VACUUM and WAL flushes |
| **API Container CPU** | $< 75\%$ | Headroom for TLS and gzip compression |
| **Memory Growth (60-min Soak)** | $< 5\%/\text{hour}$ | Verifies absence of RSS memory leaks |
