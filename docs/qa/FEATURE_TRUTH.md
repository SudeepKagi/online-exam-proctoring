# Feature Truth Audit Ledger (`FEATURE_TRUTH.md`)

> **Protocol Specification (§4.4):** Every claim on every page must strictly reflect reality. Suspect, aspirational, or legacy marketing claims have either been removed, aligned with actual platform behavior, or verified against concrete implementation code and automated tests.

---

## 1. Executive Summary of Reconciled Suspect Claims

| Suspect Claim | Original Claimed Text | Truth Status | Reconciled Platform Reality | Implementation Reference | Verification Evidence |
|---|---|---|---|---|---|
| **24-Seat Concurrent Grid** | *"24-seat live grid supervision with simultaneous feeds"* | **Refined to Truth** | The live grid is paginated (adaptive grid layout showing active candidates with instant search, status filtering, and pagination) to prevent browser DOM exhaustion and WebRTC SFU saturation. | `proctornet/frontend/src/pages/invigilator/InvigilatorLiveGrid.jsx` | `proctornet/backend/tests/route-matrix.test.js`, Manual pagination verification |
| **Two-Way Audio** | *"Two-way live audio communication with candidate"* | **Removed / Reconciled** | Candidate audio is streamed one-way to invigilators (WebAudio VAD detects whispering/speech). Invigilators communicate via real-time WebSocket warning messages and announcements. | `proctornet/frontend/src/pages/invigilator/InvigilatorLiveGrid.jsx`, `proctornet/frontend/src/lib/socketClient.js` | `shared/violationTypes.json`, `tests/q3-student-flow.test.js` |
| **1080p Dual Video Stream** | *"1080p full HD dual-camera stream"* | **Refined to Truth** | Streams are intentionally low-bitrate and adaptive (320×240 / 640×480 @ 15 fps VP8 SFU) to prevent network congestion across hundreds of concurrent exam takers on university networks. | `proctornet/frontend/src/lib/proctorMedia.js` (lines 45–60: max 250 kbps video) | `tests/load/chaos/chaos-runner.js --scenario sfu_ladder` |
| **Continuous Biometric Check** | *"Continuous real-time AI biometric recognition"* | **Refined to Truth** | Pre-exam verification matches the candidate's live webcam snapshot against their registered institutional ID photo. In-exam proctoring uses periodic face re-verification and head pose tracking to prevent client thermal throttling. | `proctornet/frontend/src/pages/student/SecurityCheck.jsx`, `proctornet/frontend/src/hooks/useProctoringMonitors.js` | `proctornet/backend/tests/q3-student-flow.test.js` |
| **Deployed to Active Clusters** | *"Settings deployed across all active container clusters"* | **Removed** | Abstracted to clean institutional policy persistence. Configuration is saved authoritatively in platform settings and applied across exam sessions. | `proctornet/frontend/src/pages/admin/Settings.jsx` | `tests/reset-keep-admin.test.js` |
| **Unconsumed Settings Toggles (J-02)** | *PaddleOCR, CompreFace, SwiftShader, VirtualBox toggles* | **Removed / Re-scoped** | Eliminated dead toggles for non-existent or vendor-specific engines. Settings UI strictly controls active features: Face & Identity Verification, ID Document Verification, Security & Device Monitoring, Display Watermark & Full-Screen Mode. | `proctornet/frontend/src/pages/admin/Settings.jsx` | AST banned-term scan, Settings persistence API |
| **Code Similarity Analysis** | *"Code similarity & plagiarism scanning"* | **Removed** | Platform exclusively conducts 100% objective multiple-choice (MCQ) examinations with instant automated grading. No coding questions exist or are claimed. | `proctornet/frontend/src/pages/faculty/CreateExam.jsx`, `LandingPage.jsx` | `proctornet/backend/tests/mcq-validation.test.js` (DOD-02) |

---

## 2. Page-by-Page Claim Audit & Verification

### 2.1 Landing Page (`proctornet/frontend/src/pages/LandingPage.jsx`)

| UI Section / Card | User-Facing Claim | Implemented? | Reality & Implementation Mechanism | Test Reference |
|---|---|---|---|---|
| **Hero Title** | *"Run Secure Exams with Smart Proctoring & Verified Integrity"* | **Yes** | Identity verification, browser lockdown, live monitoring, and instant evaluation active. | `e2e/capture-baselines.spec.js` |
| **Hero Subtitle** | *"Conduct high-stakes university and college examinations with identity verification, live camera and screen monitoring, a secure exam mode, and automated integrity checks."* | **Yes** | All 4 functional pillars exist and are tested. | `tests/load/verify-integrity.js` |
| **Trust Strip** | *Identity Verification · Before and during the exam* | **Yes** | Reference photo comparison during pre-exam gate; periodic re-verification during active exam. | `SecurityCheck.jsx`, `useProctoringMonitors.js` |
| **Trust Strip** | *Live Monitoring · Camera & screen* | **Yes** | SFU media pipeline publishes camera and screen tracks; invigilator receives live tiles. | `proctorMedia.js`, `proctorViewer.js` |
| **Trust Strip** | *Instant Evaluation · Objective exams* | **Yes** | Asynchronous outbox worker computes score immediately upon submit; instant score display. | `evaluationWorker.js`, `DOD-05` |
| **Spec Ribbon** | *4-Stage Pre-Exam Checks (Device, camera & identity)* | **Yes** | Sequential wizard: BYOD agent check, media authorization, identity match, full-screen lock. | `SecurityCheck.jsx` (stages 0–3) |
| **Spec Ribbon** | *Live Camera & Screen Monitoring* | **Yes** | LiveKit SFU media plane with adaptive bitrate. | `proctorMedia.js` |
| **Spec Ribbon** | *100% MCQ Objective Exams* | **Yes** | Enforced at database schema level, backend validator, and frontend editor. | `mcq-validation.test.js` |
| **Spec Ribbon** | *4 Portals: Candidate, Faculty, Invigilator & Admin* | **Yes** | Discrete role workspaces with strict route-matrix authorization. | `route-matrix.test.js` |
| **Student Exam Portal** | *"Take assigned exams in a secure full-screen exam mode with guided pre-exam checks, identity verification, and objective-type assessments."* | **Yes** | Real student assessment lifecycle from lobby to submission. | `q3-student-flow.test.js` |
| **Faculty Exam Suite** | *"Create and manage question papers, build exams from a topic or your own material with a question assistant, and review results and integrity reports."* | **Yes** | Exam builder, PDF question extractor, CSV/XLSX results dossier export. | `CreateExam.jsx`, `Results.jsx` |
| **Live Invigilator Grid** | *"Supervise concurrent exam sessions from a live monitoring grid, receive instant alerts, and message candidates directly."* | **Yes** | Real-time candidate feed, violation triage feed, direct candidate warning dispatch. | `InvigilatorLiveGrid.jsx`, `Violations.jsx` |
| **Administrator Console** | *"Configure exam policies, approve accounts, onboard rosters in bulk, and review a complete audit trail."* | **Yes** | Institutional settings, roster import, identity verification review list. | `AdminEnrollmentReview.jsx`, `Settings.jsx` |

---

### 2.2 Student Examination Lifecycle

| Page / Component | Claim | Implemented? | Reality & Implementation Mechanism | Test Reference |
|---|---|---|---|---|
| **Lobby** (`ExamLobby.jsx`) | *"Early Checkup Window Open (5 mins prior): Complete your hardware & identity verification early!"* | **Yes** | Server-synchronized countdown triggers pre-exam gate exactly 5 minutes before scheduled start time. | `useExamTimer.js`, `examScheduler.js` |
| **Security Check** (`SecurityCheck.jsx`) | *"Environment Check — Confirms your browser, display and device meet exam requirements."* | **Yes** | Local device companion checks running process list on port 49152 against prohibited list. | `SecurityCheck.jsx:217` |
| **Security Check** (`SecurityCheck.jsx`) | *"Camera & Screen — Checks that your camera and screen sharing are working."* | **Yes** | Native `getUserMedia` and `getDisplayMedia` test feeds with live volume meter and video preview. | `BYODDeviceCheck.jsx` |
| **Security Check** (`SecurityCheck.jsx`) | *"Identity Match — Matches you against your registered profile photo."* | **Yes** | Client-side face detector matches live camera frame against registered student reference photo. | `SecurityCheck.jsx:437` |
| **Security Check** (`SecurityCheck.jsx`) | *"Secure Exam Mode — Starts full-screen mode with focus and window monitoring."* | **Yes** | Requests browser Fullscreen API; overlays compliance prompt if student leaves full screen. | `FullscreenComplianceOverlay.jsx` |
| **Exam Interface** (`ExamInterface.jsx`) | *"Answers saved automatically as you progress."* | **Yes** | CAS AutosaveManager batches answers every 5 seconds or immediately on question change with revision tracking. | `autosaveManager.js`, `p6-frontend-autosave.test.js` |
| **Exam Interface** (`ExamInterface.jsx`) | *"Session auto-submits when countdown reaches zero."* | **Yes** | Authority-backed timer derives remaining duration from `expiresAt` and fires idempotent auto-submit. | `useExamTimer.js` |

---

### 2.3 Faculty & Invigilator Portals

| Page / Component | Claim | Implemented? | Reality & Implementation Mechanism | Test Reference |
|---|---|---|---|---|
| **Create Exam** (`CreateExam.jsx`) | *"Question Assistant — Upload a PDF or paste notes to generate your question pool"* | **Yes** | Text extraction from PDF via PDF.js worker, questions populated into draft pool with validation. | `CreateExam.jsx:105` |
| **Create Exam** (`CreateExam.jsx`) | *"Objective multiple-choice format with positive & negative marking"* | **Yes** | Questions support 2–6 choices, exactly one correct choice, configurable mark values. | `mcq-validation.test.js` |
| **Live Grid** (`InvigilatorLiveGrid.jsx`) | *"Live multi-candidate monitoring with instant incident alerts"* | **Yes** | Paginated video grid connecting to SFU media tracks; real-time Socket.IO incident notification banner. | `InvigilatorLiveGrid.jsx`, `socketClient.js` |
| **Violations** (`Violations.jsx`) | *"Incident triage with severity filtering, acknowledgment, and report export"* | **Yes** | Filter by severity, candidate USN, or incident category; export audit report. | `Violations.jsx:345` |
| **Results** (`Results.jsx`) | *"Instant scoring breakdown, candidate performance metrics, and security audit reports"* | **Yes** | Instant grading computed via worker; exportable audit report. | `Results.jsx:65` |

---

### 2.4 Administrative Console

| Page / Component | Claim | Implemented? | Reality & Implementation Mechanism | Test Reference |
|---|---|---|---|---|
| **Enrollment Review** (`AdminEnrollmentReview.jsx`) | *"Review and authorize student college ID credentials, webcam selfies, and document details."* | **Yes** | Split-screen comparison of student uploaded college ID card and live verification selfie. | `AdminEnrollmentReview.jsx:320` |
| **Bulk Account Creation** (`BulkCreateAccounts.jsx`) | *"Upload spreadsheet or PDF roster to parse, review, and generate credentials in bulk."* | **Yes** | Client-side spreadsheet parser creates accounts and generates secure temporary password document. | `BulkCreateAccounts.jsx:150` |
| **Settings** (`Settings.jsx`) | *"Institutional policy configuration for identity verification, document checks, and secure exam mode."* | **Yes** | Persisted platform settings in database controlling proctoring strictness across assessments. | `Settings.jsx`, `reset-keep-admin.test.js` |

---

## 3. Verification Protocol & Continuous Audit

1. **Banned Term Scanner (`scripts/ci/scan-banned-terms.js`):** Run on every pull request to guarantee zero user-visible leaks of internal technologies, vendors, or protocols.
2. **Route Inventory Verification (`scripts/ci/generate-route-inventory.js`):** Asserts all exposed API endpoints match documented service capabilities.
3. **Integrity Verification Script (`tests/load/verify-integrity.js`):** Asserts CAS revision consistency, zero double evaluations, and zero data leakage across 100+ concurrent virtual students.
