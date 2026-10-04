# ProctorNet — Master Claims Ledger

> **Protocol Reference (§0.3):** Every claimed item must map to a reproducible command executed against the real stack, an execution timestamp, a verified status (`PENDING` | `IN_PROGRESS` | `PASSED` | `DISPUTED`), and a concrete artifact path. Unverified claims remain strictly `PENDING`.

| Item ID | Category | Description | Exact Verification Command | Last Verified Timestamp | Status | Concrete Artifact Path |
|---|---|---|---|---|---|---|
| **DOD-01** | §6 DoD | Admin/PlatformSetting data retention only after reset | `npm run ops:reset-keep-admin && node tests/reset-keep-admin.test.js` | 2026-10-04T12:00:00Z | PASSED | `proctornet/backend/tests/reset-keep-admin.test.js` |
| **DOD-02** | §6 DoD | Strict MCQ-Only Invariant | `node tests/mcq-validation.test.js` | 2026-10-04T12:30:00Z | PASSED | `proctornet/backend/tests/mcq-validation.test.js` |
| **DOD-03** | §6 DoD | Canonical roles & Resource-level authz | `node tests/security_auth_cookies.test.js` | — | PENDING | `proctornet/backend/tests/security_auth_cookies.test.js` |
| **DOD-04** | §6 DoD | Schema migrations reproducible & Timestamptz UTC | `npx prisma migrate diff --exit-code` | — | PENDING | `proctornet/backend/prisma/migrations/` |
| **DOD-05** | §6 DoD | Fast answer save (1 RT), start (≤2 RT), async grading | `node tests/p4-concurrency-write-paths.test.js` | — | PENDING | `proctornet/backend/tests/p4-concurrency-write-paths.test.js` |
| **DOD-06** | §6 DoD | Autosave CAS, idempotent submit, sweeper | `node tests/p4-state-machine.test.js` | — | PENDING | `proctornet/backend/tests/p4-state-machine.test.js` |
| **DOD-07** | §6 DoD | Redis / RabbitMQ graceful degradation | `node tests/infra_resilience.test.js` | — | PENDING | `proctornet/backend/tests/infra_resilience.test.js` |
| **DOD-08** | §6 DoD | Zero media over socket/API; LiveKit SFU; TURN fallback | `node tests/p7-media-livekit.test.js` | — | PENDING | `proctornet/backend/tests/p7-media-livekit.test.js` |
| **DOD-09** | §6 DoD | Presigned S3 keys only; no base64 in database/API | `node tests/p5-storage-evidence.test.js` | — | PENDING | `proctornet/backend/tests/p5-storage-evidence.test.js` |
| **DOD-10** | §6 DoD | VPN flag-gated; IPAM O(1) lease/release | `node tests/p8-vpn-wireguard.test.js` | — | PENDING | `proctornet/backend/tests/p8-vpn-wireguard.test.js` |
| **DOD-12** | §6 DoD | Golden-Path Playwright E2E Suite harness & red test baseline | `npx playwright test e2e/golden/golden-path.spec.ts` | 2026-10-04T17:51:53Z | PASSED (REPRODUCED RED AT STEP 3 AUTOSAVE AS PREDICTED) | `e2e/golden/golden-path.spec.ts` |
| **VIS-01** | §3 Q0.5 | Visual + structural DOM baselines across 5 roles & 3 viewports | `npx playwright test e2e/capture-baselines.spec.js` | 2026-10-04T17:35:00Z | PASSED (186 baseline files) | `e2e/visual-baseline/` |
| **DOC-01** | §3 Q0.1 | Markdown documentation link integrity check | `node scripts/ci/check-doc-links.js` | 2026-10-04T17:05:00Z | PASSED (0 broken links) | `scripts/ci/check-doc-links.js` |
| **BUG-A02** | Integration | Plumb attemptId into useExamSocket & assert room join | `npx playwright test tests/e2e/socket-attempt.spec.js` | — | PENDING | `proctornet/frontend/src/hooks/useExamSocket.js` |
| **BUG-A03** | Integration | Student ExamInterface publishes LiveKit stream | `npx playwright test tests/e2e/media-sfu.spec.js` | — | PENDING | `proctornet/frontend/src/lib/proctorMedia.js` |
| **BUG-A04** | Integration | Error envelope unification frontend ↔ backend | `node tests/error_envelope.test.js` | — | PENDING | `proctornet/backend/src/shared/errors.js` |
| **BUG-A05** | Integration | Exam countdown timer derived from expiresAt + serverClock | `node tests/exam_timer.test.js` | — | PENDING | `proctornet/frontend/src/hooks/useExamTimer.js` |
| **BUG-A06** | Integration | Shared violation event catalogue & socket validation | `node tests/violation_catalogue.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/violationTypes.js` |
| **BUG-A07** | Integration | Automated exam status scheduler & prewarm trigger | `node tests/exam_lifecycle.test.js` | — | PENDING | `proctornet/backend/src/jobs/examScheduler.js` |
| **BUG-B01** | Legacy | Remove broken legacy studentService calls & dead relations | `node tests/student_service_v1.test.js` | — | PENDING | `proctornet/backend/src/services/studentService.js` |
| **BUG-B02** | Legacy | Eliminate studentExams references from examService | `node tests/exam_service_v1.test.js` | — | PENDING | `proctornet/backend/src/services/examService.js` |
| **BUG-B04** | Legacy | Deprecate dead legacy service modules | `git rm ...` | — | PENDING | `proctornet/backend/src/services/` |
| **BUG-B05** | Legacy | Fix faculty department approval check | `node tests/approval_auth.test.js` | — | PENDING | `proctornet/backend/src/services/studentService.js` |
| **BUG-B06** | Legacy | Guard student profile updates (block usn/email & unverified status) | `node tests/profile_security.test.js` | — | PENDING | `proctornet/backend/src/services/studentService.js` |
| **BUG-B07** | Legacy | Cryptographic invigilator credentials & publish guard | `node tests/exam_credentials.test.js` | — | PENDING | `proctornet/backend/src/services/examService.js` |
| **BUG-C01** | Async/Infra | RabbitMQ connection manager with auto-recovery & topology setup | `node tests/rabbitmq_resilience.test.js` | — | PENDING | `proctornet/backend/src/infra/rabbitmq/client.js` |
| **BUG-C02** | Async/Infra | Outbox publisher non-destructive broker reconnect & replay CLI | `node tests/outbox_resilience.test.js` | — | PENDING | `proctornet/backend/src/infra/rabbitmq/outboxPublisher.js` |
| **BUG-C03** | Async/Infra | RabbitMQ dead-letter exchange retry ladder (5s/30s/5m) & dlq-replay | `node tests/rabbitmq_retry.test.js` | — | PENDING | `proctornet/backend/src/infra/rabbitmq/client.js` |
| **BUG-C04** | Async/Infra | Single-statement CTE for attempt transition + audit + outbox | `node tests/atomic_transition.test.js` | — | PENDING | `proctornet/backend/src/modules/attempts/stateMachine.js` |
| **BUG-C05** | Async/Infra | Redis infinite capped backoff & Socket.IO adapter lazy connection | `node tests/redis_reconnect.test.js` | — | PENDING | `proctornet/backend/src/infra/redis/client.js` |
| **BUG-C06** | Async/Infra | Distributed worker Socket.IO emits via @socket.io/redis-emitter | `node tests/redis_emitter.test.js` | — | PENDING | `proctornet/backend/src/infra/websocket/emitter.js` |
| **BUG-C07** | Async/Infra | Evaluation status guards, unbounded scores fix, absentee handling | `node tests/evaluation_guards.test.js` | — | PENDING | `proctornet/backend/src/modules/results/repository.js` |
| **BUG-C08** | Async/Infra | Atomically link evidence tickets to created violation events | `node tests/violation_evidence.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/service.js` |
| **BUG-C09** | Async/Infra | Resilient violation micro-batcher with per-row fallback | `node tests/microbatcher_resilience.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/violationMicroBatcher.js` |
| **BUG-C10** | Async/Infra | Clean graceful shutdown across HTTP, Socket.IO & consumers | `node tests/graceful_shutdown.test.js` | — | PENDING | `proctornet/backend/src/app.js` |
| **BUG-C11** | Async/Infra | Composite IdempotencyKey scoped by user + operation + body hash | `node tests/idempotency_scope.test.js` | — | PENDING | `proctornet/backend/src/middleware/idempotency.js` |
| **BUG-D01** | Security | Canonical role constants & BOLA check enforcement | `node tests/bola_role_matrix.test.js` | — | PENDING | `proctornet/backend/src/shared/roles.js` |
| **BUG-D02** | Security | Violation timeline resource ownership check | `node tests/timeline_auth.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/controller.js` |
| **BUG-D03** | Security | Strict assertStaffExamAccess with examId propagation | `node tests/staff_access.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/service.js` |
| **BUG-D04** | Security | WebSocket channel authorization & room scoping | `node tests/socket_authz.test.js` | — | PENDING | `proctornet/backend/src/infra/websocket/socket.server.js` |
| **BUG-D05** | Security | Login rate limiter keyed on IP + USN/Email with trust-proxy | `node tests/login_limiter.test.js` | — | PENDING | `proctornet/backend/src/middleware/rateLimiter.js` |
| **BUG-D06** | Security | Internal error masking on 5xx & private /metrics, /readyz | `node tests/error_masking.test.js` | — | PENDING | `proctornet/backend/src/middleware/errorHandler.js` |
| **BUG-D07** | Security | Strict enum casting in raw SQL & metadata size-capping | `node tests/sql_enum_casts.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/service.js` |
| **BUG-D08** | Security | LiveKit webhook internal-only route with HMAC signature check | `node tests/livekit_webhook.test.js` | — | PENDING | `proctornet/backend/src/modules/proctoring/livekitWebhook.js` |
| **BUG-D09** | Security | Replace vulnerable xlsx parser, crypto invId, CSP tightening | `node tests/security_hardening.test.js` | — | PENDING | `proctornet/backend/src/utils/excel.js` |
| **BUG-E01** | Data/SQL | Migration drift zero-tolerance check & synchronization | `npx prisma migrate diff --exit-code` | — | PENDING | `proctornet/backend/prisma/migrations/` |
| **BUG-E02** | Data/SQL | Timestamptz(3) everywhere & UTC session enforcement | `node tests/utc_timestamptz.test.js` | — | PENDING | `proctornet/backend/prisma/schema.prisma` |
| **BUG-E03** | Data/SQL | Attempt activation gating (status, window, pause, eligibility) | `node tests/attempt_activation.test.js` | — | PENDING | `proctornet/backend/src/modules/attempts/repository.js` |
| **BUG-E04** | Data/SQL | Roster query performance & index on answers(attempt_id) | `node tests/roster_query.test.js` | — | PENDING | `proctornet/backend/prisma/schema.prisma` |
| **BUG-E05** | Data/SQL | Deduplicate batch answers in-memory before ON CONFLICT upsert | `node tests/batch_answer_dedup.test.js` | — | PENDING | `proctornet/backend/src/modules/answers/service.js` |
| **BUG-E06** | Data/SQL | Question immutability after publish & safe in-place option updates | `node tests/question_immutability.test.js` | — | PENDING | `proctornet/backend/src/modules/questions/service.js` |
| **BUG-E07** | Data/SQL | AI question preview validation (reject missing unambiguous correct) | `node tests/ai_question_validation.test.js` | — | PENDING | `proctornet/backend/src/services/aiService.js` |
| **BUG-E08** | Data/SQL | Cache empty prevention & crypto Fisher-Yates shuffle | `node tests/shuffle_cache.test.js` | — | PENDING | `proctornet/backend/src/modules/questions/cache.js` |
| **BUG-E09** | Data/SQL | Drop redundant TIMED_OUT status & enforce revision CAS on 0 | `node tests/revision_cas.test.js` | — | PENDING | `proctornet/backend/prisma/schema.prisma` |
| **BUG-F01** | Media | Nginx LiveKit reverse proxy & bridge network alignment | `curl -i -N http://localhost/livekit` | — | PENDING | `ops/nginx/conf.d/proctornet.conf` |
| **BUG-F02** | Media | Invigilator UI migration to v1 rosterStore & proctorViewer | `npx playwright test tests/e2e/invigilator-grid.spec.js` | — | PENDING | `proctornet/frontend/src/pages/invigilator/` |
| **BUG-F03** | Media | Align connectionStateRecovery with Socket.IO Redis transport | `node tests/socket_recovery.test.js` | — | PENDING | `proctornet/backend/src/infra/websocket/socket.server.js` |
| **BUG-G01** | Infra | Docker-compose egress network for external services | `docker compose -f docker-compose.prod.yml config` | — | PENDING | `docker-compose.prod.yml` |
| **BUG-G02** | Infra | Multi-stage frontend Docker build serving static bundle | `docker build -t proctornet-frontend proctornet/frontend` | — | PENDING | `proctornet/frontend/Dockerfile` |
| **BUG-G03** | Infra | One-shot migration container on stack startup | `docker compose run --rm migrate` | — | PENDING | `docker-compose.prod.yml` |
| **BUG-G04** | Infra | Worker dedicated healthcheck & memory heap alignment | `docker inspect --format='{{.State.Health.Status}}' proctornet-worker` | — | PENDING | `docker-compose.prod.yml` |
| **BUG-G05** | Infra | Nginx rate limits relaxed for shared NAT IP addresses | `node tests/nat_rate_limit.test.js` | — | PENDING | `ops/nginx/nginx.conf` |
| **BUG-G06** | Infra | Redis no-persistence flag & compose alignment | `docker compose config` | — | PENDING | `docker-compose.prod.yml` |
| **BUG-G07** | Infra | Secret scanning of git history with gitleaks | `gitleaks detect --verbose` | — | PENDING | `docs/qa/gitleaks_audit.log` |
| **BUG-H01** | Frontend | Submit error handling fix: never treat 403 as success | `npx playwright test tests/e2e/submit-error.spec.js` | — | PENDING | `proctornet/frontend/src/pages/student/ExamInterface.jsx` |
| **BUG-H02** | Frontend | Integrate autosaveManager (batching, CAS, debounce) | `npx playwright test tests/e2e/autosave.spec.js` | — | PENDING | `proctornet/frontend/src/pages/student/ExamInterface.jsx` |
| **BUG-H03** | Frontend | Fix landing page tab filter & mobile navigation | `npx playwright test tests/e2e/landing-nav.spec.js` | — | PENDING | `proctornet/frontend/src/pages/LandingPage.jsx` |
| **BUG-H04** | Frontend | Server-driven vpnEnforcement configuration flag | `node tests/config_flag.test.js` | — | PENDING | `proctornet/frontend/src/pages/student/ExamInterface.jsx` |
| **BUG-H05** | Frontend | Deterministic leader tab election & graceful face model fallback | `npx playwright test tests/e2e/tab-guard.spec.js` | — | PENDING | `proctornet/frontend/src/hooks/useProctoringMonitors.js` |
| **BUG-H06** | Frontend | Axios client interceptors for Idempotency-Key & Request-ID | `node tests/api_client.test.js` | — | PENDING | `proctornet/frontend/src/utils/api.js` |
| **BUG-J01** | Integrity | Documentation link integrity CI checker | `node scripts/ci/check-doc-links.js` | — | PENDING | `scripts/ci/check-doc-links.js` |
| **BUG-J02** | Abstraction | Feature-truth audit of setting toggles (wire or remove) | `node tests/feature_truth.test.js` | — | PENDING | `proctornet/frontend/src/pages/faculty/ExamSettings.jsx` |
