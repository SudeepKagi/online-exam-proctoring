---
name: red-team-flow
description: Adversarial quality assurance workflow. Generates 15 failure scenarios across network drops, race conditions, timer skew, and security boundaries, turning each into automated tests.
---

# Red-Team Adversarial Flow

Once a vertical slice passes its happy-path test, execute this mandatory adversarial pass before declaring completion:

## 1. Fifteen Failure Scenarios Checklist
Generate concrete automated tests covering:
1. Client clock skew / tampering with browser clock or `localStorage` timer.
2. Closing browser right before timer expires (`expiresAt` auto-submit).
3. Mid-exam page refresh or back-button browser navigation.
4. Simulated network drop during autosave or question transition.
5. Rapid double-click or concurrent `POST /submit` requests (idempotency).
6. Starting an exam 1 second before `startTime` (403 `EXAM_NOT_OPEN`).
7. Starting an exam 1 second after `endTime` (403 `EXAM_ENDED`).
8. Starting a second attempt from a second browser tab (409 `ATTEMPT_ALREADY_EXISTS`).
9. Inspecting network payloads for leaked `correctAnswer` or `rubric` fields (zero answer leakage).
10. Student attempting to call teacher/admin endpoints or read another student's submission (403 `FORBIDDEN`).
11. Expired or signature-tampered JWT mid-exam (clean 401 redirect to `/login`).
12. Multi-select partial marking and negative scoring floor rules (scoring never drops below 0 per question).
13. Zod schema rejection on malformed JSON, unexpected types, or huge payloads.
14. Safe Exam Browser header tampering or missing `X-SafeExamBrowser-ConfigKeyHash`.
15. Resuming exam after browser crash with dirty offline cache recovery.

## 2. Test Implementation & Gate
- Implement automated tests in `Vitest` (backend integration) and `Playwright` (frontend E2E).
- Run `npm test` and `npx playwright test` to verify all 15 failure scenarios pass cleanly.
