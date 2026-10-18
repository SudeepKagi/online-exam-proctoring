# ProctorNet: Online Examination & AI Proctoring Platform

ProctorNet is an enterprise-grade online examination and automated proctoring platform engineered for high-concurrency assessment delivery, sub-second cheat detection, and set-based atomic evaluation.

---

## 1. Architecture Overview

- **Frontend (`frontend/`)**: React 19 single-page application bundled with Vite. In production, static assets are pre-compressed (Gzip/Brotli) and served via unprivileged Nginx, which reverse-proxies `/api` and `/socket.io` to the backend.
- **Backend (`backend/`)**: Node.js (Express) application handling REST APIs, Socket.io dual-stream real-time telemetry, Zod payload validation, and server-authoritative timer enforcement.
- **Database (`PostgreSQL 16`)**: Relational database managed with Prisma ORM enforcing ACID compliance and set-based grading.
- **Cache & Real-Time Engine (`Redis 7`)**: Fast ephemeral state, rate-limiting counters, and Socket.io multi-process broadcast adapter.

---

## 2. Core Relational Schema (7 Tables)

1. **`users` (`User`)**: Identity management supporting `ADMIN`, `FACULTY`, `INVIGILATOR`, and `STUDENT` roles with password hashes and facial verification references.
2. **`exams` (`Exam`)**: Examination metadata, course codes, scheduling windows, duration, and proctoring configurations.
3. **`questions` (`Question`)**: Assessment items, MCQ option payloads, marks, negative mark penalization, and sequence display orders.
4. **`exam_assignments` (`ExamAssignment`)**: Role-scoped candidate enrollments and invigilator proctor rosters.
5. **`exam_attempts` (`ExamAttempt`)**: Candidate lifecycle state machine (`NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, `SUSPENDED`, `TIMED_OUT`), scores, and violation tally.
6. **`attempt_answers` (`AttemptAnswer`)**: Autosaved candidate choices, bookmark flags, and timestamps indexed uniquely on `(attempt_id, question_id)`.
7. **`proctoring_logs` (`ProctoringLog`)**: Candidate telemetry events (`TAB_SWITCH`, `FULLSCREEN_EXIT`), severity levels, evidence keys, and audit metadata.

---

## 3. Local Development

### Prerequisites
- Node.js `>= 22.0.0`
- PostgreSQL `16`
- Redis `7`

### Setup & Run
```bash
# 1. Clone repository and install dependencies
git clone https://github.com/SudeepKagi/online-exam-proctoring.git
cd online-exam-proctoring
npm install

# 2. Configure environment
cp .env.example .env

# 3. Apply Prisma migrations & seed administrative account
npx prisma migrate deploy --schema=backend/prisma/schema.prisma
npm run seed --workspace=backend

# 4. Start backend and frontend concurrently
npm run dev
```
- Frontend UI: `http://localhost:5173`
- Backend API: `http://localhost:5000` (Health: `http://localhost:5000/healthz`)

---

## 4. Testing & Quality Verification

```bash
# Run backend integration, unit, and concurrency penetration tests
npm test --workspace=backend

# Run Playwright End-to-End browser test suite
npm run test:e2e
```

---

## 5. Production Container Deployment

ProctorNet provides a production-hardened multi-stage Docker Compose stack:

```bash
# Single-command build and launch
docker compose up -d --build

# Verify container health
docker compose ps
curl http://localhost:4000/healthz
```
- Production Web Application: `http://localhost:80` (or `http://localhost:5173`)
- Production API Gateway: `http://localhost:4000`
