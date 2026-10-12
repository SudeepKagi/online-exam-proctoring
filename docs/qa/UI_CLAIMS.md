# ProctorNet UI Claims vs. Code Ground Truth

This document audits all user-facing status claims displayed across the ProctorNet web interface and maps each claim to its exact backing implementation and verifiable source of truth.

---

## 1. Candidate Identity & Profile Claims

| UI Text / Badge | Condition Under Which It Appears | Backing Implementation & Ground Truth | Verified By |
| :--- | :--- | :--- | :--- |
| **"Registered"** | Face and ID card photos exist, verified by S3 HeadObject check, profile status `VERIFIED`, and approved by faculty. | `student/presenter.js`: `photoAvailable: true`, `idPhotoAvailable: true`, `approvalStatus === 'APPROVED'` | `tests/w1-student-presenter.test.js` |
| **"ID Uploaded"** | Both face photo and government/college ID photo verified in storage, awaiting staff review. | `student/presenter.js`: `photoAvailable: true`, `idPhotoAvailable: true`, `approvalStatus !== 'APPROVED'` | `tests/w1-student-presenter.test.js` |
| **"Re-upload Required"** | Student has photo keys in DB, but S3 HeadObject check fails (file missing/deleted/corrupted), or profile status is `FLAGGED`. | `student/presenter.js`: `facePhotoKey` present but HeadObject returns 404, or `profileStatus === 'FLAGGED'` | `tests/w1-student-presenter.test.js` |
| **"Not Registered"** | Student has not completed profile photo onboarding. | `student/presenter.js`: `facePhotoKey: null` and `idCardPhotoKey: null` | `Profile.jsx` |
| **Profile Photo Rendering** | Real presigned URL from S3/MinIO rendered with automatic error fallback to neutral initials avatar. | `<SignedImage>` component; presigned URL valid for 1 hour; profile auto-refreshes after 50 minutes tab dormancy. | `SignedImage.jsx`, `Profile.jsx` |

---

## 2. Exam Device Companion & Hardware Claims

| UI Text / Badge | Condition Under Which It Appears | Backing Implementation & Ground Truth | Verified By |
| :--- | :--- | :--- | :--- |
| **"Companion: Active"** / **"HEALTHY"** | Companion app is running on the student's machine, paired to this exact `attemptId`, heartbeat is fresh (< 45s), release hash matches active release, and 0 blocking findings. | `agent/agentGate.js`: `evaluateDeviceGate({ attemptId, exam })` returns `passed: true`, `state: 'HEALTHY'`. Practice `PRECHECK` sessions are strictly isolated and never satisfy attempt gate. | `tests/w2-agent-gate.test.js` |
| **"Companion: Waived"** | Exam faculty/invigilator granted a formal waiver for this attempt. | `agent/agentGate.js`: `prisma.deviceAgentWaiver.findUnique({ where: { attemptId } })` exists. | `tests/w2-agent-gate.test.js` |
| **"Companion: Not Paired"** | Student has not paired the companion app for this examination attempt. | `agent/agentGate.js`: `getSessionByAttemptId(attemptId)` returns null or `TERMINATED`. | `tests/w2-agent-gate.test.js` |
| **"Companion: Lost Connection"** | Companion was paired but heartbeat has not been received within 45 seconds. | `agent/agentGate.js`: `Date.now() - session.lastSeenAt > AGENT_STALE_MS` (45s). | `tests/w2-agent-gate.test.js` |
| **"Prohibited software detected"** | Companion detected active prohibited processes (e.g. AnyDesk, TeamViewer) with policy action `BLOCK_START`. | `agent/agentGate.js`: `session.openFindings` contains rules with `action: 'BLOCK_START'`. | `tests/w2-agent-gate.test.js` |

---

## 3. Network & Security Environment Claims

| UI Text / Badge | Condition Under Which It Appears | Backing Implementation & Ground Truth | Verified By |
| :--- | :--- | :--- | :--- |
| **"Network: Connected (Secure)"** | Student browser is operating in secure context (HTTPS / TLS) AND live WebSocket connection to ProctorNet server is active. | `SecurityCheck.jsx`: `isHttpsSecure && isSocketConnected`. Real-time socket events track connect/disconnect. | `SecurityCheck.jsx` |
| **"Network: HTTPS Secure"** | Operating over HTTPS with socket reconnecting. | `SecurityCheck.jsx`: `isHttpsSecure && !isSocketConnected`. | `SecurityCheck.jsx` |
| **"Full-Screen Mode: Locked"** | HTML5 Fullscreen API is actively engaged (`document.fullscreenElement !== null`). | `SecurityCheck.jsx`: `fullscreenchange` event listener updates state instantly on lock/unlock. | `SecurityCheck.jsx` |
| **"Full-Screen Mode: Click button below to enter full screen"** | Student has browser maximized or in F11 mode, but assessment lock API has not been triggered. | `SecurityCheck.jsx`: `isF11Mode` detection (`window.innerHeight >= screen.height - 10`). | `SecurityCheck.jsx` |

---

## 4. Question Assistant & AI Generation Claims

| UI Text / Badge | Condition Under Which It Appears | Backing Implementation & Ground Truth | Verified By |
| :--- | :--- | :--- | :--- |
| **"Question Assistant" (Active)** | Real LLM provider configured (`groq`, `openai`, `google`, `anthropic`) with valid API key. | `router.js` `/api/v1/config`: `llmEnabled: true`. `llmService.js` routes to provider with strict schema validation. | `tests/w3-groq-llm.test.js` |
| **"Question assistant isn't enabled — ask the administrator"** | `LLM_PROVIDER=none` or API key unconfigured. Button shows (Setup) badge and clearly explains server status. | `shared/config.js`: `llmEnabled: false`. Off means off — zero fake generation or mock fallbacks. | `QuestionPool.jsx` |
