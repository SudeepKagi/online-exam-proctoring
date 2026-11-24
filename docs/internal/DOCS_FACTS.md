# ProctorNet Documentation Facts Matrix

> **Generated on**: 2026-11-24T00:30:58.848Z  
> **Source**: Verified directly from code, configurations, schemas, and tests in the repository.

---

## 1. Stack and Component Versions

| Tier | Technology / Library | Version / Runtime | Source |
| :--- | :--- | :--- | :--- |
| **Monorepo Runtime** | Node.js | >= 22.0.0 | Root & workspaces `package.json` |
| **Backend Framework** | Express.js | ^4.18.2 | `backend/package.json` |
| **Database ORM** | Prisma | ^5.22.0 | `backend/package.json` |
| **Database Engine** | PostgreSQL | 15+ (ACID transactional) | `backend/prisma/schema.prisma` |
| **Cache & Real-Time** | Redis (`ioredis`) + Socket.io | ioredis ^6.0.0, socket.io ^4.6.1 | `backend/package.json` |
| **Frontend Framework** | React + React DOM | ^19.2.5 | `frontend/package.json` |
| **Frontend Bundler** | Vite | ^8.0.10 | `frontend/package.json` |
| **Frontend Styling** | Tailwind CSS (Vite plugin) | ^4.3.0 | `frontend/package.json` |
| **Frontend UI / Motion** | Radix UI + Motion | radix-ui ^1.6.7, motion ^14.14.0 | `frontend/package.json` |
| **Frontend Icons** | Lucide React | ^1.14.0 | `frontend/package.json` |
| **Client Lockdown** | Safe Exam Browser (SEB) | 3.x compatible | `backend/src/modules/seb/` |
| **AI / LLM Integration** | Google Gemini (fallback OpenAI) | Gemini API / OpenAI API | `backend/src/modules/exams/ai.generator.js` |
| **Cloud Biometrics** | AWS Rekognition | @aws-sdk/client-rekognition ^3.1147.0 | `backend/package.json` |
| **Cloud Storage** | AWS S3 (Presigned URLs) | @aws-sdk/client-s3 ^3.1146.0 | `backend/package.json` |
| **E2E Testing** | Playwright | ^1.63.0 | Root `package.json` |

---

## 2. Stored Data Models (Prisma Relational Schema)

The PostgreSQL database stores the following 11 models defined in `backend/prisma/schema.prisma`:

1. `User` (Students, Faculty, Invigilators, Admins; auth credentials, reference photo keys, institutional ID)
2. `Exam` (Exam titles, course codes, start/end timestamps, duration, proctoring configuration, status)
3. `Question` (Exam questions, multiple-choice options, correct index, positive/negative marks, display order)
4. `ExamAssignment` (Mapping of assigned students and faculty to specific exams)
5. `ExamAttempt` (Per-student exam sessions, start/submit times, scores, face verification status, violation counts)
6. `AttemptAnswer` (Saved responses per question, selected options bitmask, bookmark flags, update timestamps)
7. `ProctoringLog` (Audit log of violation events: tab switches, multi-face alerts, severity, snapshot keys)
8. `SystemSetting` (Key-value store for global institutional settings and SEB configurations)
9. `StudentReadinessReport` (Pre-exam hardware telemetry: camera, microphone, browser, OS, latency bucket)
10. `StudentConsent` (Legal and institutional proctoring agreements accepted prior to exam entry)
11. `ExamDraft` (Autosaved drafts for faculty exam creation wizard)

---

## 3. Features Implemented by User Role

### Candidate / Student Role
- **Authentication & Setup**: Registration, password reset, login with JWT cookies, and institutional reference photo capture.
- **Pre-Exam System Check**: Interactive hardware diagnostic (webcam, microphone, operating system, browser, network latency check).
- **Identity Gate**: Automated facial comparison against stored reference photo using AWS Rekognition before entry is unlocked.
- **Secure Browser Integration**: Direct launching and verification via Safe Exam Browser with cryptographic config key exchange.
- **Exam Arena**:
  - Live synchronized countdown timer anchored to server expiration timestamp.
  - Question navigation palette with answered, unanswered, and bookmarked filters.
  - Debounced auto-save on answer change with local offline queue fallback.
  - Full-screen enforcement, tab-switch detection, and keyboard shortcut interception.
- **Submission & Results**: Immediate idempotent submission with score calculation and breakdown.

### Faculty / Invigilator Role
- **Exam Management**:
  - Multi-step Exam Creation Wizard (Title, duration, schedules, audience assignments).
  - Question authoring supporting single-choice, multi-select, positive, negative, and partial marks.
  - AI-assisted question generation grounded in uploaded PDF course material.
  - Safe Exam Browser security settings configuration.
- **Live Invigilator Console**:
  - Real-time candidate roster grid with active attempt statuses (`IN_PROGRESS`, `SUBMITTED`, `SUSPENDED`).
  - Live webcam snapshot stream updated periodically via WebSockets.
  - Real-time malpractice alerts for tab switches, fullscreen exit, and multi-face detections.
  - Active proctor interventions: Pause attempt, resume attempt, or terminate attempt with reason.
- **Submission & Review**: Review flagged attempts, inspect photographic violation evidence, and approve identity overrides.

### Institutional Administrator Role
- **User Management**: Approve pending faculty/student registrations, modify roles, and suspend malicious accounts.
- **Global SEB Configuration**: Manage institutional Safe Exam Browser config files and cryptographic exam keys.
- **Audit & Analytics**: System-wide exam logs, candidate violation audit trails, and server health telemetry.

---

## 4. Production Integrations

1. **AWS S3**: Direct pre-signed upload policies and secure read URLs for reference photos, identity cards, and violation snapshots.
2. **AWS Rekognition**: Biometric face comparison (`CompareFacesCommand`) matching live pre-check frames against reference photos with a 90% confidence threshold.
3. **Safe Exam Browser (SEB)**: Browser lockdown via HTTP header verification (`x-safeexambrowser-requesthash` and `x-safeexambrowser-configkeyhash`).
4. **Google Gemini (with OpenAI fallback)**: Document-grounded question generation from course PDFs (`gemini-3.5-flash` or `gpt-4o-mini`).
5. **Redis Pub/Sub**: WebSocket scaling across Socket.io instances and in-memory session token tracking.

---

## 5. Verified npm Scripts

### Root Workspace Scripts
- `dev`: Run both frontend and backend concurrently in development mode.
- `dev:backend`: Run backend development server with nodemon.
- `dev:frontend`: Run frontend Vite development server.
- `build`: Build frontend production assets with Vite.
- `db:migrate`: Run Prisma database migrations in development.
- `db:migrate:deploy`: Deploy pending Prisma database migrations to production.
- `db:seed`: Seed database with initial administrator account.
- `typecheck`: Run TypeScript typechecking across backend and frontend workspaces.
- `lint`: Run ESLint across frontend and backend.
- `test`: Run backend automated tests.
- `test:e2e`: Run Playwright end-to-end browser tests.
- `test:smoke`: Run Playwright tests tagged with `@smoke`.
- `test:all`: Run complete backend test suite and Playwright tests.
- `format`: Format codebase with Prettier.
- `format:check`: Verify codebase formatting without modifying files.

### Backend Scripts
- `start`: Run backend service with memory limits (`src/app.js`).
- `start:standard`: Run backend service with standard Node runtime.
- `pilot`: Run backend using pilot environment file (`.env.pilot`).
- `test`: Run backend unit and integration tests using Node built-in test runner.
- `lint`: Run ESLint on backend source files.
- `typecheck`: Typecheck backend JavaScript using JSDoc and `jsconfig.json`.
- `seed`: Run admin database seeder.
- `generate`: Generate Prisma Client JavaScript bindings.

### Frontend Scripts
- `dev`: Start Vite development server.
- `build`: Compile and bundle React frontend for production.
- `lint`: Run ESLint on frontend code.
- `typecheck`: Run TypeScript typecheck on frontend source.
- `preview`: Preview production Vite build locally.

---

## 6. Environment Variable Names

The following environment variables are recognized and validated across `.env.example` and `backend/src/shared/config.js`:

```text
PORT
NODE_ENV
DATABASE_URL
DIRECT_URL
REDIS_URL
JWT_SECRET
JWT_REFRESH_SECRET
CORS_ORIGIN
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET
REQUIRE_IDENTITY_VERIFICATION
FACE_MATCH_THRESHOLD
FACE_DRIVER
GEMINI_API_KEY
GEMINI_MODEL
OPENAI_API_KEY
OPENAI_MODEL
AI_MAX_QUESTIONS_PER_RUN
AI_MAX_PDF_PAGES
AI_DAILY_QUESTION_QUOTA_PER_USER
AI_MIN_SUBSTANTIVE_WORDS
SEB_CONFIG_KEY
SEB_ENFORCE_MODE
APP_URL
VITE_API_URL
```

---

## 7. Current Deployment Architecture

- **Hosting Platform**: Single-node AWS EC2 instance running Ubuntu Linux.
- **Process Management**: Systemd services for Node.js backend processes with automatic restart.
- **Reverse Proxy & TLS**: Caddy web server terminating SSL/TLS with automatic Let's Encrypt certificates and reverse-proxying API / WebSocket traffic.
- **Remote Operations**: Zero-SSH AWS Systems Manager (SSM) command dispatch with automated pre-flight checks, live database backup, zero-downtime cutover, and automated rollback safeguarding.
- **Database**: Remote PostgreSQL database connected via pooling and direct migration URLs.

---

## 8. Test Coverage Overview

- **Backend Tests (54 test suites under `backend/tests/`)**:
  - Authentication lifecycle, token expiration, password security, and onboarding guards.
  - Exam creation validation, scheduling, and timezone handling.
  - Safe Exam Browser config key exchange, token validation, and header security.
  - Proctoring pipeline buffering, violation severity mapping, and camera cadence.
  - State persistence, answer autosave, concurrent race conditions, and scoring accuracy.
  - AI document-grounded question generator fixtures and rate quotas.
- **E2E Playwright Tests (25 test suites under `e2e/`)**:
  - Complete user journeys for Student, Faculty, Invigilator, and Administrator.
  - Real browser verification of hardware check, exam arena, palette navigation, and auto-submit.
  - Invigilator live console telemetry and manual interventions.
  - Safe Exam Browser simulated handoff journeys.

---

## 9. Comprehensive Stale-Term Audit

The following table lists all detected occurrences of legacy or disallowed terms across repository files:

| Target Stale Term | File Path | Line | Context Snippet |
| :--- | :--- | :--- | :--- |
| `Companion` | `.agents/skills/exam-platform-terminology/glossary.md` | 95 | `| Desktop app | Agent, Device agent, Companion, BYOD client | UI only |` |
| `Flask` | `.agents/skills/exam-platform-terminology/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `DeepFace` | `.agents/skills/exam-platform-terminology/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `OpenCV` | `.agents/skills/exam-platform-terminology/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `WebRTC` | `.agents/skills/exam-platform-terminology/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `RabbitMQ` | `.agents/skills/exam-platform-terminology/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `WebRTC` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 44 | `phrase: WebRTC` |
| `RabbitMQ` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 48 | `phrase: RabbitMQ` |
| `Cloudinary` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 52 | `phrase: Cloudinary` |
| `DeepFace` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 55 | `phrase: DeepFace` |
| `OpenCV` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 56 | `phrase: OpenCV` |
| `Flask` | `.agents/skills/exam-platform-terminology/references/deny-list.txt` | 58 | `phrase: Flask` |
| `Companion` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 95 | `| Desktop app | Agent, Device agent, Companion, BYOD client | UI only |` |
| `Flask` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `DeepFace` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `OpenCV` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `WebRTC` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `RabbitMQ` | `.agents/skills/exam-platform-terminology/references/glossary.md` | 170 | `- **Technology names:** WebRTC, Socket, SFU, Redis, RabbitMQ, Prisma, Postgres, S3, EC2, DeepFace, OpenCV, Tesseract, Fl` |
| `RabbitMQ` | `.env` | 38 | `# RabbitMQ Message Broker (RabbitMQ 3.12)` |
| `RabbitMQ` | `.env` | 40 | `RABBITMQ_USER=proctornet_user` |
| `RabbitMQ` | `.env` | 42 | `RABBITMQ_PASSWORD=replace_with_strong_random_rabbitmq_password_32_chars` |
| `RabbitMQ` | `.env` | 43 | `RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672` |
| `MinIO` | `.env` | 54 | `# Object Storage (AWS S3 or Local Dev MinIO)` |
| `MinIO` | `.env` | 61 | `# Local MinIO dev profile only:` |
| `MinIO` | `.env` | 62 | `MINIO_ROOT_USER=minioadmin` |
| `MinIO` | `.env` | 63 | `MINIO_ROOT_PASSWORD=replace_with_strong_minio_root_password_32_chars` |
| `WebRTC` | `.env` | 68 | `# LiveKit SFU WebRTC Media Server` |
| `LiveKit` | `.env` | 68 | `# LiveKit SFU WebRTC Media Server` |
| `LiveKit` | `.env` | 71 | `LIVEKIT_API_KEY=replace_with_livekit_api_key_32_hex` |
| `LiveKit` | `.env` | 73 | `LIVEKIT_API_SECRET=replace_with_livekit_api_secret_at_least_32_bytes` |
| `LiveKit` | `.env` | 74 | `LIVEKIT_URL=wss://exam.university.edu/livekit` |
| `WireGuard` | `.env` | 77 | `# WireGuard VPN Module (Flag-Gated: default false)` |
| `WireGuard` | `.env` | 85 | `VPN_AGENT_SOCKET=/var/run/wireguard/vpn-agent.sock` |
| `RabbitMQ` | `.env.rehearsal` | 26 | `# RabbitMQ` |
| `RabbitMQ` | `.env.rehearsal` | 27 | `RABBITMQ_DEFAULT_USER=proctornet` |
| `RabbitMQ` | `.env.rehearsal` | 28 | `RABBITMQ_DEFAULT_PASS=daaf54f52d01ddf8f0cf13e73ec6c0738c6ae772b66bd8c9` |
| `RabbitMQ` | `.env.rehearsal` | 29 | `RABBITMQ_URL=amqp://proctornet:daaf54f52d01ddf8f0cf13e73ec6c0738c6ae772b66bd8c9@rabbitmq:5672` |
| `MinIO` | `backend/.env` | 16 | `AWS_ACCESS_KEY_ID=minioadmin` |
| `MinIO` | `backend/.env` | 17 | `AWS_SECRET_ACCESS_KEY=minioadmin` |
| `MinIO` | `backend/.env.dev` | 12 | `# Storage (Local MinIO or Mock)` |
| `MinIO` | `backend/.env.dev` | 16 | `AWS_ACCESS_KEY_ID=minioadmin` |
| `MinIO` | `backend/.env.dev` | 17 | `AWS_SECRET_ACCESS_KEY=minioadmin` |
| `MinIO` | `backend/.env.example` | 30 | `# For local MinIO S3 emulation:` |
| `LiveKit` | `backend/package-lock.json` | 47 | `"livekit-server-sdk": "^2.19.1",` |
| `LiveKit` | `backend/package-lock.json` | 476 | `"livekit-client": "^2.22.3",` |
| `LiveKit` | `backend/package-lock.json` | 2027 | `"node_modules/@livekit/mutex": {` |
| `LiveKit` | `backend/package-lock.json` | 2029 | `"resolved": "https://registry.npmjs.org/@livekit/mutex/-/mutex-1.1.1.tgz",` |
| `LiveKit` | `backend/package-lock.json` | 2033 | `"node_modules/@livekit/protocol": {` |
| `LiveKit` | `backend/package-lock.json` | 2035 | `"resolved": "https://registry.npmjs.org/@livekit/protocol/-/protocol-1.51.0.tgz",` |
| `LiveKit` | `backend/package-lock.json` | 8043 | `"node_modules/livekit-client": {` |
| `LiveKit` | `backend/package-lock.json` | 8045 | `"resolved": "https://registry.npmjs.org/livekit-client/-/livekit-client-2.22.3.tgz",` |
| `LiveKit` | `backend/package-lock.json` | 8049 | `"@livekit/mutex": "1.1.1",` |
| `LiveKit` | `backend/package-lock.json` | 8050 | `"@livekit/protocol": "1.50.4",` |
| `WebRTC` | `backend/package-lock.json` | 8058 | `"webrtc-adapter": "9.0.6"` |
| `LiveKit` | `backend/package-lock.json` | 8064 | `"node_modules/livekit-client/node_modules/@livekit/protocol": {` |
| `LiveKit` | `backend/package-lock.json` | 8066 | `"resolved": "https://registry.npmjs.org/@livekit/protocol/-/protocol-1.50.4.tgz",` |
| `LiveKit` | `backend/package-lock.json` | 8073 | `"node_modules/livekit-client/node_modules/jose": {` |
| `LiveKit` | `backend/package-lock.json` | 8082 | `"node_modules/livekit-server-sdk": {` |
| `LiveKit` | `backend/package-lock.json` | 8084 | `"resolved": "https://registry.npmjs.org/livekit-server-sdk/-/livekit-server-sdk-2.19.1.tgz",` |
| `LiveKit` | `backend/package-lock.json` | 8089 | `"@livekit/protocol": "1.51.0",` |
| `WebRTC` | `backend/package-lock.json` | 10742 | `"node_modules/webrtc-adapter": {` |
| `WebRTC` | `backend/package-lock.json` | 10744 | `"resolved": "https://registry.npmjs.org/webrtc-adapter/-/webrtc-adapter-9.0.6.tgz",` |
| `proctornet/` | `backend/scripts/ops/backup-postgres.sh` | 9 | `BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"` |
| `proctornet/` | `backend/scripts/ops/crontab.example` | 3 | `# Environment variables must be sourced from /opt/proctornet/.env.production` |
| `proctornet/` | `backend/scripts/ops/crontab.example` | 7 | `0 2 * * * proctornet . /opt/proctornet/.env.production && /opt/proctornet/current/scripts/ops/backup-postgres.sh >> /var` |
| `staging` | `backend/scripts/ops/init-env.js` | 7 | `* Bootstraps a production or staging environment file ON the host machine:` |
| `staging` | `backend/scripts/ops/init-env.js` | 16 | `*   node scripts/ops/init-env.js [--staging] [--domain <domain>] [--env <path>] [--s3-bucket <name>] [--force]` |
| `staging` | `backend/scripts/ops/init-env.js` | 26 | `isStaging: false,` |
| `staging` | `backend/scripts/ops/init-env.js` | 39 | `if (arg === '--staging') {` |
| `staging` | `backend/scripts/ops/init-env.js` | 40 | `flags.isStaging = true` |
| `staging` | `backend/scripts/ops/init-env.js` | 64 | `const isStaging = Boolean(options.isStaging)` |
| `staging` | `backend/scripts/ops/init-env.js` | 65 | `const defaultDomain = isStaging ? 'staging.proctornet.duckdns.org' : 'proctornet.duckdns.org'` |
| `staging` | `backend/scripts/ops/init-env.js` | 68 | `const dbName = isStaging ? 'proctornet_staging' : 'proctornet'` |
| `staging` | `backend/scripts/ops/init-env.js` | 69 | `const sebMode = options.sebMode || (isStaging ? 'log' : 'enforce')` |
| `staging` | `backend/scripts/ops/init-env.js` | 70 | `const s3Bucket = options.s3Bucket || (isStaging ? 'REPLACE_ME' : 'REPLACE_ME')` |
| `staging` | `backend/scripts/ops/init-env.js` | 74 | `const defaultFileName = isStaging ? '.env.staging' : '.env.production'` |
| `staging` | `backend/scripts/ops/init-env.js` | 93 | `# ProctorNet ${isStaging ? 'Staging' : 'Production'} Environment Configuration` |
| `RabbitMQ` | `backend/scripts/ops/init-env.js` | 119 | `# RabbitMQ Message Broker (Group A generated)` |
| `RabbitMQ` | `backend/scripts/ops/init-env.js` | 120 | `RABBITMQ_DEFAULT_USER=proctornet` |
| `RabbitMQ` | `backend/scripts/ops/init-env.js` | 121 | `RABBITMQ_DEFAULT_PASS=${rabbitPass}` |
| `RabbitMQ` | `backend/scripts/ops/init-env.js` | 122 | `RABBITMQ_URL=amqp://proctornet:${rabbitPass}@rabbitmq:5672` |
| `staging` | `backend/scripts/ops/init-env.js` | 170 | `const preflight = preflightEnv(targetPath, { isProduction: !isStaging })` |
| `staging` | `backend/scripts/ops/init-env.js` | 174 | `isStaging,` |
| `staging` | `backend/scripts/ops/init-env.js` | 191 | `console.log(' Mode:        ' + (result.isStaging ? 'STAGING' : 'PRODUCTION'))` |
| `MinIO` | `backend/scripts/ops/preflight-env.js` | 202 | `if (ep.includes('localhost') || ep.includes('127.0.0.1') || ep.includes('::1') || ep.includes('minio')) {` |
| `MinIO` | `backend/scripts/ops/preflight-env.js` | 203 | `errors.push('Production S3_ENDPOINT must NOT point to local/MinIO services or mock storage address: ${envMap.S3_ENDPOINT` |
| `staging` | `backend/scripts/ops/preflight-env.js` | 253 | `console.log(' Mode:   ${result.isProduction ? 'PRODUCTION' : 'STAGING / NON-PRODUCTION'}')` |
| `proctornet/` | `backend/scripts/ops/restore-postgres-test.sh` | 10 | `BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"` |
| `Kubernetes` | `backend/scripts/ops/run-retention-cleanup.js` | 7 | `* Suitable for systemd timers, ECS scheduled tasks, or Kubernetes CronJobs.` |
| `proctornet/` | `backend/src/infra/postgres/assertNonProduction.js` | 4 | `* proctornet/backend/src/infra/postgres/assertNonProduction.js` |
| `MinIO` | `backend/src/infra/s3/s3.client.js` | 11 | `// In-memory mock store for CI and offline test environments without active MinIO/AWS S3` |
| `MinIO` | `backend/src/infra/s3/s3Adapter.js` | 39 | `* AWS SDK v3 Implementation using Default Credential Provider Chain (Instance Role) / MinIO` |
| `MinIO` | `backend/src/infra/s3/s3Adapter.js` | 64 | `// In non-production or when custom S3_ENDPOINT (e.g. MinIO) is provided, allow explicit static credentials` |
| `MinIO` | `backend/src/infra/s3/s3Adapter.js` | 72 | `// MinIO / S3 compatible endpoint` |
| `RabbitMQ` | `backend/src/lifecycle.js` | 59 | `const rmqMod = getLoadedModule('./infra/rabbitmq/client')` |
| `RabbitMQ` | `backend/src/lifecycle.js` | 60 | `if (rmqMod?.rabbitmq?.close) await rmqMod.rabbitmq.close().catch(() => {})` |
| `WireGuard` | `backend/src/modules/attempts/attempts.controller.js` | 152 | `// WireGuard VPN Hook check` |
| `maxViolations` | `backend/src/modules/exams/exams.guard.js` | 127 | `'maxViolations',` |
| `maxViolations` | `backend/src/modules/exams/exams.guard.js` | 190 | `// Phase 2 C.1: Accept and ignore legacy maxViolations, strip it from sanitized config` |
| `maxViolations` | `backend/src/modules/exams/exams.guard.js` | 191 | `delete sanitized.maxViolations` |
| `violation limit` | `backend/src/modules/exams/exams.service.js` | 60 | `// Remove request-only flag and deprecated violation limit if present` |
| `maxViolations` | `backend/src/modules/exams/exams.service.js` | 62 | `delete pConfig.maxViolations` |
| `screen share` | `backend/src/modules/media/media.routes.js` | 7 | `// Presigned S3 uploads for live snapshots & screen share evidence` |
| `MinIO` | `backend/src/shared/validateConfig.js` | 172 | `if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1') || endpoint.includes('::1') || endpoint.includes('m` |
| `MinIO` | `backend/src/shared/validateConfig.js` | 173 | `const msg = 'Production S3_ENDPOINT must NOT point to local/MinIO services or mock storage address: "${env.S3_ENDPOINT}"` |
| `screen share` | `backend/src/shared/violationTypes.js` | 108 | `"SCREEN_SHARE_ENDED": "Screen share ended (legacy)",` |
| `screen share` | `backend/src/shared/violationTypes.js` | 109 | `"SCREEN_SHARE_STOPPED": "Screen share ended (legacy)",` |
| `WireGuard` | `backend/tests/e2e_lifecycle.test.js` | 152 | `vpnActive = false // syncWireGuardRemovePeer executed` |
| `staging` | `backend/tests/init-env.test.js` | 22 | `'--staging',` |
| `staging` | `backend/tests/init-env.test.js` | 33 | `assert.strictEqual(flags.isStaging, true)` |
| `staging` | `backend/tests/init-env.test.js` | 51 | `assert.strictEqual(result.isStaging, false)` |
| `RabbitMQ` | `backend/tests/init-env.test.js` | 64 | `env.RABBITMQ_DEFAULT_PASS,` |
| `RabbitMQ` | `backend/tests/init-env.test.js` | 84 | `assert.ok(env.RABBITMQ_URL.includes(env.RABBITMQ_DEFAULT_PASS))` |
| `staging` | `backend/tests/init-env.test.js` | 87 | `test('3. initEnv staging configuration sets staging defaults and flags', () => {` |
| `staging` | `backend/tests/init-env.test.js` | 88 | `const targetFile = getTempTarget('staging')` |
| `staging` | `backend/tests/init-env.test.js` | 90 | `isStaging: true,` |
| `staging` | `backend/tests/init-env.test.js` | 95 | `assert.strictEqual(result.isStaging, true)` |
| `staging` | `backend/tests/init-env.test.js` | 99 | `assert.strictEqual(env.POSTGRES_DB, 'proctornet_staging')` |
| `staging` | `backend/tests/init-env.test.js` | 101 | `assert.strictEqual(env.PUBLIC_HOST, 'staging.proctornet.duckdns.org')` |
| `staging` | `backend/tests/init-env.test.js` | 102 | `assert.strictEqual(env.PUBLIC_ORIGIN, 'https://staging.proctornet.duckdns.org')` |
| `staging` | `backend/tests/init-env.test.js` | 163 | `'--staging',` |
| `staging` | `backend/tests/init-env.test.js` | 165 | `'--s3-bucket', 'staging-bucket-test',` |
| `RabbitMQ` | `backend/tests/init-env.test.js` | 179 | `assert.ok(!stdout.includes(env.RABBITMQ_DEFAULT_PASS), 'stdout must never print RABBITMQ_DEFAULT_PASS')` |
| `WebRTC` | `backend/tests/live_proctoring_pipeline.test.js` | 79 | `it('validates WebRTC camera stream mapping structure', () => {` |
| `screen share` | `backend/tests/p7-privacy-readiness-incidents.test.js` | 466 | `assert.strictEqual(legacyLog.displayLabel, 'Screen share ended (legacy)')` |
| `screen share` | `backend/tests/p7-privacy-readiness-incidents.test.js` | 515 | `assert.ok(attemptRes.rawText.includes('Screen share ended (legacy)'))` |
| `maxViolations` | `backend/tests/phase2-proctoring-redesign.test.js` | 67 | `maxViolations: 3 // Legacy field that should be ignored` |
| `maxViolations` | `backend/tests/phase2-proctoring-redesign.test.js` | 288 | `it('7. DTO Sanitization: maxViolations is stripped from toExamDto and ignored in guard', async () => {` |
| `maxViolations` | `backend/tests/phase2-proctoring-redesign.test.js` | 291 | `maxViolations: 5,` |
| `maxViolations` | `backend/tests/phase2-proctoring-redesign.test.js` | 294 | `assert.equal(sanitized.maxViolations, undefined)` |
| `maxViolations` | `backend/tests/phase2-proctoring-redesign.test.js` | 298 | `assert.equal(dto.proctoringConfig.maxViolations, undefined)` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 46 | `/Production S3_ENDPOINT must NOT point to local\/MinIO services/` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 54 | `/Production S3_ENDPOINT must NOT point to local\/MinIO services/` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 58 | `test('4. S3_ENDPOINT pointing to minio is strictly refused in production', () => {` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 59 | `const badConfig = { ...baseProdConfig, S3_ENDPOINT: 'http://minio:9000' }` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 62 | `/Production S3_ENDPOINT must NOT point to local\/MinIO services/` |
| `MinIO` | `backend/tests/storage-validation.test.js` | 96 | `assert.ok(result.errors.some(e => e.includes('Production S3_ENDPOINT must NOT point to local/MinIO services')))` |
| `screen share` | `backend/tests/violation-labels.test.js` | 11 | `it('formats SCREEN_SHARE_ENDED as "Screen share ended (legacy)"', () => {` |
| `screen share` | `backend/tests/violation-labels.test.js` | 12 | `assert.strictEqual(formatViolationType('SCREEN_SHARE_ENDED'), 'Screen share ended (legacy)')` |
| `screen share` | `backend/tests/violation-labels.test.js` | 15 | `it('formats SCREEN_SHARE_STOPPED as "Screen share ended (legacy)"', () => {` |
| `screen share` | `backend/tests/violation-labels.test.js` | 16 | `assert.strictEqual(formatViolationType('SCREEN_SHARE_STOPPED'), 'Screen share ended (legacy)')` |
| `screen share` | `CHANGELOG.md` | 29 | `- Legacy violation type compatibility mapping ('SCREEN_SHARE_ENDED' -> 'Screen share ended (legacy)').` |
| `WebRTC` | `CHANGELOG.md` | 48 | `- Refactored student pre-exam check into a streamlined 2-step verification flow (Identity Facial Verification -> Kiosk F` |
| `RabbitMQ` | `docs/adr/001-single-node-topology.md` | 21 | `- 'rabbitmq' (1 container): Durable queue with dead-letter queue (DLQ) and exponential backoff retry.` |
| `WebRTC` | `docs/adr/001-single-node-topology.md` | 22 | `- 'livekit' (1 container on host networking): High-performance Selective Forwarding Unit (SFU) for WebRTC media streams.` |
| `LiveKit` | `docs/adr/001-single-node-topology.md` | 22 | `- 'livekit' (1 container on host networking): High-performance Selective Forwarding Unit (SFU) for WebRTC media streams.` |
| `RabbitMQ` | `docs/adr/001-single-node-topology.md` | 40 | `Directly aligns with Notion 13.12 ("Phase 2 — Low-cost AWS / Co-located Topology"), where Redis and RabbitMQ are co-loca` |
| `LiveKit` | `docs/adr/005-camera-plus-screen-retained.md` | 16 | `- Both candidate camera and candidate screen tracks are published to the LiveKit SFU.` |
| `LiveKit` | `docs/adr/005-camera-plus-screen-retained.md` | 24 | `- Off-screen tiles in paginated grids are paused via LiveKit dynacast.` |
| `WebRTC` | `docs/adr/005-camera-plus-screen-retained.md` | 34 | `- Requires WebRTC simulcast support on student browsers.` |
| `staging` | `docs/adr/007-db-location.md` | 29 | `- Easily testable in local development, CI, and staging environments with identical database engines.` |
| `Flask` | `docs/adr/013-identity-verification-rekognition.md` | 11 | `1. **Unreliable On-Box Python Face Service**: A legacy Python Flask service loaded large computer vision models ('face_r` |
| `OpenCV` | `docs/adr/013-identity-verification-rekognition.md` | 11 | `1. **Unreliable On-Box Python Face Service**: A legacy Python Flask service loaded large computer vision models ('face_r` |
| `face_recognition` | `docs/adr/013-identity-verification-rekognition.md` | 11 | `1. **Unreliable On-Box Python Face Service**: A legacy Python Flask service loaded large computer vision models ('face_r` |
| `Cloudinary` | `docs/adr/013-identity-verification-rekognition.md` | 11 | `1. **Unreliable On-Box Python Face Service**: A legacy Python Flask service loaded large computer vision models ('face_r` |
| `Cloudinary` | `docs/adr/013-identity-verification-rekognition.md` | 68 | `- Remove 'cloudinary' from Python dependencies.` |
| `MinIO` | `docs/adr/SAFETY-001.md` | 33 | `Development machines must **never** connect directly to the production database. All local workflows, test runners, and ` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 16 | `[Primary: WebRTC P2P]             [Fallback: Socket.io Frames]` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 19 | `- Direct MediaStream rendering     - Throttled to 15s when WebRTC Live` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 26 | `|  - HTMLVideoElement (WebRTC Live) |` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 38 | `## 2. WebRTC & Socket.io Control-Plane Protocol` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 40 | `### WebRTC Signaling Sequence` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 42 | `2. Invigilator emits 'webrtc:request-stream' with '{ studentId, invId, examId }'.` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 44 | `4. Student creates an 'RTCPeerConnection', attaches camera track, generates SDP Offer, and emits 'webrtc:offer'.` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 45 | `5. Invigilator receives 'webrtc:offer', sets remote description, generates SDP Answer, and emits 'webrtc:answer'.` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 46 | `6. ICE candidates are exchanged bidirectionally ('webrtc:ice-candidate').` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 47 | `7. Invigilator receives 'pc.ontrack': assigns camera track to active stream registry ('window.activeWebRTCStreams') and ` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 48 | `8. 'WebcamFeed' binds stream to genuine '<video autoPlay playsInline muted>' element with live badge ('LIVE WEBRTC').` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 51 | `- While WebRTC is negotiating or disconnected, student transmits JPEG snapshots every 2.5s ('exam:frame').` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 53 | `- If WebRTC connection drops, the 2.5s fallback rate seamlessly resumes.` |
| `WireGuard` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 81 | `- Calls 'syncWireGuardRemovePeer(session.vpnKey)' to immediately revoke WireGuard VPN tunnel access.` |
| `WebRTC` | `docs/architecture/LIVE_PROCTORING_PIPELINE.md` | 86 | `- Closes WebRTC peer connections.` |
| `LiveKit` | `docs/architecture/media-capacity.md` | 1 | `# LiveKit SFU Media Capacity & Bandwidth Math (ADR-008 / Notion 13.10)` |
| `WebRTC` | `docs/architecture/media-capacity.md` | 5 | `In legacy WebRTC mesh architectures, bandwidth and decode loads grow quadratically:` |
| `LiveKit` | `docs/architecture/media-capacity.md` | 9 | `With **LiveKit Selective Forwarding Unit (SFU)**:` |
| `screen share` | `docs/architecture/media-capacity.md` | 19 | `- **Screen Share (VP8 Simulcast)**:` |
| `LiveKit` | `docs/architecture/media-capacity.md` | 40 | `> **EC2 Bandwidth Baseline vs Burst**: When choosing AWS EC2 instances for LiveKit, ensure the **baseline** network band` |
| `LiveKit` | `docs/architecture/media-capacity.md` | 69 | `LiveKit SFU CPU usage is bound by UDP packet forwarding:` |
| `RabbitMQ` | `docs/architecture/overview.md` | 10 | `ProctorNet employs a **single-node topology with horizontally ready modular boundaries**. All external web traffic termi` |
| `WebRTC` | `docs/architecture/overview.md` | 15 | `User -->|WebRTC / UDP :7882| LiveKit["LiveKit SFU (Host Network)"]` |
| `LiveKit` | `docs/architecture/overview.md` | 15 | `User -->|WebRTC / UDP :7882| LiveKit["LiveKit SFU (Host Network)"]` |
| `MinIO` | `docs/architecture/overview.md` | 16 | `User -->|Direct Presigned POST| S3["AWS S3 / MinIO Object Storage"]` |
| `RabbitMQ` | `docs/architecture/overview.md` | 32 | `API1 --> RabbitMQ[("RabbitMQ 3.12 (Event Bus)") ]` |
| `RabbitMQ` | `docs/architecture/overview.md` | 33 | `API2 --> RabbitMQ` |
| `RabbitMQ` | `docs/architecture/overview.md` | 36 | `Worker --> RabbitMQ` |
| `WireGuard` | `docs/architecture/overview.md` | 47 | `VPNAgent -.->|wg0 Kernel Interface| HostKernel["Host Kernel WireGuard"]` |
| `LiveKit` | `docs/architecture/overview.md` | 60 | `- **Zero-Trust Header Hardening**: Strict Content-Security-Policy (CSP) allowing only authorized origins (LiveKit WSS, S` |
| `RabbitMQ` | `docs/architecture/overview.md` | 66 | `- '/readyz': Readiness probe verifying PostgreSQL ('SELECT 1'), Redis ('PING'), and RabbitMQ exchange response within a ` |
| `RabbitMQ` | `docs/architecture/overview.md` | 70 | `- Consumes outbox events from RabbitMQ and executes heavy I/O operations outside the HTTP request path:` |
| `WireGuard` | `docs/architecture/overview.md` | 75 | `- 'vpnWorker' & 'vpnReconciler': WireGuard peer lifecycle management (flag-gated).` |
| `RabbitMQ` | `docs/architecture/overview.md` | 84 | `- **RabbitMQ 3.12**:` |
| `LiveKit` | `docs/architecture/overview.md` | 87 | `### 2.5 Media Plane ('livekit')` |
| `RabbitMQ` | `docs/architecture/overview.md` | 124 | `| **RabbitMQ Unreachable** | Outbox publishing paused | API commits events to PostgreSQL 'outbox_events' table inside tr` |
| `WebRTC` | `docs/architecture/scale-resilience-roadmap.md` | 3 | `> **Phase C8 Deliverable**: Definitive architectural roadmap addressing concurrency bounds, capacity tiers, burst handli` |
| `WebRTC` | `docs/architecture/scale-resilience-roadmap.md` | 14 | `| **Lite Profile** | 1–2 vCPU, 1–2 GB RAM (e.g. AWS t3.micro / t4g.small), external PostgreSQL | **80 – 100** *(Measured` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 15 | `| **Standard Profile** | 4–8 vCPU, 8–16 GB RAM (e.g. AWS c6i.2xlarge), dedicated internal Redis 7 + RabbitMQ 3.12 | **50` |
| `RabbitMQ` | `docs/architecture/scale-resilience-roadmap.md` | 15 | `| **Standard Profile** | 4–8 vCPU, 8–16 GB RAM (e.g. AWS c6i.2xlarge), dedicated internal Redis 7 + RabbitMQ 3.12 | **50` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 16 | `| **Multi-Node Cluster** | AWS Application Load Balancer + Auto Scaling Group ($\ge 2$ API nodes), RDS Aurora PostgreSQL` |
| `WebRTC` | `docs/architecture/scale-resilience-roadmap.md` | 55 | `## 3. Pillar 2: Firewalled Networks & WebRTC Traversal` |
| `WebRTC` | `docs/architecture/scale-resilience-roadmap.md` | 57 | `Institutional firewalls often block UDP WebRTC ports (7880-7882).` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 60 | `- 'MEDIA_DRIVER=livekit': Standard profile for high-bandwidth environments.` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 64 | `- For LiveKit deployments, embedded TURN handles NAT traversal:` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 67 | `- For 443-only corporate networks, SNI proxying on port 443 routes TLS traffic directly to LiveKit TURN.` |
| `Companion` | `docs/architecture/scale-resilience-roadmap.md` | 105 | `The database table registering SHA-256 binary signatures for companion desktop agents is named **'agent_releases'** *(no` |
| `Companion` | `docs/architecture/scale-resilience-roadmap.md` | 119 | `| 'POST /api/v1/agent/report' | HMAC-SHA256 authenticated desktop companion telemetry ingestion | 'src/modules/agent/' |` |
| `LiveKit` | `docs/architecture/scale-resilience-roadmap.md` | 120 | `| 'MEDIA_DRIVER=snapshot\|livekit' | Dual video driver support (low-bandwidth WebP snapshots vs LiveKit SFU) | 'src/infr` |
| `RabbitMQ` | `docs/architecture/scale-resilience-roadmap.md` | 121 | `| 'QUEUE_DRIVER=postgres\|rabbitmq' | Multi-driver queue with in-process 'SKIP LOCKED' outbox dispatcher | 'src/infra/po` |
| `WireGuard` | `docs/architecture/scale-resilience-roadmap.md` | 123 | `| 'IPAM / vpn_ip_pool' | WireGuard $O(1)$ lease/release allocation with advisory locks | 'src/modules/vpn/' |` |
| `WebRTC` | `docs/architecture/scale-resilience-roadmap.md` | 136 | `| **8-Second ICE Fallback** | Automated diagnostic timeout falling back from WebRTC UDP/TCP to snapshot driver when ICE ` |
| `staging` | `docs/ci/INVENTORY.md` | 4 | `**Target:** CI Pipeline Modernization & Staging/Production Deployment Alignment` |
| `proctornet/` | `docs/ci/INVENTORY.md` | 123 | `- Working directory: '/opt/proctornet/current/backend'.` |
| `proctornet/` | `docs/ci/INVENTORY.md` | 125 | `- Caddy reverse-proxies '/api/*' and '/socket.io/*' to '127.0.0.1:5000', and serves static frontend SPA assets directly ` |
| `proctornet/` | `docs/ci/INVENTORY.md` | 130 | `- Release tarballs pushed to S3 -> AWS SSM command triggers deployment script on EC2 -> directory symlink swapped to '/o` |
| `staging` | `docs/ci/README.md` | 119 | `### Staging Deployment ('.github/workflows/cd-staging.yml')` |
| `staging` | `docs/ci/README.md` | 121 | `* **Target**: Staging environment ('staging.proctornet.duckdns.org').` |
| `staging` | `docs/ci/README.md` | 124 | `2. Pushes container images to GitHub Container Registry ('ghcr.io/repository/backend:<SHA>' and ':staging').` |
| `staging` | `docs/ci/README.md` | 126 | `4. Stores current tag in '/opt/proctornet-staging/ACTIVE_TAG'.` |
| `proctornet/` | `docs/ci/README.md` | 140 | `4. Records existing active tag in '/opt/proctornet/ACTIVE_TAG'.` |
| `proctornet/` | `docs/ci/README.md` | 175 | `cat /opt/proctornet/ACTIVE_TAG` |
| `staging` | `docs/ci/SECRETS.md` | 13 | `| 'AWS_ACCESS_KEY_ID' | 'cd-staging.yml', 'cd-production.yml' | AWS IAM user access key used by 'aws-actions/configure-a` |
| `staging` | `docs/ci/SECRETS.md` | 14 | `| 'AWS_SECRET_ACCESS_KEY' | 'cd-staging.yml', 'cd-production.yml' | AWS IAM secret access key corresponding to 'AWS_ACCE` |
| `staging` | `docs/ci/SECRETS.md` | 15 | `| 'AWS_ROLE_TO_ASSUME' | 'cd-staging.yml', 'cd-production.yml' | (Optional) AWS IAM Role ARN for OIDC-based federation i` |
| `staging` | `docs/ci/SECRETS.md` | 17 | `| 'AWS_EC2_STAGING_INSTANCE_ID' | 'cd-staging.yml' | (Optional) The AWS EC2 Instance ID hosting staging. Falls back to '` |
| `staging` | `docs/ci/SECRETS.md` | 23 | `Environment-scoped secrets are injected only into jobs executing inside protected environments ('staging' or 'production` |
| `staging` | `docs/ci/SECRETS.md` | 25 | `### Staging Environment ('staging')` |
| `staging` | `docs/ci/SECRETS.md` | 28 | `| 'DATABASE_URL' | Staging | Connection string for staging PostgreSQL ('postgresql://...'). |` |
| `staging` | `docs/ci/SECRETS.md` | 29 | `| 'DIRECT_URL' | Staging | Direct unpooled connection string for staging Prisma migrations. |` |
| `staging` | `docs/ci/SECRETS.md` | 30 | `| 'REDIS_URL' | Staging | Connection string for staging Redis instance ('redis://:...@host:port'). |` |
| `staging` | `docs/ci/SECRETS.md` | 31 | `| 'JWT_SECRET' | Staging | Cryptographic secret for signing staging session JWTs ($\ge 32$ chars). |` |
| `staging` | `docs/ci/SECRETS.md` | 32 | `| 'SEB_LINK_SECRET' | Staging | Secret for HMAC token generation on one-click SEB launch links ($\ge 32$ chars). |` |
| `staging` | `docs/ci/SECRETS.md` | 33 | `| 'SEB_CONFIG_KEY' | Staging | (Optional) 64-character hex fallback Safe Exam Browser Config Key. |` |
| `staging` | `docs/ci/SECRETS.md` | 34 | `| 'PUBLIC_ORIGIN' | Staging | Canonical external origin (e.g., 'https://staging.proctornet.duckdns.org'). |` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 57 | `Client: SebPinEntryPage (PIN submission)` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 59 | `├──> POST /api/v1/seb/exchange-pin (with { pin: "124486" })` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 61 | `│      ├──> seb.routes.js:72 (router.post('/exchange-pin', ...))` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 85 | `└──> Student Retries With Same PIN:` |
| `launch code` | `docs/ops/AUDIT_2026-11-18.md` | 87 | `SebPinEntryPage renders: "This launch code has already been used. Please generate a new one."` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 94 | `Nov 18 09:45:07 ip-10-0-1-104 node[220645]: {"level":"warn","msg":"SEB enforcement failed on PIN exchange: invalid or mi` |
| `PIN` | `docs/ops/AUDIT_2026-11-18.md` | 141 | `- In Phase 1, 'exchangePin' will be refactored so that the PIN is validated first, but marked consumed ONLY AFTER the cr` |
| `violation limit` | `docs/ops/AUDIT_2026-11-18.md` | 196 | `2. **Elimination of Violation Limits**:` |
| `maxViolations` | `docs/ops/AUDIT_2026-11-18.md` | 197 | `- 'grep' audit for 'maxViolations', 'excessive violations', and auto-termination thresholds returned 0 functional occurr` |
| `Flask` | `docs/ops/AUDIT_2026-11-18.md` | 204 | `- 'README.md' reflects the current PostgreSQL 16 + Node.js 22 + React 19 + S3 architecture. Legacy references to Flask, ` |
| `DeepFace` | `docs/ops/AUDIT_2026-11-18.md` | 204 | `- 'README.md' reflects the current PostgreSQL 16 + Node.js 22 + React 19 + S3 architecture. Legacy references to Flask, ` |
| `Cloudinary` | `docs/ops/AUDIT_2026-11-18.md` | 204 | `- 'README.md' reflects the current PostgreSQL 16 + Node.js 22 + React 19 + S3 architecture. Legacy references to Flask, ` |
| `WebRTC` | `docs/ops/AUDIT_2026-11-18.md` | 204 | `- 'README.md' reflects the current PostgreSQL 16 + Node.js 22 + React 19 + S3 architecture. Legacy references to Flask, ` |
| `WireGuard` | `docs/ops/AUDIT_2026-11-18.md` | 204 | `- 'README.md' reflects the current PostgreSQL 16 + Node.js 22 + React 19 + S3 architecture. Legacy references to Flask, ` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 16 | `"msg": "SEB enforcement failed on PIN exchange: invalid or mismatch header hash",` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 24 | `* **Endpoint**: 'POST /api/v1/seb/exchange-pin'` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 34 | `'POST /api/v1/seb/exchange-pin' arrives at [backend/src/modules/seb/seb.controller.js#L574-L680](file:///c:/Final%20year` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 36 | `Lines 634–635 evaluate 'isEnforce = sebState.effectiveMode === 'enforce' || sebState.requestedMode === 'enforce''. Since` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 55 | `| **(5) BEK / Starter Key Code Path** | Check if backend still accepts BEK header or starter key | 'verifySebHeaderHash'` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 59 | `**Hypothesis (3) and (4) hold**: The client's SEB runtime was launched using the starter config with Config Key '4b04249` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 65 | `### Code Comparison: '/seb/ping' vs '/seb/exchange-pin'` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 80 | `* Students execute '/seb/exchange' or '/seb/exchange-pin', which strictly evaluates the incoming request against 'active` |
| `PIN` | `docs/ops/AUDIT_2026-11-19.md` | 193 | `The SEB entry failure occurred because token/PIN exchange endpoints ('/seb/exchange' and '/seb/exchange-pin') strictly e` |
| `PIN` | `docs/ops/AUDIT_2026-11-22.md` | 78 | `5. The student view displayed a dead-end error with only "Return to Dashboard", failing to present the PIN code fallback` |
| `PIN` | `docs/ops/AUDIT_2026-11-22.md` | 105 | `| **(g)** | Code change in launch or start-page code bypassed the code form | Compare auto-exchange logic with PIN form ` |
| `PIN` | `docs/ops/AUDIT_2026-11-22.md` | 106 | `| **(h)** | Start page showing error state instead of form | Inspect 'StudentExamStartPage.jsx' error mapping for 403 'C` |
| `proctornet/` | `docs/ops/AUDIT_2026-11-23_AI_GENERATION.md` | 36 | `| H1 | 'GEMINI_API_KEY' was missing, empty, or unreadable in '/opt/proctornet/shared/.env'. | Inspected environment via ` |
| `proctornet/` | `docs/ops/AUDIT_2026-11-23_AI_GENERATION.md` | 131 | `- Backup: '/opt/proctornet/backups/postgres/pre_deploy_v1.3.0_1795408329.dump' (598,847 bytes)` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 1 | `# Root Cause Investigation & Audit: Safe Exam Browser Handoff & PIN Removal` |
| `launch code` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 3 | `**Incident Reference:** SEB Launch Code "Already Used" on Student Launch` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 4 | `**Investigation Branch:** 'fix/seb-handoff-and-remove-pin'` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 10 | `- **Symptom:** After launching an exam from the website via Safe Exam Browser, SEB presented a fallback PIN input form. ` |
| `launch code` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 10 | `- **Symptom:** After launching an exam from the website via Safe Exam Browser, SEB presented a fallback PIN input form. ` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 13 | `2. Completely remove the 6-digit PIN system across the entire application stack.` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 27 | `| **12:56:06.015** | Backend API | Session Issuance & Token Consumption | 'SUCCESS' | 'setAuthCookie' issued JWTs. 'sebT` |
| `launch code` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 30 | `| **12:56:09.120** | Frontend SPA | Error State Transition | Error View Rendered | 'StudentExamStartPage' caught 403 and` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 31 | `| **12:56:14.209** | Caddy / Backend | 'POST /api/v1/seb/exchange-pin' | '409 Conflict' | Candidate typed the 6-digit PI` |
| `launch code` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 31 | `| **12:56:14.209** | Caddy / Backend | 'POST /api/v1/seb/exchange-pin' | '409 Conflict' | Candidate typed the 6-digit PI` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 41 | `| **H3** | Two separate launches were created, and the second launch invalidated the first launch's token/PIN. | Inspect` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 42 | `| **H4** | The initial automated exchange at '12:56:06' atomically consumed both the token and the PIN, so subsequent ma` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 43 | `| **H5** | A failure on '/student/exams/:id/start' incorrectly displayed the fallback PIN entry form to an already-authe` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 51 | `The initial automated token exchange ('GET /api/v1/seb/exchange?launch=...') succeeded and marked the entire launch reco` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 53 | `2. **Unnecessary PIN System Complexity:**` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 54 | `The 6-digit PIN system was originally built as a fallback for SEB versions that did not forward query parameters. Howeve` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 63 | `1. **Remove PIN System Completely:**` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 64 | `- Eliminate PIN generation, storage, and hashing in 'sebToken.service.js'.` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 65 | `- Remove '/api/v1/seb/exchange-pin' endpoint and router definitions.` |
| `PIN` | `docs/ops/AUDIT_2026-11-23_SEB_HANDOFF.md` | 67 | `- Remove PIN display, copy button, and "asks for a code" panels from 'StudentExamStartPage.jsx', 'AdminSebConfigPage.jsx` |
| `RabbitMQ` | `docs/ops/CLEANUP_REPORT.md` | 16 | `| 'amqp-connection-manager' | RabbitMQ broker library. RabbitMQ was replaced by Postgres pg-boss queue. | 'grep -r "amqp` |
| `LiveKit` | `docs/ops/CLEANUP_REPORT.md` | 17 | `| 'livekit-server-sdk' | LiveKit SFU server SDK. Live media plane migrated to snapshot stream + SEB. | 'grep -r "livekit` |
| `WebRTC` | `docs/ops/CLEANUP_REPORT.md` | 38 | `| 'livekit-client' | LiveKit WebRTC client. LiveKit plane removed in favor of snapshot proctoring. | 'grep -r "livekit-c` |
| `LiveKit` | `docs/ops/CLEANUP_REPORT.md` | 38 | `| 'livekit-client' | LiveKit WebRTC client. LiveKit plane removed in favor of snapshot proctoring. | 'grep -r "livekit-c` |
| `LiveKit` | `docs/ops/CLEANUP_REPORT.md` | 48 | `- **'POST /internal/livekit/webhook'**: Lines 65-76 in 'backend/src/app.js' call 'mediaService.handleWebhook(rawBody, au` |
| `RabbitMQ` | `docs/ops/CLEANUP_REPORT.md` | 57 | `- 'backend/scripts/ops/dlq-replay.js': Replay script for RabbitMQ dead-letter exchange (dead technology).` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 61 | `## 3. Staging & Obsolete Deployment Artifacts` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 63 | `The live environment is bare-metal lite (host Caddy, systemd 'proctornet.service', Supabase PostgreSQL). The following f` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 65 | `1. '.github/workflows/cd-staging.yml' — Automated staging CD. Fails due to container tag naming, and staging instance 'i` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 68 | `4. 'docker-compose.staging.yml' (already deleted) & 'docker-compose.rehearsal.yml'.` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 71 | `7. 'scripts/ops/aws-provision-staging.ps1', 'scripts/ops/aws-provision-staging.sh', 'scripts/ops/bootstrap-remote-stagin` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 72 | `8. 'docs/ops/STAGING_DEPLOY.md' & 'docs/ops/DEPLOY_CHECKLIST_STAGING.md'.` |
| `WireGuard` | `docs/ops/CLEANUP_REPORT.md` | 73 | `9. 'docs/runbooks/vpn.md' & 'docs/adr/010-vpn-default-off.md' — WireGuard VPN module was deprecated and removed.` |
| `RabbitMQ` | `docs/ops/CLEANUP_REPORT.md` | 80 | `- 'RABBITMQ_DEFAULT_USER', 'RABBITMQ_DEFAULT_PASS', 'RABBITMQ_URL' — Obsolete; RabbitMQ is not used.` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 81 | `- '.env.staging.example' — Obsolete; staging environment has been terminated.` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 114 | `1. **Commit 1:** Remove obsolete staging & container deploy workflows, docs, and scripts.` |
| `LiveKit` | `docs/ops/CLEANUP_REPORT.md` | 115 | `2. **Commit 2:** Remove dead backend files, dead '/internal/livekit/webhook' route, dead '/api/v1/agent' handlers, and d` |
| `staging` | `docs/ops/CLEANUP_REPORT.md` | 117 | `4. **Commit 4:** Clean '.env.example', '.env.production.example', and delete '.env.staging.example'.` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 111 | `- **Active Release Directory**: '/opt/proctornet/releases/release-ace92878effc7d9b335f7877d98d685b7a6fed39'` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 112 | `- **Current Symlink**: '/opt/proctornet/current -> /opt/proctornet/releases/release-ace92878effc7d9b335f7877d98d685b7a6f` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 198 | `- **Active Release Directory**: '/opt/proctornet/releases/release-c3fb95349adf6a7d9113bee73305359f1822ade6'` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 199 | `- **Current Symlink**: '/opt/proctornet/current -> /opt/proctornet/releases/release-c3fb95349adf6a7d9113bee73305359f1822` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 242 | `- **Active Release Directory**: '/opt/proctornet/releases/release-5a46abfb2172d364ef2f5541ccd1a1976821f2f2'` |
| `proctornet/` | `docs/ops/DEPLOY_LOG.md` | 243 | `- **Current Symlink**: '/opt/proctornet/current -> /opt/proctornet/releases/release-5a46abfb2172d364ef2f5541ccd1a1976821` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 17 | `| **Release Path** | '/opt/proctornet/releases/release-185e4cb3bc...' | '/opt/proctornet/releases/release-<HEAD_SHA>' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 18 | `| **Symlink** | '/opt/proctornet/current -> release-185e4cb...' | Atomically switched ('ln -sfn') to new release |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 19 | `| **Static Assets** | '/opt/proctornet/current/frontend/dist' | Built production bundle in new release directory |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 34 | `- Package new release into '/opt/proctornet/releases/release-<SHA>'.` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 35 | `- Run 'preflight-env.js' on target server against '/opt/proctornet/shared/.env'.` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 47 | `- Enforce file permissions: 'chmod 600 /opt/proctornet/shared/.env' (owned by 'proctornet:proctornet').` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 64 | `- Atomically switch symlink: 'ln -sfn /opt/proctornet/releases/release-<SHA> /opt/proctornet/current'.` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 92 | `ln -sfn /opt/proctornet/releases/release-185e4cb3bc7882547b9d6eb25a24f989cfa7efa7 /opt/proctornet/current` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 106 | `| 'PUBLIC_ORIGIN' | Missing (had 'FRONTEND_URL') | '/opt/proctornet/shared/.env' | 'https://proctornet.duckdns.org' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 107 | `| 'ALLOWED_ORIGINS' | Missing | '/opt/proctornet/shared/.env' | 'https://proctornet.duckdns.org' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 108 | `| 'JWT_REFRESH_SECRET'| Missing | '/opt/proctornet/shared/.env' | Server-generated 'openssl rand -hex 32' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 109 | `| 'SEB_LINK_SECRET' | Missing | '/opt/proctornet/shared/.env' | Server-generated 'openssl rand -hex 32' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 110 | `| 'SEB_MODE' | Missing | '/opt/proctornet/shared/.env' | Set to 'log' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 111 | `| 'SEB_PRE_DOWNLOAD_MINUTES' | Missing | '/opt/proctornet/shared/.env' | Default '30' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 112 | `| 'SUPPORT_URL' | Missing | '/opt/proctornet/shared/.env' | 'https://proctornet.duckdns.org' |` |
| `proctornet/` | `docs/ops/DEPLOY_PLAN_PROD.md` | 113 | `| 'SEB_DOWNLOAD_URL' | Missing | '/opt/proctornet/shared/.env' | 'https://safeexambrowser.org/download_en.html' |` |
| `proctornet/` | `docs/ops/DEPLOY_PROGRESS.md` | 17 | `| **Phase 2: Variables & Environment Hardening** | Deploy new release directory on server, run 'preflight-env.js', gener` |
| `WebRTC` | `docs/ops/FINDINGS_2026-11-16.md` | 16 | `4. **Camera Streaming & Periodic Capture Inventory:** Complete catalog of all continuous camera capture components, WebR` |
| `WebRTC` | `docs/ops/FINDINGS_2026-11-16.md` | 141 | `1. **WebRTC Hooks & Global References:**` |
| `proctornet/` | `docs/ops/GO_LIVE_CHECKLIST.md` | 21 | `- Command: 'node scripts/ops/preflight-env.js /opt/proctornet/shared/.env --prod'` |
| `staging` | `docs/ops/GO_LIVE_CHECKLIST.md` | 59 | `The following verification steps **CANNOT** be automated and require human operators to perform on staging or production` |
| `PIN` | `docs/ops/RELEASE_v1.4.0.md` | 19 | `### Phase 1: PIN Exchange & Entry Hardening (PR #56 / 'b505d8a')` |
| `PIN` | `docs/ops/RELEASE_v1.4.0.md` | 20 | `- **Key Validation Precedence**: Fixed bug where PIN exchange consumed launch tokens before verifying request headers or` |
| `launch code` | `docs/ops/RELEASE_v1.4.0.md` | 20 | `- **Key Validation Precedence**: Fixed bug where PIN exchange consumed launch tokens before verifying request headers or` |
| `proctornet/` | `docs/ops/RELEASE_v1.4.0.md` | 134 | `--parameters 'commands=["bash /opt/proctornet/scripts/ops/remote/automated-rollback.sh"]' '` |
| `PIN` | `docs/ops/RELEASE_v1.4.0.md` | 197 | `| **5** | In the standard browser tab, observe the **6-digit Launch Code** modal. | A 6-digit PIN is displayed clearly w` |
| `launch code` | `docs/ops/RELEASE_v1.4.0.md` | 197 | `| **5** | In the standard browser tab, observe the **6-digit Launch Code** modal. | A 6-digit PIN is displayed clearly w` |
| `launch code` | `docs/ops/RELEASE_v1.4.0.md` | 198 | `| **6** | Switch to the Safe Exam Browser window. | SEB opens to 'https://proctornet.duckdns.org/seb/enter' showing the ` |
| `launch code` | `docs/ops/RELEASE_v1.4.0.md` | 199 | `| **7** | Enter the 6-digit code in SEB and click **Continue to exam**. | Code is verified; SEB transitions smoothly int` |
| `PIN` | `docs/ops/RELEASE_v1.5.0.md` | 17 | `- The PIN exchange endpoint ('POST /api/v1/seb/exchange') is no longer blocked by missing or mismatched 'x-safeexambrows` |
| `PIN` | `docs/ops/RELEASE_v1.5.0.md` | 19 | `- PIN exchange now authenticates student identity via temporary launch code, issues a cryptographically signed SEB sessi` |
| `launch code` | `docs/ops/RELEASE_v1.5.0.md` | 19 | `- PIN exchange now authenticates student identity via temporary launch code, issues a cryptographically signed SEB sessi` |
| `WebRTC` | `docs/ops/RELEASE_v1.5.0.md` | 31 | `- Addressed Windows SEB 3.10.3 configuration tool GUI behavior where webcam controls rely on Chromium WebRTC engine defa` |
| `PIN` | `docs/ops/RELEASE_v1.5.0.md` | 54 | `**Root Cause**: The PIN exchange route ('POST /api/v1/seb/exchange') performed strict header validation checking 'req.he` |
| `proctornet/` | `docs/ops/RELEASE_v1.5.0.md` | 66 | `2. Edit the shared environment file '/opt/proctornet/shared/.env':` |
| `proctornet/` | `docs/ops/RELEASE_v1.5.0.md` | 68 | `sudo nano /opt/proctornet/shared/.env` |
| `PIN` | `docs/ops/RELEASE_v1.5.0.md` | 125 | `4. Verify SEB launches, transitions from launch splash to the student assessment lobby, and displays the PIN exchange co` |
| `PIN` | `docs/ops/RELEASE_v1.5.0.md` | 126 | `5. Enter the exam PIN and click **Begin Exam**.` |
| `proctornet/` | `docs/ops/RELEASE_v1.5.0.md` | 161 | `PREV_RELEASE=$(cat /opt/proctornet/releases/PREVIOUS_RELEASE)` |
| `proctornet/` | `docs/ops/RELEASE_v1.5.0.md` | 162 | `ln -sfn "$PREV_RELEASE" /opt/proctornet/current` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 14 | `- '/opt/proctornet/releases/release-<gitSha>/' — Versioned deployment releases containing backend, built frontend ('fron` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 15 | `- '/opt/proctornet/current' — Atomic symlink pointing to the currently active release directory.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 16 | `- '/opt/proctornet/releases/PREVIOUS_RELEASE' — Text record pointing to the previous release for one-click rollback.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 17 | `- '/opt/proctornet/shared/.env' — Master production environment variables and cryptographic secrets ('chmod 600').` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 18 | `- '/opt/proctornet/backups/postgres/' — Local storage for compressed PostgreSQL database dumps ('pg_dump -Fc').` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 19 | `- '/var/log/proctornet/' — Operational logs, including automated nightly backup logs ('backup.log').` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 22 | `- **Application Service:** 'proctornet.service' (systemd unit running '/opt/proctornet/current/backend/src/index.js' as ` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 55 | `- **Release Unpacking:** Downloads and unpacks archive to '/opt/proctornet/releases/release-<gitSha>'.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 59 | `- **Atomic Symlink Cutover:** Updates '/opt/proctornet/current' symlink.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 87 | `PREV=$(cat /opt/proctornet/releases/PREVIOUS_RELEASE)` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 90 | `ln -sfn "$PREV" /opt/proctornet/current` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 109 | `- **Script:** '/opt/proctornet/current/scripts/ops/backup-postgres.sh'.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 117 | `tail -n 30 /var/log/proctornet/backup.log` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 122 | `sudo -u proctornet /opt/proctornet/current/scripts/ops/backup-postgres.sh` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 130 | `ls -la /opt/proctornet/backups/postgres/` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 151 | `. /opt/proctornet/shared/.env` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 192 | `1. Open '/opt/proctornet/shared/.env'.` |
| `proctornet/` | `docs/ops/RUNBOOK.md` | 202 | `1. Update '/opt/proctornet/shared/.env' to 'SEB_MODE=enforce'.` |
| `WebRTC` | `docs/ops/UI_COPY_CHANGES.md` | 5 | `- **Removed**: Legacy WebRTC screen sharing ('getDisplayMedia'), "entire screen" capture prompts, 3-step pre-checks, des` |
| `WireGuard` | `docs/ops/UI_COPY_CHANGES.md` | 5 | `- **Removed**: Legacy WebRTC screen sharing ('getDisplayMedia'), "entire screen" capture prompts, 3-step pre-checks, des` |
| `Companion` | `docs/ops/UI_COPY_CHANGES.md` | 5 | `- **Removed**: Legacy WebRTC screen sharing ('getDisplayMedia'), "entire screen" capture prompts, 3-step pre-checks, des` |
| `violation limit` | `docs/ops/UI_COPY_CHANGES.md` | 45 | `- 'COPY.student.instructions': 5 core candidate rules (camera, one-tab, server timer, autosave, violation limit).` |
| `RabbitMQ` | `docs/ops/VARIABLES.md` | 13 | `| **Group A** | **Generated on Server** | Cryptographically generated with 'crypto.randomBytes'; never printed to termin` |
| `staging` | `docs/ops/VARIABLES.md` | 15 | `| **Group C** | **Get from AWS** | Cloud infrastructure identifiers obtained from AWS Console, IAM, or Terraform/CloudFo` |
| `staging` | `docs/ops/VARIABLES.md` | 17 | `| **Group E** | **GitHub-Only CI/CD** | Pipeline authorization tokens and branch deployment flags stored in GitHub Actio` |
| `staging` | `docs/ops/VARIABLES.md` | 19 | `| **Group G** | **Forbidden in Production** | Debug flags, mock drivers, and bypass switches that MUST NEVER be enabled ` |
| `staging` | `docs/ops/VARIABLES.md` | 27 | `| **'JWT_SECRET'** | 'backend/src/shared/config.js'<br>'backend/src/shared/validateConfig.js'<br>'backend/src/utils/jwt.` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 27 | `| **'JWT_SECRET'** | 'backend/src/shared/config.js'<br>'backend/src/shared/validateConfig.js'<br>'backend/src/utils/jwt.` |
| `staging` | `docs/ops/VARIABLES.md` | 28 | `| **'JWT_REFRESH_SECRET'** | 'backend/src/shared/config.js'<br>'backend/src/shared/validateConfig.js'<br>'backend/src/mo` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 28 | `| **'JWT_REFRESH_SECRET'** | 'backend/src/shared/config.js'<br>'backend/src/shared/validateConfig.js'<br>'backend/src/mo` |
| `staging` | `docs/ops/VARIABLES.md` | 29 | `| **'SEB_LINK_SECRET'** | 'backend/src/modules/seb/sebToken.js'<br>'backend/src/shared/config.js'<br>'backend/src/shared` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 29 | `| **'SEB_LINK_SECRET'** | 'backend/src/modules/seb/sebToken.js'<br>'backend/src/shared/config.js'<br>'backend/src/shared` |
| `staging` | `docs/ops/VARIABLES.md` | 30 | `| **'POSTGRES_PASSWORD'** | 'docker-compose.prod.yml'<br>'scripts/ops/backup-postgres.js' | Staging, Prod | None | Secre` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 30 | `| **'POSTGRES_PASSWORD'** | 'docker-compose.prod.yml'<br>'scripts/ops/backup-postgres.js' | Staging, Prod | None | Secre` |
| `staging` | `docs/ops/VARIABLES.md` | 31 | `| **'REDIS_PASSWORD'** | 'docker-compose.prod.yml'<br>'backend/src/shared/config.js' | Staging, Prod | None | Secret | S` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 31 | `| **'REDIS_PASSWORD'** | 'docker-compose.prod.yml'<br>'backend/src/shared/config.js' | Staging, Prod | None | Secret | S` |
| `RabbitMQ` | `docs/ops/VARIABLES.md` | 32 | `| **'RABBITMQ_DEFAULT_PASS'** | 'docker-compose.prod.yml' | Staging, Prod | None | Secret | Server env '/opt/proctornet/` |
| `staging` | `docs/ops/VARIABLES.md` | 32 | `| **'RABBITMQ_DEFAULT_PASS'** | 'docker-compose.prod.yml' | Staging, Prod | None | Secret | Server env '/opt/proctornet/` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 32 | `| **'RABBITMQ_DEFAULT_PASS'** | 'docker-compose.prod.yml' | Staging, Prod | None | Secret | Server env '/opt/proctornet/` |
| `staging` | `docs/ops/VARIABLES.md` | 33 | `| **'PII_ENCRYPTION_KEY'** | 'backend/src/utils/crypto.js' | Staging, Prod | None | Secret | Server env '/opt/proctornet` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 33 | `| **'PII_ENCRYPTION_KEY'** | 'backend/src/utils/crypto.js' | Staging, Prod | None | Secret | Server env '/opt/proctornet` |
| `staging` | `docs/ops/VARIABLES.md` | 34 | `| **'PUBLIC_ORIGIN'** | 'backend/src/middleware/security.js'<br>'backend/src/shared/config.js'<br>'scripts/ops/preflight` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 34 | `| **'PUBLIC_ORIGIN'** | 'backend/src/middleware/security.js'<br>'backend/src/shared/config.js'<br>'scripts/ops/preflight` |
| `staging` | `docs/ops/VARIABLES.md` | 35 | `| **'PUBLIC_HOST'** | 'docker-compose.prod.yml'<br>'ops/caddy/Caddyfile' | Staging, Prod | 'proctornet.duckdns.org' | Pu` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 35 | `| **'PUBLIC_HOST'** | 'docker-compose.prod.yml'<br>'ops/caddy/Caddyfile' | Staging, Prod | 'proctornet.duckdns.org' | Pu` |
| `staging` | `docs/ops/VARIABLES.md` | 36 | `| **'RETENTION_DAYS'** | 'backend/src/jobs/retentionJob.js'<br>'scripts/ops/backup-postgres.js' | Staging, Prod | '90' |` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 36 | `| **'RETENTION_DAYS'** | 'backend/src/jobs/retentionJob.js'<br>'scripts/ops/backup-postgres.js' | Staging, Prod | '90' |` |
| `staging` | `docs/ops/VARIABLES.md` | 37 | `| **'SEB_MODE'** | 'backend/src/middleware/seb.js'<br>'backend/src/shared/config.js'<br>'backend/src/shared/validateConf` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 37 | `| **'SEB_MODE'** | 'backend/src/middleware/seb.js'<br>'backend/src/shared/config.js'<br>'backend/src/shared/validateConf` |
| `staging` | `docs/ops/VARIABLES.md` | 38 | `| **'AWS_REGION'** | 'backend/src/infra/s3/s3.client.js'<br>'backend/src/shared/validateConfig.js' | Staging, Prod | 'ap` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 38 | `| **'AWS_REGION'** | 'backend/src/infra/s3/s3.client.js'<br>'backend/src/shared/validateConfig.js' | Staging, Prod | 'ap` |
| `staging` | `docs/ops/VARIABLES.md` | 39 | `| **'S3_BUCKET'** | 'backend/src/infra/s3/s3.client.js'<br>'backend/src/shared/validateConfig.js'<br>'docker-compose.pro` |
| `proctornet/` | `docs/ops/VARIABLES.md` | 39 | `| **'S3_BUCKET'** | 'backend/src/infra/s3/s3.client.js'<br>'backend/src/shared/validateConfig.js'<br>'docker-compose.pro` |
| `staging` | `docs/ops/VARIABLES.md` | 40 | `| **'AWS_ACCESS_KEY_ID'** | 'backend/src/infra/s3/s3Adapter.js'<br>'.github/workflows/deploy-aws.yml' | Staging, Prod | ` |
| `staging` | `docs/ops/VARIABLES.md` | 41 | `| **'AWS_SECRET_ACCESS_KEY'** | 'backend/src/infra/s3/s3Adapter.js'<br>'.github/workflows/deploy-aws.yml' | Staging, Pro` |
| `staging` | `docs/ops/VARIABLES.md` | 42 | `| **'AWS_ROLE_TO_ASSUME'** | '.github/workflows/cd-staging.yml'<br>'.github/workflows/cd-production.yml' | CI/CD | None ` |
| `staging` | `docs/ops/VARIABLES.md` | 43 | `| **'AWS_EC2_STAGING_INSTANCE_ID'** | '.github/workflows/cd-staging.yml' | CI/CD | None | Secret | GitHub Repository Sec` |
| `staging` | `docs/ops/VARIABLES.md` | 45 | `| **'STAGING_ENABLED'** | '.github/workflows/cd-staging.yml' | CI/CD | 'true' | Config | GitHub -> Settings -> Environme` |
| `staging` | `docs/ops/VARIABLES.md` | 46 | `| **'SEB_CONFIG_KEY'** | 'backend/src/modules/exams/exams.service.js'<br>'docker-compose.prod.yml' | Staging, Prod | Non` |
| `staging` | `docs/ops/VARIABLES.md` | 63 | `| **JWT Secrets in Production** | '.env.example' listed only 'JWT_SECRET', omitting 'JWT_REFRESH_SECRET' and 'SEB_LINK_S` |
| `LiveKit` | `docs/ops/VARIABLES.md` | 64 | `| **Legacy Stale Backend Variables** | 'backend/.env.example' contained 'PYTHON_SERVICE_URL', 'COMPREFACE_URL', 'LIVEKIT` |
| `staging` | `docs/ops/VARIABLES.md` | 65 | `| **Staging Compose Architecture** | Legacy docs referenced 'docker-compose.staging.yml' on port 8081 with Nginx. | Unif` |
| `staging` | `docs/ops/VARIABLES.md` | 75 | `# For Staging Deployment` |
| `staging` | `docs/ops/VARIABLES.md` | 76 | `node scripts/ops/init-env.js --staging --domain staging.proctornet.duckdns.org` |
| `proctornet/` | `docs/runbooks/backup-restore.md` | 34 | `0 2 * * * root docker compose -f /opt/proctornet/docker-compose.prod.yml exec -T postgres /bin/bash /opt/proctornet/ops/` |
| `staging` | `docs/runbooks/backup-restore.md` | 44 | `To restore a database snapshot into production or a staging verification environment:` |
| `MinIO` | `docs/runbooks/ci.md` | 24 | `Setup --> Integration[2. Integration: Postgres + MinIO + Boot Smoke]` |
| `MinIO` | `docs/runbooks/ci.md` | 34 | `- **'integration'**: Lite profile parity (Postgres 16 + MinIO), backend integration tests, boot smoke test.` |
| `MinIO` | `docs/runbooks/ci.md` | 80 | `# Starts Postgres & MinIO containers, applies migrations, runs verify + integration:` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 27 | `│   │   │  ├─ Static SPA: /opt/proctornet/current/proctornet/frontend/dist                │   │   │` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 223 | `3. Save configuration into '/opt/proctornet/shared/.env':` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 225 | `sudo -u proctornet nano /opt/proctornet/shared/.env` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 290 | `# [ROLLBACK] Reverting symlink to previous release: /opt/proctornet/releases/release-prev` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 303 | `0 2 * * * /opt/proctornet/current/ops/aws/scripts/backup-s3.sh proctornet-storage-prod-987654 >> /var/log/proctornet-bac` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 317 | `bash /opt/proctornet/current/ops/aws/scripts/restore-drill.sh` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 363 | `| 'disk-utilization-high' | 'ProctorNet/System' | 'disk_used_percent > 80%' | EBS storage near full | Alerts for EBS exp` |
| `proctornet/` | `docs/runbooks/deploy-aws.md` | 364 | `| 'memory-utilization-high' | 'ProctorNet/System' | 'mem_used_percent > 85%' | RAM capacity strained | Alerts for scalin` |
| `LiveKit` | `docs/runbooks/deploy-aws.md` | 377 | `For institutions requiring full multi-container redundancy (separate API replicas, Redis cluster, RabbitMQ broker, LiveK` |
| `RabbitMQ` | `docs/runbooks/deploy-aws.md` | 377 | `For institutions requiring full multi-container redundancy (separate API replicas, Redis cluster, RabbitMQ broker, LiveK` |
| `LiveKit` | `docs/runbooks/deploy.md` | 94 | `### 4.3 LiveKit API Credentials ('LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET')` |
| `LiveKit` | `docs/runbooks/deploy.md` | 99 | `2. Update 'ops/livekit/livekit.yaml' and '.env'.` |
| `LiveKit` | `docs/runbooks/deploy.md` | 100 | `3. Restart LiveKit container and backend pods.` |
| `proctornet/` | `docs/runbooks/incident.md` | 25 | `grep "Load shedding active" /var/log/proctornet/api.log` |
| `LiveKit` | `docs/runbooks/incident.md` | 88 | `## 4. LiveKit SFU Video Traversal / Media Dropouts` |
| `WebRTC` | `docs/runbooks/incident.md` | 92 | `- Candidates receive WebRTC connection failures.` |
| `LiveKit` | `docs/runbooks/incident.md` | 96 | `# Check LiveKit container logs` |
| `LiveKit` | `docs/runbooks/incident.md` | 97 | `docker compose -f docker-compose.prod.yml logs --tail=100 livekit` |
| `proctornet/` | `docs/runbooks/reset-prod.md` | 51 | `node proctornet/backend/scripts/ops/active-attempts.js` |
| `RabbitMQ` | `docs/runbooks/scale-up.md` | 56 | `ECS --> AmazonMQ[("Amazon MQ for RabbitMQ")]` |
| `WebRTC` | `docs/runbooks/scale-up.md` | 58 | `Client -->|UDP / WebRTC| SFUCluster["LiveKit SFU Autoscaling Cluster"]` |
| `LiveKit` | `docs/runbooks/scale-up.md` | 58 | `Client -->|UDP / WebRTC| SFUCluster["LiveKit SFU Autoscaling Cluster"]` |
| `LiveKit` | `docs/runbooks/scale-up.md` | 70 | `- **Zero Media Bytes on API**: Video media bypasses the application tier directly to LiveKit SFU; snapshot evidence bypa` |
| `proctornet/` | `docs/runbooks/secrets.md` | 9 | `ProctorNet production parameters are organized under the '/proctornet/prod/' path:` |
| `proctornet/` | `docs/runbooks/secrets.md` | 13 | `| '/proctornet/prod/LLM_PROVIDER' | 'String' | Provider identifier: 'openai', 'google', 'anthropic', or 'none' |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 14 | `| '/proctornet/prod/LLM_API_KEY' | 'SecureString' | Production API key for the LLM provider |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 15 | `| '/proctornet/prod/LLM_MODEL' | 'String' | Model identifier (e.g., 'gemini-3.5-flash', 'gpt-4o-mini') |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 16 | `| '/proctornet/prod/DATABASE_URL' | 'SecureString' | Production PostgreSQL connection string |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 17 | `| '/proctornet/prod/JWT_SECRET' | 'SecureString' | Primary JWT signing secret |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 18 | `| '/proctornet/prod/AUTH_EPOCH' | 'String' | Global authentication epoch counter (integer) |` |
| `proctornet/` | `docs/runbooks/secrets.md` | 30 | `--name "/proctornet/prod/LLM_PROVIDER" \` |
| `proctornet/` | `docs/runbooks/secrets.md` | 38 | `--name "/proctornet/prod/LLM_MODEL" \` |
| `proctornet/` | `docs/runbooks/secrets.md` | 52 | `--name "/proctornet/prod/LLM_API_KEY" \` |
| `proctornet/` | `docs/runbooks/secrets.md` | 81 | `2. Update '/proctornet/prod/DATABASE_URL' via 'aws ssm put-parameter --type SecureString --overwrite'.` |
| `proctornet/` | `docs/runbooks/secrets.md` | 86 | `2. Update '/proctornet/prod/JWT_SECRET'.` |
| `proctornet/` | `docs/runbooks/secrets.md` | 87 | `3. Increment '/proctornet/prod/AUTH_EPOCH' (invalidates all outstanding JWTs across all sessions).` |
| `proctornet/` | `docs/runbooks/secrets.md` | 97 | `--parameter-filters "Key=Name,Option=BeginsWith,Values=/proctornet/prod/" \` |
| `WebRTC` | `docs/seb/DECISIONS.md` | 40 | `## Decision 10: Removal of WebRTC Screen Sharing in Favor of Camera-Only Proctoring and Safe Exam Browser Lockdown` |
| `WebRTC` | `docs/seb/DECISIONS.md` | 41 | `- **Context:** WebRTC screen sharing ('getDisplayMedia') introduced continuous user UX friction (browser permission prom` |
| `WebRTC` | `docs/seb/DECISIONS.md` | 42 | `- **Decision:** Completely removed WebRTC screen sharing across the frontend and backend. Pre-exam verification is strea` |
| `screen share` | `docs/seb/DECISIONS.md` | 77 | `3. **Incident Review & Adjudication:** Per-attempt violation timelines display chronological events and snapshot preview` |
| `MinIO` | `docs/seb/DECISIONS.md` | 78 | `4. **Retention Policy & Scheduled Cleanup:** Configured default retention period ('RETENTION_DAYS=90'). A scheduled cron` |
| `staging` | `docs/seb/DECISIONS.md` | 85 | `2. **Preflight Environment Validation:** Implemented 'scripts/ops/preflight-env.js' and wired it into '.github/workflows` |
| `PIN` | `docs/seb/DECISIONS.md` | 112 | `- **Context:** Previously, the exchange endpoints ('/seb/exchange' and '/seb/exchange-pin') strictly enforced the 'X-Saf` |
| `PIN` | `docs/seb/DECISIONS.md` | 114 | `1. **Decoupled Exchange:** The launch-code and token exchange endpoints ('/seb/exchange' and '/seb/exchange-pin') create` |
| `launch code` | `docs/seb/DECISIONS.md` | 114 | `1. **Decoupled Exchange:** The launch-code and token exchange endpoints ('/seb/exchange' and '/seb/exchange-pin') create` |
| `proctornet/` | `docs/seb/LAUNCH_INCIDENT.md` | 60 | `- **Deployed Release Directory**: '/opt/proctornet/releases/release-4d5745e0873dec11601afd0255913606f9435cb1'` |
| `proctornet/` | `docs/seb/LAUNCH_INCIDENT.md` | 62 | `- **Route '/seb/enter' in Build**: Verified present in '/opt/proctornet/current/frontend/dist/assets/Dq8zqIWR.js' and 'A` |
| `PIN` | `docs/seb/LAUNCH_INCIDENT.md` | 63 | `- **Launch-Code Card in Build**: Verified present in '/opt/proctornet/current/frontend/dist/assets/BfdF8-r3.js' ('SebPin` |
| `launch code` | `docs/seb/LAUNCH_INCIDENT.md` | 63 | `- **Launch-Code Card in Build**: Verified present in '/opt/proctornet/current/frontend/dist/assets/BfdF8-r3.js' ('SebPin` |
| `proctornet/` | `docs/seb/LAUNCH_INCIDENT.md` | 63 | `- **Launch-Code Card in Build**: Verified present in '/opt/proctornet/current/frontend/dist/assets/BfdF8-r3.js' ('SebPin` |
| `MinIO` | `docs/SEB_PreFlight_Analysis.md` | 71 | `- Object Storage / S3 / MinIO: 'https://*.s3.ap-south-1.amazonaws.com', 'http://localhost:9000'` |
| `LiveKit` | `docs/SEB_PreFlight_Analysis.md` | 153 | `- **Repo Audit**: There is no active LiveKit client in 'frontend/src/' and no external WebSockets other than Socket.IO.` |
| `maxViolations` | `docs/SEB_PreFlight_Analysis.md` | 167 | `- Whitelist allowed fields in 'proctoringConfig' ('sebRequired', 'sebConfigKey', 'maxViolations', 'sebFileKey').` |
| `screen share` | `docs/SEB_PreFlight_Analysis.md` | 208 | `### Step 4 — Frontend Screen Share Removal & Camera Retention ('feat/seb-04-remove-screen-share')` |
| `screen share` | `docs/SEB_PreFlight_Analysis.md` | 211 | `- **E2E Spec Rewrites**: Note that existing tests exercising screen sharing ('phase6-lifecycle-edge-cases.spec.ts' Test ` |
| `proctornet/` | `docs/security/AUTHENTICATION_AND_SECURITY_HARDENING.md` | 20 | `### Central Cookie Helper ('proctornet/backend/src/utils/cookies.js')` |
| `proctornet/` | `docs/security/AUTHENTICATION_AND_SECURITY_HARDENING.md` | 50 | `### Backend Handshake Middleware ('proctornet/backend/src/sockets/exam.socket.js')` |
| `proctornet/` | `docs/security/AUTHENTICATION_AND_SECURITY_HARDENING.md` | 80 | `### Axios HTTP Client ('proctornet/frontend/src/utils/api.js')` |
| `proctornet/` | `docs/security/AUTHENTICATION_AND_SECURITY_HARDENING.md` | 92 | `### React Auth Context ('proctornet/frontend/src/context/AuthContext.jsx')` |
| `WireGuard` | `docs/security/AUTHENTICATION_AND_SECURITY_HARDENING.md` | 103 | `4. **Mandatory WireGuard Enforcement**: Pre-exam verification ensures student traffic routes over the encrypted WireGuar` |
| `screen share` | `docs/testing/TEST_AUDIT.md` | 15 | `- **Copy & Feature Alignment:** Validated that UI assertions match current enterprise design tokens ('#fbfcfd' canvas, '` |
| `WebRTC` | `docs/testing/TEST_AUDIT.md` | 51 | `| 'live_proctoring_pipeline.test.js' | 6 | **KEEP** | Verifies WebRTC/Socket.io proctoring event ingestion, anomaly scor` |
| `MinIO` | `docs/testing/TEST_AUDIT.md` | 58 | `| 'preflight-env.test.js' | 10 | **KEEP** | Verifies strict preflight checks: refuses 'S3_ENDPOINT' pointing to localhos` |
| `screen share` | `docs/testing/TEST_AUDIT.md` | 79 | `| 'violation-labels.test.js' | 5 | **KEEP** | Verifies legacy violation label formatting ('Screen share ended (legacy)')` |
| `proctornet/` | `docs/ux/TERMINOLOGY.md` | 10 | `4. **Consistency:** Terminology is standardized via 'proctornet/frontend/src/lib/labels.js' and enforced via static ratc` |
| `Companion` | `docs/ux/TERMINOLOGY.md` | 26 | `| **Pairing Token** | **Pairing Code** | Device companion code input | "Code" is intuitive; "token" is technical jargon.` |
| `Companion` | `docs/ux/TERMINOLOGY.md` | 37 | `- **Device Check:** "Exam Device Companion Audit"` |
| `LiveKit` | `e2e/helpers/guard.ts` | 23 | `text.includes('LiveKit') ||` |
| `screen share` | `e2e/invigilator-ops.spec.ts` | 122 | `test('Legacy violation types (e.g. SCREEN_SHARE_ENDED) render with label "Screen share ended (legacy)" in audit sheet', ` |
| `screen share` | `e2e/invigilator-ops.spec.ts` | 160 | `// Verify legacy violation renders friendly label "Screen share ended (legacy)"` |
| `screen share` | `e2e/invigilator-ops.spec.ts` | 161 | `await expect(invigilator.page.getByText('Screen share ended (legacy)')).toBeVisible({ timeout: 10000 })` |
| `screen share` | `e2e/privacy-readiness-incidents.spec.ts` | 143 | `await expect(facultyActor.page.getByText(/Screen share ended \(legacy\)/i)).toBeVisible()` |
| `WireGuard` | `frontend/.env` | 5 | `VITE_VPN_GUIDE_URL=https://wireguard.com/install` |
| `violation limit` | `frontend/src/components/faculty/ExamWizardStepSecurity.jsx` | 256 | `{/* Violation Limit */}` |
| `violation limit` | `frontend/src/copy/index.js` | 9 | `* - One-tab rule & violation limit (3 violations)` |
| `MinIO` | `frontend/src/lib/uploadHelper.js` | 36 | `// Direct S3 / MinIO PUT failed (e.g. offline dev, mock storage, or port 9000 unreachable)` |
| `screen share` | `frontend/src/shared/violationTypes.js` | 108 | `"SCREEN_SHARE_ENDED": "Screen share ended (legacy)",` |
| `screen share` | `frontend/src/shared/violationTypes.js` | 109 | `"SCREEN_SHARE_STOPPED": "Screen share ended (legacy)",` |
| `proctornet/` | `logs-deploy/check-current.sh` | 4 | `readlink -f /opt/proctornet/current || true` |
| `proctornet/` | `logs-deploy/check-current.sh` | 5 | `if [ -f /opt/proctornet/current/REVISION ]; then` |
| `proctornet/` | `logs-deploy/check-current.sh` | 6 | `echo "REVISION: $(cat /opt/proctornet/current/REVISION)"` |
| `proctornet/` | `logs-deploy/evidence-collection.sh` | 14 | `echo "--- S3/Storage variables in /opt/proctornet/shared/.env ---"` |
| `proctornet/` | `logs-deploy/evidence-collection.sh` | 15 | `if [ -f /opt/proctornet/shared/.env ]; then` |
| `MinIO` | `logs-deploy/evidence-collection.sh` | 16 | `grep -E "^(S3_|AWS_|STORAGE_|BUCKET|REGION|MINIO|MOCK)" /opt/proctornet/shared/.env | while IFS='=' read -r key val; do` |
| `proctornet/` | `logs-deploy/evidence-collection.sh` | 16 | `grep -E "^(S3_|AWS_|STORAGE_|BUCKET|REGION|MINIO|MOCK)" /opt/proctornet/shared/.env | while IFS='=' read -r key val; do` |
| `proctornet/` | `logs-deploy/evidence-collection.sh` | 30 | `echo "/opt/proctornet/shared/.env NOT FOUND"` |
| `proctornet/` | `logs-deploy/evidence-collection.sh` | 36 | `if grep -q "^${var}=" /opt/proctornet/shared/.env 2>/dev/null; then` |
| `MinIO` | `logs-deploy/evidence-collection.sh` | 45 | `systemctl show proctornet --property=Environment | tr ' ' '\n' | grep -E "(S3|AWS|STORAGE|BUCKET|REGION|MINIO|MOCK)" | w` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 3 | `echo "--- Searching for 9000 in /opt/proctornet/current ---"` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 4 | `grep -rn "9000" /opt/proctornet/current/backend/src/ || true` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 5 | `echo "--- Searching for S3_ENDPOINT in /opt/proctornet/current ---"` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 6 | `grep -rn "S3_ENDPOINT" /opt/proctornet/current/backend/src/ || true` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 7 | `echo "--- Searching for S3Client in /opt/proctornet/current ---"` |
| `proctornet/` | `logs-deploy/find-9000-remote.sh` | 8 | `grep -rn "new S3Client" /opt/proctornet/current/backend/src/ || true` |
| `proctornet/` | `logs-deploy/fix-server-config.sh` | 4 | `SHARED_ENV="/opt/proctornet/shared/.env"` |
| `proctornet/` | `logs-deploy/fix-server-config.sh` | 5 | `CURRENT_RELEASE=$(readlink -f /opt/proctornet/current)` |
| `MinIO` | `logs-deploy/fix-server-config.sh` | 14 | `# Remove S3_ENDPOINT, S3_MOCK, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, MINIO_*` |
| `MinIO` | `logs-deploy/fix-server-config.sh` | 17 | `sed -i '/^MINIO_/d' "$SHARED_ENV"` |
| `proctornet/` | `logs-deploy/query-launches.json` | 3 | `"cd /opt/proctornet/current/backend \u0026\u0026 NODE_ENV=production node -r dotenv/config -e \u0027const { prisma } = r` |
| `violation limit` | `README.md` | 246 | `IN_PROGRESS --> SUSPENDED: Invigilator Manual Action / Critical Violation Limit` |
| `Flask` | `scripts/docs/generate_facts.js` | 8 | `'Flask',` |
| `DeepFace` | `scripts/docs/generate_facts.js` | 9 | `'DeepFace',` |
| `OpenCV` | `scripts/docs/generate_facts.js` | 10 | `'OpenCV',` |
| `face_recognition` | `scripts/docs/generate_facts.js` | 11 | `'face_recognition',` |
| `Cloudinary` | `scripts/docs/generate_facts.js` | 12 | `'Cloudinary',` |
| `WebRTC` | `scripts/docs/generate_facts.js` | 13 | `'WebRTC',` |
| `screen share` | `scripts/docs/generate_facts.js` | 14 | `'screen share',` |
| `WireGuard` | `scripts/docs/generate_facts.js` | 15 | `'WireGuard',` |
| `LiveKit` | `scripts/docs/generate_facts.js` | 16 | `'LiveKit',` |
| `coturn` | `scripts/docs/generate_facts.js` | 17 | `'coturn',` |
| `MinIO` | `scripts/docs/generate_facts.js` | 18 | `'MinIO',` |
| `RabbitMQ` | `scripts/docs/generate_facts.js` | 19 | `'RabbitMQ',` |
| `Companion` | `scripts/docs/generate_facts.js` | 20 | `'Companion',` |
| `PIN` | `scripts/docs/generate_facts.js` | 21 | `'PIN',` |
| `launch code` | `scripts/docs/generate_facts.js` | 22 | `'launch code',` |
| `violation limit` | `scripts/docs/generate_facts.js` | 23 | `'violation limit',` |
| `maxViolations` | `scripts/docs/generate_facts.js` | 24 | `'maxViolations',` |
| `staging` | `scripts/docs/generate_facts.js` | 25 | `'staging',` |
| `Kubernetes` | `scripts/docs/generate_facts.js` | 26 | `'Kubernetes',` |
| `proctornet/` | `scripts/docs/generate_facts.js` | 27 | `'proctornet/'` |
| `PIN` | `scripts/docs/generate_facts.js` | 69 | `// For exact terms like PIN, avoid false positives in 'spin', 'pine', etc.` |
| `PIN` | `scripts/docs/generate_facts.js` | 71 | `if (term === 'PIN') {` |
| `PIN` | `scripts/docs/generate_facts.js` | 72 | `// Regex word boundary for PIN` |
| `proctornet/` | `scripts/ops/backup-postgres.sh` | 10 | `BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"` |
| `proctornet/` | `scripts/ops/check-env-vars.js` | 13 | `'grep -E "PUBLIC_ORIGIN|SEB" /opt/proctornet/shared/.env || true'` |
| `proctornet/` | `scripts/ops/check-exam-live.js` | 8 | `const script = 'cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '` |
| `proctornet/` | `scripts/ops/check-exam-live.js` | 38 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/check-preconditions-live.js` | 11 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/check-preconditions-live.js` | 43 | `const backupDir = "/opt/proctornet/backups/postgres";` |
| `proctornet/` | `scripts/ops/check-preconditions-live.js` | 74 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/check-seb-settings.js` | 13 | `'cd /opt/proctornet/current/backend',` |
| `proctornet/` | `scripts/ops/check-seb-settings.js` | 14 | `'set -a; . /opt/proctornet/shared/.env; set +a',` |
| `proctornet/` | `scripts/ops/crontab.example` | 3 | `# Environment variables must be sourced from /opt/proctornet/.env.production` |
| `proctornet/` | `scripts/ops/crontab.example` | 7 | `0 2 * * * proctornet . /opt/proctornet/.env.production && /opt/proctornet/current/scripts/ops/backup-postgres.sh >> /var` |
| `proctornet/` | `scripts/ops/deploy-prod.js` | 20 | `*    - Release extraction to /opt/proctornet/releases/release-${gitSha}` |
| `proctornet/` | `scripts/ops/deploy-prod.js` | 26 | `*    - Atomic symlink switch (/opt/proctornet/current)` |
| `staging` | `scripts/ops/init-env.js` | 7 | `* Bootstraps a production or staging environment file ON the host machine:` |
| `staging` | `scripts/ops/init-env.js` | 16 | `*   node scripts/ops/init-env.js [--staging] [--domain <domain>] [--env <path>] [--s3-bucket <name>] [--force]` |
| `staging` | `scripts/ops/init-env.js` | 26 | `isStaging: false,` |
| `staging` | `scripts/ops/init-env.js` | 39 | `if (arg === '--staging') {` |
| `staging` | `scripts/ops/init-env.js` | 40 | `flags.isStaging = true` |
| `staging` | `scripts/ops/init-env.js` | 64 | `const isStaging = Boolean(options.isStaging)` |
| `staging` | `scripts/ops/init-env.js` | 65 | `const defaultDomain = isStaging ? 'staging.proctornet.duckdns.org' : 'proctornet.duckdns.org'` |
| `staging` | `scripts/ops/init-env.js` | 68 | `const dbName = isStaging ? 'proctornet_staging' : 'proctornet'` |
| `staging` | `scripts/ops/init-env.js` | 69 | `const sebMode = options.sebMode || (isStaging ? 'log' : 'enforce')` |
| `staging` | `scripts/ops/init-env.js` | 70 | `const s3Bucket = options.s3Bucket || (isStaging ? 'REPLACE_ME' : 'REPLACE_ME')` |
| `staging` | `scripts/ops/init-env.js` | 74 | `const defaultFileName = isStaging ? '.env.staging' : '.env.production'` |
| `staging` | `scripts/ops/init-env.js` | 93 | `# ProctorNet ${isStaging ? 'Staging' : 'Production'} Environment Configuration` |
| `RabbitMQ` | `scripts/ops/init-env.js` | 119 | `# RabbitMQ Message Broker (Group A generated)` |
| `RabbitMQ` | `scripts/ops/init-env.js` | 120 | `RABBITMQ_DEFAULT_USER=proctornet` |
| `RabbitMQ` | `scripts/ops/init-env.js` | 121 | `RABBITMQ_DEFAULT_PASS=${rabbitPass}` |
| `RabbitMQ` | `scripts/ops/init-env.js` | 122 | `RABBITMQ_URL=amqp://proctornet:${rabbitPass}@rabbitmq:5672` |
| `staging` | `scripts/ops/init-env.js` | 170 | `const preflight = preflightEnv(targetPath, { isProduction: !isStaging })` |
| `staging` | `scripts/ops/init-env.js` | 174 | `isStaging,` |
| `staging` | `scripts/ops/init-env.js` | 191 | `console.log(' Mode:        ' + (result.isStaging ? 'STAGING' : 'PRODUCTION'))` |
| `proctornet/` | `scripts/ops/phase0-investigate.js` | 11 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/phase0-investigate.js` | 33 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/phase0-investigate.js` | 47 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/phase0-investigate.js` | 81 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `MinIO` | `scripts/ops/preflight-env.js` | 202 | `if (ep.includes('localhost') || ep.includes('127.0.0.1') || ep.includes('::1') || ep.includes('minio')) {` |
| `MinIO` | `scripts/ops/preflight-env.js` | 203 | `errors.push('Production S3_ENDPOINT must NOT point to local/MinIO services or mock storage address: ${envMap.S3_ENDPOINT` |
| `staging` | `scripts/ops/preflight-env.js` | 253 | `console.log(' Mode:   ${result.isProduction ? 'PRODUCTION' : 'STAGING / NON-PRODUCTION'}')` |
| `proctornet/` | `scripts/ops/query-logs.js` | 7 | `const script = 'cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '` |
| `proctornet/` | `scripts/ops/query-logs.js` | 20 | `' dotenv_config_path=/opt/proctornet/shared/.env';` |
| `proctornet/` | `scripts/ops/query-seb-activity.js` | 17 | `cd /opt/proctornet/current/backend && NODE_ENV=production node -r dotenv/config -e '` |
| `proctornet/` | `scripts/ops/query-seb-activity.js` | 44 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/check-backup-service.sh` | 8 | `if [ -f /var/log/proctornet/backup.log ]; then` |
| `proctornet/` | `scripts/ops/remote/check-backup-service.sh` | 9 | `cat /var/log/proctornet/backup.log` |
| `proctornet/` | `scripts/ops/remote/check-backup-service.sh` | 11 | `echo "No /var/log/proctornet/backup.log found."` |
| `proctornet/` | `scripts/ops/remote/check-backup-service.sh` | 15 | `su -s /bin/bash proctornet -c "set -a; . /opt/proctornet/shared/.env; set +a; /bin/bash /opt/proctornet/current/scripts/` |
| `proctornet/` | `scripts/ops/remote/check-cleanup-targets.sh` | 9 | `echo "--- 1. RELEASES IN /opt/proctornet/releases ---"` |
| `proctornet/` | `scripts/ops/remote/check-cleanup-targets.sh` | 10 | `CURRENT_RELEASE=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/check-cleanup-targets.sh` | 12 | `ls -ldt /opt/proctornet/releases/release-*` |
| `proctornet/` | `scripts/ops/remote/check-cleanup-targets.sh` | 20 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/check-cleanup-targets.sh` | 21 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 5 | `CURRENT_TARGET=$(readlink -f /opt/proctornet/current || echo "not-a-symlink")` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 8 | `if [ -d "/opt/proctornet/current" ]; then` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 10 | `ls -ld /opt/proctornet/current` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 11 | `if [ -d "/opt/proctornet/current/.git" ]; then` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 13 | `git -C /opt/proctornet/current rev-parse HEAD` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 14 | `elif [ -f "/opt/proctornet/current/RELEASE_COMMIT" ]; then` |
| `proctornet/` | `scripts/ops/remote/check-current-release.sh` | 16 | `cat /opt/proctornet/current/RELEASE_COMMIT` |
| `proctornet/` | `scripts/ops/remote/check-exam-student.sh` | 3 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/check-exam-student.sh` | 22 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/check-gemini-env.sh` | 2 | `grep GEMINI /opt/proctornet/shared/.env | cut -d'=' -f1` |
| `proctornet/` | `scripts/ops/remote/check-gemini-models.sh` | 4 | `. /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/check-live-exams.sh` | 3 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/check-live-exams.sh` | 24 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 9 | `echo "--- 1. ENVIRONMENT VARIABLES IN /opt/proctornet/shared/.env (NAMES & LENGTHS ONLY) ---"` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 10 | `if [ -f /opt/proctornet/shared/.env ]; then` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 18 | `done < /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 20 | `echo "ERROR: /opt/proctornet/shared/.env does not exist!"` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 25 | `CURRENT_TARGET=$(readlink -f /opt/proctornet/current || echo "not-a-symlink")` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 39 | `CURRENT_DIR=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 42 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 116 | `if [ -d /opt/proctornet/backups ]; then` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 117 | `ls -la /opt/proctornet/backups | tail -n 10` |
| `proctornet/` | `scripts/ops/remote/check-preflight-live.sh` | 119 | `echo "/opt/proctornet/backups does not exist."` |
| `proctornet/` | `scripts/ops/remote/check-prod-data.sh` | 4 | `CURRENT_DIR=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/check-prod-data.sh` | 7 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/check-seb-error.sh` | 18 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/check-seb-error.sh` | 19 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/check-seb-setting.sh` | 4 | `CURRENT_DIR=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/check-seb-setting.sh` | 7 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/clean-demo-accounts.sh` | 17 | `/opt/proctornet/current/scripts/ops/backup-postgres.sh || true` |
| `proctornet/` | `scripts/ops/remote/clean-demo-accounts.sh` | 21 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/debug-backup.sh` | 5 | `bash -x /opt/proctornet/current/scripts/ops/backup-postgres.sh || true` |
| `proctornet/` | `scripts/ops/remote/delete-test-data.sh` | 9 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/delete-test-data.sh` | 10 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/remote/fix-seb-mode-env-log.sh` | 3 | `sed -i 's/^SEB_MODE=.*/SEB_MODE=log/' /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/fix-seb-mode-env-log.sh` | 5 | `grep "^SEB_MODE=" /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/query-ref-id.sh` | 9 | `echo "=== Searching in /opt/proctornet/ logs ==="` |
| `proctornet/` | `scripts/ops/remote/query-ref-id.sh` | 10 | `grep -rn "ae97b547" /opt/proctornet/logs/ 2>/dev/null || echo "No matches in /opt/proctornet/logs"` |
| `proctornet/` | `scripts/ops/remote/run-ai-smoke-live.sh` | 3 | `cd /opt/proctornet/current` |
| `proctornet/` | `scripts/ops/remote/run-ai-smoke-live.sh` | 4 | `NODE_ENV=production node --env-file=/opt/proctornet/shared/.env scripts/ops/ai-smoke.js` |
| `proctornet/` | `scripts/ops/remote/run-automatic-cleanup.sh` | 11 | `cd /opt/proctornet/releases` |
| `proctornet/` | `scripts/ops/remote/run-automatic-cleanup.sh` | 12 | `CURRENT_TARGET=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/run-automatic-cleanup.sh` | 16 | `if [ -d "$old_release" ] && [ "/opt/proctornet/releases/$old_release" != "$CURRENT_TARGET" ]; then` |
| `proctornet/` | `scripts/ops/remote/run-automatic-cleanup.sh` | 23 | `ls -ld /opt/proctornet/releases/release-*` |
| `proctornet/` | `scripts/ops/remote/set-env-seb-mode-audit.sh` | 3 | `if grep -q "^SEB_MODE=" /opt/proctornet/shared/.env; then` |
| `proctornet/` | `scripts/ops/remote/set-env-seb-mode-audit.sh` | 4 | `sed -i 's/^SEB_MODE=.*/SEB_MODE=audit/' /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/set-env-seb-mode-audit.sh` | 6 | `echo "SEB_MODE=audit" >> /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/set-env-seb-mode-audit.sh` | 8 | `echo "Updated SEB_MODE in /opt/proctornet/shared/.env:"` |
| `proctornet/` | `scripts/ops/remote/set-env-seb-mode-audit.sh` | 9 | `grep "^SEB_MODE=" /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/test-gemini-call.sh` | 4 | `. /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/update-caddyfile-live.sh` | 105 | `root * /opt/proctornet/current/frontend/dist` |
| `proctornet/` | `scripts/ops/remote/update-caddyfile-live.sh` | 112 | `root * /opt/proctornet/current/frontend/dist` |
| `proctornet/` | `scripts/ops/remote/update-env-gemini-model.sh` | 3 | `if grep -q "^GEMINI_MODEL=" /opt/proctornet/shared/.env; then` |
| `proctornet/` | `scripts/ops/remote/update-env-gemini-model.sh` | 4 | `sed -i 's/^GEMINI_MODEL=.*/GEMINI_MODEL=gemini-3.5-flash/' /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/update-env-gemini-model.sh` | 6 | `echo "GEMINI_MODEL=gemini-3.5-flash" >> /opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/update-env-gemini-model.sh` | 8 | `echo "Updated GEMINI_MODEL in /opt/proctornet/shared/.env"` |
| `proctornet/` | `scripts/ops/remote/update-env-seb-mode.sh` | 4 | `ENV_FILE="/opt/proctornet/shared/.env"` |
| `proctornet/` | `scripts/ops/remote/update-env-seb-mode.sh` | 34 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/remote/update-env-seb-mode.sh` | 44 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `proctornet/` | `scripts/ops/remote/update-seb-config-key.sh` | 4 | `CURRENT_DIR=$(readlink -f /opt/proctornet/current)` |
| `proctornet/` | `scripts/ops/remote/update-seb-config-key.sh` | 7 | `node --env-file=/opt/proctornet/shared/.env -e "` |
| `proctornet/` | `scripts/ops/restore-postgres-test.sh` | 10 | `BACKUP_DIR="${BACKUP_DIR:-/opt/proctornet/backups/postgres}"` |
| `proctornet/` | `scripts/ops/rollback-prod.js` | 9 | `* Reverts the live production symlink (/opt/proctornet/current) to either:` |
| `proctornet/` | `scripts/ops/rollback-prod.js` | 11 | `* - The previously recorded release in /opt/proctornet/releases/PREVIOUS_RELEASE` |
| `proctornet/` | `scripts/ops/set-seb-mode.js` | 34 | `cd /opt/proctornet/current/backend` |
| `proctornet/` | `scripts/ops/set-seb-mode.js` | 96 | `' dotenv_config_path=/opt/proctornet/shared/.env` |
| `MinIO` | `scripts/ops/smoke-live.js` | 175 | `logCheck('CSP Header Sanitization', true, 'Verified: zero localhost/127.0.0.1/minio references in production CSP')` |
| `screen share` | `shared/violationTypes.js` | 108 | `"SCREEN_SHARE_ENDED": "Screen share ended (legacy)",` |
| `screen share` | `shared/violationTypes.js` | 109 | `"SCREEN_SHARE_STOPPED": "Screen share ended (legacy)",` |

---
