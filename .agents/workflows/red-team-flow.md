---
description: List 15 ways the current flow can break and turn each into an automated test.
---

# Workflow: Red-Team Flow (`/red-team-flow`)

Once a vertical slice passes its happy-path test, perform this mandatory adversarial pass:

1. **Generate 15 Failure Scenarios:**
   - Explicitly list 15 concrete ways the current flow can break across:
     - Client clock skew / manipulating `localStorage` timer
     - Closing browser right before timer expires
     - Mid-exam page refresh or back-button navigation
     - Network drop during autosave or final submit
     - Rapid double-click or parallel `POST /submit` requests
     - Starting an exam 1 second before `startTime` or 1 second after `endTime`
     - Starting a second attempt from a second browser tab
     - Inspecting network responses for leaked `correctOption` fields
     - Student calling teacher/admin endpoints or another student's `attemptId`
     - Expired or signature-tampered JWT mid-exam
     - Partial credit edge cases (e.g., selecting 1 correct and 1 wrong option in multi-select) and negative marking floor
     - Malformed JSON, unexpected types, empty strings, or huge payloads
2. **Convert Every Scenario into a Test:**
   - Write automated Vitest/Supertest, RTL/MSW, or Playwright tests for every uncovered scenario in the list.
3. **Execute & Fix:**
   - Run `npm test && npx playwright test` and fix all discovered bugs until green.
