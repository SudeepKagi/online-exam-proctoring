# ProctorNet E2E & Verification Strategy: Deterministic Gate + AI Explorer

**Status:** Authoritative Architecture Guide  
**Version:** 2.0.0 (Prompt 8 Architecture)  
**Owners:** Architecture & QA Engineering  

---

## 1. Executive Summary

ProctorNet implements a **two-layer end-to-end testing architecture**:
1. **Layer 1: Deterministic "Human Journeys" (Playwright)** — The strict, non-flaky merge and deployment gate. Runs on every commit to `main` and gating AWS deployments. Zero retries masking bugs. Blocks merges.
2. **Layer 2: AI "Human Tester" (Midscene.js / VLM Personas)** — Exploratory vision-language agent that tests like an anxious candidate, a rushed faculty member, or an invigilator watching candidates. Uncovers dead ends, unreadable text, awkward layouts, and confusing copy. **Advisory by design — never blocks `ci-gate`.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROCTORNET TEST PYRAMID                         │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 2: AI Exploratory Agent (Advisory, Vision VLM, UX Personas)     │
│  ────────────────────────────────────────────────────────────────────  │
│  Layer 1: Deterministic Journeys J1–J9 (Blocking Gate, Playwright)     │
│  ────────────────────────────────────────────────────────────────────  │
│  Integration & Boot Smoke (Real DB, MinIO, RabbitMQ, Redis, AST Linter)│
│  ────────────────────────────────────────────────────────────────────  │
│  Fast Unit & Architecture Invariant Tests (<3s, Strict DTO Mappers)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer 1: Deterministic Human Journeys (Playwright Merge Gate)

### Core Invariants:
- **Zero Fake DB Seeding:** Only the `admin` account exists at clean-room start. All departments, faculty, students, exams, questions, and one-time credentials are created **through real HTTP APIs and UI flows by authentic actors**.
- **Context Isolation:** Every human actor (`admin`, `faculty`, `student`, `invigilator`) operates in a completely isolated browser context with dedicated cookies and local state.
- **Biometric Mock Drivers in Test Only:** Explicit mock face driver that returns likeness from fixture identities, strictly refused by `validateConfig` in production runtimes.
- **Device Companion Integration:** Child process runs `proctornet/device-agent` from source, pairs via Crockford codes, verifies Ed25519 policy, and reports workstation integrity.
- **Seeded Pseudo-Random Human Behavior (`humanize.ts`):** Natural typing cadence, Bézier mouse movements, occasional typos, and think time. Seed is logged per run for deterministic replay.
- **Retries Policy:** `retries: 0` for all stateful journeys. Flakiness is treated as an engineering defect, not masked by automated retries.

### The 9 Journeys:
| ID | Journey Name | Actors | Core Invariants Verified |
| :--- | :--- | :--- | :--- |
| **J1** | Onboarding & Department Bootstrap | Admin, Faculty, Student | Admin login, department creation, faculty onboarding, bulk student CSV upload, forced password change on first login, 404 public registration URLs. |
| **J2** | Exam Authoring & Publication | Faculty, Admin | Wizard validation errors (end < start, duration > window), manual MCQ creation, CSV import with invalid row rejection, one-time invigilator credentials modal (shown once, never retrievable), question mutation blocked after publish. |
| **J3** | Student Happy Path & Resilience | Student, Faculty, Admin | Biometric consent, quality gate photo enrollment, admin approval, precheck, companion pairing, out-of-order MCQ answering across 3+ questions, answer edits, mid-exam refresh, 30s offline resilience, token expiry silent refresh, multi-tab block, idempotent double-click submit, score release, audit trail. |
| **J4** | Biometric Identity Paths | Student, Invigilator | Impostor photo FAIL (retries then blocked), provider outage REVIEW, invigilator real-time approval in separate context with seamless candidate continuation without refresh. |
| **J5** | Invigilator Operations & Realtime Grid | Invigilator, Student | One-time credential login, hinted tile polling cadence, student violations (fullscreen exit, copy, companion disconnect) with evidence thumbnail capture, proctor warnings (<= 2s latency), pause/resume assessment, terminal session termination, zero 429 rate-limit drops over 20 mins. |
| **J6** | Security Negative & IDOR/BOLA | Student A, Student B | Cross-student attempt denial (IDOR), unauthorized media presign ticket access, single-session concurrency supersession, CSRF cross-origin POST refusal, zero tokens in `localStorage`, strict `HttpOnly; Secure; SameSite=Lax` cookies, profile eligibility tampering blocked. |
| **J7** | Infrastructure Blip & Recovery | Student, Backend | Docker backend restart during active attempt: WebSocket reconnection, answer preservation, timer continuity, graceful DB retry. |
| **J8** | Exploratory Router Crawler (Monkey) | All Roles | Seeded crawl of all frontend routes per role, fuzzing inputs with edge-case unicode/long strings/script tags, asserting zero 5xx, zero console errors, zero blank screens, zero `[object Object]` leaks. |
| **J9** | Accessibility & Visual Baselines | Public, Student | `@axe-core/playwright` WCAG 2.1 AA audit on all primary views, zero critical/serious violations, full keyboard-only navigation of student authentication and exam flows. |
| **J10** | Exam Lifecycle & Results | All Roles, 6 Students | Automated state transitions (`PUBLISHED → LIVE → ENDED → EVALUATED`), evaluation of absent students (score 0, `NOT_STARTED`), suspended student end-of-exam evaluation, oracle rank computation, and results release gating. |
| **J11** | Real-Time Timeout & Expiry Sweeper (`@slow`) | Student, ExpirySweeper | Real-time countdown expiry, grace period answer submission, late answer rejection, reload post-expiry result recovery (F2), client clock skew independence. |
| **J12** | Concurrency Burst & 450MB Memory Budget | 10 Human + 150 Virtual | 160 concurrent student assessment burst, 100% answer persistence, 100% evaluation completion, autosave p95 latency, zero 5xx, backend RSS verified below 450MB systemd ceiling. |
| **J13** | Production Read-Only Smoke & Canary Gate | Ops, Canary Bot | Read-only production smoke verification, automated canary assessment gate with isolated `canary-*` accounts and clean teardown. |


---

## 3. Layer 2: AI "Human Tester" (Midscene.js Explorer)

### Architecture Decision:
Per **ADR E2E-AI-001**, Midscene.js (`@midscene/web/playwright`) is selected for Layer 2. TesterArmy was rejected due to pre-1.0 stability concerns and third-party telemetry.

### Personas Executed:
1. **Nervous First-Time Student on Slow Laptop:** Stumbles through enrollment and pre-checks, misreading technical prompts. Logs visual hesitation points.
2. **Student Under Time Pressure:** Rushes through questions, rapidly toggles options, experiences connection drops, recovers, and submits.
3. **Invigilator Monitoring Candidate Grid:** Interprets multi-student tile feeds, identifies suspicious flags, and executes warning/pause workflows.
4. **Faculty Authoring in a Hurry:** Creates exams, bulk-imports questions, publishes, and handles one-time credentials.
5. **Admin Department Onboarding:** Rapidly bootstraps new departments and audits system activity logs.
6. **Cross-Page UX & Banned Wording Auditor:** Visually scans screens for unabstracted technical leaks (e.g. "AI Kiosk", "AWS Rekognition", "neural engine"), awkward layout shifts, or confusing microcopy.

### Mandatory Guardrails:
- **Strict Staging Allow-List:** `validateAiTargetEnvironment()` refuses any URL that does not match `localhost`, `127.0.0.1`, or `staging.proctornet.local`. The AI explorer is programmatically prevented from touching production.
- **Budget & Cost Caps:** Hard stop at `$1.50` per run and `$50.00` per month. Steps and tokens are strictly monitored by `AiCostGuard`.
- **Parallel Objective Assertions:** While the AI evaluates subjective UX, strict objective checks (HTTP status codes, console error guards, database state checks) execute simultaneously. A hallucinated "everything looks great" model output cannot hide an HTTP 500 error.
- **Outputs & Triage:** Every run produces `reports/ai-tester/<date>/findings.json` and `SUMMARY.md`. Findings are triaged weekly into GitHub issues labeled `ux-ai` and `needs-human-confirm`.

---

## 4. Production Safeguards (Prompt 8 §2 U7)

1. **Zero Synthetic Users in Production:** Automated human journeys J1–J9 run **exclusively** on staging or ephemeral test environments. No test students or dummy exams are created on production databases.
2. **Read-Only Production Smoke (`scripts/ops/production-smoke.js`):**
   - Verifies HTTPS, HSTS, and Content-Security-Policy headers.
   - Probes `/healthz` (200 OK).
   - Probes `/api/v1/version` and validates that `gitSha` matches the released artifact.
   - Executes read-only authentication for a dedicated smoke administrator from AWS SSM (`/proctornet/prod/smoke_admin_password`) and verifies `/api/v1/auth/me`.
   - Strictly performs zero database mutations.
3. **Admin-Only Production Database:**
   - Production database maintains strictly real institutional records.
   - The reset tool (`scripts/ops/reset-keep-admin.js`) preserves administrative accounts and configuration tables (`admins`, `departments`, `platform_settings`), cleans runtime session and attempt data, and requires explicit confirmation flags (`--confirm "reset <dbname>"` and `--allow-production-i-understand`).

---

## 5. Architectural Defense: Why Deterministic Gates + AI Explorer?

> **Question: Why not replace Playwright scripts with an AI testing agent?**  
> **Answer:** Merge and deployment gates require **absolute determinism, zero flakiness, and instantaneous execution**. Vision-language models exhibit prompt sensitivity, probabilistic output distribution, and API latency. By keeping deterministic Playwright journeys as the merge gate and using the AI explorer as an advisory UX observer, ProctorNet gains the reliability of formal verification and the empathy of real human observation.

> **Question: How do you prevent model non-determinism from blocking merges?**  
> **Answer:** Layer 2 AI explorer is decoupled from `ci-gate`. It runs nightly and via manual dispatch, persisting findings as structured JSON artifacts and markdown summaries. It never blocks PR merges on subjective design opinions.
