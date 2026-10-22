---
trigger: always_on
description: Enforces Playwright, Vitest, Supertest, RTL+MSW, Testcontainers, Schemathesis, k6, Husky, and GitHub Actions CI.
---

# Rule 04: Open-Source Testing, Static Checks & Security Stack

## 1. Automated Testing Stack
- **Playwright (E2E):**
  - Enable trace recording (`trace: 'retain-on-failure'`) so the trace viewer reveals exact failure points.
  - Maintain E2E tests for the 5 core flows first, plus all failure modes.
- **Vitest + Supertest + Testcontainers (Backend):**
  - Run integration tests against a real ephemeral PostgreSQL instance via `testcontainers` (never mock the DB).
  - Verify status codes, auth, Zod validation errors, and concurrent race conditions.
- **Vitest + React Testing Library + MSW (Frontend):**
  - Use Mock Service Worker (MSW) to test `loading`, `error`, `empty`, and `success` states on every screen.
- **Schemathesis (API Fuzzing):**
  - Maintain `openapi.yaml` and fuzz all endpoints with Schemathesis to catch edge-case crashes and `500` responses.
- **k6 (Load Testing):**
  - Maintain `tests/load/exam-start-surge.k6.js` simulating 200 students starting an exam simultaneously (`http_req_failed == 0`, `p(95) < 500ms`).

## 2. Static Checks & Git Hooks
- Enable TypeScript `"strict": true` in both frontend and backend `tsconfig.json`.
- Enforce ESLint + Husky + `lint-staged` on `pre-commit` so broken types, lint errors, or failing unit tests cannot be committed.

## 3. GitHub Actions CI & Security
- Configure `.github/workflows/ci.yml` to run on every push and PR:
  - TypeScript strict check + ESLint
  - Vitest (Backend with Testcontainers + Frontend with RTL/MSW)
  - Playwright E2E tests (with trace artifact upload)
  - Schemathesis OpenAPI fuzzer
  - Security scans: `npm audit`, Semgrep, and OWASP ZAP baseline scan.
