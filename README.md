# ProctorNet: Enterprise Online Examination & AI Proctoring Platform

ProctorNet is a full-stack, distributed assessment platform built with React 19, Node.js (Express), PostgreSQL (Prisma ORM), Redis, and RabbitMQ. Featuring 205 REST endpoints, 36 relational database models, and dual Socket.IO real-time telemetry streams, the system enforces multi-tier role-based access control, sub-second client anti-cheat monitoring, and set-based atomic evaluation for concurrent examination environments.

### Technology Stack & Verified Versions

| Layer | Technology | Exact Version | Architectural Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | React | `19.2.5` | Component-driven single-page application with concurrent rendering |
| **Frontend Build Tool** | Vite | `8.0.10` | ES module bundler with Brotli/Gzip static asset pre-compression |
| **Styling & Design System** | Tailwind CSS | `4.3.0` | Utility-first CSS styling with `@tailwindcss/vite` compiler |
| **Client Anti-Cheat AI** | `face-api.js` | `0.22.2` | In-browser TinyFaceDetector and 68-point facial landmark tracking |
| **Real-Time Client** | Socket.IO Client | `4.8.3` | Dual-channel bidirectional socket communication (exam + invigilation) |
| **Backend Runtime** | Node.js | `>=22.0.0` | Event-driven asynchronous JavaScript runtime engine |
| **Backend Framework** | Express | `4.18.2` | Core HTTP application server and REST API routing framework |
| **Database & ORM** | PostgreSQL / Prisma | `5.22.0` | Relational storage with type-safe schema definitions and migrations |
| **In-Memory Cache / PubSub** | Redis (`ioredis`) | `6.0.0` | Socket adapter multi-process scaling, rate limiting, and session caching |
| **Message Broker** | RabbitMQ (`amqplib`) | `2.2.0` | Asynchronous decoupled job queues for grading and email alerts |
| **Object Storage** | AWS S3 SDK | `3.1146.0` | Cloud/MinIO bucket storage for proctoring snapshots and student IDs |
| **Authentication & Tokens** | JSON Web Tokens (`jsonwebtoken`) | `9.0.0` | Signed Bearer tokens and HttpOnly session cookies |
| **Password Hashing** | Bcrypt (`bcrypt`) | `6.0.0` | Adaptive salted hashing algorithm for user credential security |
| **Schema Validation** | Zod | `4.6.5` / `4.4.3` | Strict runtime schema parsing for request parameters and payloads |
| **Testing & Quality** | Playwright / Node Test | `1.63.0` / Native | End-to-end browser journeys and native micro-benchmark suites |

---

## 2. System Architecture & Codebase Metrics

### Architectural Data Flow

```mermaid
graph TD
    subgraph Client Workstations
        StudentApp["Student SPA<br/>(React 19 + Vite)"]
        FacultyApp["Faculty / Admin Portal<br/>(React 19)"]
        InvigilatorApp["Invigilator Console<br/>(Live Tile Grid)"]
        AgentClient["Companion Security Agent<br/>(OS Daemon)"]
    end

    subgraph API Gateway & Middlewares
        ExpressGateway["Express HTTP Gateway (:5000)"]
        AuthMW["Auth & RBAC Middleware<br/>(JWT + Roles: Admin, Faculty, Student, Invigilator)"]
        RateLimitMW["Rate Limiter & Load Shedder<br/>(Redis Sliding Window)"]
        ValidationMW["Zod Validation Layer<br/>(Strict DTO schemas)"]
    end

    subgraph Real-Time Engine
        SocketServer["Socket.IO Cluster (:5000)<br/>(@socket.io/redis-adapter)"]
    end

    subgraph Service Layer
        ExamEngine["Exam & Scheduling Service<br/>(serverClock + expirySweeper)"]
        AutosaveService["Answer Ingestion & CAS Sync"]
        GradingEngine["Set-Based SQL Evaluation"]
        ProctorService["Proctoring & Violation Service"]
    end

    subgraph Persistence & Messaging Tier
        PostgresDB[("PostgreSQL Database<br/>(36 Prisma Models, 25 Composite Indexes)")]
        RedisStore[("Redis Cluster / Fallback<br/>(Session Cache + Token Bucket)")]
        RabbitMQBroker[("RabbitMQ Broker<br/>(Evaluation & Notification Queues)")]
        S3Storage[("AWS S3 / MinIO<br/>(Media Snapshots & Verification IDs)")]
    end

    StudentApp -->|"HTTP REST & Autosave"| RateLimitMW
    FacultyApp -->|"HTTP REST Management"| RateLimitMW
    InvigilatorApp -->|"HTTP REST Controls"| RateLimitMW
    AgentClient -->|"Signed Telemetry (HMAC-SHA256)"| RateLimitMW

    RateLimitMW --> AuthMW
    AuthMW --> ValidationMW
    ValidationMW --> ExpressGateway

    ExpressGateway --> ExamEngine
    ExpressGateway --> AutosaveService
    ExpressGateway --> GradingEngine
    ExpressGateway --> ProctorService

    StudentApp <-->|"Dual Socket.IO (attempt:state, frames)"| SocketServer
    InvigilatorApp <-->|"Dual Socket.IO (proctor:tile_visibility, alerts)"| SocketServer
    SocketServer <--> RedisStore

    ExamEngine --> PostgresDB
    AutosaveService --> PostgresDB
    GradingEngine --> PostgresDB
    ProctorService --> PostgresDB

    AutosaveService -.->|"Transactional Outbox"| RabbitMQBroker
    RabbitMQBroker --> GradingEngine
    ProctorService --> S3Storage
```

### Repository Fact Sheet

| Codebase Dimension | Verified Metric | Implementation Details |
| :--- | :--- | :--- |
| **Total Lines of Code (LOC)** | **84,762 Lines** | Backend `src`: 28,797 LOC (165 files) • Tests: 14,239 LOC (48 files) • Frontend `src`: 36,776 LOC (139 files) • Scripts: 4,950 LOC (31 files) |
| **REST API Surface** | **205 Endpoints** | Strictly validated routes documented in `docs/api/ROUTE_INVENTORY.md` across 13 distinct functional modules |
| **Domain Controllers** | **18 Controllers** | Dedicated controllers for `admin`, `faculty`, `student`, `attempts`, `exams`, `proctoring`, `results`, `answers`, etc. |
| **Custom Middleware Layers** | **12 Layers** | `auth.middleware`, `authorization`, `role.middleware`, `rateLimit`, `loadShed`, `audit.middleware`, `errorHandler`, `requestId`, `upload.middleware`, `validation`, `vpnGuard`, `authentication` |
| **Database Models** | **36 Models & 16 Enums** | Defined in `proctornet/backend/prisma/schema.prisma` mapping candidate attempts, questions, violations, outbox events, and audit logs |
| **Database Indexing** | **25 Compound Indexes** | Composite `@@index` and 7 `@@unique` constraints covering high-cardinality foreign keys and active attempt lookup paths |
| **Frontend Scale** | **43 Pages & 60 Components** | Modular UI library organized into role-specific modules (`admin`, `faculty`, `student`, `invigilator`) with 7 custom React hooks |
| **Real-Time WebSocket Events**| **36 Event Types** | Socket.IO event handlers governing frame dispatch, roster synchronizations, peer warnings, and session revocations |
| **Anti-Cheat Sensors** | **8 Sensor Defenses** | Client DOM listeners, WebAudio frequency analyzer, `face-api.js` facial tracking, dynamic canvas watermark, and companion agent signatures |

---

## 3. Engineering Highlights & Core Workflows

### Authentication & RBAC Security
- **Role Enforcement:** Access is strictly segregated into 4 discrete roles (`ADMIN`, `FACULTY`, `STUDENT`, `INVIGILATOR`) governed by the native PostgreSQL `Role` enum and enforced via `role.middleware.js` and `authorization.js`.
- **JWT Lifecycles:** Uses cryptographically signed JSON Web Tokens (`JWT_SECRET`) paired with rotating session records in the `auth_sessions` table.
- **Non-Destructive Re-Authentication:** The client interface catches `401 Unauthorized` responses without discarding candidate form state or unmounting components, launching an inline modal that re-authenticates the candidate and replays buffered answers.
- **Resource Ownership Guards:** Prevents horizontal privilege escalation by validating that faculty members own targeted exams and candidates can only query attempts bound to their authenticated `studentId`.

### Live Examination Engine & State Sync
- **Server-Authoritative Clock:** The `serverClock.js` module computes round-trip latency and synchronizes client clocks against server response timestamps (`Date` headers), calculating deadlines against an absolute `expiresAt` ISO string to prevent local clock tampering.
- **Background Tab Drift Mitigation:** `useExamTimer.js` recalculates remaining seconds on every tick directly against the synchronized target deadline rather than decrementing counters, preventing background tab timer throttling.
- **Two-Tier Autosave Architecture:** `AutosaveManager.js` handles optimistic updates with Compare-And-Swap (CAS) revisioning (`expectedRevision`). Answer payloads are backed up locally to both `sessionStorage` and an encrypted `IndexedDB` store (`offlineAnswerStore`), flushing automatically upon document blur, page hide, visibility loss, or via a debounced batch timer.
- **Concurrency & Idempotency:** The autosave batch payload sends stable `Idempotency-Key` headers. The backend `answers/repository.js` executes conditional upserts (`WHERE revision = expected_revision`) to reconcile competing writes.
- **Background Expiry Sweeper:** `expirySweeper.js` runs as an active background cron daemon, identifying active attempts whose deadline has passed and transitioning them to `EXPIRED` status with automated evaluation triggers.

### Anti-Cheat & Client Integrity
- **Client DOM Listeners:** `useAntiCheat.js` registers event listeners for:
  - `visibilitychange`: Flags `TAB_SWITCH` events whenever `document.hidden` becomes true.
  - `window.blur`: Flags `WINDOW_BLUR` events upon application focus loss.
  - `fullscreenchange`: Flags `FULLSCREEN_EXIT` violations when `document.fullscreenElement` is null.
  - `keydown`: Suppresses and records unauthorized system shortcuts (`F12`, `PrintScreen`, `Ctrl+C`, `Ctrl+V`, `Ctrl+U`, `Ctrl+S`, `Ctrl+P`, `Ctrl+I`, `Ctrl+J`).
  - `contextmenu`: Suppresses right-click inspection menus.
- **Computer Vision & Audio Proctoring:** In-browser `face-api.js` models run against video elements to detect missing faces, multiple faces, and pitch/yaw gaze angles. Web Audio API `AnalyserNode` computes ambient decibels to flag unauthorized voice activity.
- **Tamper-Evident Dynamic Watermarking:** The `WatermarkCanvas.jsx` component overlays a semi-transparent, non-interfering grid containing the candidate's unique identifier, timestamp, and IP address hash to deter unauthorized screen recording and photo leakage.
- **Companion Agent Endpoint Gating:** The optional endpoint daemon transmits system process snapshots signed with an HMAC-SHA256 signature containing monotonic sequence counters to detect remote desktop applications, virtual machines, and screen-sharing proxies.

### Automated Evaluation & Analytics
- **Set-Based Atomic Evaluation:** When an attempt reaches a terminal state (`SUBMITTED`, `EXPIRED`, `TERMINATED`), `resultRepository.evaluateAttemptSetBased()` executes a single, atomic SQL `INSERT ... SELECT` query joining `exam_attempts`, `attempt_questions`, `questions`, `answers`, and `question_options`.
- **Negative Marking Calculation:** The SQL evaluation engine computes scores dynamically:
  $$\text{Score} = \sum(\text{Correct Marks}) - \sum(\text{Negative Marks Penalty})$$
  Preserving negative totals when enabled or capping at zero based on exam configuration.
- **Transactional Outbox Worker:** Evaluation events are written to the `outbox_events` table within the same transaction as attempt submission. The asynchronous `EvaluationWorker` dispatches the event through RabbitMQ or the transactional dispatcher (`processed_events`), guaranteeing idempotent, at-least-once grading with zero duplicate records.

---

## 4. Database Schema Overview

The database is managed with Prisma ORM against PostgreSQL, comprising 36 models and 16 enums. Key tables include:

| Model / Table | Primary Fields | Key Relationships & Indexes |
| :--- | :--- | :--- |
| `User` / `Admin` / `Faculty` / `Student` | `id`, `email`, `passwordHash`, `role`, `departmentId`, `isApproved` | Composite indices on `[email]`, `[departmentId]`; foreign keys to `Department` and `AuthSession` |
| `Department` | `id`, `name`, `code`, `createdAt` | 1-to-many relationship with `Student`, `Faculty`, and `Exam` |
| `Exam` | `id`, `facultyId`, `title`, `status`, `startTime`, `endTime`, `duration`, `totalMarks`, `negativeMarking`, `tabSwitchLimit` | Indexes on `[facultyId]`, `[status]`, `[startTime, endTime]`; foreign key to `Faculty` |
| `Question` | `id`, `examId`, `questionText`, `questionType`, `marks`, `negativeMarks`, `order` | Index on `[examId, order]`; cascades with `QuestionOption` |
| `QuestionOption` | `id`, `questionId`, `optionText`, `isCorrect` | Index on `[questionId]`; foreign key to `Question` |
| `ExamAttempt` | `id`, `examId`, `studentId`, `status`, `startedAt`, `submittedAt`, `expiresAt`, `flagCount` | Compound indexes on `[examId, studentId]`, `[status, expiresAt]`; cascades to `AttemptQuestion`, `Answer` |
| `AttemptQuestion` | `id`, `attemptId`, `questionId`, `displayOrder`, `optionOrder` | Unique constraint `[attemptId, questionId]`; preserves candidate-randomized question/option sequences |
| `Answer` | `id`, `attemptQuestionId`, `selectedOptionId`, `revision`, `clientTimestamp` | Unique constraint `[attemptQuestionId]`; revision integer for Compare-And-Swap reconciliation |
| `ExamResult` | `id`, `attemptId`, `examId`, `score`, `percentage`, `correctCount`, `wrongCount`, `status` | Unique constraint `[attemptId]`; index on `[examId, score]` for percentile ranking |
| `ViolationEvent` | `id`, `attemptId`, `type`, `severity`, `metadata`, `timestamp` | Index on `[attemptId, timestamp]`; foreign key to `ExamAttempt` |
| `OutboxEvent` | `id`, `type`, `payload`, `status`, `retryCount`, `scheduledFor` | Compound index on `[status, scheduledFor]` for asynchronous worker dispatch |
| `ProcessedEvent` | `id`, `eventId`, `handlerName`, `processedAt` | Unique index on `[eventId, handlerName]` preventing duplicate grading executions |
| `AuditLog` | `id`, `actorId`, `role`, `action`, `entityType`, `entityId`, `metadata`, `ipAddress` | Index on `[entityType, entityId]`, `[actorId, timestamp]` for compliance traceability |
| `AgentSession` | `id`, `attemptId`, `platform`, `buildHash`, `lastSeq`, `state`, `createdAt` | Indexes on `[attemptId]`; validates companion agent heartbeats and sequences |

---

## 5. API Reference Summary

The API surface spans 205 endpoints documented in [ROUTE_INVENTORY.md](file:///c:/Final%20year%20project/online-exam-proctoring/docs/api/ROUTE_INVENTORY.md). Below is a summary of the core operational routes:

| Module | Method | Endpoint | Required Role | Functional Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Public | Candidate registration with department binding |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Issues JWT Bearer token and HttpOnly session cookie |
| **Auth** | `POST` | `/api/v1/auth/refresh` | Public | Refreshes expired access tokens using valid session ID |
| **Auth** | `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current session record in `auth_sessions` |
| **Auth** | `GET` | `/api/v1/auth/me` | Authenticated | Retrieves current authenticated profile and permissions |
| **Exams** | `GET` | `/api/v1/exams` | Student / Faculty | Lists scheduled and active examinations |
| **Exams** | `GET` | `/api/v1/exams/:id` | Student / Faculty | Retrieves exam metadata and access policy rules |
| **Exams** | `PATCH` | `/api/v1/exams/:examId/settings` | Faculty / Invigilator / Admin | Updates operational parameters (duration, limits, times) |
| **Faculty** | `POST` | `/api/v1/faculty/exams` | Faculty | Creates draft assessment with scheduling constraints |
| **Faculty** | `POST` | `/api/v1/faculty/exams/:id/publish` | Faculty | Validates question counts and locks draft into `PUBLISHED` |
| **Questions** | `POST` | `/api/v1/faculty/exams/:id/questions` | Faculty | Adds question and option sets to draft exam |
| **Questions** | `DELETE` | `/api/v1/faculty/exams/:id/questions/:qid` | Faculty | Removes question from draft exam bank |
| **Attempts** | `POST` | `/api/v1/student/attempts/start` | Student | Generates randomized attempt, seeds questions, sets deadline |
| **Attempts** | `PATCH` | `/api/v1/student/attempts/:id/answers` | Student | Ingests debounced answer batch with CAS revision check |
| **Attempts** | `POST` | `/api/v1/student/attempts/:id/submit` | Student | Finalizes attempt, halts timer, dispatches evaluation |
| **Attempts** | `POST` | `/api/v1/student/attempts/:id/violations` | Student | Ingests client anti-cheat detection violation record |
| **Results** | `GET` | `/api/v1/student/attempts/:id/result` | Student | Fetches scored result and percentage if results are released |
| **Results** | `GET` | `/api/v1/faculty/exams/:id/results` | Faculty / Admin | Exports comprehensive grading roster and question stats |
| **Admin** | `GET` | `/api/v1/admin/dashboard` | Admin | Aggregates global throughput, concurrent attempts, and alerts |
| **Admin** | `GET` | `/api/v1/admin/audit-logs` | Admin | Queries system-wide auditable actions with actor tracking |

---

## 6. Local Setup & Environment Variables

### Prerequisites
- **Node.js:** Version `>= 22.0.0`
- **npm:** Version `>= 10.0.0`
- **PostgreSQL:** Version `15.x` or higher
- **Redis (Optional / Recommended):** Version `6.x` or higher (falls back to bounded LRU in-memory cache if absent)
- **RabbitMQ (Optional / Recommended):** Version `3.12+` (falls back to PostgreSQL transactional queue if absent)

### Environment Configuration

Create `.env` inside `proctornet/backend/.env` using the following schema:

| Variable Name | Required | Example / Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `5000` | HTTP port for the backend API server |
| `NODE_ENV` | Yes | `development` | Runtime environment (`development` / `production`) |
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/proctornet?schema=public` | PostgreSQL connection pool URL for Prisma Client |
| `DIRECT_URL` | Yes | `postgresql://postgres:password@localhost:5432/proctornet` | Direct database URL for Prisma schema migrations |
| `JWT_SECRET` | Yes | `[GENERATE_RANDOM_256_BIT_SECRET]` | Cryptographic secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token validity duration |
| `FRONTEND_URL` | Yes | `http://localhost:5173` | Allowed CORS origin for the React single-page app |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL for distributed sockets & rate limiting |
| `RABBITMQ_URL` | No | `amqp://guest:guest@localhost:5672` | RabbitMQ connection string for outbox grading queues |
| `QUEUE_DRIVER` | No | `postgres` | Queue backend driver (`postgres` or `rabbitmq`) |
| `AWS_REGION` | Yes | `ap-south-1` | AWS S3 region for bucket operations |
| `AWS_S3_BUCKET_NAME` | Yes | `proctornet-evidence` | AWS S3 / MinIO storage bucket name |
| `AWS_ACCESS_KEY_ID` | Yes | `[AWS_KEY_ID]` | IAM access key credential |
| `AWS_SECRET_ACCESS_KEY`| Yes | `[AWS_SECRET_KEY]` | IAM secret access key credential |
| `S3_ENDPOINT` | No | `http://127.0.0.1:9000` | Optional custom endpoint when using local MinIO |
| `S3_FORCE_PATH_STYLE` | No | `true` | Required when routing S3 requests to local MinIO |

Create `.env` inside `proctornet/frontend/.env`:

| Variable Name | Required | Example Value | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | No | `http://localhost:5000/api/v1` | Base URL routing frontend API requests |
| `VITE_SOCKET_URL` | No | `http://localhost:5000` | Base URL routing real-time Socket.IO connections |

---

### Installation & Run Commands

#### 1. Repository Setup & Dependency Installation
```bash
# Clone the repository
git clone https://github.com/SudeepKagi/online-exam-proctoring.git
cd online-exam-proctoring

# Install root dependencies (linters, quality guardrails, tools)
npm install

# Install backend dependencies
cd proctornet/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ../..
```

#### 2. Database Migration & Baseline Seeding
Ensure PostgreSQL is running and `DATABASE_URL` is configured in `proctornet/backend/.env`:
```bash
# Apply Prisma schema migrations to PostgreSQL
npm run migrate --prefix proctornet/backend

# Generate Prisma Client bindings
npm run generate --prefix proctornet/backend

# Seed initial administrative governance credentials
npm run seed --prefix proctornet/backend
```

#### 3. Run Quality & Security Checks
Verify codebase compliance against architectural guardrails:
```bash
# Run unified quality gate (no-stubs, banned-terms, route-inventory check)
npm run quality

# Run backend unit and integration suites
npm test --prefix proctornet/backend
```

#### 4. Start Development Servers
Run the backend API gateway and frontend development servers in separate terminal sessions:

**Session 1 (Backend API Gateway & Sockets):**
```bash
cd proctornet/backend
npm run dev
# Server initializes on http://localhost:5000
```

**Session 2 (Frontend Client Application):**
```bash
cd proctornet/frontend
npm run dev
# Application initializes on http://localhost:5173
```

---

## 7. Automated Verification & Quality Guardrails

The project enforces an automated CI quality gate (`scripts/ci/quality.js`) executed on every pull request and build:
- **`no-stubs`:** AST and regex scanning prohibiting mock score returns, unobserved test writes, and fake passes.
- **`no-legacy`:** Verifies the absence of legacy paths, obsolete deployment definitions, and orphaned schema tokens.
- **`banned-terms`:** Audits user-facing interface text to prevent low-level technical vocabulary leaks.
- **`no-source-grep`:** Validates that automated tests invoke runtime behavioral contracts rather than asserting against source strings.
- **`route-inventory`:** Compares runtime mounted Express routes against `docs/api/ROUTE_INVENTORY.md` to guarantee zero undocumented endpoints.
- **`e2e-integrity`:** Analyzes Playwright journey scripts to prevent unconditioned timeouts (`waitForTimeout`) and forbidden test bypasses.

---

## 8. License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
