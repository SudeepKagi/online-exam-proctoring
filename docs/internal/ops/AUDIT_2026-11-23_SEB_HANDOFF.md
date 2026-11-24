# Root Cause Investigation & Audit: Safe Exam Browser Handoff & PIN Removal
**Date:** 2026-11-23  
**Incident Reference:** SEB Launch Code "Already Used" on Student Launch  
**Investigation Branch:** `fix/seb-handoff-and-remove-pin`  
**Target Environment:** `https://proctornet.duckdns.org` (EC2 `i-0d242d962823f0a89`)

---

## 1. Incident Description & Symptom
- **Symptom:** After launching an exam from the website via Safe Exam Browser, SEB presented a fallback PIN input form. When the user entered the 6-digit code displayed in their primary browser, SEB displayed an error stating: `"This launch code has already been used"`.
- **Primary Goal:** 
  1. Determine the root cause of why the link or code was already consumed.
  2. Completely remove the 6-digit PIN system across the entire application stack.
  3. Ensure a zero-friction, seamless launch flow where students enter the exam lobby inside SEB without typing any code, and where reloads or duplicate requests within the first minute do not strand the student.

---

## 2. Evidence-Based Timeline

From the production systemd journal (`journalctl -u proctornet.service`), Caddy reverse proxy logs (`journalctl -u caddy.service`), and local Windows client logs (`%LOCALAPPDATA%\SafeExamBrowser\Logs`):

| Timestamp (UTC) | Hop / Component | Action / Request | Status / Result | Details |
|---|---|---|---|---|
| **12:56:05.511** | Caddy Proxy | `GET /seb/enter?launch=3cf0cc...` | `200 OK` (1336 bytes) | SEB Windows CEFRuntime navigated to Start URL with `?launch=<token>` successfully forwarded. |
| **12:56:05.717** | Caddy Proxy | `GET /assets/C2jV_Dah.css`, `GET /assets/Ce4RQt1-.js` | `200 OK` | SEB loaded the SPA bundles for `/seb/enter`. |
| **12:56:06.012** | Backend API | `GET /api/v1/seb/exchange?launch=3cf0cc...` | `200 OK` | Automated token exchange triggered by `SebPinEntryPage` (`attemptAutoExchange()`). |
| **12:56:06.015** | Backend API | Session Issuance & Token Consumption | `SUCCESS` | `setAuthCookie` issued JWTs. `sebTokenService.markConsumed(record)` marked BOTH the launch token AND the linked 6-digit PIN as `consumedAt = 12:56:06.015`. |
| **12:56:06.020** | Frontend SPA | Redirection | `302 / Replace` | SPA redirected window to destination: `/student/exams/b566af5f-f5a1-4577-8b34-6113cff661a8/start`. |
| **12:56:09.114** | Backend API | `POST /api/v1/attempts/exams/b566af5f.../start` | `403 Forbidden` | Enforce mode check: Request ConfigKeyHash (`receivedPrefix8: d13dd034`) did not match active key for start endpoint URL. |
| **12:56:09.120** | Frontend SPA | Error State Transition | Error View Rendered | `StudentExamStartPage` caught 403 and rendered error UI containing: *"Have a launch code from your browser? Enter the 6-digit code shown on your primary browser to connect this session."* |
| **12:56:14.209** | Caddy / Backend | `POST /api/v1/seb/exchange-pin` | `409 Conflict` | Candidate typed the 6-digit PIN and submitted. Backend rejected request with `CODE_USED`: *"This launch code has already been used. Please generate a fresh code."* |

---

## 3. Hypotheses & Falsification Table

| # | Hypothesis | Falsifying Test | Result | Verdict |
|---|---|---|---|---|
| **H1** | Stored `.seb` configuration failed to forward the launch query parameter to Start URL (`startURLAppendQueryParameter` disabled or not honored by SEB). | Inspect Caddy access log for the incoming GET request on the Start URL (`/seb/enter`) from SEB User-Agent. | Caddy log at `12:56:05.511` shows `GET /seb/enter?launch=3cf0cc4fb69b1834...` received with full query intact. SEB 3.10.3 honors the key. | **FALSIFIED** |
| **H2** | Session cookies (`proctornet_token`) failed to persist across redirects in SEB (SameSite/Secure/path issue). | Inspect Caddy log headers on subsequent requests from SEB at `12:56:06` - `12:56:09`. | Subsequent request to `/api/v1/exams/.../readiness` and `/api/v1/attempts/.../start` carried `Cookie: [REDACTED]` and authenticated user `dd389f54...`. Session was active. | **FALSIFIED** |
| **H3** | Two separate launches were created, and the second launch invalidated the first launch's token/PIN. | Inspect timestamps and user active tokens in Redis/memory store. | While two launches occurred (`12:54:41` and `12:56:06`), the second launch created a fresh token and PIN. The PIN submitted at `12:56:14` belonged to the second launch. | **FALSIFIED** |
| **H4** | The initial automated exchange at `12:56:06` atomically consumed both the token and the PIN, so subsequent manual PIN submission was rejected as already used. | Trace code in `sebToken.service.js` `markConsumed()` and correlate timestamps of automated exchange (`12:56:06.012`) vs `POST /exchange-pin` (`12:56:14.209`). | `sebTokenService.markConsumed()` in `exchange()` marks `record.consumedAt = Date.now()`. When `exchangePin()` was called 8 seconds later, `consumeResult.status === 'ALREADY_USED'` was triggered. | **CONFIRMED (Root Cause 1)** |
| **H5** | A failure on `/student/exams/:id/start` incorrectly displayed the fallback PIN entry form to an already-authenticated student instead of handling the error in-place. | Inspect `StudentExamStartPage.jsx` error rendering branch. | When `startExam` throws any error (e.g. 403), lines 490-527 rendered a fallback 6-digit PIN input form, prompting the candidate to re-enter a code that was already spent during initial handoff. | **CONFIRMED (Root Cause 2)** |
| **H6** | Token exchange strictly allowed single HTTP request with zero replay tolerance, meaning any reload or browser double-dispatch broke the session handoff. | Review `consumeLaunchToken()` logic in `sebToken.service.js`. | Zero replay tolerance: immediate invalidation with no grace period for reloads or concurrent asset requests. | **CONFIRMED (Root Cause 3)** |

---

## 4. Root Causes Identified

1. **Premature Dual Consumption with Dead-End Error Recovery:**  
   The initial automated token exchange (`GET /api/v1/seb/exchange?launch=...`) succeeded and marked the entire launch record consumed. When downstream exam readiness checks encountered an issue (such as SEB request verification in enforce mode), `StudentExamStartPage` displayed a prompt asking for the 6-digit code. Submitting that code hit `exchange-pin`, which rejected it with `409 CODE_USED` because the initial exchange had already consumed it.

2. **Unnecessary PIN System Complexity:**  
   The 6-digit PIN system was originally built as a fallback for SEB versions that did not forward query parameters. However, evidence confirms modern SEB 3.x clients reliably forward query parameters via `startURLAppendQueryParameter`. The PIN system introduced state desynchronization, duplicate exchange race conditions, and user confusion.

3. **Zero Replay Tolerance on Launch Token:**  
   `sebTokenService` had no grace period. If a student reloaded `/seb/enter` or if the webview dispatched duplicate requests within the first minute of opening SEB, the student was permanently stranded with `ALREADY_USED`.

---

## 5. Architectural Remediation Plan

1. **Remove PIN System Completely:**
   - Eliminate PIN generation, storage, and hashing in `sebToken.service.js`.
   - Remove `/api/v1/seb/exchange-pin` endpoint and router definitions.
   - Delete `SebPinEntryPage.jsx` and replace with a seamless `SebHandoffPage.jsx` (which performs token exchange and displays status/error with password fallback).
   - Remove PIN display, copy button, and "asks for a code" panels from `StudentExamStartPage.jsx`, `AdminSebConfigPage.jsx`, and `LoginPage.jsx`.
   - Purge all documentation and error mappings referring to PINs or 6-digit codes.

2. **Resilient Launch Token Lifecycle with 60-Second Replay Window:**
   - Introduce a 60-second replay window for the launch token: within 60 seconds of initial exchange, reloads or duplicate requests by the same student will re-issue/confirm the authenticated session and redirect to the exam lobby rather than failing.
   - After 60 seconds, or for expired/tampered tokens, present a clear, human-readable error state with:
     - Clear explanation of what happened.
     - Direct button to sign in with password inside SEB.
     - Instructions on how to relaunch from the standard browser.
     - Reference ID linked to admin launch traces.

3. **Chrome Launch Polling & Live State:**
   - Chrome displays:
     - *"Opening the secure browser…"*
     - *"Waiting for the secure browser…"* with live server polling (`/api/v1/seb/token-status/:token`).
     - *"Your exam is open in the secure browser, you can close this tab"* once token status transitions to `CONSUMED`.
     - Direct download/install help if SEB does not launch.
