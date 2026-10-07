# ProctorNet Comprehensive Architectural & Bottleneck Audit Register

**Audit Date**: 2026-10-03  
**Auditor**: Principal Systems Engineer  
**Scope**: Complete codebase audit across `backend/src`, `frontend/src`, `python-service`, `device-agent`, and deployment infrastructure.

Severity Definitions:
- **P1**: Breaks at modest concurrency (< 100 users), causes severe data/memory corruption, or leaks confidential credentials/answer keys.
- **P2**: Significant latency, CPU/memory bloat, architectural regression risk, or lack of multi-process safety.
- **P3**: Hygiene, code cleanliness, or minor performance optimization.

---

## 1. Database & Data Access Bottlenecks

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **B-01** | P1 | `studentService.js:212, 278, 358` | `exam.findUnique({ include: { questions: true } })` pulls full question bank per student; `.sort(() => Math.random() - 0.5)` biased shuffle; second `findMany` query; O(N^2) `.map(qid => questions.find(...))`. | P4: Pre-created `READY` attempts + `attempt_questions`; start = one conditional `UPDATE`; cached immutable exam content. |
| **B-02** | P1 | `studentService.js:450-496` | Autosave runs 3 sequential queries (`session -> question -> upsert`); increments `changedCount` without revision CAS; accepts saves past `endTime` as long as status is `ACTIVE`. | P4: Single-statement guarded upsert with revision CAS + `expires_at` check. |
| **B-03** | P1 | `studentService.js:473-491, 572-580` | Sequential `for (... of questions) await upsert` loop; submit runs `Promise.all` of N upserts; synchronous in-request scoring loop updates each answer row, causing connection pool exhaustion during submission bursts. | P4: Batch save via PostgreSQL `unnest`; submit = short transaction + transactional outbox; grading in worker as single bulk SQL. |
| **B-04** | P1 | `studentService.js:658` | Explicit code: `if (correctIdx === undefined) correctIdx = 0;` silently defaults correct answer to Option A if unspecified! | P2/P3: Relational `question_options` + exactly-one-correct database constraint; validate at publish. |
| **B-05** | P1 | `studentService.js:358-372`, `questionService.js:289-291` | `options` JSON array stores `{ text: opt, isCorrect: boolean }`. `startOrResumeExam` selects `options: true` and sends the complete array to candidate browsers, **leaking the answer key**. | P3/P4: Strict DTO projection boundary; automated "no answer-key leak" regression test. |
| **B-06** | P1 | `invigilator.controller.js:81-133` | Loads all candidates, all sessions with `evidenceLogs take 50`, and injects raw base64 JPEGs from `global.latestLiveFrames` into the REST response without pagination. | P6: Keyset-paginated roster + summary aggregate + WS deltas; zero base64 media in REST JSON. |
| **B-07** | P2 | `invigilator.controller.js:476-555` | 4-table joined insensitive `ILIKE` OR query, offset pagination (`skip`/`take`), deep `include`, resulting in full sequential table scans. | P4/P6: Keyset pagination, `pg_trgm` GIN indexes, single `GROUP BY` summary. |
| **B-08** | P1 | `schema.prisma:1-368` | **Zero `@@index` annotations** exist in `schema.prisma`. Only primary key and `@unique` constraints are indexed. All foreign keys and filter columns suffer sequential scans. | P3: Comprehensive B-tree and composite indexing strategy across all relational FKs. |
| **B-09** | P2 | `studentService.js:61-106` | Fetches up to 100 exams (`take: 100`) and executes JavaScript filtering for department/semester matching in Node memory. | P3/P4: Canonical department codes at write time + GIN array index. |
| **B-10** | P2 | `exam.socket.js:340-420`, `studentService.js:498-527` | Per-event `flagCount` increment and `VerificationAuditLog` creation; duplicate logic paths across socket and REST. | P4/P6: Micro-batched inserts; unified violation service. |
| **B-11** | P2 | `proctornet/.gitignore:38` | `prisma/migrations/` was excluded by `.gitignore`, preventing version-controlled schema evolution despite physical files existing on disk. | P0/P3: Un-ignore migrations in `.gitignore` and commit baseline migrations. |
| **B-12** | P2 | `backend/package.json:43`, `vpnService.js:125` | `@prisma/client` is in `devDependencies`; `vpnService` instantiates `global.prisma || new PrismaClient()`. | P0/P3: Moved `@prisma/client` to `dependencies`; single shared Prisma client instance. |
| **B-13** | P1 | `sessionStateMachine.js:91-189` | Synchronous `exec` of `syncWireGuardRemovePeer` executed directly inside `prisma.$transaction(async (tx) => { ... })` callback. | P4: Conditional `UPDATE ... WHERE status = ANY(allowed)`; side effects published via outbox. |
| **B-14** | P1 | `backend/package.json:33`, `schema.prisma` | `node-cron` is installed but never imported or used; `StudentExam` lacks `expires_at` column; no automated expiration sweeper exists. | P4: Add `expires_at` column, request-path deadline checks, and background expiry sweeper. |
| **B-15** | P2 | `adminService.js:20`, `invigilator.controller.js:507` | Unindexed `ILIKE '%search%'` string pattern matching across names, emails, and USNs. | P3: PostgreSQL `pg_trgm` extension with GIN trigram indexes. |
| **B-16** | P3 | `schema.prisma:1-368` | All primary and foreign keys stored as 36-character `text` strings (`@default(uuid())`). | P3: Native `@db.Uuid` (16 bytes) for core entities. |
| **B-17** | P2 | `schema.prisma:117, 180` | Statuses and severities stored as unconstrained `String`; question shuffling stored in raw arrays. | P3: Native PostgreSQL `enum` types and relational `attempt_questions`. |

---

## 2. Real-Time & Media Pipeline Defects

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **M-01** | P1 | `exam.socket.js:166, 192` | `io.to('inv:X').to('exam:X').emit('student:screenFrame')` broadcasts every student's JPEG frame to the **entire exam room containing all students**, creating an O(N^2) network fan-out and severe privacy leak. | P7: Delete frame events over Socket.IO entirely; route media strictly through LiveKit SFU. |
| **M-02** | P1 | `exam.socket.js:162-164, 188-190` | In-memory `global.latestLiveFrames` Map caches uncompressed base64 strings indefinitely without eviction or size limits. | P7: Delete in-memory frame cache; proctors view live WebRTC streams directly. |
| **M-03** | P1 | `useInvigilatorSocket.js:47`, `useExamSocket.js:223` | Full-mesh P2P: Invigilator auto-requests streams from every joined candidate; student opens 1 `RTCPeerConnection` per invigilator, collapsing browser decoders at ~15 candidates. | P7: Selective Forwarding Unit (SFU) with selective subscription. |
| **M-04** | P1 | `useInvigilatorSocket.js:181-184` | ICE configuration contains only Google STUN (`stun.l.google.com:19302`); zero TURN servers configured for NAT traversal. | P7: LiveKit embedded TURN + TCP/TLS fallback on ports 3478/5349. |
| **M-05** | P1 | `docker-compose.yml:7-20`, `frontend/package.json` | LiveKit SFU is deployed in Docker Compose but `frontend/package.json` lacks `livekit-client`; LiveKit token route is unmounted. | P7: Install `livekit-client`, mount token minting route `/api/media/token`, configure dynacast. |
| **M-06** | P1 | `exam.socket.js:89-103` | Socket authentication catch block catches invalid/expired JWTs, logs a warning, sets `socket.user = null`, and calls `next()`, **failing open**. | P6: Strict fail-closed socket middleware (`return next(new Error('AUTH_FAILED'))`). |
| **M-07** | P2 | `app.js:69` | `transports: ['websocket', 'polling']` without Redis adapter; prevents multi-process scaling. | P6: Enforce `transports: ['websocket']` with `@socket.io/redis-adapter`. |
| **M-08** | P2 | `exam.socket.js:41` | `flagRateLimitMap` is an in-memory Map lost on server restart or across multi-process replicas. | P4/P6: Redis-backed distributed sliding window rate limiting. |
| **M-09** | P2 | `useExamSocket.js:331-336` | Student main thread renders hidden `<video>` + `<canvas>` + `toDataURL('image/jpeg')` twice every 1.5 seconds, causing CPU thrashing. | P7: WebRTC hardware-accelerated video encoders. |
| **M-10** | P2 | `InvigilatorLiveGrid.jsx:170` | Proctors listen on global `window` CustomEvent bus and render all video tiles without DOM virtualisation. | P6/P7: Virtualized grid + `useSyncExternalStore` reactive stream state. |

---

## 3. Storage & Evidence Deficiencies

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **S-01** | P1 | `s3.service.js:119-166` | Media frames upload as base64 in JSON through the Express API process, saturating Node memory and event loops. | P5: Browser direct pre-signed POST to S3. |
| **S-02** | P1 | `s3.service.js:96-109` | Database stores 7-day presigned URLs; profile photos and evidence links silently break after 7 days. | P5: Store clean relative S3 object keys only; sign on read with short TTL (ADR-011). |
| **S-03** | P1 | `s3.service.js:158` | `uploadBase64` falls back to returning the original base64 data URL on failure, bloating DB columns. | P5: Fail loudly; never persist multi-megabyte base64 strings in PostgreSQL. |
| **S-04** | P2 | `backend/src/services/cloudinary.service.js` | Legacy Cloudinary and MinIO services co-exist with S3; synchronous `fs.readFileSync` in `uploadFile`. | P1/P5: Clean removal of Cloudinary dependencies; pure AWS S3 SDK v3. |
| **S-05** | P2 | `s3.service.js:11-17` | Static IAM keys used; default `S3Client` configuration lacks connection keep-alive agent tuning. | P5: Configured HTTP keep-alive agent with connection pooling and timeouts. |
| **S-06** | P2 | `app.js:109` | `app.use('/uploads', authenticate, express.static(...))` allows any authenticated candidate or user to browse all stored snapshots on local disk. | P5: Remove static local uploads directory; private S3 bucket only. |

---

## 4. VPN & Network Isolation Flaws

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **V-01** | P1 | `vpnService.js:29-41, 57-69` | Shells out with string-interpolated `exec` referencing hardcoded Azure IP `20.198.83.12` and SSH commands. | P8: Abstract behind `IVpnProvider`; asynchronous command queue; zero shell injection. |
| **V-02** | P1 | `vpnService.js:80-85` | Subnet hardcoded to `10.0.0.0/24` (maximum 253 peers); allocation queries all active exams without table locking. | P8: `/16` CIDR pool managed via database allocation with `FOR UPDATE SKIP LOCKED`. |
| **V-03** | P1 | `vpnService.js:193` | Client private key stored in plaintext in the database (`vpnPrivateKey: privateKey`). | P8: Never persist client private keys server-side. |
| **V-04** | P2 | `vpnService.js:187-208` | `issueVpnConfig` upserts `StudentExam` as an unverified side effect without checking exam start eligibility. | P8: Decouple VPN provisioning from attempt creation; require explicit enrollment. |
| **V-05** | P2 | `sessionStateMachine.js:184` | WireGuard peer removal executed inside database transaction callbacks. | P8: Publish peer lifecycle events to transactional outbox. |
| **V-06** | P2 | `vpnService.js:240-300` | No periodic peer handshake reconciliation; relies solely on client-reported disconnection. | P8: Background worker reconciles `wg show wg0 latest-handshakes`. |

---

## 5. Security, Runtime & Configuration Hygiene

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **C-01** | P1 | `docker-compose.yml:29, 49, 107, 140` | Hardcoded `JWT_SECRET`, database passwords, MinIO root credentials, and LiveKit dev keys committed directly in Compose. | P9: Extract secrets to non-committed `.env` files; bind internal services to private network only. |
| **C-02** | P2 | `app.js:83` | `contentSecurityPolicy: false` in Helmet configuration. | P4/P9: Strict Content Security Policy allowing only verified domains and SFU endpoints. |
| **C-03** | P1 | `package.json`, `auth.controller.js` | CPU-intensive `bcryptjs` and `tesseract.js` run on the main Node event loop. | P4: Use native cryptographic bindings / offload heavy CPU tasks to background workers. |
| **C-04** | P2 | `app.js:223-241` | No `SIGTERM`/`SIGINT` graceful shutdown; no request timeouts; no request ID tracing. | P4/P9: Add graceful shutdown, timeout middleware, and `AsyncLocalStorage` request-id propagation. |
| **C-05** | P2 | Repository Root | 24 scratch scripts under `scripts/scratch/` and `B04_Final_Year_Project_Updated new one.docx` committed in version control. | P0: Deleted scratch scripts; relocated documentation and samples to `docs/assets/`. |

---

## 6. Extended Audit Findings (Unread Services & Controllers)

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **A-01** | P1 | `collusionService.js:37-90` | Synchronous O(N^2) pairwise Levenshtein distance calculations run on the main API process for all submissions. For N=500, executes 124,750 string comparisons, locking the Node event loop for over 30 seconds. | P4: Offload collusion similarity analysis to asynchronous background worker queue. |
| **A-02** | P1 | `python.service.js:31-37` | Permissive fallback on service failure: when Python liveness check fails, it catches the error and returns `{ isReal: true, livenessScore: 0.88 }`, allowing spoofing attacks to bypass verification. | P4: Fail closed on biometric and liveness verification (`isReal: false`). |
| **A-03** | P1 | `deviceCheck.controller.js:51` | Global broadcast leak: `global.io.emit('device_alert', { ... })` emits candidate process and network violation alerts to the entire Socket.IO server, exposing student names and IPs to all other connected users. | P6: Scope alerts strictly to `io.to('inv:${examId}')`. |
| **A-04** | P2 | `ocr.service.js:119` | OCR text extraction falls back to hardcoded dummy strings `'1MS21CS001'` and `'Candidate Student'`, generating false-positive validation passes when card parsing completely fails. | P4: Fail closed when OCR extraction fails; require manual proctor approval. |
| **A-05** | P2 | `notification.controller.js:16-140` | Every notification request executes 3–5 sequential database queries with unindexed OR clauses (`profileStatus`, `approvalStatus`) and deep joins. Under 200 users polling, generates 800+ queries/min. | P4/P6: Single coalesced query with Redis caching (TTL: 10s) and WebSocket notifications. |
| **A-06** | P2 | `chat.socket.js:7, 42` | In-memory `chatRateLimitMap` cannot coordinate across multiple API processes; single synchronous database insert per chat message. | P6: Redis rate limiting and micro-batched chat inserts. |
| **A-07** | P2 | `resultService.js:16-30` | `listResultsForExam` loads full student exams with all answers, all questions, and all evidence logs without pagination. For a 500-student exam, returns a 20+ MB JSON payload. | P4/P6: Paginated summary projection with on-demand drill-down. |
| **A-08** | P2 | `examService.js:138-142` | `getExamById` includes all `studentExams` and nested `student` profiles whenever faculty views an exam, loading thousands of rows for large cohorts. | P4: Separate exam configuration from candidate roster; paginate roster separately. |

---

## 7. Deep Integration Audit (Prompt 2 — Q0.6)

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy |
|---|---|---|---|---|
| **I-01** | S0 | `backend/src/modules/submissions/` & `pages/student/ExamInterface.jsx` | Client UI submits via legacy `/student/exams/:id/submit` rather than modern idempotent v1 submissions endpoint. | Q3: Wire frontend to `/api/v1/exams/:id/attempts/:attemptId/submit`. |
| **I-02** | S0 | `backend/src/modules/answers/` & `ExamInterface.jsx` | Candidate autosaves bypass revision-CAS endpoint in `modules/answers` and post to legacy unversioned autosave endpoint. | Q3: Wire frontend autosave to v1 revision CAS. |
| **I-03** | S0 | `backend/src/modules/media/` & `useExamSocket.js` | Media pipeline module exists for LiveKit token issuance, but student exam client never requests token or publishes media. | Q6: Wire LiveKit publisher and subscriber components. |
| **I-04** | S1 | `backend/src/modules/vpn/` & `device-agent/` | Device agent has hardcoded command structures and lacks mutual TLS with the backend API. | Q5/Q7: Strict API token validation and WireGuard peer lifecycle events. |
| **I-05** | S1 | `python-service/app.py` | Python biometric service operates synchronously on single worker without keep-alive or connection pooling. | Q4/Q7: ASGI production server (Uvicorn) with internal Docker networking. |
| **I-06** | S0 | `frontend/src/services/api.js` | Axios interceptor expects flat string error messages (`err.response.data.error`), breaking on modern `{ error: { code, message } }` envelope. | Q2/Q3: Unified client error unwrapper. |
| **I-07** | S0 | `backend/src/modules/auth/` & `auth.middleware.js` | Role normalisation mismatch: JWT payload uses lowercase `'faculty'` / `'student'`, while v1 route guards compare uppercase `'FACULTY'` / `'STUDENT'`. | Q5: Canonical role constants across auth middleware and guards. |
| **I-08** | S1 | `backend/src/modules/audit/` | Audit writer commits asynchronously without transactional outbox tie-in, risking lost audit logs on process crashes. | Q4: Dual-write prevention using PostgreSQL single-statement CTEs. |
| **I-09** | S1 | `frontend/src/pages/invigilator/` | Invigilator live grid and violation viewer still query legacy unindexed endpoints instead of keyset-paginated v1 endpoints. | Q6: Migrate invigilator views to v1 keyset roster & violations endpoints. |

---

## 8. Prompt 3 R0 Re-Audit (§2.5 Files & Real Stack Reconciliation)

| ID | Sev | Codebase Location | Evidence & Verified Vulnerability | Architectural Remedy & R0 Status |
|---|---|---|---|---|
| **R0-01** | P1 | `backend/src/modules/media/biometricService.js:132-154` | Fallback branches assigned hardcoded match scores (`similarity = 0.85`) and synthetic keys (`verified-key`). Allowed spoofing/offline bypasses. | **REMEDIATED**: Replaced all fallback branches with strict fail-closed responses (`matched: false, similarity: 0.0`). Zero stubs permitted. |
| **R0-02** | P1 | `frontend/src/pages/student/SecurityCheck.jsx:136-150` | Fallback simulation assigned synthetic match score `0.96` and confidence `0.95` when verification failed. | **REMEDIATED**: Purged synthetic score assignments; UI displays real verification failure and blocks unauthorized progression. |
| **R0-03** | P2 | `backend/src/modules/auth/controller.js:140-150` | `POST /api/v1/auth/logout` dispatched `success: true` synchronously without awaiting `authService.logout(req.user?.id)`, failing to guarantee Redis token revocation before returning. | **REMEDIATED**: Handler converted to `async`; explicitly awaits `authService.logout(req.user?.id)`. |
| **R0-04** | P2 | `backend/src/modules/admin/repository.js:294-298` | `createAnnouncement()` omitted client-side UUID generation for `id`, causing PostgreSQL null-constraint violation (`P2011`). | **REMEDIATED**: Explicitly generates `id: crypto.randomUUID()` in database write payload. |
| **R0-05** | P2 | `vpnGuard.js`, `violationMicroBatcher.js`, `outboxPublisher.js`, `stateMachine.js`, `expirySweeper.js`, `exams/repository.js`, `biometricService.js` | Unobserved writes inside empty `catch(() => {})` blocks obscured failed database/cache persistence operations. | **REMEDIATED**: Replaced all empty catch blocks with structured `logger.error(...)` and `logger.warn(...)` observability calls. |
| **R0-06** | P1 | `backend/src/modules/student/controller.js` | Legacy unversioned student routes (`/exams/:id/answer`, `/autosave`, `/submit`, `/evidence`, `/violation`, `/acknowledge`) existed as unmaintained zombie endpoints bypassing v1 idempotency and CAS. | **REMEDIATED**: Purged legacy student endpoints; unified API exclusively on v1 canonical flows (`/attempts/:id/submission`, `/attempts/:id/answers`, `/violations/batch`). |
| **R0-07** | P1 | `backend/tests/route-matrix.test.js` & `docs/api/ROUTE_INVENTORY.md` | Route tests checked HTTP status codes but did not assert *observable state changes* (database rows, outbox events, negative-effect invariance). | **REMEDIATED**: Contract tests extended with positive effect assertions (DB row created, outbox row queued) and negative effect assertions (BOLA / 403 / 404 mutations strictly 0). |
| **R0-08** | P2 | `backend/src/modules/invigilator/` & `assertStaffExamAccess` | Invigilator staff scoping permitted non-UUID strings in JWT payload, which caused PostgreSQL UUID casting syntax errors during state machine transitions. | **REMEDIATED**: Normalized token generation and staff scoping to validate standard UUIDs; fail-closed on unassigned/missing exam IDs. |


