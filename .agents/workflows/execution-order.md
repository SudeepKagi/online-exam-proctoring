---
description: Execute the 4-phase engineering and UI build order strictly.
---

# Workflow: Master Execution Order (`/execution-order`)

Follow this exact 4-phase sequence:

## Phase 1: Design Token Foundation & Core Playwright E2E Flows
1. Set up the CSS variables and typography tokens from `.agent/specs/DESIGN.md` (strictly Light Theme `#fbfcfd` canvas, `#edecfb` cards, `#5266eb` primary pill, Inter 360–500).
2. Build the 3 to 5 core vertical slices and write Playwright E2E tests for them.
3. Run `npx playwright test`, inspect traces on failure, and fix all issues until passing.

## Phase 2: Central Error Handling, Interceptors & Zod Validation
1. Implement the central Express error middleware (`{ code, message }`), `helmet`, `express-rate-limit`, `pino` logger, and Zod validation on all backend routes.
2. Implement the Root React Error Boundary, `loading`/`error`/`empty` view states, `401`/network Axios/fetch interceptor, and React Hook Form + Zod with submit button disabling.
3. Verify with Supertest and React Testing Library + MSW tests.

## Phase 3: Exam-System Invariants & 15-Point Red-Team Suites
1. Implement and test all 10 exam-specific cases in `.agent/rules/03-exam-domain-invariants.md` (server timer, auto-submit worker, refresh resume, offline autosave, double-click idempotency, single attempt constraint, RBAC/answer hiding, JWT tamper handling, partial/negative scoring, exam start/end windows).
2. Run `/red-team-flow` on every flow ("list 15 ways this flow can break") and turn each into an automated test.

## Phase 4: Static Gates, Fuzzing, Load Testing, CI & Sentry
1. Enable TypeScript strict mode, ESLint, Husky, and `lint-staged`.
2. Add Schemathesis OpenAPI fuzzing and k6 load test (200 concurrent students starting an exam).
3. Add Semgrep, OWASP ZAP, and `npm audit`.
4. Configure `.github/workflows/ci.yml` and wire up Sentry (`@sentry/node` and `@sentry/react`).
