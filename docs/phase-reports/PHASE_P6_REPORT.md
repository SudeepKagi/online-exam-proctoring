# Phase P6 Report — Realtime Plane & Invigilator Dashboard

**Branch**: `feature/p6-realtime-and-invigilator-dashboard`  
**Status**: Complete  
**Date**: October 2026  
**Reference**: Notion 13.10 / ADR-008  

---

## 1. Executive Summary

Phase P6 implements the production realtime plane and high-density invigilator dashboard for ProctorNet. Following the core architectural principle:
> *"WebSocket is a notification channel, not a source of truth — that single rule makes reconnects, scaling and failure handling simple."*

The implementation transitions the platform from fragile client-authoritative socket streams to a bounded, delta-driven, horizontally scalable architecture across N Node.js processes backed by Redis pub/sub. All authoritative state remains strictly anchored in ACID PostgreSQL transactions and resilient REST endpoints, guaranteeing zero state loss upon socket drops, network reconnects, or server failovers.

---

## 2. Architectural Pillars & Core Tasks

### 2.1 Socket.IO Production Configuration (`infra/websocket/socket.server.js`)
- **Transport Lock**: `transports: ['websocket']` enforced on both server and client (disabling legacy HTTP long-polling upgrades and sticky-session requirement).
- **Horizontal Clustering**: Connected to `@socket.io/redis-adapter` for transparent multi-process pub/sub broadcast.
- **Heartbeat & Buffers**: `pingInterval: 25000` (25 s), `pingTimeout: 20000` (20 s), `maxHttpBufferSize: 65536` (64 KB — strictly sized for JSON control events; binary media rejected at transport level).
- **Compression**: `perMessageDeflate: false` by default, eliminating CPU compression overhead for small JSON control frames.
- **Fail-Closed Handshake**: Handshake authentication middleware validates JWT synchronously (`io.use(...)`). If the token is missing, expired, forged, or unrecognized, the connection is refused immediately and closed.

### 2.2 Room Privacy & Security Isolation
- **Private Candidate Room**: `attempt:{attemptId}` — candidate receives private warnings, private chat, and authoritative state broadcasts. Admission is strictly validated via SQL attempt ownership and cached per socket.
- **Authorized Invigilator Room**: `inv:{examId}` — restricted strictly to faculty owning the exam, assigned invigilators with matching JWT claims, or system admins. Validated via SQL and cached per socket.
- **Permanent Deletion of Legacy Room**: The student-wide broadcast room `exam:{examId}` was completely deleted. Broadcasting candidate flags, warnings, or roster changes across all exam candidates represented a severe privacy and compliance leak.

### 2.3 Minimal Event Set & Delta Coalescing (`infra/websocket/rosterCoalescer.js`)
- **Minimal Event Surface**:
  - Server $\to$ Student: `attempt:state`, `proctor:warning`, `proctor:chat`
  - Student $\to$ Server: `heartbeat`, `violation` (forwarded to REST pipeline), `chat`
  - Server $\to$ Invigilator: `roster:delta` (coalesced), `violation:new`, `chat:new`
- **Removed Legacy Bloat**: Removed `exam:frame`, `exam:screenFrame`, all `webrtc:*` events, duplicate `student:flag`/`exam:flag`, and `student:progress`.
- **500 ms Delta Coalescing**: `RosterDeltaCoalescer` buffers candidate updates (status, answered count, online presence, flag counts) in memory and flushes a consolidated batch per exam room every 500 ms. 1,000 rapid violation notifications are coalesced into $\le 3$ network frames per proctor, eliminating DOM thrashing.

### 2.4 Presence Tracking & REST Resync (`infra/websocket/presence.js`)
- Candidate heartbeats every 15 s update Redis hash `pn:presence:{examId}` (`studentId -> epochMs`).
- Candidate marked offline if last heartbeat $> 45\text{ s}$ old. Socket disconnect immediately writes `0` timestamp.
- **Non-Authoritative Guarantee**: Presence is strictly advisory. On reconnect, the client issues `GET /api/v1/attempts/:id/state` to reconcile authoritative state, current `expiresAt`, revision, and synchronized server clock epoch.

### 2.5 High-Performance Invigilator Endpoints (`modules/proctoring/*`)
- **Summary**: `GET /api/v1/proctoring/exams/:examId/summary` — single SQL aggregate (`COUNT(*) FILTER (WHERE status=...)`, flagged count) combined with live Redis presence count.
- **Roster Keyset Pagination**: `GET /api/v1/proctoring/exams/:examId/roster?limit=50&cursor=...&status=&q=`
  - Keyset pagination on `(s.name ASC, ea.id ASC)` with opaque base64 cursors.
  - Sub-5ms query performance via database B-tree indexes.
  - Zero base64 and zero evidence arrays: payload bounded to $< 100\text{ KB}$ per page.
  - Presigned profile thumbnails dynamically generated with 5-minute cache rounding.
- **Violations Stream**: `GET /api/v1/proctoring/attempts/:attemptId/violations?cursor=` and `GET /api/v1/proctoring/exams/:examId/violations?severity=&type=&cursor=` using keyset pagination on `(server_timestamp DESC, id DESC)`.
- **Staff Commands**: `warn`, `pause` (transitions to `SUSPENDED`), `resume` (transitions to `ACTIVE`), `terminate`, `acknowledgeViolation` execute via P4 state machine, update PostgreSQL with row-level locks, and emit immutable `audit_logs` entries.

---

## 3. Frontend Architecture & Resilience

### 3.1 Typed State Store & Virtualization (`frontend/src/lib/*`)
- **`rosterStore.js`**: Centralized store managed via `useSyncExternalStore` with batch updates dispatched inside React `startTransition`.
- **`VirtualizedRoster.jsx`**: High-density 60 fps table virtualization built on `@tanstack/react-virtual`, rendering only visible DOM rows regardless of candidate pool size (e.g. 5,000+ candidates).

### 3.2 Autosave Manager (`frontend/src/lib/autosaveManager.js`)
- Dirty map keyed by `attemptQuestionId`.
- Flushes dirty answers every 5 seconds, on window blur, and on document `visibilitychange`.
- Revision tracking with optimistic concurrency: 409 `STALE_REVISION` response synchronizes the local revision and re-flushes immediately.
- Exponential backoff with full jitter on network drops or 429/503 errors. Dirty state is preserved in memory during outages.
- Flush-before-submit guarantee: submit uses a stable `Idempotency-Key` generated once per click session and reused on retries with the submit button locked.

### 3.3 Server-Clock Drift Synchronization (`frontend/src/lib/serverClock.js`)
- Client computes `offset = serverTime − Date.now()` from every authoritative REST payload.
- Countdown timer computes remaining duration against authoritative `expiresAt` using synchronized epoch, neutralizing local machine clock tampering.

### 3.4 Production Bundling & Code Splitting (`frontend/vite.config.js`)
- Dynamic imports and `React.lazy` route splitting.
- Heavy dependencies segregated into dedicated vendor chunks via Vite `manualChunks`:
  - `vendor-react` (`react`, `react-dom`, `react-router-dom`)
  - `vendor-tanstack` (`@tanstack/react-virtual`)
  - `vendor-recharts` (`recharts`)
  - `vendor-xlsx` (`xlsx`)
  - `vendor-faceapi` (`face-api.js` loaded only on enrolment / pre-check routes)
- `vite-plugin-compression2` generates pre-compressed `.br` (Brotli) and `.gz` (Gzip) assets for zero-CPU nginx static delivery with `Cache-Control: immutable`.

---

## 4. Test Verification & Results

All test suites passed with 100% pass rates across all domains:

### 4.1 P6 Realtime & Invigilator Dashboard Tests (`tests/p6-realtime-invigilator.test.js`)
- **Suite 1: Handshake Authentication (Fails Closed)**:
  - Missing token rejected with `AUTHENTICATION_FAILED` (✔)
  - Expired / forged token rejected with `AUTHENTICATION_FAILED` (✔)
  - Valid student token admitted (✔)
- **Suite 2: Room Privacy & Isolation**:
  - Student admitted to own `attempt:{attemptId}` room (✔)
  - Student blocked from joining another student's attempt room (✔)
  - Faculty admitted to authorized `inv:{examId}` room; unauthorized staff blocked (✔)
- **Suite 3: 500 ms Roster Delta Coalescing**:
  - 1,000 rapid event notifications fired in 1 s produced $\le 3$ `roster:delta` emissions (✔)
- **Suite 4: Multi-Process Horizontal Fan-out**:
  - Student on Process 1 transmits violation; Invigilator on Process 2 receives delta via Redis adapter (✔)
- **Suite 5: Presence Tracking & REST Resync**:
  - Heartbeat updates online presence; socket disconnect marks offline immediately (✔)
  - `GET /api/v1/attempts/:attemptId/state` returns authoritative status, expiry, and server clock (✔)
- **Suite 6: Invigilator Endpoints**:
  - `GET /summary` returns exact SQL aggregate and live Redis presence count (✔)
  - `GET /roster` performs keyset pagination on `(name, attempt_id)` with bounded payload $< 100\text{ KB}$ (✔)
  - `GET /violations` returns keyset paginated violation stream (✔)
- **Suite 7: Staff Action Commands**:
  - `warnCandidate` dispatches warning and creates audit log (✔)
  - `pauseAttempt` (transitions to `SUSPENDED`) and `resumeAttempt` (transitions to `ACTIVE`) cleanly update DB state machine (✔)
  - `acknowledgeViolation` updates violation metadata and records audit log (✔)
- **Result**: 16/16 passed (0 failures, 22.7 s duration)

### 4.2 P6 Frontend Autosave Unit Tests (`tests/p6-frontend-autosave.test.js`)
- Dirty answer tracking and buffering (✔)
- 5 s interval / event-driven flush with revision advancement (✔)
- 409 `STALE_REVISION` reconciliation (✔)
- Offline memory retention with exponential backoff and jitter (✔)
- Stable `Idempotency-Key` reuse across submit retries (✔)
- Server clock drift offset calculation (✔)
- **Result**: 6/6 passed (0 failures)

### 4.3 Full Regression Verification
- **P5 Storage & Evidence Pipeline**: 13/13 passed (0 failures)
- **P4 Concurrency & Write Paths**: 10/10 passed (0 failures)
- **P3 Schema Constraints & Hot Query Index Scans**: 20/20 passed (0 failures)

---

## 5. Artifacts and Deliverables

| Category | File | Description |
|---|---|---|
| Backend Infra | `src/infra/websocket/socket.server.js` | Socket.IO server with pure WS transport, 64KB buffer, fail-closed auth, private rooms |
| Backend Infra | `src/infra/websocket/presence.js` | Non-authoritative Redis hash presence manager with memory fallback |
| Backend Infra | `src/infra/websocket/rosterCoalescer.js` | 500 ms delta coalescing batcher per exam room |
| Backend Proctoring | `src/modules/proctoring/service.js` | Summary aggregate, keyset roster, violations stream, staff actions |
| Backend Proctoring | `src/modules/proctoring/controller.js` | REST controllers for invigilator endpoints and staff commands |
| Backend Proctoring | `src/modules/proctoring/validation.js` | Zod validation schemas for roster, violation queries, and staff actions |
| Backend Attempts | `src/modules/attempts/controller.js` | Authoritative `GET /api/v1/attempts/:attemptId/state` REST resync endpoint |
| Frontend Store | `src/lib/socketClient.js` | Singleton Socket.IO client configured with pure WS transport and resync hook |
| Frontend Store | `src/lib/serverClock.js` | Client-server clock offset synchronization and countdown |
| Frontend Store | `src/lib/autosaveManager.js` | Dirty tracking, revision control, backoff, and idempotent submission |
| Frontend Store | `src/lib/rosterStore.js` | Typed external store with `useSyncExternalStore` and `startTransition` deltas |
| Frontend UI | `src/components/VirtualizedRoster.jsx` | High-density 60 fps virtualized roster table |
| Frontend Build | `vite.config.js` | Vendor code-splitting (`manualChunks`) and pre-compression (`gzip` + `brotli`) |
| Test Suites | `tests/p6-realtime-invigilator.test.js` | 16 multi-process, presence, coalescing, and endpoint tests |
| Test Suites | `tests/p6-frontend-autosave.test.js` | 6 unit tests for autosave manager and server clock |
| Documentation | `docs/INTERVIEW_NOTES.md` | Section 7: "WebSocket is a notification channel, not a source of truth" |
