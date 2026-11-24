# ProctorNet Cleanup Report: Evidence & Audit

**Generated:** 2026-11-10  
**Target Branch:** `chore/cleanup`  
**Methodology:** Static analysis via `depcheck`, `knip`, AST grep, git tracked inventory, and live database query via AWS SSM.

---

## 1. Unused Dependencies & Proof

### 1.1 Backend Dependencies (`backend/package.json`)
The following packages were identified by `depcheck` (evidence in `test-results/depcheck-backend.txt`) and verified to have zero runtime imports in `backend/src/`:

| Package | Reason / Origin | Proof of Inactivity |
|---|---|---|
| `amqp-connection-manager` | RabbitMQ broker library. RabbitMQ was replaced by Postgres pg-boss queue. | `grep -r "amqp" backend/src` yields 0 matches. |
| `livekit-server-sdk` | LiveKit SFU server SDK. Live media plane migrated to snapshot stream + SEB. | `grep -r "livekit-server-sdk" backend/src` yields 0 matches. |
| `nodemailer` | Legacy SMTP email library. No emails are dispatched by application code. | `grep -r "nodemailer" backend/src` yields 0 matches. |
| `opossum` | Circuit breaker library. Unused; failover is handled via retry middleware. | `grep -r "opossum" backend/src` yields 0 matches. |
| `p-limit` | Concurrency throttling utility. Not imported in backend code. | `grep -r "p-limit" backend/src` yields 0 matches. |
| `pdf-lib` | PDF generation utility. Not imported in backend code. | `grep -r "pdf-lib" backend/src` yields 0 matches. |
| `pino` & `pino-http` | Fast logger. Replaced by `backend/src/shared/logging.js` (JSON-formatted standard logger). | Neither package is imported in `backend/src/shared/logging.js`. |
| `prom-client` | Prometheus client. App uses custom metrics counter in `backend/src/shared/metrics.js`. | `grep -r "prom-client" backend/src` yields 0 matches. |
| `rate-limiter-flexible` | Rate limiter. Application uses `express-rate-limit` exclusively. | `grep -r "rate-limiter-flexible" backend/src` yields 0 matches. |
| `ssh2` | SSH client library. Unused by backend application runtime. | `grep -r "ssh2" backend/src` yields 0 matches. |
| `tesseract.js` | Optical character recognition library for legacy ID scanning. | Accompanied by unused 5.2 MB training blob `backend/eng.traineddata`. Zero imports. |

### 1.2 Frontend Dependencies (`frontend/package.json`)
The following packages were identified by `depcheck` (evidence in `test-results/depcheck-frontend.txt`) and verified to have zero imports in `frontend/src/`:

| Package | Reason / Origin | Proof of Inactivity |
|---|---|---|
| `@dnd-kit/core`, `@dnd-kit/modifiers`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | Drag-and-drop question builder experiment. Question editor uses native form ordering. | `grep -r "@dnd-kit" frontend/src` yields 0 matches. |
| `@tabler/icons-react` | Legacy icon set. UI uses `lucide-react` across all components. | `grep -r "@tabler" frontend/src` yields 0 matches. |
| `@tanstack/react-table`, `@tanstack/react-virtual` | Heavy table virtualization. Tables use enterprise semantic markup. | `grep -r "@tanstack" frontend/src` yields 0 matches. |
| `html2canvas` | Client-side screenshot tool. Proctoring snapshots are captured from `<video>` element canvas directly. | `grep -r "html2canvas" frontend/src` yields 0 matches. |
| `jspdf` | Client-side PDF generation. Unused. | `grep -r "jspdf" frontend/src` yields 0 matches. |
| `livekit-client` | LiveKit WebRTC client. LiveKit plane removed in favor of snapshot proctoring. | `grep -r "livekit-client" frontend/src` yields 0 matches. |
| `react-hot-toast` | Toast library. UI uses custom `ToastContext` / `ex-toast`. | `grep -r "react-hot-toast" frontend/src` yields 0 matches. |
| `recharts` | Charting library. Faculty/admin dashboards use CSS bar & stat card widgets. | `grep -r "recharts" frontend/src` yields 0 matches. |
| `zod` (frontend) | Schema validation library. Frontend validations run lightweight inline schemas. | `grep -r "zod" frontend/src` yields 0 matches. |

---

## 2. Dead Routes & Dead Code in Product Paths

### 2.1 Dead Routes in `backend/src/app.js`
- **`POST /internal/livekit/webhook`**: Lines 65-76 in `backend/src/app.js` call `mediaService.handleWebhook(rawBody, authHeader)`. `MediaService` does NOT implement `handleWebhook`. This route is non-functional and dead.
- **`/api/v1/agent` raw body matcher**: Lines 58-61 in `backend/src/app.js` and line 158 in `backend/src/middleware/security.js` check for `/api/v1/agent`. No `/agent` routes exist in the system (the desktop agent was replaced by SEB).

### 2.2 Dead Unreferenced Backend Files
- `backend/src/middleware/auth.middleware.js`: 7-line redundant re-export file, not imported anywhere.
- `backend/src/middleware/validation.js`: Generic Zod request validation wrapper replaced by module-specific DTO validators (`auth.dto.js`, `exam.dto.js`).
- `backend/src/utils/crypto.js` & `backend/src/utils/helpers.js`: Legacy utility stubs with zero imports across codebase.
- `backend/enable_rls.js`: Stale script for manual database setup.
- `backend/eng.traineddata`: 5,236,112-byte binary training blob left behind by `tesseract.js`.
- `backend/scripts/ops/dlq-replay.js`: Replay script for RabbitMQ dead-letter exchange (dead technology).

---

## 3. Staging & Obsolete Deployment Artifacts

The live environment is bare-metal lite (host Caddy, systemd `proctornet.service`, Supabase PostgreSQL). The following files belong to deleted staging or unproven container workflows:

1. `.github/workflows/cd-staging.yml` — Automated staging CD. Fails due to container tag naming, and staging instance `i-0d7b44f76235917fe` has been terminated.
2. `.github/workflows/cd-production.yml` — Container deployment workflow onto EC2. Conflicts with the live bare-metal topology.
3. `.github/workflows/deploy-aws.yml` — Legacy manual cutover workflow.
4. `docker-compose.staging.yml` (already deleted) & `docker-compose.rehearsal.yml`.
5. `docker-compose.prod.yml` — Production container compose file (unused on bare-metal host).
6. `frontend/nginx.conf` — Live server uses host Caddy (`/etc/caddy/Caddyfile`) to serve `frontend/dist`.
7. `scripts/ops/aws-provision-staging.ps1`, `scripts/ops/aws-provision-staging.sh`, `scripts/ops/bootstrap-remote-staging.js`, `scripts/ops/smoke-staging.js`, `scripts/ops/s3-cors-staging.json`, `scripts/ops/s3-staging-policy.json`, `scripts/ops/staging-block-device.json`, `scripts/ops/staging-user-data.sh`.
8. `docs/ops/STAGING_DEPLOY.md` & `docs/ops/DEPLOY_CHECKLIST_STAGING.md`.
9. `docs/runbooks/vpn.md` & `docs/adr/010-vpn-default-off.md` — WireGuard VPN module was deprecated and removed.

---

## 4. Stale Environment Variables

In `.env.example` and `.env.production.example`:
- `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`, `RABBITMQ_URL` — Obsolete; RabbitMQ is not used.
- `.env.staging.example` — Obsolete; staging environment has been terminated.

---

## 5. Live Production Database Audit (Read-Only via AWS SSM)

Audit executed against PostgreSQL on 2026-11-10 via `check-prod-data.sh`:

### 5.1 Real Production Data (DO NOT TOUCH)
- **Faculty:** `rajesh@gmail.com`
  - Created 4 exams: `aaaa`, `Abbb`, `sv`, `cv`.
- **Student:** `sudeepkagi@gmail.com`
  - Assigned to 4 exams, submitted 2 active attempts:
    - Exam `Abbb`: status `COMPLETED`, score `10`.
    - Exam `sv`: status `COMPLETED`, score `4`.
- **Invigilator Accounts (Auto-generated by Faculty Wizard):**
  - `invaaa702@proctornet.local` (assigned to exam `aaaa`)
  - `invzdv129@proctornet.local` (assigned to exam `Abbb`)
  - `invdzs795@proctornet.local` (assigned to exam `sv`)
  - `invvz938@proctornet.local` (assigned to exam `cv`)
  *Note:* These accounts are linked via foreign keys to active exams. Deleting them would violate relational integrity or leave dangling exams. They are legitimate exam invigilators created by the faculty user.

### 5.2 Seeded / Demo Accounts (Zero Relationships)
The following accounts have 0 created exams, 0 assignments, and 0 attempts:
- `faculty@proctornet.com`
- `invigilator@proctornet.com`
- `student1@proctornet.com`
- `student2@proctornet.com`
- `admin@proctornet.com` (System Administrator — retains admin access)

---

## 6. Action Plan & Governance
1. **Commit 1:** Remove obsolete staging & container deploy workflows, docs, and scripts.
2. **Commit 2:** Remove dead backend files, dead `/internal/livekit/webhook` route, dead `/api/v1/agent` handlers, and dead backend dependencies.
3. **Commit 3:** Remove dead frontend dependencies and clean `screenStreamStore.js`.
4. **Commit 4:** Clean `.env.example`, `.env.production.example`, and delete `.env.staging.example`.
5. **Verification:** Run `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, and `npx playwright test`.
6. **Branch Hygiene:** Delete fully merged local and remote git branches.
