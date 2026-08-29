# ProctorNet: Online Exam Proctoring & Network Isolation System

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933.svg?style=flat&logo=nodedotjs)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19.2-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![Python](https://img.shields.io/badge/Python-v3.9%2B-3776AB.svg?style=flat&logo=python)](https://python.org/)
[![WireGuard](https://img.shields.io/badge/WireGuard-VPN%20Kernel-88171A.svg?style=flat&logo=wireguard)](https://www.wireguard.com/)
[![Prisma](https://img.shields.io/badge/Prisma-v5.22-2D3748.svg?style=flat&logo=prisma)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v15-4169E1.svg?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-v4.6-010101.svg?style=flat&logo=socketdotio)](https://socket.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat)](LICENSE)

ProctorNet is a multi-tier online examination proctoring and laboratory network containment system. Engineered for high-stakes university assessments and Bring Your Own Device (BYOD) testing environments, ProctorNet combines **kernel-level WireGuard VPN network isolation**, a **local OS process inspection agent**, **computer vision face verification & ID card OCR**, **real-time Socket.IO and WebRTC dual-stream video invigilation**, and an **authoritative database-backed session state machine**.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Core Subsystems](#core-subsystems)
  - [1. Network Isolation Layer (WireGuard VPN)](#1-network-isolation-layer-wireguard-vpn)
  - [2. BYOD Companion Agent](#2-byod-companion-agent)
  - [3. Biometric Verification & OCR Engine](#3-biometric-verification--ocr-engine)
  - [4. In-Exam Proctoring & Kiosk Enforcement](#4-in-exam-proctoring--kiosk-enforcement)
  - [5. Real-Time Video Invigilation & Socket Architecture](#5-real-time-video-invigilation--socket-architecture)
  - [6. Authoritative Exam Session State Machine](#6-authoritative-exam-session-state-machine)
  - [7. Question Bank & Monaco Coding IDE](#7-question-bank--monaco-coding-ide)
- [Database Schema (Prisma ORM)](#database-schema-prisma-orm)
- [Security Architecture](#security-architecture)
- [End-to-End System Workflows](#end-to-end-system-workflows)
- [Automated Testing & Verification](#automated-testing--verification)
- [Project Directory Structure](#project-directory-structure)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Known Limitations & Design Trade-offs](#known-limitations--design-trade-offs)
- [Implementation Status](#implementation-status)
- [License](#license)

---

## Problem Statement

Remote and unproctored online assessments face critical security vulnerabilities:
1. **Network Breakout & External Assistance**: Students can communicate via unmonitored network connections, secondary messaging apps, or external search engines.
2. **Unauthorized Background Software**: Screen sharing tools (AnyDesk, TeamViewer), virtual camera injectors (OBS Virtual Camera, ManyCam), and local AI assistant clients (ChatGPT, Copilot, Ollama) undermine test integrity.
3. **Identity Impersonation**: Proxies or unauthorized individuals taking exams in place of enrolled students.
4. **UI State Tampering & Tab Switching**: Loss of exam focus, unauthorized browser navigation, and copy-pasting answers.
5. **State Desynchronization & Concurrency Collisions**: Client-side state manipulations attempting to resume terminated sessions, extend timers, or overwrite submitted answers.

ProctorNet addresses these vulnerabilities through defense-in-depth: kernel-level split-tunnel VPN containment, an endpoint companion agent, biometric identity verification, continuous in-browser monitoring, and a server-authoritative state machine.

---

## System Architecture

ProctorNet is structured across distinct service boundaries communicating over REST APIs, WebSockets, and SSH control channels:

```mermaid
graph TD
    %% Client Workstation
    subgraph Client Workstation
        BrowserApp["Student / Invigilator Web App<br/>(React 19 + Vite :5173)"]
        LocalAgent["BYOD Companion Agent<br/>(Node.js http :49152)"]
        WGClient["WireGuard Desktop Client<br/>(Tunnel Adapter 10.0.0.x)"]
    end

    %% Backend Tier
    subgraph Core Infrastructure
        NodeBackend["Backend API Gateway<br/>(Node.js + Express + Socket.io :5000)"]
        PythonAI["AI & OCR Microservice<br/>(Python + Flask + OpenCV + OCR :5001)"]
        PostgresDB[("PostgreSQL Database<br/>(Prisma ORM 21 Models)")]
        CloudinaryCDN[("Cloudinary Media Storage<br/>(Evidence & ID Cards)")]
    end

    %% Network Isolation Tier
    subgraph Network Isolation Server
        WGKernel["WireGuard Kernel Module (wg0 :51820)<br/>UDP Split-Tunnel Pool 10.0.0.0/24"]
        UnboundDNS["Unbound DNS Server (:53)<br/>Domain Whitelist Filtering"]
        IPTableFW["iptables / NAT Packet Filter"]
    end

    %% Optional Extensions
    subgraph Optional Integrations
        CompreFace["Exadel CompreFace (:8000)<br/>(Optional Face Recognition API)"]
        LiveKitSFU["LiveKit Media Server (:7880)<br/>(Optional WebRTC SFU)"]
    end

    %% Connections
    BrowserApp -- "HTTP REST (withCredentials) & Socket.io" --> NodeBackend
    BrowserApp -- "GET /scan & /vpn-check (localhost)" --> LocalAgent
    BrowserApp -- "face-api.js (in-browser)" --> BrowserApp
    LocalAgent -- "tasklist / ps aux & ipconfig / ip addr" --> LocalAgent

    NodeBackend -- "Prisma Client (CRUD & Transactions)" --> PostgresDB
    NodeBackend -- "REST /api/face & /api/ocr & /api/ai" --> PythonAI
    NodeBackend -- "SSH: sudo wg set wg0 peer..." --> WGKernel
    NodeBackend -- "Multipart Form / Media Streams" --> CloudinaryCDN

    WGClient == "Encrypted WireGuard UDP Tunnel" ==> WGKernel
    WGKernel --> UnboundDNS
    WGKernel --> IPTableFW

    NodeBackend -. "Optional Face API" .-> CompreFace
    NodeBackend -. "Optional SFU Token" .-> LiveKitSFU
```

---

## Technology Stack

### Verified Dependencies & Runtime Requirements

| Layer | Component | Version / Technology | Verified Responsibilities in Codebase |
| :--- | :--- | :--- | :--- |
| **Frontend** | React | `^19.2.5` | Single-page application, multi-role routing, reactive UI state. |
| | Vite | `^8.0.10` | Frontend tooling, build pipeline, and local dev server. |
| | Tailwind CSS | `^4.3.0` | CSS utility architecture, dark charcoal dashboard styling. |
| | Monaco Editor | `@monaco-editor/react ^4.7.0` | In-browser coding exam IDE with syntax highlighting. |
| | In-Browser Vision | `face-api.js ^0.22.2` | Client-side TinyFaceDetector polling loop (every 4 seconds). |
| | Real-Time Client | `socket.io-client ^4.8.3` | Dual-stream signaling, live proctoring alerts, exam chat. |
| | Data Tables & Charts | `@tanstack/react-table`, `recharts` | Invigilator metrics, candidate rosters, audit log viewer. |
| | UI Primitives | `radix-ui`, `lucide-react`, `sonner` | Accessible dialogs, toast alerts, iconography, modals. |
| **Backend Gateway** | Runtime | `Node.js >= 18.0.0` | Asynchronous API gateway and WebSocket server runtime. |
| | Web Framework | `express ^4.18.2` | REST API routing, rate limiting, request validation, error handling. |
| | Real-Time Server | `socket.io ^4.6.1` | Room-isolated socket signaling, video frame relays, live alerts. |
| | ORM | `@prisma/client ^5.22.0` | Type-safe PostgreSQL client, migrations, multi-table transactions. |
| | Authentication | `jsonwebtoken ^9.0.0`, `bcryptjs ^2.4.3` | JWT issuance, password hashing (10 salt rounds), cookie auth. |
| | Security | `helmet ^7.0.0`, `cookie-parser ^1.4.7` | Security headers, HttpOnly cookie extraction, CSRF defense. |
| | Image / OCR | `tesseract.js ^7.0.0`, `pdf-lib`, `xlsx` | In-process OCR parsing, PDF generation, Excel roster import. |
| | Cloud Media | `cloudinary ^1.37.3` | Evidence photo, student profile, and ID snapshot storage. |
| **Python AI Microservice** | Framework | `Flask >= 2.3.2`, `flask-cors >= 4.0.0` | Python microservice exposed on port `5001`. |
| | Computer Vision | `opencv-python >= 4.8.0`, `Pillow`, `numpy` | HSV histogram correlation, Laplacian sharpness liveness check, Haar cascades. |
| | Face Detection | `mtcnn` (lazy-loaded fallback) | MTCNN / Haar cascade bounding box ID card face cropping. |
| | OCR Engines | `pytesseract >= 0.3.10` / `paddleocr` | Text extraction, USN pattern parsing from student ID cards. |
| | LLM Integration | `requests`, optional `openai` | OpenAI GPT-3.5 API question generation with curated fallback. |
| **BYOD Companion Agent** | Native Server | Node.js `http` module (`:49152`) | Cross-platform OS process audit (`tasklist` / `ps aux`), adapter inspection. |
| **Database & Cache** | Database | `PostgreSQL 15` (Supabase / Self-hosted) | Relational persistence across 21 models with foreign key constraints. |
| **Network Infrastructure**| VPN | `WireGuard (wg0)` Linux Kernel | Cryptographic Curve25519 UDP tunnel (`10.0.0.0/24`), live kernel sync. |
| | DNS Filter | `Unbound DNS 1.17+` | Split-horizon DNS daemon whitelisting only exam infrastructure. |

---

## Core Subsystems

### 1. Network Isolation Layer (WireGuard VPN)

The WireGuard subsystem provides cryptographic network containment for candidate workstations:

- **Keypair Generation**: The backend generates standard WireGuard-compatible Curve25519 (`x25519`) Base64 keypairs natively in Node.js via `crypto.generateKeyPairSync('x25519')` without external shell dependencies (`vpnService.js`).
- **IP Pool Management**: Dynamically allocates unassigned IP addresses from the `10.0.0.2` – `10.0.0.254` pool (`10.0.0.0/24` subnet). A serialization mutex lock (`withAllocationLock`) eliminates race conditions during concurrent candidate check-ins.
- **Kernel Peer Synchronization**: Upon VPN profile issuance (`POST /api/vpn/issue/:examId`), the backend registers the student's public key directly with the live WireGuard server interface via SSH (`sudo wg set wg0 peer <pubKey> allowed-ips <ip>/32`).
- **Client Configuration Generation**: Generates a standard WireGuard client configuration file (`.conf`) formatted with split-tunneling directives (`AllowedIPs = 10.0.0.0/24` or target server IP), routing exam traffic through the tunnel without hijacking non-exam traffic.
- **Dynamic Lease Revocation**: When the exam session reaches a terminal state (`SUBMITTED`, `TERMINATED`, `ENDED`), `revokeVpnPeer` drops the peer directly from kernel memory (`sudo wg set wg0 peer <pubKey> remove`) and marks the database lease expired.
- **DNS Containment**: `vpn-server/setup-dns.sh` configures an Unbound DNS server (`10.0.0.1:53`) that refuses all public lookups (`local-zone: "." refuse`) while explicitly permitting resolution only for the exam domain and required cloud infrastructure (Supabase, Cloudinary, LiveKit).

---

### 2. BYOD Companion Agent

A standalone Node.js daemon running locally on the student's workstation at `http://127.0.0.1:49152` (`device-agent/agent.js`):

- **Origin Security Gate**: Rejects requests from unauthorized origins with HTTP `403 Forbidden`. Only pre-approved origins (`http://localhost:5173`, `http://localhost:3000`, and production frontend URLs) are accepted.
- **Process Scanner (`GET /scan`)**:
  - Executes native OS process listing commands (`tasklist` on Windows, `ps aux` on Linux/macOS).
  - Inspects running process names against `BANNED_PROCESS_PATTERNS`:
    - *Remote Desktop & Screen Sharing*: AnyDesk, TeamViewer, UltraViewer, Chrome Remote Desktop, RDP/mstsc, VNC, LogMeIn.
    - *AI Assistants & Desktop Clients*: GitHub Copilot, ChatGPT, Claude, Cursor, Ollama, LM Studio.
    - *Virtual Cameras & Screen Capture*: OBS (`obs64`, `obs32`), ManyCam, vMix, Camtasia, Bandicam.
- **VPN Adapter Verification (`GET /vpn-check`)**:
  - Inspects network adapter configurations (`ipconfig /all` on Windows, `ip addr` on Linux).
  - Verifies whether an active interface matching `wireguard` or `wg0` exists and has an assigned IP address within the `10.0.0.x` range.
- **Automatic Tunnel Provisioning (`POST /vpn-activate`)**:
  - Validates configuration text for dangerous directives (`PostUp`, `PreUp`, command injection characters).
  - On Windows, writes a temporary `.conf` file and executes `wireguard.exe /installtunnelservice` to attach the tunnel.

---

### 3. Biometric Verification & OCR Engine

Identity verification is implemented through a multi-tier fallback pipeline:

```mermaid
graph TD
    LiveFrame["Live Webcam Frame (Base64)"] --> CFCheck{"CompreFace API Configured?"}
    CFCheck -- Yes --> CFCall["POST /api/v1/recognition/recognize"]
    CFCheck -- No / Offline --> PyService["Python AI Microservice (:5001)<br/>POST /api/face/compare-faces"]
    
    PyService --> CV2Hist["OpenCV HSV Color Histogram Correlation<br/>cv2.compareHist(hist1, hist2, HISTCMP_CORREL)"]
    CV2Hist --> Threshold{"Correlation >= 0.45?"}
    Threshold -- Yes --> VerifiedPass["Biometric Verified: true (Score: 0.88 - 0.99)"]
    Threshold -- No --> VerifiedFail["Biometric Verified: false (Fail-Closed)"]
    
    CFCall -- Matched (>= 0.65) --> VerifiedPass
    CFCall -- Unreachable / No Match --> PyService

    IDPhoto["Student ID Card Upload"] --> OCRChoice{"Node.js Tesseract.js / Python OCR"}
    OCRChoice --> RegexMatch["VTU Pattern Regex Match<br/>[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}"]
    RegexMatch --> IDVerified["Extracted USN & Name Verification"]
```

- **Live Face Biometric Matching**:
  - *Primary (Optional)*: If CompreFace is configured (`COMPREFACE_URL`), the backend compares the webcam frame against registered subject embeddings (`compreface.service.js`).
  - *Internal Computer Vision (Python Service)*: `python-service/services/face_service.py` executes computer vision comparison using 2D HSV color histogram correlation (`cv2.calcHist` on normalized Hue/Saturation channels across 128x128 resized crops, compared with `cv2.HISTCMP_CORREL`).
  - *Fail-Closed Guarantee*: If the biometric service is offline, unreachable, or returns a correlation below `0.45`, verification strictly resolves to `verified: false` and logs a security audit entry.
- **Selfie Liveness & Anti-Spoofing Check (`POST /api/face/liveness-check`)**:
  - Evaluates image focus and edge frequency using the OpenCV 64-bit Laplacian variance operator (`cv2.Laplacian(gray, cv2.CV_64F).var()`). Images with variance $\le 15.0$ are flagged as low-resolution screen replays or static photo presentations.
- **ID Card Face Cropping (`POST /api/face/crop-id-face`)**:
  - Lazily loads MTCNN (`mtcnn.MTCNN`) on first invocation to detect the facial bounding box on an ID card with 20% padding.
  - Automatically falls back to OpenCV Haar Cascade classifier (`haarcascade_frontalface_default.xml`) or center crop if MTCNN is unavailable.
- **ID Card OCR Parsing**:
  - Evaluates uploaded ID cards via `Tesseract.js` in Node.js or `PaddleOCR` / `Pytesseract` in Python.
  - Regex parsers extract University Seat Numbers (USN) matching institutional patterns (`[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}`), employee IDs (`EMP[0-9]{3,6}`), and dates of birth.

---

### 4. In-Exam Proctoring & Kiosk Enforcement

During an active examination, the student browser enforces strict kiosk constraints:

- **In-Browser Face Presence Polling**: `useProctoringMonitors.js` executes `face-api.js` (TinyFaceDetector) directly inside the browser every 4 seconds.
  - Exactly 1 face $\rightarrow$ Normal operation (`faceOk: true`).
  - 0 faces detected $\rightarrow$ Triggers `NO_FACE_DETECTED` (Severity: `MEDIUM`).
  - $>1$ faces detected $\rightarrow$ Triggers `MULTIPLE_FACES_DETECTED` (Severity: `HIGH`).
- **Tab Switching & Viewport Monitoring**:
  - `document.visibilitychange` detects when the student changes tabs (`document.hidden = true`), emitting `TAB_SWITCH`.
  - `window.blur` tracks focus loss away from the exam window (`WINDOW_BLUR`).
  - `document.fullscreenchange` detects exit from fullscreen mode (`FULLSCREEN_EXIT`).
- **Peripheral & Shortcut Restrictions**:
  - Intercepts context menu right-clicks (`contextmenu`).
  - Blocks developer tools shortcuts (`F12`, `Ctrl+Shift+I`, `Ctrl+Shift+J`, `Cmd+Option+I`) and copy/paste shortcuts (`Ctrl+C`, `Ctrl+V`, `Ctrl+U`, `Ctrl+P`, `PrintScreen`).
- **Multi-Tab Concurrency Guard**:
  - Instantiates a `BroadcastChannel('proctornet_exam_{examId}')` ping-pong protocol to ensure only a single browser tab can interact with an active exam session.
- **Cryptographic Canvas Watermarking**:
  - `WatermarkCanvas.jsx` renders a dynamic translucent 2D canvas overlay across the entire question viewport.
  - Stamps the student's unique USN and timestamp in repeating 45-degree tiled patterns to deter off-screen mobile phone photography and facilitate leak forensics.

---

### 5. Real-Time Video Invigilation & Socket Architecture

ProctorNet implements an authenticated real-time communication pipeline with room scoping:

```
                      ┌─────────────────────────────────────────┐
                      │        Socket.io Gateway (:5000)        │
                      └─────────────────────────────────────────┘
                                   ▲               ▲
                 Authenticated via │               │ Authenticated via
                   HttpOnly Cookie │               │ HttpOnly Cookie
                                   │               │
        ┌──────────────────────────┴────┐    ┌─────┴─────────────────────────┐
        │  Student Socket Connection    │    │  Invigilator Socket Connection│
        │  Rooms:                       │    │  Rooms:                       │
        │  - exam:{examId}              │    │  - inv:{examId}               │
        │  - student:{studentId}        │    │                               │
        └───────────────────────────────┘    └───────────────────────────────┘
```

#### Socket Protocol & Event Matrix

| Event Name | Direction | Payload | Rate Limit / Guard | Description |
| :--- | :--- | :--- | :--- | :--- |
| `exam:join` | Student $\rightarrow$ Server | `{ examId, studentId, name, usn }` | Student role check | Joins `exam:{examId}` and `student:{studentId}` rooms. |
| `inv:join` | Proctor $\rightarrow$ Server | `{ examId }` | Staff role & examId scope | Joins `inv:{examId}` room; receives real-time feeds. |
| `exam:frame` | Student $\rightarrow$ Server | `{ examId, studentId, frame }` | 1 frame / 800ms, $\le$ 500KB | Relays JPEG webcam snapshot to invigilators. |
| `exam:screenFrame` | Student $\rightarrow$ Server | `{ examId, studentId, frame }` | 1 frame / 800ms, $\le$ 500KB | Relays JPEG screen snapshot to invigilators. |
| `exam:flag` | Student $\rightarrow$ Server | `{ examId, studentId, type, details }` | 2000ms–5000ms cooldown | Reports integrity violation; saves to `EvidenceLog`. |
| `webrtc:request-stream` | Proctor $\rightarrow$ Student | `{ studentId, examId }` | Staff role check | Requests student to initiate P2P WebRTC peer offer. |
| `webrtc:offer` | Student $\rightarrow$ Proctor | `{ offer, invId, studentId, streamMap }` | Authenticated handshake | Dispatches WebRTC SDP offer to specific invigilator. |
| `webrtc:answer` | Proctor $\rightarrow$ Student | `{ answer, studentId }` | Authenticated handshake | Dispatches WebRTC SDP answer back to candidate. |
| `webrtc:ice-candidate` | Bidirectional | `{ candidate, targetId }` | Authenticated handshake | Exchanges ICE candidates for NAT traversal. |
| `inv:warn` | Proctor $\rightarrow$ Student | `{ examId, studentId, message }` | Staff role check | Delivers popup warning dialog to student viewport. |
| `inv:pause` | Proctor $\rightarrow$ Student | `{ examId, studentId, reason }` | Staff role check | Suspends session (`SUSPENDED`) and locks question view. |
| `inv:resume` | Proctor $\rightarrow$ Student | `{ examId, studentId }` | Staff role check | Resumes suspended candidate back to `ACTIVE`. |
| `inv:terminate` | Proctor $\rightarrow$ Student | `{ examId, studentId, reason }` | Staff role check | Issues misconduct termination; transitions to `TERMINATED`. |
| `student:chat` | Bidirectional | `{ examId, studentId, message }` | Authenticated user | Relays and persists in-exam proctor-student chat. |

- **Invigilator UI Optimization**: The invigilator live grid (`InvigilatorLiveGrid.jsx` and `StudentGrid.jsx`) decouples incoming high-frequency frame payloads (`window.dispatchEvent` / `latestStudentFrames` cache) from the React component tree, preventing UI re-rendering lag during multi-candidate exams.

---

### 6. Authoritative Exam Session State Machine

Exam sessions follow a strict, database-enforced finite state machine (`sessionStateMachine.js`). All transitions are executed inside atomic Prisma database transactions:

```mermaid
stateDiagram-v2
    [*] --> PENDING: Enrolled / Initialized
    PENDING --> SECURITY_CHECK: Launch Device Diagnostics
    PENDING --> ACTIVE: Direct Start (if unproctored)
    PENDING --> ENDED: Window Closed

    SECURITY_CHECK --> READY: All Checks & VPN Verified
    SECURITY_CHECK --> PENDING: Reset / Aborted
    SECURITY_CHECK --> ENDED: Window Closed

    READY --> ACTIVE: Start Exam Clicked
    READY --> SUSPENDED: Pre-exam Pause
    READY --> ENDED: Window Closed

    ACTIVE --> SUSPENDED: Proctor Pause / VPN Drop
    ACTIVE --> SUBMITTED: Normal Submission / Timer Expiry
    ACTIVE --> TERMINATED: Proctor Misconduct Order
    ACTIVE --> ENDED: Exam Window Closed

    SUSPENDED --> ACTIVE: Proctor Resume / VPN Reconnected
    SUSPENDED --> SUBMITTED: Auto-Submitted on Deadline
    SUSPENDED --> TERMINATED: Proctor Misconduct Order
    SUSPENDED --> ENDED: Window Closed

    SUBMITTED --> [*]: Terminal (Immutable)
    TERMINATED --> [*]: Terminal (Immutable)
    ENDED --> [*]: Terminal (Immutable)
```

- **Terminal State Immutability**: Transitions out of `SUBMITTED`, `TERMINATED`, or `ENDED` are strictly forbidden. Any subsequent attempts to mutate answers, request VPN keys, or restart timers return HTTP `400 Bad Request`.
- **Automatic VPN Cleanup**: Reaching any terminal state automatically triggers `syncWireGuardRemovePeer` to detach the peer from the WireGuard kernel interface.

---

### 7. Question Bank & Monaco Coding IDE

- **Question Types**: Supports Multiple Choice (`MCQ`), Programming (`CODING`), Short Written (`WRITTEN`), and Subjective (`SUBJECTIVE`) question types.
- **Monaco Code Editor**: Embedded VS Code Monaco editor (`@monaco-editor/react`) supporting JavaScript, Python, Java, C, and C++ with custom starter code templates, sample I/O, and test cases.
- **Autosave & Queue Flushing**: Candidate answer inputs are debounced and autosaved in the background (`saveQueueRef`), with a guaranteed synchronous flush on final submission (`POST /student/exams/:examId/submit`).
- **Negative Marking Calculation Engine**: Evaluates MCQ answers with support for per-question penalties (`question.negativeMarks`) or global exam-level defaults (`exam.negativeValue`). Unanswered questions incur zero penalty.
- **AI Question Generator (`POST /api/ai/generate-questions`)**: Generates structured MCQ questions from syllabus text. Uses OpenAI GPT-3.5-turbo if `OPENAI_API_KEY` is present, or falls back to an extensive domain-curated question bank (Operating Systems, DBMS, Networking, DSA, JS, Python) with deterministic shuffling.

---

## Database Schema (Prisma ORM)

The database schema is managed via Prisma ORM (`prisma/schema.prisma`) targeting PostgreSQL, consisting of **21 distinct models**:

```mermaid
erDiagram
    Faculty ||--o{ Exam : creates
    Exam ||--o{ Question : contains
    Exam ||--o{ StudentExam : instances
    Student ||--o{ StudentExam : takes
    Student ||--o{ VerificationAuditLog : logs
    Faculty ||--o{ AuditLog : logs
    Student ||--o{ AuditLog : logs
    
    StudentExam ||--o{ Answer : records
    StudentExam ||--o{ EvidenceLog : captures
    StudentExam ||--o{ ReverificationLog : periodic
    StudentExam ||--o| IdentityVerification : verifies
    StudentExam ||--o| ExamResult : grades
    
    Exam ||--o{ InvigilatorSession : assigns
    Exam ||--o{ ChatMessage : stores
    Exam ||--o{ CollusionReport : flags
```

### Entity Summary

| Model Name | Primary Purpose | Key Fields |
| :--- | :--- | :--- |
| `Admin` | System administrator accounts | `id`, `name`, `email`, `password` |
| `Faculty` | Instructor and examiner accounts | `id`, `name`, `email`, `employeeId`, `department`, `isApproved`, `isSuspended` |
| `Student` | Student candidate accounts | `id`, `name`, `usn`, `email`, `department`, `semester`, `facePhotoUrl`, `profileStatus` |
| `VerificationAuditLog` | Audit log of biometric check results | `id`, `studentId`, `checkType`, `score`, `status`, `details`, `timestamp` |
| `BiometricOverrideLog` | Manual faculty overrides of biometrics | `id`, `studentId`, `approverId`, `reason`, `prevStatus`, `newStatus`, `timestamp` |
| `Exam` | Examination definitions & proctor config | `id`, `title`, `subject`, `duration`, `startTime`, `endTime`, `negativeMarking`, `invId`, `status` |
| `Question` | Questions within an exam | `id`, `examId`, `type`, `questionText`, `options`, `correctAnswer`, `marks`, `codeTemplate` |
| `StudentExam` | Candidate exam session instance | `id`, `studentId`, `examId`, `status`, `vpnPeerIp`, `vpnKey`, `flagCount`, `watermarkSeed` |
| `Answer` | Student responses to questions | `id`, `studentExamId`, `questionId`, `selectedOption`, `codeAnswer`, `autoScore`, `manualScore` |
| `IdentityVerification` | Pre-exam biometric & OCR match record | `id`, `studentExamId`, `liveFaceMatchScore`, `idCardMatchResult`, `status`, `verifiedAt` |
| `EvidenceLog` | Proctoring violation snapshots & events | `id`, `studentExamId`, `eventType`, `severity`, `screenshotUrl`, `cameraFrameUrl`, `details` |
| `ChatMessage` | In-exam student-proctor messages | `id`, `examId`, `studentId`, `senderRole`, `message`, `timestamp` |
| `ReverificationLog` | Periodic in-exam biometric verifications | `id`, `studentExamId`, `faceMatchScore`, `result`, `cameraFrameUrl`, `checkTime` |
| `CollusionReport` | Post-exam answer similarity analysis | `id`, `examId`, `student1Id`, `student2Id`, `similarityScore`, `matchingWrongAnswers` |
| `ExamResult` | Final computed student exam score | `id`, `studentExamId`, `examId`, `autoScore`, `totalScore`, `percentage`, `finalStatus` |
| `InvigilatorSession` | Proctor exam session assignments | `id`, `examId`, `invId`, `loginTime`, `sessionExpiry`, `isActive` |
| `Announcement` | Campus-wide broadcast announcements | `id`, `title`, `message`, `postedBy`, `target`, `priority`, `createdAt` |
| `AuditLog` | System-wide administrative action logs | `id`, `userId`, `userRole`, `action`, `details`, `ipAddress`, `timestamp` |
| `PlatformSetting` | Global system configuration parameters | `id`, `key`, `value`, `updatedBy`, `updatedAt` |
| `DeviceCheckLog` | Pre-exam hardware and agent audit log | `id`, `studentId`, `agentConnected`, `blockedProcesses`, `virtualCams`, `status` |
| `EvidenceClip` | Recorded video violation evidence clips | `id`, `studentExamId`, `violationType`, `severity`, `clipUrl`, `timestamp` |

---

## Security Architecture

ProctorNet implements layered security controls verified across the backend and frontend codebases:

### 1. Authentication & Cookie Token Transport
- **Zero Token Storage**: The frontend never writes JWTs to `localStorage`, `sessionStorage`, or window global variables.
- **HttpOnly Cookies**: On login (`/api/auth/*/login`), the backend signs an HMAC-SHA256 JWT containing `{ id, role }` and sets a cookie named `proctornet_auth`:
  - `httpOnly: true` (inaccessible to client JavaScript / XSS scripts)
  - `sameSite: 'lax'`
  - `secure: true` in production environments (`NODE_ENV=production`)
  - `path: '/'`
- **Session Restoration**: The frontend calls `GET /api/auth/me` on mount with `withCredentials: true` to populate session state.
- **Socket Authentication**: `extractTokenFromSocket` parses the `proctornet_auth` cookie directly from the Socket.IO handshake headers during connection initiation.

### 2. Origin Defense & CSRF Mitigation
- **CSRF Origin Validation**: State-changing HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) pass through `csrfProtection` middleware in `app.js`, rejecting cross-origin requests from untrusted origins with `403 Forbidden`.
- **CORS Allowlist**: Strict origin checking for `http://localhost:5173`, `http://127.0.0.1:5173`, and production `FRONTEND_URL` targets.

### 3. Rate Limiting
- **Authentication Limiter**: `30 requests / 15 minutes` per IP address on `/api/auth` to prevent credential brute-forcing.
- **API Gateway Limiter**: `600 requests / 15 minutes` keyed by authenticated user ID (or fallback IP), accommodating burst traffic during simultaneous exam autosaves in shared university NAT laboratories.
- **Socket Flag Cooldowns**: Enforces per-student event-specific cooldown timers (2000ms–5000ms) on `exam:flag` to prevent socket flooding.

### 4. Authorization & Input Sanitization
- **Role-Based Middleware**: `requireRole(['admin', 'faculty'])` gates protected API routes.
- **Invigilator Scoping**: Invigilators are cryptographically scoped to their assigned `examId`. Attempts to inspect or terminate students in other exams return `403 Forbidden`.
- **Database Error Sanitization**: Prisma database error codes (`P2002`, `P2025`) are translated to generic client messages in global error middleware, preventing database schema or internal metadata leakage.
- **Admin-Managed Accounts**: Public self-registration is disabled (`403 Forbidden`); user accounts are provisioned and approved through administrative workflows.

---

## End-to-End System Workflows

### 1. Student Pre-Exam & Examination Lifecycle

```
[1. Student Login]
  │── POST /api/auth/student/login (USN + Password)
  │── Backend issues HttpOnly 'proctornet_auth' cookie
  ▼
[2. Exam Selection]
  │── GET /api/student/exams (Lists enrolled, active, and upcoming exams)
  ▼
[3. Multi-Stage Security Check (/student/security-check/:id)]
  │── Stage 1: BYOD Companion Agent Check
  │     ├── GET http://127.0.0.1:49152/scan (Checks banned processes)
  │     ├── POST /api/vpn/issue/:examId (Generates Curve25519 keypair & IP)
  │     ├── Downloads proctornet_exam_<id>.conf
  │     └── GET http://127.0.0.1:49152/vpn-check (Confirms 10.0.0.x tunnel)
  │── Stage 2: Hardware Media Feeds
  │     ├── Prompts for Webcam (getUserMedia) & Screen Share (getDisplayMedia)
  │── Stage 3: Biometric Identity Verification
  │     ├── Captures live webcam snapshot
  │     └── POST /api/student/exams/:examId/verify-face (OpenCV / CompreFace)
  │── Stage 4: Kiosk Mode Lock
  │     └── Request Fullscreen -> Session State transitioned to READY
  ▼
[4. Active Exam Interface (/student/exam/:id)]
  │── Session transitions to ACTIVE; connects to Socket.io room exam:{id}
  │── In-browser face-api.js presence detection loop runs every 4s
  │── Frame emitter pushes compressed base64 JPEG snapshots every 1.5s
  │── Monaco Editor / MCQ Question UI with dynamic USN watermark overlay
  │── Debounced answer autosave (POST /student/exams/:id/submit)
  ▼
[5. Submission & Teardown]
  │── Final answer submission flushes to DB
  │── Session state transitions to SUBMITTED (Terminal & Immutable)
  │── WireGuard peer revoked from server kernel interface
  └── Student redirected to results / completion view
```

### 2. Invigilator Real-Time Monitoring & Intervention

```
[1. Invigilator Authentication]
  │── POST /api/auth/invigilator/login (examId + invId + invPassword)
  │── Scoped session established with HttpOnly cookie
  ▼
[2. Live Monitoring Grid (/invigilator/live-grid/:examId)]
  │── Socket joins room inv:{examId}
  │── Renders candidate grid with live video/screen cards
  │── WebRTC P2P streams established; Socket.IO frame relay as fallback
  │── Real-time violation banners trigger on exam:flag socket events
  ▼
[3. Proctor Intervention Controls]
  │── Warn Student: socket.emit('inv:warn', { studentId, message })
  │── Pause Exam: socket.emit('inv:pause', { studentId, reason }) -> State: SUSPENDED
  │── Resume Exam: socket.emit('inv:resume', { studentId }) -> State: ACTIVE
  │── Terminate Exam: socket.emit('inv:terminate', { studentId, reason }) -> State: TERMINATED
  └── Live Chat: socket.emit('inv:chat', { studentId, message })
```

---

## Automated Testing & Verification

The repository contains an automated test suite implemented via the Node.js native test runner (`node:test` and `node:assert/strict`):

```bash
cd proctornet/backend
npm test
```

### Test Suites Summary (65 Automated Tests Across 17 Suites)

```
✔ Architectural & Regression Guardrails
  - Verified controller export signatures and deduplication
  - Confirmed zero direct Prisma calls in controllers (Service Layer Pattern)
  - Verified absence of legacy configuration flags (VITE_VPN_ENABLED)
  - Enforced mandatory VPN verification guardrails in SecurityCheck.jsx
✔ Black-Box Browser Security Verification Suite
  - HttpOnly cookie issuance and zero-JWT response body validation
  - Cookie handshake extraction in Socket.IO without tokens in socket.auth
  - Cross-student socket identity spoofing prevention
  - Expired and tampered token rejection with 401
  - CSRF origin verification on state-changing API endpoints
  - Role-based authorization boundary enforcement
✔ Live Proctoring Pipeline Suite
  - State machine transition rules and terminal state immutability
  - WebRTC dual-stream mapping validation
  - Frame payload size limits (500KB cap)
✔ Phase C Remediation Suite
  - Negative marking scoring logic and question-level penalty precedence
  - Invigilator login credential validation and exam scoping
✔ Phase G End-to-End Lifecycle & Failure Matrix
  - Full lifecycle chain from account setup through grading and release
✔ Zero-Token Storage Security Regression Audit
  - Static AST scan confirming zero localStorage/sessionStorage token calls in frontend
✔ Collusion & Verification Service Unit Tests
  - String similarity, edit distance, and fail-closed biometric fallback logic
```

---

## Project Directory Structure

```
online-exam-proctoring/
├── README.md                          # Project documentation and system architecture
├── proctornet/
│   ├── package.json                   # Root workspace manifest (frontend & backend)
│   ├── docker-compose.yml             # Container orchestration (App, DB, MinIO, CompreFace)
│   ├── render.yaml                    # Cloud deployment specification
│   ├── vercel.json                    # Frontend deployment routing
│   ├── livekit.yaml                   # WebRTC media server configuration
│   │
│   ├── backend/                       # Node.js + Express API Gateway (:5000)
│   │   ├── src/
│   │   │   ├── app.js                 # Server entry point, middleware, routes, socket init
│   │   │   ├── controllers/           # HTTP request handlers (admin, faculty, student, vpn)
│   │   │   ├── middleware/            # auth, role, audit, and upload middleware
│   │   │   ├── routes/                # Express API route declarations
│   │   │   ├── services/              # Domain services (vpnService, sessionStateMachine, etc.)
│   │   │   ├── sockets/               # exam.socket.js and chat.socket.js
│   │   │   └── utils/                 # jwt, cookies, helpers, auditLogger
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # PostgreSQL data model (21 entities)
│   │   │   └── seed/                  # Database seed scripts (admin.js, demo.js)
│   │   ├── tests/                     # Automated test suites (65 tests)
│   │   └── package.json
│   │
│   ├── frontend/                      # React 19 + Vite Web Application (:5173)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   │   ├── admin/             # Admin management dashboards
│   │   │   │   ├── faculty/           # Exam authoring, questions, student dossiers
│   │   │   │   ├── invigilator/       # Live proctoring grid and violation HUD
│   │   │   │   └── student/           # Exam interface, security check, results
│   │   │   ├── components/            # UI components (Monaco editor, watermark canvas, feeds)
│   │   │   ├── context/               # AuthContext.jsx and ExamContext.jsx
│   │   │   ├── hooks/                 # useExamSocket, useProctoringMonitors, useAntiCheat
│   │   │   └── utils/                 # api.js (Axios instance with withCredentials: true)
│   │   └── package.json
│   │
│   ├── python-service/                # Python AI & OCR Microservice (:5001)
│   │   ├── app.py                     # Flask entry point and blueprint registrations
│   │   ├── requirements.txt           # Python dependencies
│   │   ├── routes/                    # face.py, ocr.py, ai_gen.py
│   │   └── services/                  # face_service.py, ocr_service.py
│   │
│   ├── device-agent/                  # BYOD Companion Desktop Agent (:49152)
│   │   └── agent.js                   # Process scanning, VPN interface check, tunnel service
│   │
│   └── vpn-server/                    # WireGuard VPN Server Deployment Scripts
│       ├── setup.sh                   # WireGuard interface and key generation script
│       ├── setup-dns.sh               # Unbound DNS domain whitelist configuration
│       └── setup-firewall.sh          # iptables packet filtering rules
```

---

## Setup & Installation

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Python**: v3.9 or higher
- **PostgreSQL**: v14+ (or a cloud PostgreSQL instance e.g., Supabase)
- **Tesseract OCR** *(Optional for local OCR binaries)*: [Tesseract Installation](https://github.com/tesseract-ocr/tesseract)
- **WireGuard Client** *(Required for network isolation testing)*: [WireGuard Download](https://www.wireguard.com/install/)

---

### Running the Services Locally (4 Separate Terminals)

#### Terminal 1 — Backend API Gateway

```bash
cd proctornet/backend
npm install
npx prisma generate
npx prisma db push
npm run seed     # Seeds default administrative account
npm start
```
*Runs on port `5000` (Health: `http://localhost:5000/health`).*

#### Terminal 2 — Python AI Microservice

```bash
cd proctornet/python-service
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS / Linux:
# source venv/bin/activate
pip install -r requirements.txt
python app.py
```
*Runs on port `5001` (Health: `http://localhost:5001/health`).*

#### Terminal 3 — Frontend Web Application

```bash
cd proctornet/frontend
npm install
npm run dev
```
*Runs on `http://localhost:5173`.*

#### Terminal 4 — BYOD Device Companion Agent

```bash
cd proctornet/device-agent
node agent.js
```
*Runs on `http://127.0.0.1:49152`.*

---

### Docker Compose Deployment (Alternative)

To launch the containerized application stack including PostgreSQL, MinIO object storage, and CompreFace:

```bash
cd proctornet
docker-compose up --build
```

---

## Environment Variables

### Backend Configuration (`proctornet/backend/.env`)

```env
# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database (PostgreSQL + Prisma)
DATABASE_URL=postgresql://postgres:password@localhost:5432/proctornet?schema=public
DIRECT_URL=postgresql://postgres:password@localhost:5432/proctornet

# Authentication
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# AI & Media Services
PYTHON_SERVICE_URL=http://localhost:5001
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Optional Services
COMPREFACE_URL=http://localhost:8000
COMPREFACE_API_KEY=your_compreface_api_key_here
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here

# WireGuard VPN Configuration
VPN_SERVER_IP=127.0.0.1
VPN_SERVER_PORT=51820
VPN_SERVER_PUBLIC_KEY=your_wireguard_server_public_key
VPN_INTERFACE=wg0
VPN_SUBNET=10.0.0.0/24
VPN_DNS=10.0.0.1
VPN_KEY_EXPIRY_BUFFER_MINS=10
VPN_SSH_KEY_PATH=/path/to/ssh_key.pem
VPN_SSH_USER=azureuser
```

### Python Microservice Configuration (`proctornet/python-service/.env`)

```env
PORT=5001
FLASK_DEBUG=false
OPENAI_API_KEY=your_openai_api_key_here  # Optional: for AI question generation
COMPREFACE_URL=http://localhost:8000
```

---

## Known Limitations & Design Trade-offs

During technical evaluation and source inspection, the following architectural boundaries and constraints should be noted:

1. **WireGuard Remote SSH Synchronization**: The backend attempts to sync peer public keys to the remote WireGuard server via SSH commands (`ssh ... sudo wg set wg0 peer ...`). In local development environments without an active WireGuard server or valid SSH private key configured in `.env`, the sync operation logs a warning and proceeds gracefully.
2. **Face Biometric Comparison Implementation**: By default, the Python AI microservice implements face similarity using 2D OpenCV HSV color histogram correlation (`cv2.calcHist` + `cv2.compareHist`) and Laplacian variance sharpness checks. Deep neural-network facial embeddings (e.g. ArcFace) require deploying the optional Exadel CompreFace container stack.
3. **ID Card OCR Environmental Sensitivity**: In-process `Tesseract.js` and `Pytesseract` text extraction is sensitive to lighting conditions, camera blur, glare, and low card resolution. The system incorporates fallback regex and keyword extractors to verify USN patterns.
4. **Local Device Agent Execution**: Because browser sandboxing prevents web applications from inspecting local OS processes directly, students must run the local Node.js companion agent (`node agent.js`) on `127.0.0.1:49152` before passing the pre-exam system check.
5. **WebRTC NAT Traversal & Relay Fallback**: Direct WebRTC P2P streaming between candidates and invigilators depends on network NAT traversal. When symmetric NAT or corporate firewalls restrict P2P connections, the system transparently falls back to Socket.IO compressed JPEG frame relays.

---

## Implementation Status

| Feature / Subsystem | Status | Implementation Details |
| :--- | :--- | :--- |
| **HttpOnly Cookie Authentication** | `IMPLEMENTED` | JWT in HttpOnly cookie (`proctornet_auth`), zero token storage in frontend, CSRF origin check. |
| **Role-Based Authorization** | `IMPLEMENTED` | RBAC for Admin, Faculty, Student, Invigilator. Cross-exam invigilator actions blocked. |
| **WireGuard Keypair & IP Allocation** | `IMPLEMENTED` | Node.js native Curve25519 generation, `10.0.0.0/24` subnet pool with mutex lock. |
| **Live WireGuard Kernel Sync** | `IMPLEMENTED` | SSH command execution to WireGuard interface; peer revocation on exam completion. |
| **BYOD Companion Agent** | `IMPLEMENTED` | Native Node.js daemon on port `49152`, process scanning, tunnel adapter verification. |
| **Client Kiosk & Anti-Cheat** | `IMPLEMENTED` | Fullscreen locking, tab-switch detection, right-click & devtools shortcut blocking. |
| **In-Browser Face Detection** | `IMPLEMENTED` | `face-api.js` TinyFaceDetector polling loop (every 4 seconds). |
| **Identity Biometrics & Liveness**| `IMPLEMENTED` | OpenCV HSV histogram matching, Laplacian variance anti-spoofing, CompreFace client. |
| **ID Card OCR Parsing** | `IMPLEMENTED` | Tesseract.js / Pytesseract extracting USN and student metadata from ID cards. |
| **Socket.IO Signaling & Relays** | `IMPLEMENTED` | Room-isolated socket signaling, rate-limited frame relay (800ms throttle, 500KB cap). |
| **WebRTC P2P Signaling** | `IMPLEMENTED` | SDP offer/answer and ICE candidate exchange between student and invigilator. |
| **Monaco Coding IDE** | `IMPLEMENTED` | Multi-language code editor with test cases and starter templates. |
| **Exam Session State Machine** | `IMPLEMENTED` | Authoritative state machine with immutable terminal states (`SUBMITTED`, `TERMINATED`, `ENDED`). |
| **AI Question Generator** | `IMPLEMENTED` | OpenAI GPT-3.5-turbo integration with curated domain question bank fallback. |
| **Automated Test Suite** | `IMPLEMENTED` | 65 automated tests across 17 suites in `proctornet/backend/tests`. |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
