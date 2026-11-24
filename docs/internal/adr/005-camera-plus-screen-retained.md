# ADR 005: Dual Video Tracks (Camera + Screen) with Selective SFU Subscription

## Status
Accepted

## Date
2026-10-03

## Context
Notion Step 13 section 13.10 outlines an invigilator bandwidth-saving model that defaults to screen sharing only, omitting live candidate webcams to conserve egress bandwidth. However, academic integrity requirements in the current ProctorNet design mandate both candidate facial monitoring (identity verification, multiple face detection, gaze tracking) and candidate screen sharing (detecting unauthorized apps, browser window state).

Transmitting both tracks unthrottled over full-mesh P2P or raw Socket.IO JPEGs collapsed network links and browser decoders beyond 15–20 candidates (Findings M-01, M-03).

## Decision
1. **Retain Dual Video Tracks**:
   - Both candidate camera and candidate screen tracks are published to the LiveKit SFU.
   - Controlled by application feature flag `PROCTOR_CAMERA_PUBLISH` (default: `true`).
2. **Bandwidth and Bitrate Differentiation**:
   - **Screen Track**: Primary grid track. Published at 1280x720 (simulcast layers: 720p @ 15fps 500kbps, 360p @ 10fps 150kbps, 180p @ 5fps 50kbps).
   - **Camera Track**: Low-bitrate auxiliary track. Published at 320x240 @ 10fps (maximum 100kbps).
3. **Selective Subscription (Dynacast / Focused Stream Model)**:
   - The invigilator live grid subscribes **only** to the lowest simulcast layer (thumbnail) for candidates visible in the viewport.
   - When an invigilator clicks/focuses a specific student tile, the client upgrades subscription for that student's screen track to high-definition (720p) and subscribes to the full camera track.
   - Off-screen tiles in paginated grids are paused via LiveKit dynacast.

## Consequences
### Positive
- Preserves full dual-track proctoring fidelity without sacrificing candidate capacity.
- Bounds total invigilator downlink bandwidth to manageable levels (< 5 Mbps for a 25-candidate visible grid).
- Eliminates O(N^2) socket fan-out and unneeded video decoding churn on the proctor dashboard.

### Negative
- Candidates require sufficient uplink bandwidth to transmit both tracks (approx. 250–600 kbps total).
- Requires WebRTC simulcast support on student browsers.

## Notion Step-13 Alignment
Adapts Notion 13.10 ("Focused Stream Model") to dual video streams via SFU simulcast and viewport-driven selective subscriptions.
