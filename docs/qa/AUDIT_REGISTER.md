# ProctorNet Architectural Audit Register

> Mirror of canonical audit register at `docs/performance/AUDIT_REGISTER.md`, extended through Prompt 3 R0 truth reset.

See [docs/performance/AUDIT_REGISTER.md](../performance/AUDIT_REGISTER.md) for full historical entries B-01 through I-09.

---

## Prompt 3 R0 Re-Audit (§2.5 Files & Real Stack Reconciliation)

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

---

## Prompt 5 Defect Remediation Register

| ID | Sev | Codebase Location | Evidence & Verified Defect | Architectural Remedy & S1 Status |
|---|---|---|---|---|
| **EDGE-01** | S1 | `/etc/caddy/Caddyfile` & `ops/aws/templates/user_data.sh.tpl` | No CSP on the SPA; no `encode` directive (uncompressed assets); `/readyz` and `/metrics` publicly proxied to internal port 9100/5000 revealing telemetry & internal host details; HSTS preload before readiness. | **REMEDIATED (S1)**: Canonical Caddyfile deployed with `encode zstd gzip`, full SPA CSP with exact origins (`wss://`, S3 buckets, font/script CDNs), HSTS ramp-up (`max-age=300`), and dedicated `handle` blocks returning 404 for `/readyz*` and `/metrics*`. |
| **EDGE-03** | S2 | `backend/src/app.js` | Node `compression()` burned CPU duplicating Caddy; `express.json({limit:'10mb'})` with blanket `rawBody` retention on every request; production CSP had `ws:`/`wss:` wildcards; `LOADTEST_ALLOW` rate-limit bypass had no production guard. | **REMEDIATED (S1)**: Node `compression()` disabled in production; `express.json` default limit reduced to 256KB with `rawBody` conditionally captured only for agent/livekit webhooks; per-route 10MB override on bulk import; exact CSP connect-src origins; rate-limit test bypass guarded with `!isProd`. |

