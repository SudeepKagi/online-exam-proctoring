# Testing Strategy & Quality Assurance Framework

**System:** ProctorNet Enterprise Exam Platform  
**Architecture:** React + TypeScript (Frontend), Node.js + Express + TypeScript (Backend), PostgreSQL + Redis, Safe Exam Browser (SEB) Integration

---

## 1. Quality Philosophy & Testing Pyramid

ProctorNet enforces a strict spec-first, test-driven engineering discipline. All code is accompanied by automated tests across three primary levels:

```
          ▲
         / \
        /   \     E2E / Browser Automation (Playwright)
       / E2E \    - 79 tests | Real browser flows, video feeds, SEB headers, human typing
      /-------\
     / Integr. \  API & Database Integration (Node Test Runner + Supertest)
    /   Tests   \ - 366 tests | Database constraints, auth, Zod validation, concurrency
   /-------------\
  /   Unit & UI   \ Component & Pure Domain Logic (Vite + RTL)
 /      Tests      \ - 42 tests | View state transitions, design tokens, parsing algorithms
/-------------------\
```

---

## 2. Test Classification Tags

All Playwright tests support tag filtering for granular, rapid execution:

| Tag | Target | Description | Example Commands |
| :--- | :--- | :--- | :--- |
| `@smoke` | High-priority happy paths | Fast critical path tests verifying login, exam start, and submission. Runs on every commit. | `npx playwright test --grep @smoke` |
| `@slow` | Long-running workflows | Tests involving multi-minute timers, server countdown expirations, and heavy media streaming. | `npx playwright test --grep @slow` |
| `@seb` | Safe Exam Browser | Tests requiring simulated or verified SEB headers (`X-SafeExamBrowser-ConfigKeyHash`, BEK). | `npx playwright test --grep @seb` |

---

## 3. NPM Test Commands

In the root repository `package.json`, unified test targets are provided:

```json
{
  "scripts": {
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "npm test --workspace=backend",
    "test:frontend": "npm test --workspace=frontend",
    "test:e2e": "npx playwright test",
    "test:smoke": "npx playwright test --grep @smoke",
    "test:all": "npm test && npx playwright test"
  }
}
```

---

## 4. Test Suite Durations & Performance Benchmarks

All test suites run deterministically in CI and local development environments without flaky retries.

| Suite | Scope | Test Count | Typical Duration | Gate |
| :--- | :--- | :---: | :---: | :--- |
| **Backend Integration** | `backend/tests/*.test.js` | 366 | ~34s | Mandatory (100% pass) |
| **Frontend Unit** | `frontend/src/**/*.test.jsx` | 42 | ~5s | Mandatory (100% pass) |
| **E2E Smoke** | `e2e/*` tagged `@smoke` | 18 | ~35s | Mandatory (100% pass) |
| **E2E Full Suite** | `e2e/*.spec.ts` | 79 | ~2.5m | Mandatory prior to merge |
| **Mutation Canary** | `scripts/ci/mutation-canary.js` | 5 faults | ~45s | Mandatory prior to cutover |
| **Live Smoke** | `scripts/ops/smoke-live.js` | 8 checks | ~3s | Mandatory post-deploy (Read-only) |

---

## 5. Non-Negotiable Invariants for Test Authors

1. **Web-First Assertions Only:** Never use hardcoded sleeps (`page.waitForTimeout` or `setTimeout`). Always use Playwright web-first locators (`expect(locator).toBeVisible()`) which automatically retry and poll.
2. **Dynamic Data Isolation:** Use `seed = 'pn-' + Date.now()` for all generated usernames, emails, and exam titles to prevent state collisions.
3. **Timezone Determinism:** Always specify timezones explicitly (`Asia/Kolkata`, `America/New_York`) when testing schedule windows or countdown clocks.
4. **Never Mock the Database for Core Invariants:** Concurrency tests and atomic attempt transitions must run against real PostgreSQL transactions.
