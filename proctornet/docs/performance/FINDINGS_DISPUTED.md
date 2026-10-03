# ProctorNet Scalability & Defect Register — Findings Verification & Disputes

As mandated by §0 Rule 4 of the Master Operating Protocol, every finding in §3 of the architectural audit was verified directly against the codebase.

---

## 1. Disputed / Refined Findings

### Finding B-11: "No `prisma/migrations` directory found (only `schema.prisma` + `seed/`)"
* **Severity in Register**: P2
* **Original Claim**: No database migration history exists in the repository; only schema and seed scripts are present.
* **Codebase Verification Result**: **DISPUTED / REFINED**
* **Evidence & Proof**:
  - The physical directory `proctornet/backend/prisma/migrations` **does exist** on disk.
  - Contents:
    - `20260509141145_init/migration.sql`
    - `20260828110700_add_schema_audit_fields/migration.sql`
    - `migration_lock.toml`
  - **Root Cause**: In `proctornet/.gitignore`, line 38 explicitly ignores `backend/prisma/migrations/`. Thus, the directory was untracked by Git, giving the appearance of being missing in remote repository listings.
* **Resolution**:
  - Remove line 38 from `proctornet/.gitignore` and track all Prisma migrations in Git as required for repeatable schema evolution.

---

## 2. Confirmed & Verified Findings (with Exact Codebase Proof)

| ID | Sev | Codebase Location | Concrete Code Evidence & Verified Impact |
|---|---|---|---|
| **B-01** | P1 | `studentService.js:212, 278, 358` | `exam.findUnique({ include: { questions: true } })` pulls full question bank per student; `.sort(() => Math.random() - 0.5)` biased shuffle; second `findMany` query; O(N^2) `.map(qid => questions.find(...))`. |
| **B-02** | P1 | `studentService.js:450-496` | Autosave runs 3 sequential queries (`session -> question -> upsert`); increments `changedCount` without revision CAS; accepts saves past `endTime` as long as status is `ACTIVE`. |
| **B-03** | P1 | `studentService.js:473-491, 572-580` | Sequential `for (... of questions) await upsert` loop; submit runs `Promise.all` of N upserts; synchronous in-request scoring loop updates each answer row, causing connection pool exhaustion during submission bursts. |
| **B-04** | P1 | `studentService.js:658` | Explicit code: `if (correctIdx === undefined) correctIdx = 0;` silently defaults correct answer to Option A if undefined! |
| **B-05** | P1 | `studentService.js:358-372`, `questionService.js:289-291` | `options` JSON array stores `{ text: opt, isCorrect: boolean }`. `startOrResumeExam` selects `options: true` and sends the complete array to the candidate's browser, **exposing the answer key in network responses**. |
| **B-06** | P1 | `invigilator.controller.js:81-133` | Loads all candidates, all sessions with `evidenceLogs take 50`, and injects raw base64 JPEGs from `global.latestLiveFrames` into the REST response without pagination. |
| **B-07** | P2 | `invigilator.controller.js:476-555` | 4-table joined insensitive `ILIKE` OR query, offset pagination (`skip`/`take`), deep `include`, resulting in full sequential table scans. |
| **B-08** | P1 | `schema.prisma:1-368` | **Zero `@@index` annotations** exist in `schema.prisma`. Only primary key and `@unique` constraints are indexed. All foreign keys and filter columns suffer sequential scans. |
| **B-09** | P2 | `studentService.js:61-106` | Fetches up to 100 exams (`take: 100`) and executes JavaScript filtering for department/semester matching in Node memory. |
| **B-10** | P2 | `exam.socket.js:340-420`, `studentService.js:498-527` | Per-event `flagCount` increment and `VerificationAuditLog` creation; duplicate logic paths across socket and REST. |
| **B-12** | P2 | `backend/package.json:43`, `vpnService.js:125` | `@prisma/client` is in `devDependencies`; `vpnService` instantiates `global.prisma || new PrismaClient()`. |
| **B-13** | P1 | `sessionStateMachine.js:91-189` | Synchronous `exec` of `syncWireGuardRemovePeer` executed directly inside `prisma.$transaction(async (tx) => { ... })` callback. |
| **B-14** | P1 | `backend/package.json:33`, `schema.prisma` | `node-cron` is installed but never imported or used; `StudentExam` lacks `expires_at` column; no automated expiration sweeper exists. |
| **M-01** | P1 | `exam.socket.js:166, 192` | `io.to('inv:X').to('exam:X').emit('student:screenFrame')` broadcasts every student's JPEG frame to the **entire exam room containing all students**, creating an O(N^2) network fan-out and severe privacy leak. |
| **M-02** | P1 | `exam.socket.js:162-164, 188-190` | In-memory `global.latestLiveFrames` Map caches uncompressed base64 strings indefinitely without eviction or size limits. |
| **M-03** | P1 | `useInvigilatorSocket.js:47`, `useExamSocket.js:223` | Full-mesh P2P: Invigilator auto-requests streams from every joined candidate; student opens 1 `RTCPeerConnection` per invigilator. |
| **M-04** | P1 | `useInvigilatorSocket.js:181-184` | ICE configuration contains only Google STUN (`stun.l.google.com:19302`); zero TURN servers configured for NAT traversal. |
| **M-05** | P1 | `docker-compose.yml:7-20`, `frontend/package.json` | LiveKit SFU is deployed in Docker Compose but `frontend/package.json` lacks `livekit-client`; LiveKit token route is unmounted. |
| **M-06** | P1 | `exam.socket.js:89-103` | Socket authentication catch block catches invalid/expired JWTs, logs a warning, sets `socket.user = null`, and calls `next()`, **failing open**. |
| **M-07** | P2 | `app.js:69` | `transports: ['websocket', 'polling']` without Redis adapter; prevents multi-process scaling. |
| **M-08** | P2 | `exam.socket.js:41` | `flagRateLimitMap` is an in-memory Map lost on server restart or across processes. |
| **S-01** | P1 | `s3.service.js:119-166` | Media frames upload as base64 in JSON through the Express API process, saturating Node memory and event loops. |
| **S-02** | P1 | `s3.service.js:96-109` | Database stores 7-day presigned URLs; profile photos and evidence links silently break after 7 days. |
| **S-06** | P2 | `app.js:109` | `app.use('/uploads', authenticate, express.static(...))` allows any authenticated candidate or user to browse all stored snapshots on local disk. |
| **V-01** | P1 | `vpnService.js:29-41, 57-69` | Shells out with string-interpolated `exec` referencing hardcoded Azure IP `20.198.83.12` and SSH commands. |
| **V-02** | P1 | `vpnService.js:80-85` | Subnet hardcoded to `10.0.0.0/24` (maximum 253 peers); allocation queries all active exams without table locking. |
| **V-03** | P1 | `vpnService.js:193` | Client private key stored in plaintext in the database (`vpnPrivateKey: privateKey`). |
| **C-01** | P1 | `docker-compose.yml:29, 49, 107, 140` | Hardcoded `JWT_SECRET`, database passwords, MinIO root credentials, and LiveKit dev keys committed directly in Compose. |
| **C-02** | P2 | `app.js:83` | `contentSecurityPolicy: false` in Helmet configuration. |
| **C-03** | P1 | `package.json`, `auth.controller.js` | CPU-intensive `bcryptjs` and `tesseract.js` run on the main Node event loop. |
| **C-04** | P2 | `app.js:223-241` | No `SIGTERM`/`SIGINT` graceful shutdown; no request timeouts; no request ID tracing. |
| **C-05** | P2 | Repository Root | 24 scratch scripts under `scripts/scratch/` and `B04_Final_Year_Project_Updated new one.docx` committed in version control. |
| **F-01** | P2 | `frontend/package.json:17` | Unused `@monaco-editor/react` bundled in frontend dependencies. |
| **F-02** | P2 | `useExamSocket.js`, `ExamInterface.jsx`, `SecurityCheck.jsx` | Streams and frames stored globally on `window.screenShareStream`, `window.latestStudentFrames`, and `CustomEvent` listeners. |
| **T-01** | P1 | `backend/tests/` | 7 test files pass, but zero load, concurrency, or chaos simulation tests exist. |
