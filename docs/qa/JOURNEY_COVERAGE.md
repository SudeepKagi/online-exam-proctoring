# ProctorNet Journey Coverage Matrix (`JOURNEY_COVERAGE.md`)

> **Protocol Reference (§4.6):** Two-Layer E2E Suite (Layer 1 Deterministic Human Journeys J1–J13 + Layer 2 AI Explorer). All journeys drive real UI and assert against server truth and mathematical oracles without synthetic shortcuts.

---

## 1. Feature × Journey Coverage Matrix (J1–J13)

| Architectural Feature Area | J1 | J2 | J3 | J4 | J5 | J6 | J7 | J8 | J9 | J10 | J11 | J12 | J13 | AI |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Authentication & RBAC (Admin, Faculty, Student, Invigilator)** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |
| **Department & User Bootstrap (Random Temp Passwords, Must Change)** | **✓** | — | — | — | — | — | — | — | — | — | — | — | — | **✓** |
| **Exam Authoring & Question Management (MCQ, Validation, Seeded Shuffle)** | — | **✓** | — | — | — | — | — | — | — | — | — | — | — | **✓** |
| **One-Time Invigilator Credentials (Single-View Security Modal)** | — | **✓** | — | — | **✓** | — | — | — | — | — | — | — | — | **✓** |
| **Biometric Face Enrollment & Server Verification Gate** | — | — | **✓** | **✓** | — | — | — | — | — | — | — | — | — | **✓** |
| **Exam Device Companion Pairing & Session Heartbeat Verification** | — | — | **✓** | — | **✓** | — | — | — | — | — | — | — | — | **✓** |
| **Out-of-Order Answering & Autosave Per-Question Revision CAS** | — | — | **✓** | — | — | — | **✓** | — | — | **✓** | **✓** | **✓** | — | **✓** |
| **Mid-Exam Network Drop Resilience (10s Offline + Queued Flushes)** | — | — | **✓** | — | — | — | — | — | — | — | — | — | — | **✓** |
| **Multi-Tab Concurrency Guard & Server-Side Tab Switch Limit** | — | — | **✓** | — | **✓** | **✓** | — | — | — | — | — | — | — | — |
| **Idempotent Submission & Double-Click Protection** | — | — | **✓** | — | — | **✓** | — | — | — | **✓** | **✓** | **✓** | — | **✓** |
| **Mathematical Oracle Scoring & Rank Computation** | — | — | **✓** | — | — | — | — | — | — | **✓** | **✓** | **✓** | — | — |
| **Biometric Decision Matrix (PASS, Impostor Retry Cap, REVIEW)** | — | — | — | **✓** | — | — | — | — | — | — | — | — | — | — |
| **Invigilator Live Grid, Video Tiles & Violation Lightbox** | — | — | — | — | **✓** | — | — | — | — | — | — | — | — | **✓** |
| **Invigilator Interventions: Warning (≤2s), Suspend, Resume, Terminate** | — | — | — | — | **✓** | — | — | — | **✓** | — | — | — | — |
| **BOLA / IDOR / Role Escalation Denial Across Routes & Storage** | — | — | — | — | — | **✓** | — | — | — | — | — | — | — | — |
| **Zero Answer Key Leakage in Student DTOs & Cache** | — | — | — | — | — | **✓** | — | — | — | — | — | — | — | — |
| **Backend Process Restart Recovery & Sockets Reconnection** | — | — | — | — | — | — | **✓** | — | — | — | — | **✓** | — | — |
| **Full-Router Exploratory Crawl & Route Inventory Alignment** | — | — | — | — | — | — | — | **✓** | — | — | — | — | — | — |
| **Accessibility Compliance (WCAG 2.1 AA via Axe-Core & Keyboard)** | — | — | — | — | — | — | — | — | **✓** | — | — | — | — | — |
| **Exam State Progression (DRAFT → LIVE → ENDED → EVALUATED)** | — | — | — | — | — | — | — | — | — | **✓** | — | — | — | — |
| **Absent / Suspended Student Evaluation & Rank Calculation** | — | — | — | — | — | — | — | — | — | **✓** | — | — | — | — |
| **Real Time Timeout & Expiry Sweeper Reconciler (F2)** | — | — | — | — | — | — | — | — | — | — | **✓** | — | — | — |
| **Browser Clock Skew Independence** | — | — | — | — | — | — | — | — | — | — | **✓** | — | — | — |
| **High Concurrency Burst (150 Virtual + 10 Human) & RSS ≤450MB** | — | — | — | — | — | — | — | — | — | — | — | **✓** | — | — |
| **Production Read-Only Smoke & Isolated Canary Run** | — | — | — | — | — | — | — | — | — | — | — | — | **✓** | — |
| **Vision-Language Model UX Observation (Midscene Personas)** | — | — | — | — | — | — | — | — | — | — | — | — | — | **✓** |

---

## 2. Complete Journey Specifications

### J1: Onboarding & Account Lifecycle (`e2e/journeys/j1-onboarding-approval.spec.ts`)
- **Actors:** Admin, Faculty, Student.
- **Workflow:** Admin initial login forces password reset. Admin creates Department, Faculty, and Student. Server generates cryptographically random temporary password with `mustChangePassword: true`. Student attempts login, forced to set new password; intermediate API calls return 403 `PASSWORD_CHANGE_REQUIRED`. Student completes profile (name, photo, ID card); approval status starts as `PENDING`. Student cannot view or start exams until Admin approves. Admin approves enrollment.
- **Invariants:** Old token revoked; zero default passwords; strict approval gating.

### J2: Faculty Exam Authoring (`e2e/journeys/j2-exam-authoring.spec.ts`)
- **Actors:** Faculty, Student.
- **Workflow:** Create exam with duration, window, subject, branch, semester. Add MCQs manually with validation (reject empty choices, duplicate options, missing correct choice). Generate AI questions via deterministic fake LLM driver. Publish exam; invigilator credentials generated with unambiguous alphabet and displayed once. Verify exam and question immutability post-publish. Confirm student in different branch/semester cannot see exam.

### J3: Student Golden Path (`e2e/journeys/j3-student-happy-path.spec.ts`)
- **Actors:** Student, Faculty, Invigilator.
- **Workflow:** Lobby countdown → Pre-check (device agent pairing, camera/mic permissions, screen share, live photo face match) → Rules confirmation → Fullscreen exam opens. Timer synchronized from server. Student answers 70% of questions with realistic human think delays; modifies selected choices. Checkpoint: UI matches database answers. Simulates 10s offline burst; queued answers flush without duplicates. Second browser tab displays multi-tab blocker; tab switch recorded. Student submits exam; double-click protection active. Results evaluated via outbox within 30s. Faculty releases results. Student views score matching mathematical oracle.

### J4: Identity & Biometric Verification Gates (`e2e/journeys/j4-identity-paths.spec.ts`)
- **Actors:** Student, Invigilator.
- **Workflow:** Facial verification matching proceeds. Impostor face blocked with retry counter (max 3 retries). No face / multi-face detected blocked. `REVIEW` state allows invigilator override in real time without student refresh. Direct API bypass attempts (`POST /exams/:id/attempt` without valid verification pass) return 403 `FORBIDDEN`. Unenrolled students blocked.

### J5: Invigilator Live Operations (`e2e/journeys/j5-invigilator-ops.spec.ts`)
- **Actors:** Invigilator, Student.
- **Workflow:** Invigilator credential login. Live grid renders candidate tiles with video/snapshot and telemetry. Student focus loss triggers violation; invigilator sees tile alert and evidence image thumbnail. Invigilator issues warning (appears on student screen within 2s). Invigilator suspends attempt (student interface locks, answer saves rejected). Invigilator resumes attempt (deadline extended by suspension duration). Invigilator terminates attempt (student locked out, evaluation enqueued).

### J6: Security & Negative Authorization Sweep (`e2e/journeys/j6-security-negative.spec.ts`)
- **Actors:** Student A, Student B, Faculty, Attacker.
- **Workflow:** BOLA tests across attempts, answers, results, evidence between students. Role escalation attempts (student accessing admin/faculty endpoints). Exam window enforcement (start before window / after end returns 403/410). CORS rejection on unauthorized origins (`Origin: https://evil.sslip.io`). CSRF protection rejection on spoofed `x-client-type: test` headers on cookie requests. Idempotent submit replay with conflicting body returns 422. Answer save after submission/expiry returns 409/410. Full scan of student API responses asserts zero `isCorrect` leakage. Rate limiting enforcement.

### J7: Resilience & Failure Recovery (`e2e/journeys/j7-failure-modes.spec.ts`)
- **Actors:** Student, System.
- **Workflow:** Backend process restart during active exam session: sockets reconnect, answers intact, timer continuous, outbox events survive and process. Storage degradation handling: violation recorded in database even if S3 upload experiences temporary failure. Database connection drop retries autosave cleanly.

### J8: Authenticated Route Crawler (`e2e/journeys/j8-crawler.spec.ts`)
- **Actors:** Crawler bot across all 4 roles.
- **Workflow:** Crawls every route reachable by each role according to `docs/api/ROUTE_INVENTORY.md`. Asserts zero 500 errors, zero console exceptions, zero dead navigation links. Verifies coverage ≥ documented inventory. Writes telemetry to `reports/e2e/crawler-coverage.json`.

### J9: Accessibility & Visual Non-Regression (`e2e/journeys/j9-a11y-visuals.spec.ts`)
- **Actors:** Accessibility bot.
- **Workflow:** Runs Axe-Core audit on all primary views (zero critical/serious violations). Full keyboard navigation exam completion. Pixel-level snapshot regression across desktop (1440×900), tablet (1024×768), and mobile (390×844) viewports. Runtime text scan validates zero internal technical names leaked in user-facing UI.

### J10: Exam Lifecycle & Automated Progression (`e2e/journeys/j10-lifecycle-results.spec.ts`)
- **Actors:** 6 Students (Finisher A, Finisher B, Absent, Suspended, Terminated), Faculty.
- **Workflow:** Exam with 6 enrolled candidates transitions `PUBLISHED → LIVE → ENDED → EVALUATED` automatically via scheduler. Finisher students submit normally. Absent student (prewarmed `READY`) evaluated with score 0, `status_reason='NOT_STARTED'`. Suspended student expired at end and evaluated from saved answers. Mathematical oracle calculates absolute ranks and handles ties. Results release blocked before `EVALUATED` (unless forced with audit log). Students see only their own released results.

### J11: Real-Time Timeout & Expiry Sweeper (`e2e/journeys/j11-timeout-expiry.spec.ts`, `@slow`)
- **Actors:** Student, ExpirySweeper daemon.
- **Workflow:** 1-minute exam executed in real time without clock mocking:
  - (a) Idle student reaches zero countdown; UI transitions to timeout screen; server updates status to `EXPIRED` and generates result from saved answers.
  - (b) Answer save after expiry is rejected with clear error.
  - (c) Submit inside submit-grace window accepted.
  - (d) Student reloads browser immediately after expiry; verify result is not lost (F2 proof).
  - (e) Skewed client clock (±5 minutes) does not affect server-driven countdown.
  - (f) Late-join candidate without pre-check cannot start without full agent/identity validation.

### J12: Concurrency & 450MB Memory Budget (`e2e/journeys/j12-concurrency.spec.ts`)
- **Actors:** 10 Browser Students + 150 Virtual Students.
- **Workflow:** High-concurrency exam burst on prod-parity profile:
  - 160 concurrent student assessment sessions.
  - 100% of submitted answers persisted cleanly with zero CAS deadlocks.
  - 100% of terminal attempts evaluated.
  - Autosave p95 latency measured and recorded.
  - Zero 5xx responses.
  - Backend process RSS monitored throughout run, asserting memory remains below the 450MB systemd budget (`MemoryMax=450M`).
  - Abrupt backend restart mid-burst recovers gracefully without data loss.

### J13: Production Read-Only Smoke & Isolated Canary (`e2e/journeys/j13-smoke-canary.spec.ts`)
- **Actors:** Operations, Canary Bot.
- **Workflow:**
  - Non-mutating production smoke verifying HTTP/HTTPS endpoints, version metadata, Caddy security headers, and health status.
  - Automated canary gate (`prod-canary`): creates namespaced `canary-*` accounts, conducts a 3-minute assessment through the live production interface, verifies evaluation score, and cleans up only `canary-*` rows without modifying existing production data. Output written to `reports/prod-canary/`.

---

## 3. Mathematical Oracle Integration (`e2e/helpers/oracle.ts`)

Every assessment journey J3, J10, J11, J12 computes expected results independently using the mathematical oracle:
- **Total Marks:** Sum of positive mark weights for answered correct questions minus penalty weights for incorrect answers (when negative marking enabled).
- **Percentage:** `(score / total_marks) * 100` rounded to 2 decimal places.
- **Categorization:** Counts for `correct_count`, `wrong_count`, `unanswered_count`.
- **Rank Computation:** Dense ranking by score descending, breaking ties deterministically by submission timestamp.
- **Assertion:** Asserts equality between oracle computation, database `exam_results` record, and rendered DOM score breakdown.
