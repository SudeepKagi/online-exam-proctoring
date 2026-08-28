# ProctorNet Live Proctoring Pipeline Architecture & Protocol Specification

## 1. Media Transport Architecture

ProctorNet implements a multi-tier media transport pipeline designed for low-latency live proctoring:

```
                  +-----------------------------------+
                  |          STUDENT BROWSER          |
                  |  - Webcam MediaStream             |
                  |  - Screen Share MediaStream       |
                  +-----------------+-----------------+
                                    |
                    +---------------+---------------+
                    |                               |
                    v                               v
         [Primary: WebRTC P2P]             [Fallback: Socket.io Frames]
     - Dual-track RTCPeerConnection     - 2.5s Adaptive JPEG thumbnails
     - STUN: stun.l.google.com          - Active during negotiation/drop
     - Direct MediaStream rendering     - Throttled to 15s when WebRTC Live
                    |                               |
                    +---------------+---------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        INVIGILATOR CONSOLE        |
                  |  - HTMLVideoElement (WebRTC Live) |
                  |  - Img (Adaptive JPEG Fallback)   |
                  |  - High-res Violation Lightbox    |
                  +-----------------------------------+
```

### Stream Channels
1. **Camera Feed:** Acquired via `navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })`. Track published to peer connection with `streamRef.current`.
2. **Screen Feed:** Acquired via `navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' } })`. Track published to peer connection with `window.screenShareStream`. Auto-monitored; if candidate cancels screen sharing, an immediate `SCREEN_RECORDING_STOPPED` critical violation is dispatched.

---

## 2. WebRTC & Socket.io Control-Plane Protocol

### WebRTC Signaling Sequence
1. Invigilator joins room `inv:${examId}` via Socket.io.
2. Invigilator emits `webrtc:request-stream` with `{ studentId, invId, examId }`.
3. Server validates invigilator's JWT token and exam assignment, then routes to `student:${studentId}`.
4. Student creates an `RTCPeerConnection`, attaches camera and screen tracks, generates SDP Offer, and emits `webrtc:offer`.
5. Invigilator receives `webrtc:offer`, sets remote description, generates SDP Answer, and emits `webrtc:answer`.
6. ICE candidates are exchanged bidirectionally (`webrtc:ice-candidate`).
7. Invigilator receives `pc.ontrack`: assigns camera and screen tracks to active stream registry (`window.activeWebRTCStreams`) and dispatches `student-stream-update`.
8. `WebcamFeed` and `ScreenFeed` bind streams to genuine `<video autoPlay playsInline muted>` elements with live badges (`LIVE WEBRTC` / `LIVE SCREEN`).

### Fallback Adaptive Frame Pipeline
- While WebRTC is negotiating or disconnected, student transmits JPEG snapshots every 2.5s (`exam:frame` and `exam:screenFrame`).
- When `pc.connectionState === 'connected'`, frame transmission throttles to a 15s keepalive heartbeat to conserve network bandwidth.
- If WebRTC connection drops, the 2.5s fallback rate seamlessly resumes.

---

## 3. Invigilator Warning & Message Flow

- **Canonical Event:** `exam:warning`
- **Legacy Alias:** `inv:warn`
- **Flow:**
  1. Invigilator clicks preset or types custom message in `StudentDossierModal` or `InvigilatorLiveGrid`.
  2. Frontend emits `exam:warning` and calls `POST /api/invigilator/send-warning`.
  3. Backend checks role authorization and exam scoping (`req.user.examId === examId`).
  4. Backend creates an audit entry in `EvidenceLog` with `eventType: 'INVIGILATOR_WARNING'`.
  5. Socket server emits `exam:warning` to room `student:${studentId}`.
  6. Student client receives notification and renders an immediate modal/toast alert.

---

## 4. Session Termination Flow

- **Canonical Operation:** `transitionExamSession()`
- **Flow:**
  1. Invigilator clicks "Terminate Session", provides a mandatory reason, and confirms in the destructive safety modal.
  2. Frontend emits `exam:terminate` and calls `POST /api/invigilator/terminate-student/:id`.
  3. Backend runs `transitionExamSession()` inside an atomic database transaction:
     - Mutates `StudentExam.status` to `TERMINATED`.
     - Sets `StudentExam.terminationReason`.
     - Logs critical event to `EvidenceLog`.
     - Calls `syncWireGuardRemovePeer(session.vpnKey)` to immediately revoke WireGuard VPN tunnel access.
  4. Backend broadcasts `exam:terminated` to `student:${studentId}` and `student:stateChange` to `inv:${examId}`.
  5. Student browser receives `exam:terminated`:
     - Disables exam interaction.
     - Immediately stops all webcam and screen recording hardware tracks (`track.stop()`).
     - Closes WebRTC peer connections.
     - Renders immutable red lock screen displaying the official termination reason.
     - Blocks any further answer autosave or re-entry.
  6. Invigilator grid tile transitions to `TERMINATED` status badge.
