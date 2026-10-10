# ProctorNet Journey Coverage Matrix (Prompt 8 §2 U8)

**Generated:** 2026-10-10  
**Target Architecture:** Two-Layer E2E (Layer 1 Deterministic Playwright + Layer 2 AI Explorer)  
**Total Journeys:** 9 Stateful Journeys + 6 AI Personas  
**CI Gate Policy:** Layer 1 required on `main` before deployment (`ci-gate`). Layer 2 advisory reporting.

---

## 1. Feature × Journey Coverage Matrix

| Architectural Feature Area | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 | AI Personas |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Authentication & RBAC (Admin, Faculty, Student, Invigilator)** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| **Department & User Bootstrap (CSV Bulk Import, Password Reset)** | **✓** | — | — | — | — | — | — | — | — | **✓** |
| **Exam Authoring & Question Management (MCQ, CSV, Wizard)** | — | **✓** | — | — | — | — | — | — | — | **✓** |
| **One-Time Invigilator Credentials (Single-View Security Modal)** | — | **✓** | — | — | **✓** | — | — | — | — | **✓** |
| **Biometric Face Enrollment & Server Presigned Tickets (FLW-03)** | — | — | **✓** | **✓** | — | — | — | — | — | **✓** |
| **Exam Device Companion Pairing & Ed25519 Policy Verification** | — | — | **✓** | — | **✓** | — | — | — | — | **✓** |
| **Out-of-Order Answering & Autosave Per-Question Revision CAS** | — | — | **✓** | — | — | — | **✓** | — | — | **✓** |
| **Mid-Exam Network Drop Resilience (30s Offline + Silent Refresh)** | — | — | **✓** | — | — | — | — | — | — | **✓** |
| **Mid-Exam Token Expiry (Silent Refresh via `pn_rt`, Zero Logout)** | — | — | **✓** | — | — | — | — | — | — | **✓** |
| **Multi-Tab Concurrency Guard (Immediate Second-Tab Blocking)** | — | — | **✓** | — | — | — | — | — | — | — |
| **Idempotent Submission & Double-Click Protection** | — | — | **✓** | — | — | — | — | — | — | **✓** |
| **Biometric Decision Matrix (PASS, Impostor FAIL, REVIEW Outage)** | — | — | — | **✓** | — | — | — | — | — | — |
| **Invigilator Visual Override & Zero-Refresh Continuation** | — | — | — | **✓** | — | — | — | — | — | — |
| **Live Invigilator Candidate Grid & Telemetry Tile Polling** | — | — | — | — | **✓** | — | — | — | — | **✓** |
| **Proctor Violation Detection (Fullscreen, Copy, Companion)** | — | — | — | — | **✓** | — | — | — | — | — |
| **Proctor In-Exam Warning Delivery (<= 2s Latency Guarantee)** | — | — | — | — | **✓** | — | — | — | — | — |
| **Session Control: Pause, Resume & Emergency Termination** | — | — | — | — | **✓** | — | — | — | — | — |
| **Rate-Limit Resilience (Zero 429 Drops over 20-Minute Stream)** | — | — | — | — | **✓** | — | — | — | — | — |
| **BOLA / IDOR Attempt Access Denial (Cross-Student Denial)** | — | — | — | — | — | **✓** | — | — | — | — |
| **Token Storage Audit (Zero Access/Refresh Tokens in localStorage)** | — | — | — | — | — | **✓** | — | — | — | — |
| **Profile & Presentation Eligibility Tampering Lock (U1)** | — | — | — | — | — | **✓** | — | — | — | — |
| **CSRF Cross-Origin POST Refusal & SameSite Cookie Integrity** | — | — | — | — | **✓** | — | — | — | — |
| **Backend Process Restart Recovery (Stateful Sockets Reconnect)** | — | — | — | — | — | — | **✓** | — | — | — |
| **Full-Router Exploratory Crawl (Fuzzing, Zero 5xx, Zero Blank)** | — | — | — | — | — | — | — | **✓** | — | — |
| **Accessibility Compliance (WCAG 2.1 AA via Axe-Core & Keyboard)** | — | — | — | — | — | — | — | — | **✓** | — |
| **Vision-Language Model UX Observation (Midscene Personas)** | — | — | — | — | — | — | — | — | — | **✓** |

---

## 2. Layer Execution Specifications

| Spec File | Purpose | Runner | Gate Status |
| :--- | :--- | :--- | :--- |
| `e2e/journeys/j1-onboarding.spec.ts` | Department, Faculty & Student Onboarding | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j2-exam-authoring.spec.ts` | Exam Creation, Questions & One-Time Creds | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j3-student-happy-path.spec.ts` | Complete Student Lifecycle & Resilience | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j4-identity-paths.spec.ts` | Biometric Impostor, REVIEW & Overrides | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j5-invigilator-ops.spec.ts` | Invigilator Tile Grid, Warnings & Terminate | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j6-security-negative.spec.ts` | IDOR, BOLA, Cookie Flags, Tampering | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j7-failure-modes.spec.ts` | Network Drops & Backend Process Restarts | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j8-crawler.spec.ts` | Exploratory Route Monkey Crawler | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/journeys/j9-a11y-visuals.spec.ts` | Axe-Core WCAG AA & Keyboard Navigation | Chromium, Chrome, MSEdge | **REQUIRED (Blocks Merge)** |
| `e2e/ai/personas.spec.ts` | Vision-Language UX & Banned Wording Personas | Chromium (Staging Only) | **ADVISORY (Reports Findings)** |

---

## 3. Layer Flake & Quarantine Policy

- **Retries:** `0` for all stateful journeys J1–J7. Any test failure fails the merge gate.
- **Trace Retention:** `trace: 'retain-on-failure'`, `video: 'retain-on-failure'`, `screenshot: 'only-on-failure'`.
- **Known-Red Quarantine:** If an environmental issue emerges on a third-party service, the spec may only be quarantined in `e2e/known-red/` with an assigned owner, tracking issue ID, and strict expiration date (maximum 14 days).
