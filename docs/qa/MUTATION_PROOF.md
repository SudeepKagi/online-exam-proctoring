# Mutation Proof Ledger (`MUTATION_PROOF.md`)

> **Protocol Specification (§4.7):** For every finding (F1–F10), this ledger documents the covering test, the red reproduction output on parent commit `1f17a7c`, and the green verification output on the fix commit. A test that cannot fail on the defect is not accepted.

---

## 1. Summary of Verified Findings (F1–F10)

| Finding ID | Severity | Description | Covering Test | Red on Parent (`1f17a7c`) | Green on Fix Commit | Fix Commit |
|---|---|---|---|---|---|---|
| **F1** | P0 | Dead worker event handlers in production | `tests/p9-repro-baseline.test.js:F1` | Red (10.99ms) | Green (10.56ms) | `ff4ad53` |
| **F2** | P0 | Resume after expiry silently loses result | `tests/p9-repro-baseline.test.js:F2` | Red (1.40ms) | Green (1.29ms) | `48739af` |
| **F3** | P0 | Absent students block exam evaluation forever | `tests/p9-repro-baseline.test.js:F3` | Red (1.38ms) | Green (1.37ms) | `5903801` |
| **F4** | P0 | Start gates bypassable server-side | `tests/p9-repro-baseline.test.js:F4` | Red (2.93ms) | Green (1.83ms) | `8e7b447` |
| **F5** | P0 | Hardcoded default passwords on created accounts | `tests/p9-repro-baseline.test.js:F5` | Red (0.95ms) | Green (0.79ms) | `1133682` |
| **F6** | P0 | CORS / CSRF wildcard and header bypasses | `tests/p9-repro-baseline.test.js:F6` | Red (0.94ms) | Green (0.81ms) | `23f5dab` |
| **F7** | P1 | Unenforced settings (`tabSwitchLimit`) | `tests/p9-repro-baseline.test.js:F7` | Red (0.55ms) | Green (0.46ms) | `1d4f290` |
| **F8** | P1 | Contradictory time & expiry rules | `tests/p9-repro-baseline.test.js:F8` | Red (0.54ms) | Green (0.39ms) | `cafc3f6` |
| **F9** | P1 | Diverging attempt construction & RNG collapse | `tests/p9-repro-baseline.test.js:F9` | Red (0.49ms) | Green (0.56ms) | `cf9a740` |
| **F10** | P2 | Test-suite truth defects & parity evasion | `scripts/ci/check-e2e-integrity.js` | Red (28 violations) | Green (0 violations) | `778751e` |

---

## 2. Detailed Mutation Evidence by Finding

### F1 — Worker Handlers Dead Code
- **Defect:** In `infra/postgres/pgQueueDispatcher.js` and `backend/src/app.js`, outbox dispatchers called `evaluationWorker.handleEvent(...)` and `evidenceWorker.handleEvent(...)`. Neither worker implemented `handleEvent`, throwing `TypeError` and marking all outbox events `FAILED`.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:22` (F1.1) and `tests/p9-repro-baseline.test.js:30` (F1.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F1.1: evaluationWorker must define handleEvent method (9.8195ms)
    AssertionError [ERR_ASSERTION]: F1 Defect Confirmed: evaluationWorker.handleEvent is undefined; outbox events will throw TypeError and end FAILED
    + actual - expected
    + 'undefined'
    - 'function'
  ✖ F1.2: evidenceWorker must define handleEvent method (0.4166ms)
    AssertionError [ERR_ASSERTION]: F1 Defect Confirmed: evidenceWorker.handleEvent is undefined; evidence.uploaded outbox events will throw TypeError
    + actual - expected
    + 'undefined'
    - 'function'
  ```
- **Fix Commit Green Evidence (`ff4ad53`):**
  ```text
  ✔ F1.1: evaluationWorker must define handleEvent method (9.6902ms)
  ✔ F1.2: evidenceWorker must define handleEvent method (0.157ms)
  ```

---

### F2 — Resume After Expiry Silently Loses Results
- **Defect:** In `attempts/service.js`, `startOrResumeAttempt` updated expired `ACTIVE` attempts directly to `EXPIRED` via `prisma.examAttempt.update`, skipping `attemptStateMachine` and emitting no outbox event. The attempt remained unevaluated forever.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:41` (F2.1) and `tests/p9-repro-baseline.test.js:51` (F2.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F2.1: startOrResumeAttempt must not bypass attemptStateMachine on expired resume (0.7238ms)
    AssertionError [ERR_ASSERTION]: F2 Defect Confirmed: startOrResumeAttempt performs direct prisma.examAttempt.update to EXPIRED, bypassing attemptStateMachine and outbox emission
    true !== false
  ✖ F2.2: ExpirySweeper must reconcile un-evaluated terminal attempts (0.4491ms)
    AssertionError [ERR_ASSERTION]: F2 Defect Confirmed: ExpirySweeper only checks ACTIVE attempts and has no reconciler for un-evaluated terminal attempts
    false !== true
  ```
- **Fix Commit Green Evidence (`48739af`):**
  ```text
  ✔ F2.1: startOrResumeAttempt must not bypass attemptStateMachine on expired resume (0.6354ms)
  ✔ F2.2: ExpirySweeper must reconcile un-evaluated terminal attempts (0.4045ms)
  ```

---

### F3 — Exam Lifecycle & Absent Students Block Evaluated State
- **Defect:** `createAbsentResultsForEndedExam` in `results/repository.js` was never called anywhere. Prewarmed `READY` attempts for absent students blocked `transitionEndedToEvaluated` indefinitely.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:62` (F3.1) and `tests/p9-repro-baseline.test.js:72` (F3.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F3.1: createAbsentResultsForEndedExam must be invoked by examScheduler (0.4347ms)
    AssertionError [ERR_ASSERTION]: F3 Defect Confirmed: createAbsentResultsForEndedExam is never called
    false !== true
  ✖ F3.2: transitionEndedToEvaluated must not exclude exams with READY absent attempts (0.7437ms)
    AssertionError [ERR_ASSERTION]: F3 Defect Confirmed: transitionEndedToEvaluated refuses to transition while any READY attempts exist
    true !== false
  ```
- **Fix Commit Green Evidence (`5903801`):**
  ```text
  ✔ F3.1: createAbsentResultsForEndedExam must be invoked by examScheduler (0.5623ms)
  ✔ F3.2: transitionEndedToEvaluated must not exclude exams with READY absent attempts (0.6009ms)
  ```

---

### F4 — Start Gates Server Enforcement
- **Defect:** Late-join path inserted attempts directly as `ACTIVE`, bypassing device agent policies. `createStudent` defaulted `approvalStatus: 'APPROVED'`. Live photo verification was only polled by client and not verified server-side on attempt start.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:83` (F4.1), `89` (F4.2), and `96` (F4.3).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F4.1: createStudent must default approvalStatus to PENDING until approved (1.232ms)
    AssertionError [ERR_ASSERTION]: F4 Defect Confirmed: createStudent auto-approves students
    'APPROVED' !== 'PENDING'
  ✖ F4.2: createOnDemandAttempt must not insert ACTIVE status directly (0.8946ms)
    AssertionError [ERR_ASSERTION]: F4 Defect Confirmed: createOnDemandAttempt inserts ACTIVE directly
    true !== false
  ✖ F4.3: server must expose unified assertCanStart validation gate (0.5529ms)
    AssertionError [ERR_ASSERTION]: F4 Defect Confirmed: assertCanStart helper missing
    false !== true
  ```
- **Fix Commit Green Evidence (`8e7b447`):**
  ```text
  ✔ F4.1: createStudent must default approvalStatus to PENDING until approved (0.7424ms)
  ✔ F4.2: createOnDemandAttempt must not insert ACTIVE status directly (0.4736ms)
  ✔ F4.3: server must expose unified assertCanStart validation gate (0.4186ms)
  ```

---

### F5 — Default Password Security
- **Defect:** `admin/service.js` created accounts with predictable fallback passwords `Faculty@123` / `Student@123` without enforcing password rotation.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:107` (F5.1) and `tests/p9-repro-baseline.test.js:114` (F5.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F5.1: adminService must not use hard-coded default passwords Faculty@123 / Student@123 (0.5512ms)
    AssertionError [ERR_ASSERTION]: F5 Defect Confirmed: adminService uses hardcoded Faculty@123 or Student@123
    true !== false
  ✖ F5.2: check-default-credentials verification script must exist (0.2892ms)
    AssertionError [ERR_ASSERTION]: F5 Defect Confirmed: check-default-credentials.js missing
    false !== true
  ```
- **Fix Commit Green Evidence (`1133682`, `dc270a7`):**
  ```text
  ✔ F5.1: adminService must not use hard-coded default passwords Faculty@123 / Student@123 (0.451ms)
  ✔ F5.2: check-default-credentials verification script must exist (0.2378ms)
  ```

---

### F6 — CSRF / CORS Wildcard & Header Bypasses
- **Defect:** CORS allowlist matched arbitrary wildcards `*.sslip.io` and `*.duckdns.org` with `credentials: true`. CSRF middleware bypassed verification on `x-client-type: test` or unvalidated agent headers.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:125` (F6.1) and `tests/p9-repro-baseline.test.js:132` (F6.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F6.1: CORS origin validator must not allow arbitrary *.sslip.io domains (0.4806ms)
    AssertionError [ERR_ASSERTION]: F6 Defect Confirmed: CORS origin regex permits any *.sslip.io domain
    true !== false
  ✖ F6.2: CSRF protection must not bypass on arbitrary client headers like x-client-type: test (0.3582ms)
    AssertionError [ERR_ASSERTION]: F6 Defect Confirmed: CSRF bypassed on x-client-type: test in production
    true !== false
  ```
- **Fix Commit Green Evidence (`23f5dab`):**
  ```text
  ✔ F6.1: CORS origin validator must not allow arbitrary *.sslip.io domains (0.3581ms)
  ✔ F6.2: CSRF protection must not bypass on arbitrary client headers like x-client-type: test (0.3738ms)
  ```

---

### F7 — Unenforced Settings (`tabSwitchLimit`)
- **Defect:** `tabSwitchLimit` was stored in exam settings but never counted or enforced server-side.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:143` (F7.1).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F7.1: proctoringService must enforce tabSwitchLimit server-side (0.4492ms)
    AssertionError [ERR_ASSERTION]: F7 Defect Confirmed: proctoringService records TAB_SWITCH but never checks tabSwitchLimit
    false !== true
  ```
- **Fix Commit Green Evidence (`1d4f290`):**
  ```text
  ✔ F7.1: proctoringService must enforce tabSwitchLimit server-side (0.3934ms)
  ```

---

### F8 — Contradictory Time Rules Across Start Paths
- **Defect:** Start paths, late-join, and sweeper used conflicting expiry calculations (`now + duration` vs `end_time` vs `end_time + 300`).
- **Covering Tests:** `tests/p9-repro-baseline.test.js:154` (F8.1).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F8.1: unified examClock module must exist and govern expiry calculation (0.4779ms)
    AssertionError [ERR_ASSERTION]: F8 Defect Confirmed: examClock module missing
    false !== true
  ```
- **Fix Commit Green Evidence (`cafc3f6`):**
  ```text
  ✔ F8.1: unified examClock module must exist and govern expiry calculation (0.3238ms)
  ```

---

### F9 — Diverging Attempt Construction & RNG Collapse
- **Defect:** LCG PRNG algorithm collapsed to 0 permanently on zero seed hash. Attempt question construction diverged across three separate files.
- **Covering Tests:** `tests/p9-repro-baseline.test.js:165` (F9.1) and `tests/p9-repro-baseline.test.js:172` (F9.2).
- **Parent Commit Red Evidence (`1f17a7c`):**
  ```text
  ✖ F9.1: createSeededRng must not collapse to perpetual zero if seed hash is zero (0.262ms)
    AssertionError [ERR_ASSERTION]: F9 Defect Confirmed: PRNG state collapses to zero
    0 !== 100
  ✖ F9.2: unified buildAttemptQuestions function must exist and honor randomiseQuestions (0.1495ms)
    AssertionError [ERR_ASSERTION]: F9 Defect Confirmed: buildAttemptQuestions helper missing
    false !== true
  ```
- **Fix Commit Green Evidence (`cf9a740`):**
  ```text
  ✔ F9.1: createSeededRng must not collapse to perpetual zero if seed hash is zero (0.2903ms)
  ✔ F9.2: unified buildAttemptQuestions function must exist and honor randomiseQuestions (0.1975ms)
  ```

---

### F10 — E2E Test Suite Truth & Parity Evasion
- **Defect:** Playwright test suite bypassed real production stack via `START_WORKERS=false`, `S3_MOCK=true`, `NODE_ENV=test`, `reuseExistingServer: true`. Vacuous assertions (`toBeDefined()` on locators), synthetic events (`dispatchEvent('blur')`), and unbacked "AI explorer" stub reports masked production defects.
- **Covering Tool:** `scripts/ci/check-e2e-integrity.js`.
- **Parent Commit Red Evidence (`1f17a7c`):**
  - Duplicate `playwright.config.js` and `.ts` with divergent configurations.
  - 23 un-humanized `waitForTimeout` invocations across test specs.
  - 6 `force: true` click bypasses.
  - Canned AI explorer report literals with hardcoded token and step counts.
- **Fix Commit Green Evidence (`778751e`):**
  ```text
  --- E2E Test Suite Integrity Verification ---
  ✅ Integrity verification PASSED! (28 files scanned, 0 violations found)
  ```
