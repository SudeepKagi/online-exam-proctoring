# ProctorNet — Scalable Online Exam Proctoring Platform

[![Production Deployment](https://img.shields.io/badge/Production-https%3A%2F%2Fproctornet.duckdns.org-22c55e?style=for-the-badge&logo=cloudflare)](https://proctornet.duckdns.org/)
[![Node.js 22 LTS](https://img.shields.io/badge/Node.js-22_LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis 7](https://img.shields.io/badge/Redis-7-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-5.22-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)
[![AWS S3 & Rekognition](https://img.shields.io/badge/AWS-S3_%26_Rekognition-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Docker](https://img.shields.io/badge/Docker-Production_Images-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Playwright E2E](https://img.shields.io/badge/Playwright-E2E_Journeys-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)

> **Live Production URL:** [https://proctornet.duckdns.org/](https://proctornet.duckdns.org/)  
> Enterprise-grade online exam examination and automated invigilation platform featuring server-authoritative timer enforcement, atomic single-query PostgreSQL CTE grading, real-time WebSockets, facial biometric verification, and browser lockdown.

---

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph ClientLayer ["Client Presentation Layer (Browser)"]
        UI["React 19 + Shadcn UI SPA<br/>(https://proctornet.duckdns.org)"]
        RT["WebRTC Screen Capture<br/>(displaySurface === 'monitor')"]
        LD["Browser Lockdown Guard<br/>(Tab-switch, Fullscreen, Blur)"]
        UI --- RT
        UI --- LD
    end

    subgraph EdgeLayer ["Edge Security & Ingress"]
        CADDY["Caddy 2 / Nginx Reverse Proxy<br/>(:80, :443 Automatic Let's Encrypt TLS)"]
        WS_UPGRADE["WebSocket Upgrade & Compression<br/>(/api/*, /socket.io/*)"]
        CADDY --- WS_UPGRADE
    end

    subgraph BackendLayer ["Node.js 22 Modular Monolith (:5000)"]
        APP["Express API + Socket.io Server"]
        AUTH_MOD["Auth & RBAC Module<br/>(JWT, Bcrypt, Roles)"]
        EXAM_MOD["Exam Authoring Module<br/>(Questions, Publishing)"]
        ATTEMPT_MOD["Attempt Execution Module<br/>(Lock-free Starts, Autosave)"]
        PROCTOR_MOD["Proctoring Pipeline<br/>(Event Micro-Batching)"]
        MEDIA_MOD["Media & Evidence Service<br/>(Presigned URLs, Biometrics)"]
        
        APP --> AUTH_MOD
        APP --> EXAM_MOD
        APP --> ATTEMPT_MOD
        APP --> PROCTOR_MOD
        APP --> MEDIA_MOD
    end

    subgraph PersistenceLayer ["State & Persistence Tier"]
        PG[("PostgreSQL 16 Engine<br/>7 Core Normalized Tables<br/>Row-Level Locks FOR UPDATE")]
        REDIS[("Redis 7 Cache & PubSub<br/>L2 Question Cache<br/>Socket.io Cluster Adapter")]
    end

    subgraph CloudLayer ["AWS Cloud Infrastructure"]
        S3[("Amazon S3 Bucket<br/>Encrypted Evidence Storage<br/>Presigned Direct Uploads")]
        REKOG["Amazon Rekognition<br/>CompareFaces (90%+ Confidence)<br/>Real-Time Photo Verification"]
    end

    ClientLayer -->|HTTPS / WSS| EdgeLayer
    EdgeLayer -->|Internal Proxy :5000| BackendLayer
    BackendLayer -->|Prisma Client / Raw SQL Pool| PG
    BackendLayer -->|ioredis Connection Pool| REDIS
    MEDIA_MOD -->|AWS SDK v3| REKOG
    MEDIA_MOD -->|S3 Client Put/Get| S3
    UI -.->|Direct Evidence Upload via Presigned URL| S3
```

---

## 2. Database Architecture — 7-Table Canonical Schema

ProctorNet uses a strictly normalized, 7-table schema with relational constraints and composite indices for maximum transactional integrity:

```mermaid
erDiagram
    users ||--o{ exams : "creates (FACULTY)"
    users ||--o{ exam_assignments : "enrolled as"
    users ||--o{ exam_attempts : "submits"
    exams ||--o{ questions : "contains (1:N)"
    exams ||--o{ exam_assignments : "restricts"
    exams ||--o{ exam_attempts : "attempts"
    exam_attempts ||--o{ attempt_answers : "records"
    exam_attempts ||--o{ proctoring_logs : "triggers"

    users {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        enum role "ADMIN | FACULTY | INVIGILATOR | STUDENT"
        string institution_id
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    exams {
        uuid id PK
        string title
        string course_code
        uuid created_by_id FK
        timestamp start_time
        timestamp end_time
        integer duration_minutes
        enum status "DRAFT | PUBLISHED | ARCHIVED"
        boolean negative_marking
        decimal negative_value
        boolean results_released
        timestamp created_at
        timestamp updated_at
    }

    questions {
        uuid id PK
        uuid exam_id FK
        text question_text
        jsonb options "array of 4 options"
        integer correct_option_index
        decimal marks
        decimal negative_marks
        integer display_order
        timestamp created_at
        timestamp updated_at
    }

    exam_assignments {
        uuid id PK
        uuid exam_id FK
        uuid user_id FK
        enum assigned_role "STUDENT | INVIGILATOR"
        timestamp created_at
    }

    exam_attempts {
        uuid id PK
        uuid exam_id FK
        uuid student_id FK
        timestamp start_time
        timestamp end_time
        timestamp submitted_at
        enum status "NOT_STARTED | IN_PROGRESS | SUSPENDED | SUBMITTED | TIMED_OUT"
        decimal score
        integer total_violations
        timestamp created_at
        timestamp updated_at
    }

    attempt_answers {
        uuid id PK
        uuid attempt_id FK
        uuid question_id FK
        integer selected_option_index
        boolean is_bookmarked
        timestamp updated_at
    }

    proctoring_logs {
        uuid id PK
        uuid attempt_id FK
        enum event_type "TAB_SWITCH | FULLSCREEN_EXIT | MULTIPLE_FACES | NO_FACE | NOISE"
        enum severity "LOW | MEDIUM | HIGH | CRITICAL"
        jsonb metadata
        string evidence_s3_key
        timestamp created_at
    }
```

---

## 3. End-to-End Student Exam & Proctoring Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor S as Student Browser
    participant E as Edge (Caddy/Nginx)
    participant B as Backend Monolith (:5000)
    participant R as Redis 7
    participant PG as PostgreSQL 16
    participant AWS as AWS Rekognition / S3
    actor I as Invigilator Console

    %% Phase A
    Note over S,AWS: Phase A: Pre-Exam Verification & Screen Lock
    S->>E: POST /api/v1/media/verify-face (Base64 webcam frame)
    E->>B: Proxy verify-face
    B->>AWS: Rekognition CompareFaces(webcam, student_profile_photo)
    AWS-->>B: Similarity 90%+ (Match Confirmed)
    B-->>S: 200 OK { verified: true }
    Note over S: Student stops webcam track (track.stop())<br/>Acquires Full Screen (displaySurface === 'monitor')<br/>Enforces Fullscreen Window Lock

    %% Phase B
    Note over S,PG: Phase B: Thundering-Herd Safe Exam Start
    S->>B: POST /api/v1/attempts/start { examId }
    B->>R: Fetch cached exam & stripped question payload
    alt Redis Cache Miss
        B->>PG: SELECT * FROM questions WHERE exam_id = ...
        B->>R: Set question payload (O(1) L2 cache)
    end
    B->>PG: INSERT INTO exam_attempts (status = 'IN_PROGRESS') RETURNING *
    B-->>S: 200 OK (Questions without correctOptionIndex, serverStartTime, duration)

    %% Phase C
    Note over S,I: Phase C: Live Exam Loop & Real-Time Ingestion
    loop Active Attempt Loop
        S->>B: PUT /api/v1/attempts/:id/answers (Debounced batch autosave)
        B->>PG: Bulk Upsert answers (UNNEST batch query)
        B-->>S: 200 OK { savedAnswers: N, revision }
        
        opt Browser Violation Detected (Blur / Fullscreen Exit)
            S->>B: POST /api/v1/proctoring/violation { eventType: 'TAB_SWITCH' }
            B->>B: Buffer in ProctoringService queue (Max 100 items / 150ms)
            B->>I: WebSocket broadcast student:violation (Instant Push)
            B->>PG: Periodic batch insert into proctoring_logs
        end
    end

    %% Phase D
    Note over S,PG: Phase D: Atomic Single-Query CTE Submission
    S->>B: POST /api/v1/attempts/:id/submit
    B->>PG: Atomic CTE: UPDATE exam_attempts SET status = 'SUBMITTED', score = calculated_score WHERE id = ... AND status = 'IN_PROGRESS' FOR UPDATE
    PG-->>B: Score evaluated (+marks for correct, -negative_marks for wrong)
    B-->>S: 200 OK { status: 'SUBMITTED', score: 11.00 }
```

---

## 4. Exam Attempt State Machine

```mermaid
stateDiagram-v2
    [*] --> NOT_STARTED: User Enrolled
    NOT_STARTED --> IN_PROGRESS: POST /api/v1/attempts/start (Valid Schedule & Biometrics)
    
    IN_PROGRESS --> SUSPENDED: Invigilator Manual Action / Critical Violation Limit
    SUSPENDED --> IN_PROGRESS: Invigilator Resumes Attempt
    
    IN_PROGRESS --> SUBMITTED: POST /api/v1/attempts/:id/submit (Explicit User Submission)
    IN_PROGRESS --> TIMED_OUT: Server Clock Expiry Sweeper (Exceeds durationMinutes)
    SUSPENDED --> SUBMITTED: Emergency Staff Force Submission

    SUBMITTED --> [*]: Terminal Immutable State
    TIMED_OUT --> [*]: Terminal Immutable State
```

---

## 5. Clean Repository Structure

```
.
├── backend/
│   ├── Dockerfile                   # Alpine musl Node 22, non-root user, auto-migration
│   ├── prisma/
│   │   ├── schema.prisma            # 7-table canonical Prisma schema
│   │   └── migrations/              # 0001_core_tables migration definition
│   └── src/
│       ├── app.js                   # Express application, Socket.io, middleware bootstrap
│       ├── lifecycle.js             # Graceful resource teardown & connection draining
│       ├── infra/
│       │   ├── postgres/            # Prisma client instance & raw SQL query pool
│       │   ├── redis/               # Redis client, L1 Bounded LRU cache, PubSub
│       │   ├── s3/                  # S3 direct upload adapter & 100-key ring buffer fallback
│       │   └── websocket/           # Socket.io server, staff handlers & delta coalescer
│       ├── middleware/
│       │   ├── errorHandler.js      # Canonical error envelope and status codes
│       │   └── security.js          # Helmet, CSRF origin verification, rate-limiting
│       ├── modules/
│       │   ├── auth/                # [routes, controller, service, sql] (JWT + Bcrypt)
│       │   ├── users/               # [routes, controller, service, sql] (User admin)
│       │   ├── exams/               # [routes, controller, service, sql] (Exam authoring)
│       │   ├── attempts/            # [routes, controller, service, sql] (Execution & grading)
│       │   ├── media/               # [routes, controller, service, sql] (S3 + Rekognition)
│       │   └── proctoring/          # [routes, controller, service, sql] (Batch logging)
│       └── shared/                  # Config, logger, metrics, roles, validation
├── frontend/
│   ├── Dockerfile                   # Multi-stage Vite builder -> Nginx reverse proxy
│   ├── vite.config.js               # Compression, chunk splitting, proxy configuration
│   └── src/
│       ├── App.jsx                  # Central router with role-based routing guards
│       ├── components/              # Reusable Shadcn UI & dashboard shell components
│       ├── hooks/                   # Custom React hooks (auth, countdown, fullscreen)
│       ├── lib/                     # API client, autosave manager, socket listener
│       └── pages/
│           ├── auth/                # Login, account activation, password reset
│           ├── admin/               # User management, audit logs, institution settings
│           ├── faculty/             # Exam creation wizard, question bank manager
│           ├── invigilator/         # Live monitoring grid, violation review console
│           └── student/             # Pre-check wizard, live exam UI, result review
├── e2e/                             # Playwright automated user journey test specs
│   ├── auth-onboarding.spec.ts      # Multi-role authentication & account lifecycle
│   ├── exam-authoring.spec.ts       # Faculty question creation & publishing workflow
│   ├── invigilator-ops.spec.ts      # Real-time WebSocket violation alerts & suspension
│   └── student-attempt.spec.ts      # Full student exam attempt, autosave & submission
├── docker-compose.yml               # Production multi-container composition
├── .env.example                     # 11 canonical environment variables
└── README.md                        # Production system documentation
```

---

## 6. Verified Concurrency & Security Benchmarks

Validated against a live PostgreSQL 16 and Redis 7 stack in automated integration testing (`backend/tests/concurrency-security.test.js`):

| Test Scenario | Concurrency | Performance Benchmark | Assertion Result |
| :--- | :---: | :---: | :---: |
| **Thundering Herd Exam Start** | 100 simultaneous requests | **898.5 ms** (Budget: < 1500 ms) | **PASS** — Zero answer leakage, 100 attempts `IN_PROGRESS` |
| **Concurrent Batch Autosave Burst**| 200 concurrent upserts | **1292.5 ms** | **PASS** — Zero deadlocks, zero 500 errors, clean upserts |
| **Double-Submit Race Condition** | 20 parallel submits | **364.4 ms** | **PASS** — Exactly 1 grading execution, score: `11.00` |
| **Server-Authoritative Timer Guard** | Expired timestamp attempt | **51.4 ms** | **PASS** — HTTP 409 Conflict rejection, locked attempts |
| **Micro-Batch Violation Ingestion** | 60 rapid events | **1453.5 ms** | **PASS** — Auto-batched into single DB transaction |
| **IDOR & Security Boundary Check** | Cross-student mutations | **53.4 ms** | **PASS** — HTTP 403 Forbidden on unassigned attempts |

---

## 7. Local Development & Testing Guide

### Prerequisites
- Node.js `>= 22.0.0`
- Docker Engine & Docker Compose
- PostgreSQL 16 & Redis 7

### 1. Quickstart Environment Setup
```bash
# Clone the repository
git clone https://github.com/SudeepKagi/online-exam-proctoring.git
cd online-exam-proctoring

# Copy environment template
cp .env.example .env

# Install dependencies across all workspaces
npm ci

# Launch local PostgreSQL and Redis services
docker compose up -d postgres redis

# Apply database migrations and seed administrative baseline
npm run db:migrate --workspace=backend
npm run db:seed --workspace=backend

# Run local development servers (Backend :5000, Frontend :5173)
npm run dev
```

### 2. Execute Automated Test Suites
```bash
# Run all backend unit, integration, and concurrency tests (62+ tests)
npm test --workspace=backend

# Run complete Playwright end-to-end browser journeys
npx playwright test
```

### 3. Production Docker Deployment
```bash
# Build and run the entire production container stack
docker compose up -d --build

# Verify platform health
curl -f http://localhost:5000/healthz
curl -f http://localhost:5173/
```

---

## 8. AWS Production Deployment Architecture

The production environment at **[https://proctornet.duckdns.org/](https://proctornet.duckdns.org/)** is continuously deployed via GitHub Actions:

1. **Continuous Integration (`verify-and-test`):**
   - Automatically provisions ephemeral `postgres:16-alpine` and `redis:7-alpine` service containers.
   - Runs Prisma validation, generates clients, and executes schema migrations.
   - Enforces the strict `<= 250 lines` guardrail check across all source files.
   - Runs full unit and concurrency/security test suites and builds the production frontend bundle.

2. **Automated Continuous Deployment (`deploy-production`):**
   - Bundles the pre-compiled frontend distribution and backend code into an immutable release tarball.
   - Authenticates to AWS via AWS IAM OIDC (`AWS_ROLE_TO_ASSUME`) or IAM access credentials.
   - Deploys release payload via AWS Systems Manager (SSM) Session Manager without opening inbound SSH ports.
   - Automatically executes the 7-table Prisma schema cutover and seeds the administrative baseline.
   - Reloads Caddy web server with Let's Encrypt TLS and prunes dangling container images.
   - Probes public HTTPS endpoint `https://proctornet.duckdns.org/healthz` to confirm deployment readiness.

---

## License
MIT License. Developed for Advanced Online Examination and Remote Proctoring Systems.
