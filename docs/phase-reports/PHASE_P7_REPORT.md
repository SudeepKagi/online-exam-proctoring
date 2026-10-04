# Phase P7 Report — Media Plane: LiveKit SFU (The "Multiple Users" Fix)

**Branch**: `feature/p7-media-plane-livekit-sfu`  
**Status**: Complete  
**Date**: October 2026  
**Reference**: ADR-008 / Notion 13.10  

---

## 1. Executive Summary

Phase P7 resolves the fundamental video media scaling bottleneck in ProctorNet by replacing the legacy WebRTC P2P mesh and JPEG-over-socket fallback with an enterprise-grade **LiveKit Selective Forwarding Unit (SFU)**.

### Core Architectural Principle
> *"Mesh is $\mathcal{O}(N \times M)$; SFU makes the publisher cost $\mathcal{O}(1)$ and the viewer cost $\mathcal{O}(\text{visible})$. Selective subscription is what makes it scale."*

In the legacy design:
- Every candidate uploaded video frames directly to every active invigilator ($\mathcal{O}(N \times M)$), saturating campus uplinks.
- Invigilators decoded $2N$ full-resolution streams simultaneously, causing browser CPU saturation ($100\%$) and crash loops at $N \ge 50$.
- Fallback base64 JPEG canvas capture flooded WebSocket channels with megabytes of binary data, blocking Node.js event loops.

With the LiveKit SFU:
- Each candidate uploads **exactly one copy** of their media stream ($\mathcal{O}(1)$).
- Invigilators subscribe **selectively** only to visible viewport tiles (`autoSubscribe: false`, $\mathcal{O}(\text{visible})$), receiving low-bitrate VP8 simulcast layers.
- Application servers (Node.js) carry **zero media bytes**.

---

## 2. Deliverables & Technical Implementation

### 2.1 LiveKit Server Architecture & Deployment (`ops/livekit/livekit.yaml` & `docker-compose.yml`)
- **Pinned Current Stable Image**: Pinned `livekit/livekit-server:v1.13.7` (dropped `v1.5.0` and deprecated `latest`).
- **Host Networking & Single UDP Mux**: Reference configuration uses Linux host networking, eliminating Docker NAT overhead and UDP port-range translation bugs.
- **Port Allocations**:
  - `7880/tcp`: Signaling & HTTP/WSS endpoint.
  - `7881/tcp`: ICE/TCP fallback transport.
  - `7882/udp`: Single consolidated media mux port.
  - `3478/udp`: TURN media traversal.
  - `5349/tcp`: TURN/TLS (secure corporate/campus firewall traversal on port 443 option documented).
- **Hardened Policies**:
  - `rtc.congestion_control: true`, `rtc.use_external_ip: true`.
  - `room.auto_create: false` (rooms created exclusively through backend authorization).
  - `room.empty_timeout: 300` (5 minutes cleanup on empty rooms).
  - `room.max_participants: 1200` (bounded per exam session).
  - Secure API keys mapped via environment variables (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`), strictly deprecating `devkey`.

### 2.2 Token Service & RBAC Authorization (`src/modules/media/media.service.js`)
Implemented `MediaService` leveraging `livekit-server-sdk` (`AccessToken`, `RoomServiceClient`, `WebhookReceiver`):
- **Candidate Token (`student:{attemptId}`)**:
  - Validated against SQL: candidate must own an `ACTIVE` or `SUSPENDED` attempt on the specified exam.
  - Grants: `canPublish: true`, `canSubscribe: false` (strict anti-spying privacy guard — candidates cannot subscribe to other candidates or staff), `canPublishData: false`.
  - Sources: `TrackSource.SCREEN_SHARE` (and `TrackSource.CAMERA` if `PROCTOR_CAMERA_PUBLISH=true`).
  - TTL: Bound strictly to remaining attempt duration + 5 minutes grace (`expiresAt - now + 300s`).
  - Terminal guard: Attempts in `TERMINATED`, `SUBMITTED`, or `EXPIRED` states are rejected immediately (403 Forbidden).
- **Staff Token (`inv:{userId}:{rand}`)**:
  - Validated against SQL: faculty must own the exam; invigilators must be authorized for the exam scope; admins have global authority.
  - Grants: `canPublish: false`, `canSubscribe: true`, `hidden: true` (proctors are invisible in candidate participant rosters), TTL 4 hours (14400s).
- **Attempt State Machine Integration**:
  - Transitioning an attempt to terminal states (`TERMINATED`, `EXPIRED`, `SUBMITTED`) triggers `RoomServiceClient.removeParticipant(room, identity)` to cleanly evict disconnected candidates.

### 2.3 Authoritative Webhook Receiver & Debounced Violations
- Mounted on both `POST /internal/livekit/webhook` and `POST /api/v1/proctoring/livekit/webhook`.
- Express parses `req.rawBody` for cryptographic signature verification.
- Verified using `WebhookReceiver.receive(rawBody, authHeader)`: HMAC SHA-256 digest validation prevents header tampering or replay attacks.
- Authoritative event handling:
  - `track_unpublished` for screen share by candidate records `SCREEN_SHARE_STOPPED` violation in database.
  - **Debouncing**: 5-second cooldown map prevents duplicate violations from rapid transient renegotiations.
  - **Notion 13.10 §15 Principle**: Media failure is assigned `MEDIUM` severity, never treated as proof of cheating. Candidate UI prompts to re-share screen.

### 2.4 Candidate Publisher (`frontend/src/lib/proctorMedia.js`) — Compression by Design
- Upgraded to `livekit-client` v2 (`^2.22.3`).
- **VP8 Simulcast Default**:
  - *Screen Share*: $1280 \times 720$ @ 5 fps, max bitrate $400\text{ kbps}$, `contentHint: 'detail'`, degradation preference `maintain-resolution`.
  - *Low Simulcast Layer*: $640 \times 360$ @ 3 fps, $\le 120\text{ kbps}$.
  - *Webcam (if enabled)*: $320 \times 180$ @ 15 fps, max bitrate $150\text{ kbps}$, `contentHint: 'motion'`, non-simulcast, DTX enabled.
- **Auto-reconnect & Failure Recovery**:
  - Listens to `LocalTrackUnpublished` and `track.ended` to trigger `SCREEN_SHARE_STOPPED` alert.
  - Built-in connectivity test probe (UDP $\to$ TCP $\to$ TURN/TLS).

### 2.5 Invigilator Viewer (`frontend/src/lib/proctorViewer.js`) — Selective Subscription
- Connected with `autoSubscribe: false` and `adaptiveStream: true`.
- **Viewport-Driven Grid**:
  - Paginated grid (default 12 tiles/page).
  - Tiles subscribe **only while visible** in viewport via `IntersectionObserver`.
  - Grid tiles request `VideoQuality.LOW` ($640 \times 360$ @ 3 fps $\le 120\text{ kbps}$).
- **Focus Promotion**:
  - Clicking a candidate promotes screen to `VideoQuality.HIGH` + camera to `VideoQuality.MEDIUM`.
  - Strictly capped: `MAX_HIGH_QUALITY_STREAMS = 4`.
  - Auto-focus on alert: High/critical violations automatically promote candidate for 60 seconds.
  - Off-page / off-screen tiles are completely unsubscribed (`publication.setSubscribed(false)`), reducing decode load to $\mathcal{O}(\text{visible})$.

### 2.6 Purged Legacy Code & Globals
- Completely removed `webrtc:*` socket handlers and custom signaling loops from `useExamSocket.js` and `useInvigilatorSocket.js`.
- Deleted canvas snapshot loops (`exam:frame`, `exam:screenFrame`, `student:cameraFrame`).
- Purged window globals: `window.activeWebRTCStreams`, `window.latestStudentFrames`, `window.screenShareStream`, `global.latestLiveFrames`.
- Removed hand-rolled JWT minting in `services/livekit.service.js`.

---

## 3. Capacity & Bandwidth Modeling (`docs/architecture/media-capacity.md`)

| Metric | Mesh / JPEG-over-Socket (Legacy) | LiveKit SFU (P7 Architecture) |
|---|---|---|
| **Publisher Ingress Bandwidth** | $\mathcal{O}(N \times M)$ ($4\text{ Mbps}$ per student @ 10 viewers) | $\mathcal{O}(1)$ ($0.4\text{ Mbps}$ screen + $0.15\text{ Mbps}$ cam = **$0.55\text{ Mbps}$**) |
| **Total SFU Ingress (500 Students)** | N/A (P2P collapse) | **$275\text{ Mbps}$** |
| **Total SFU Ingress (2,500 Students)** | N/A (Total failure) | **$1.375\text{ Gbps}$** |
| **Invigilator Egress Bandwidth** | $\mathcal{O}(N)$ ($250\text{ Mbps}$ for 500 students) | $\mathcal{O}(\text{visible})$ (**$1.7 - 2.0\text{ Mbps}$** for 12 tiles) |
| **Invigilator Decode Load** | $2N$ full-resolution streams (CPU crash at 50) | 12 low-res VP8 streams ($< 8\%$ CPU in Chromium) |
| **Node.js Media Traffic** | Megabytes of base64 JPEG strings | **0 bytes** (100% SFU bypass) |

---

## 4. Verification & Test Suite Summary

Mandatory automated test suite implemented in `tests/p7-media-livekit.test.js` (**20 tests passed, 0 failed**):
1. **Token Authorization Matrix**:
   - Candidate receives token with `canPublish: true, canSubscribe: false`, bounded TTL (`remaining + 300s`).
   - BOLA guard: Candidate cannot request token for another candidate's attempt.
   - Terminal state guard: Candidates with `TERMINATED` or `SUBMITTED` attempts are rejected (403 Forbidden).
   - Staff receives token with `canSubscribe: true, canPublish: false, hidden: true`, TTL 4 hours (14400s).
   - Cross-exam scope guard: Faculty cannot access exams they do not own.
   - Admin exemption: System administrators can access any exam media session.
2. **Webhook Cryptographic Verification**:
   - Missing Authorization header rejected with 403 Forbidden.
   - Malformed or invalid JWT rejected with 403 Forbidden.
   - Forged token signed with wrong secret rejected with 403 Forbidden.
   - Tampered payload (sha256 mismatch) rejected with 403 Forbidden.
   - Authoritative `track_unpublished` of screen share creates `SCREEN_SHARE_STOPPED` violation in DB.
   - 5-second debounce window prevents duplicate violation spam.
   - Unpublishing non-screen track (e.g. camera) or staff track does not trigger violation.
3. **State Machine Eviction**:
   - Transitioning attempt to `TERMINATED` invokes `RoomServiceClient.removeParticipant`.
4. **Frontend Architecture Contracts**:
   - `proctorMedia.js` enforces VP8 simulcast, 720p @ 5 fps (400 kbps), 320x180 camera (150 kbps), DTX, detail contentHint.
   - `proctorViewer.js` enforces `autoSubscribe: false`, adaptiveStream, VideoQuality.LOW for grid, MAX_HIGH_QUALITY_STREAMS = 4.
   - Zero occurrences of `webrtc:*`, `exam:frame`, or `window.*` media globals across frontend codebase.
5. **Capacity Documentation**:
   - Verified `docs/architecture/media-capacity.md` matches mathematical models.

---

## 5. Full Regression Results

All existing regression suites executed and passed:
- `tests/p3-schema-constraints.test.js`: 20/20 passed
- `tests/p4-concurrency-write-paths.test.js`: 10/10 passed
- `tests/p5-storage-evidence.test.js`: 13/13 passed
- `tests/p6-realtime-invigilator.test.js`: 16/16 passed
- `tests/p6-frontend-autosave.test.js`: 6/6 passed
- `tests/p7-media-livekit.test.js`: 20/20 passed
- **Total Tests Passing**: 85 / 85 tests passing.
- **Server Health**:
  - Backend API: `http://localhost:5000/health` (HTTP 200 OK)
  - Frontend SPA: `http://localhost:5173` (HTTP 200 OK)
