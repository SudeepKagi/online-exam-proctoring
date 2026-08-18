# ProctorNet Architecture & Refactoring Plan

## 1. System Audit & Current State Analysis

### 1.1 Dead & Duplicate Functions in `faculty.controller.js`
In `backend/src/controllers/faculty.controller.js`, three functions were declared twice. In JavaScript, the last function declaration overrides earlier ones, making the first instance unreachable dead code:

| Function Name | Dead Implementation (Lines) | Live / Reachable Implementation (Lines) | Root Cause & Resolution |
| :--- | :--- | :--- | :--- |
| `publishExam` | Lines 586–627 (42 lines) | Lines 1152–1194 (43 lines) | Duplicate declaration; remove lines 586–627. |
| `generateQuestionsPreview` | Lines 1020–1060 (41 lines) | Lines 1200–1217 (18 lines) | Duplicate declaration; remove lines 1020–1060. |
| `generateQuestionsFromAI` | Lines 878–1018 (141 lines) | Lines 1223–1272 (50 lines) | Duplicate declaration; remove lines 878–1018. |

**Total unreachable dead code to be removed**: ~224 lines.

---

### 1.2 Hardcoded URLs Audit

| File | Line | Content | Status / Action |
| :--- | :--- | :--- | :--- |
| `backend/src/controllers/student.controller.js` | 736 | `axios.post('http://localhost:5001/api/face/compare-faces', ...)` | **CRITICAL BUG**: Hardcoded localhost. Replace with `process.env.PYTHON_SERVICE_URL \|\| 'http://localhost:5001'`. |
| `backend/src/controllers/student.controller.js` | 792 | `const pythonUrl = process.env.PYTHON_SERVICE_URL \|\| 'http://localhost:5001'` | Reference pattern (correct). |
| `backend/src/services/python.service.js` | 3 | `process.env.PYTHON_SERVICE_URL \|\| 'http://localhost:5001'` | Correct env fallback pattern. |
| `backend/src/services/compreface.service.js` | 4 | `process.env.COMPREFACE_URL \|\| 'http://localhost:8000'` | Correct env fallback pattern. |
| `frontend/src/pages/student/BYODDeviceCheck.jsx` | 34 | `http://127.0.0.1:49152/scan` | Expected: connects to student's local desktop companion agent. |

---

### 1.3 High-Complexity & Oversized Files (>400 Lines)

#### Backend Controllers
- `faculty.controller.js` — **1,363 lines** (27 methods, raw Prisma queries mixed with business logic)
- `student.controller.js` — **1,077 lines** (22 methods, proctoring/answering/biometrics in single functions)
- `admin.controller.js` — **797 lines** (18 methods, stats, audit, user management)
- `enrollment.controller.js` — **601 lines** (11 methods, face embeddings & approvals)

#### Frontend Pages
- `student/ExamInterface.jsx` — **1,232 lines** (Monolithic: WebRTC, Socket.IO, audio monitor, YOLO, countdown, Monaco editor)
- `invigilator/Dashboard.jsx` — **1,200 lines** (Monolithic: live WebRTC grid, dossier modal, chat timeline, lightbox)
- `faculty/ExamDetail.jsx` — **898 lines** (Tabbed settings, questions, credentials)
- `faculty/CreateExam.jsx` — **862 lines** (Multi-step exam wizard)
- `student/SecurityCheck.jsx` — **541 lines** (Camera/Screen/Face verification pipeline)
- `student/StudentEnrollment.jsx` — **496 lines** (Biometric capture & USN registration)
- `student/Profile.jsx` — **433 lines** (Student details & identity status)
- `student/Register.jsx` — **420 lines** (Registration form & validation)
- `admin/AdminEnrollmentReview.jsx` — **416 lines** (Biometric enrollment review card grid)

---

## 2. Target Architecture & Module Structure

### 2.1 Backend Layered Architecture (`routes -> controllers -> services -> prisma`)

```
backend/src/
├── routes/                     # HTTP Route Definitions & Middleware Bindings
│   ├── faculty.routes.js
│   ├── student.routes.js
│   ├── admin.routes.js
│   └── ...
├── controllers/                # Thin HTTP Transport Adapters (Request/Response/Status Code)
│   ├── faculty.controller.js   # Parses params, invokes services, returns JSON
│   ├── student.controller.js
│   ├── admin.controller.js
│   └── ...
├── services/                   # Core Business Logic & Prisma Database Access
│   ├── examService.js          # Exam CRUD, status transitions, settings, scheduling
│   ├── questionService.js      # Question CRUD, bulk import, AI question generation persistence
│   ├── studentService.js       # Student exam lifecycle, answer auto-save, submission scoring
│   ├── resultService.js        # Grade calculations, negative marking, rank calculation, CSV reports
│   ├── collusionService.js     # Cross-candidate string similarity, edit distance, behavioral analysis
│   ├── verificationService.js  # Biometric comparison, ID OCR check, fail-closed handling
│   ├── adminService.js         # Platform analytics, audit logs, system config
│   └── python.service.js       # AI microservice HTTP client
└── utils/                      # Reusable pure helpers (auditLogger, ipHelper, etc.)
```

#### Responsibilities per Layer:
1. **Routes**: Express router definitions, route-level role authorization (`authenticateToken`, `requireRole`).
2. **Controllers**: Parse and validate `req.body`, `req.params`, `req.query`, invoke corresponding Service method, map service results to HTTP status codes (`200`, `201`, `400`, `404`, `500`). Zero direct `prisma.*` calls.
3. **Services**: Pure business logic, transaction handling (`prisma.$transaction`), entity queries, similarity algorithms, audit log dispatch. Throw typed errors or return structured domain results.

---

### 2.2 Frontend Modular Component Structure (`pages -> hooks -> subcomponents`)

#### `student/ExamInterface.jsx` (Target: < 200 lines)
```
frontend/src/
├── pages/student/
│   └── ExamInterface.jsx                  # Main exam layout & high-level state orchestration
├── hooks/
│   ├── useExamSocket.js                   # Socket.IO connection, room join/leave, chat
│   ├── useProctoringMonitors.js           # Webcam, screen capture, YOLO polling, audio level monitoring
│   └── useExamTimer.js                    # Countdown timer, warning thresholds, auto-submit trigger
└── components/exam/
    ├── ExamHeader.jsx                     # Topbar with status indicators, YOLO/mic pills, timer
    ├── QuestionPanel.jsx                  # MCQ option buttons, Monaco code editor, subjective text area
    ├── ExamSidebar.jsx                    # Live camera PIP feed, question jump palette, submit action
    └── ComplianceOverlay.jsx              # Fullscreen lock and screen-share enforcement screen
```

#### `invigilator/Dashboard.jsx` (Target: < 250 lines)
```
frontend/src/
├── pages/invigilator/
│   └── Dashboard.jsx                      # Main dashboard layout, filter controls, modal state
├── hooks/
│   └── useInvigilatorSocket.js            # Live WebRTC stream reception, violation socket events
└── components/invigilator/
    ├── StudentGrid.jsx                    # Responsive grid of live student video tiles
    ├── StudentDossierModal.jsx            # Deep inspection modal (Webcam/Screen side-by-side, timeline, chat)
    └── EvidenceLightbox.jsx               # High-res violation screenshot inspection
```

---

## 3. Phased Implementation Roadmap

### Phase 1: Dead Code Removal & Correctness Bugs
- Remove duplicate declarations of `publishExam`, `generateQuestionsPreview`, and `generateQuestionsFromAI` in `faculty.controller.js`.
- Fix fail-open bugs in `student.controller.js` (`verifyFace`) and `deviceCheck.controller.js` to ensure verification failure returns `verified: false` and halts progression.
- Replace hardcoded `http://localhost:5001` in `student.controller.js` with `process.env.PYTHON_SERVICE_URL`.

### Phase 2: Service Layer Implementation
- Extract domain services: `examService.js`, `questionService.js`, `studentService.js`, `resultService.js`, `collusionService.js`, `verificationService.js`, `adminService.js`.
- Migrate all `global.prisma.*` calls from `faculty.controller.js`, `student.controller.js`, and `admin.controller.js` into services.
- Verify controller raw Prisma count drops to zero while keeping all HTTP status codes, request contracts, and response JSON schemas 100% identical.

### Phase 3: Frontend Component Decomposition
- Refactor `ExamInterface.jsx` into custom hooks (`useExamSocket`, `useProctoringMonitors`, `useExamTimer`) and focused subcomponents (`QuestionPanel`, `ExamSidebar`).
- Refactor `invigilator/Dashboard.jsx` into `useInvigilatorSocket`, `StudentGrid`, and `StudentDossierModal`.
- Verify full exam flow (Device Check -> Lobby -> Security Check -> Exam -> Results) and invigilator monitoring.

### Phase 4: Quality & Safety Guardrails
- Introduce ESLint configuration for backend (`backend/eslint.config.mjs`) with duplicate detection and unused variable linting.
- Add test framework with unit tests for services (covering happy path, fail-closed face verification, and controller duplicate exports regression tests).
- Add architecture & file size guidelines to `CONTRIBUTING.md`.
