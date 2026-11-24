# ProctorNet Production Release v1.4.0

- **Release Version**: `v1.4.0` (Minor Release)
- **Deployment Git Commit SHA**: `09f4e4becef0fadba87830cbbc3871f1397e5213`
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/release-09f4e4becef0fadba87830cbbc3871f1397e5213.tar.gz`
- **Target Instance**: EC2 `i-0d242d962823f0a89` (`proctornet.duckdns.org`, region `ap-south-1`)
- **Cutover SSM Command ID**: `6559a8ab-0877-4a85-9225-eca6ce90cf40` (Status: `Success`, Exit Code: 0)
- **Cutover Timestamp**: `2026-11-18T14:19:47.450Z`
- **Effective SEB Mode**: `log` (CEILING: `log`, DB: `audit`)

---

## 1. Summary of Changes

### Phase 0: SEB Launch Diagnostic Audit & Safety Guards
- Documented live baseline in `docs/ops/AUDIT_2026-11-18.md`.
- Safely switched live SEB mode to `audit` (0 active attempts, 0 open exams) so students are never blocked by configuration drift during rollout.

### Phase 1: PIN Exchange & Entry Hardening (PR #56 / `b505d8a`)
- **Key Validation Precedence**: Fixed bug where PIN exchange consumed launch tokens before verifying request headers or config keys. Launch codes now remain valid until cryptographic verification completes.
- **Error Code Normalization**: Standardized frontend and backend error codes (`PIN_EXPIRED`, `PIN_NOT_FOUND`, `PIN_INVALID`, `PIN_ALREADY_USED`, `CONFIG_KEY_MISMATCH`, `NOT_SEB_BROWSER`).
- **Entry Screen Stability**: Removed premature auto-submission on inside-SEB splash screen, preventing unprompted errors when students enter SEB.

### Phase 2: Comprehensive Multi-Viewport Responsive Layout (PR #57 / `10d0b21`)
- **Responsive Shell & Drawer**: Implemented a slide-out drawer navigation for viewports `< lg` (iPad mini, mobile) with touch targets $\ge 44\text{px}$.
- **Mobile Bottom Sheets**: Dialogs and confirmation modals gracefully morph into bottom sheets on screen widths `< sm` (375px–430px).
- **Stacked Card Views**: Transformed heavy tabular views (Student Exam List, Faculty Exam Management, Admin User List) into stacked cards on mobile to eliminate horizontal scrolling.
- **Collapsible Question Palette**: In `ExamArenaPage.jsx`, added a floating navigator button and bottom-sheet drawer for mobile viewports while preserving side palette on desktop.
- **Playwright Responsive Matrix**: Added dedicated viewport test projects (`mobile-chrome`, `mobile-safari`, `tablet-portrait`, `desktop-sm`, `desktop-wide`) in `playwright.config.ts`.

### Phase 3: Single Attempt Invariant & Copy Purge (PR #58 / `09f4e4b`)
- **Database Unique Constraint**: Enforced `@@unique([examId, studentId])` on the `Attempt` model.
- **Concurrency Verification**: Added integration test `1b` in `backend/tests/phase2-flow-integrity.test.js` validating 5 simultaneous `startAttempt` calls create exactly 1 DB record without duplicate entries.
- **Violation Auto-Termination Copy Purged**: Removed all legacy references to "terminated after 3 violations" across `frontend/src/copy/index.js`, `useArenaSocketAndTab.js`, and load test scripts. Flagged violations are strictly marked for human invigilator review.
- **Dynamic Results Page Verification**: Audited `StudentResultsPage.jsx` confirming 100% dynamic DB metrics and zero hardcoded/mock values.

---

## 2. Release Gate Verification (Pre-Deploy)

Executed: `node scripts/ci/release-check.js`
Total Duration: **839.8 seconds**

```
======================================================================
 ProctorNet Release Gate: Complete Verification
 Node.js : v22.14.0
 OS      : win32 (x64)
 Time    : 2026-11-18T13:48:47.362Z
======================================================================

[1/7] Typecheck...
  [frontend] tsc -p jsconfig.json --noEmit
  [backend]  tsc -p jsconfig.json --noEmit
  [✓] Typecheck passed (0 errors)

[2/7] Lint...
  [frontend] eslint . (0 errors, 14 warnings)
  [backend]  eslint . (0 errors, 1 warning)
  [✓] Lint passed (0 errors)

[3/7] Frontend Production Build...
  [vite] built in 10.42s
  [✓] Frontend production build succeeded

[4/7] Backend Unit & Integration Tests...
  [backend] node --env-file=../.env.test --test tests/*.test.js
  [✓] 32 test suites passed (100% pass)

[5/7] Playwright End-to-End Suite...
  [playwright] Running 119 tests using 4 workers
  119 passed (13.2m)
  [✓] All 119 E2E tests passed cleanly

[6/7] Dependency Audit...
  [npm audit] 0 vulnerabilities
  [✓] Security audit passed

[7/7] Git Worktree Drift Check...
  [git] Working tree clean
  [✓] No uncommitted drift detected

======================================================================
 RELEASE GATE STATUS: GREEN (100% Passed)
 Ready for Production Cutover.
======================================================================
```

---

## 3. Production Deployment & Live Smoke Verification

- **Deploy Script**: `node scripts/ops/deploy-prod.js`
- **SSM Remote Execution**: Command ID `6559a8ab-0877-4a85-9225-eca6ce90cf40` -> `Success` (Exit Code 0)
- **Live URL**: `https://proctornet.duckdns.org`

```
======================================================================
 ProctorNet Production Smoke Verification
 Target Origin : https://proctornet.duckdns.org
 SEB Mode      : log
 Timestamp     : 2026-11-18T14:19:45.886Z
======================================================================
 [PASS] 1. Backend Health Check (/healthz) - Status 200 (service: ProctorNet Backend, status: ok)
 [PASS] 2. TLS Certificate Validity - Expires in 49 day(s) (2027-01-05)
 [PASS] 3. Strict-Transport-Security (HSTS) - max-age=31536000; includeSubDomains
 [PASS] 4. Frontend SPA Login Page - Status 200, length: 3126 bytes
 [PASS] 5. CORS Preflight (SEB Headers) - Status 204
 [PASS] 6. SEB Ping Endpoint (/api/v1/seb/ping) - Status 200, verified: false
 [PASS] 7. Unauthenticated Exam Start (401 TOKEN_REQUIRED) - Status 401
 [PASS] 8. WebSocket Handshake (/socket.io) - Status 101 Switching Protocols
======================================================================
 SUCCESS: All 8 checks passed cleanly.
[✓] Live smoke suite passed 100%.
```

---

## 4. Rollback Plan & Commands

If any issue arises in production, automated rollback to the previous stable release (`release-ab36200`) is armed and immediately executable:

```powershell
# From repo root:
cd "c:\Final year project\online-exam-proctoring"
node scripts/ops/rollback-prod.js
```

Or manually via AWS SSM cutover:
```powershell
aws ssm send-command `
  --instance-ids "i-0d242d962823f0a89" `
  --document-name "AWS-RunShellScript" `
  --parameters 'commands=["bash /opt/proctornet/scripts/ops/remote/automated-rollback.sh"]' `
  --region "ap-south-1"
```

---

## 5. MANUAL CONFIGURATION NEEDED

Before switching SEB from `log` / `audit` to `enforce` mode, complete the following configuration steps in the AWS Console and ProctorNet Admin Portal:

### 1. S3 Storage Bucket IAM Policy
Ensure the EC2 IAM Instance Profile (`proctornet-ec2-role`) has permission to read and write both the `seb/` and `probe/` prefixes in S3:
- **Bucket**: `proctornet-storage-prod-858109978489`
- **IAM Policy Statement Required**:
  ```json
  {
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::proctornet-storage-prod-858109978489",
      "arn:aws:s3:::proctornet-storage-prod-858109978489/*"
    ]
  }
  ```

### 2. Institution Safe Exam Browser Configuration Upload
1. Log in to `https://proctornet.duckdns.org/login` as an Administrator.
2. Navigate to **Admin Settings** -> **Safe Exam Browser Configuration** (`/admin/seb-config`).
3. Click **Upload Configuration File (.seb)**.
4. Select the official institution configuration file (`ProctorNet_Institution.seb` or equivalent generated by the SEB Config Tool).
5. Verify that the displayed **Computed Config Key** matches the expected hash:
   - Config Key Prefix: `c8f9...`
   - Start URL: `https://proctornet.duckdns.org/seb/enter`
   - Quit URL: `https://proctornet.duckdns.org/seb/quit`
6. Click **Save Institution Settings**.

### 3. Setting Production SEB Mode
Once manual testing confirms seamless student entry with the uploaded configuration, switch mode to `enforce`:
```powershell
# Check current mode:
node scripts/ops/check-seb-mode.js

# Switch to enforce (only when all exams and verification checklist pass):
node scripts/ops/set-seb-mode.js enforce
```

---

## 6. Physical Windows PC Safe Exam Browser Test Script (10 Steps)

Perform this verification on a physical Windows machine with Safe Exam Browser 3.x installed:

| Step | Action | Expected Result | What to do if Failed |
|------|--------|-----------------|----------------------|
| **1** | Open Google Chrome and navigate to `https://proctornet.duckdns.org/login`. | Clean light-mode login screen renders (`#fbfcfd` canvas, `#ffffff` card). | Check internet connectivity and DNS resolution for `proctornet.duckdns.org`. |
| **2** | Sign in with a student account (e.g. `student@institution.edu`). | Redirected to `/student/dashboard`. Scheduled exams appear as cards. | Verify student credentials in PostgreSQL database. |
| **3** | Click **Start Exam** on an active SEB-protected exam. | Navigated to `/student/exams/:id/pre-check`. Step indicator displays camera, audio, and browser checks. | Check browser camera/microphone permissions. |
| **4** | On the Browser Security step, click **Launch Safe Exam Browser** (or **Open Secure Browser**). | Windows prompts to open `sebs://` link. Clicking Open launches the SEB desktop application. | Ensure SEB is registered as protocol handler for `sebs://`. If blocked, use manual config download link. |
| **5** | In the standard browser tab, observe the **6-digit Launch Code** modal. | A 6-digit PIN is displayed clearly with a 10-minute expiry countdown. The code is readable and stays on screen. | If code disappears, check browser console for WebSocket disconnections. |
| **6** | Switch to the Safe Exam Browser window. | SEB opens to `https://proctornet.duckdns.org/seb/enter` showing the "Enter Launch Code" card. No unprompted error dialogs appear. | Verify SEB Start URL in uploaded configuration matches `/seb/enter`. |
| **7** | Enter the 6-digit code in SEB and click **Continue to exam**. | Code is verified; SEB transitions smoothly into `/student/exams/:id/arena` with lobby & timer active. Standard Chrome tab updates to "Session connected in Secure Browser". | If "Launch code invalid/expired" appears, generate a fresh code in Chrome. Check backend logs for `CONFIG_KEY_MISMATCH`. |
| **8** | In SEB Exam Arena, navigate between questions and select answers. | Answers save immediately with "Saved" indicator. Question palette reflects answered state. | Check network connectivity indicator in header. |
| **9** | Click **Submit Exam** and confirm the submission modal. | Button disables immediately; submission processes idempotently; redirected to completion screen. | If button does not disable or hangs, check server response status. |
| **10** | Click **Exit Safe Exam Browser** (or click SEB exit button). | SEB prompts for quit password (if configured) or closes immediately. Returning to Google Chrome shows the exam results page. | If SEB blocks exit, verify `quitURL` is set to `https://proctornet.duckdns.org/seb/quit` in SEB settings. |

---

## 7. Diagnostics & Logs to Collect in Case of Failure

If any step in the manual test script fails, collect and inspect the following logs:

1. **SEB Client Logs (on Windows)**:
   - Path: `%LOCALAPPDATA%\SafeExamBrowser\Logs\SebClient.log`
   - Path: `%LOCALAPPDATA%\SafeExamBrowser\Logs\SebBrowser.log`
   - Look for: `Navigation to ... blocked`, `Config Key computation`, `Browser Exam Key header`.

2. **Backend Application Logs (on EC2)**:
   ```bash
   journalctl -u proctornet-backend -n 100 --no-pager
   ```
   Filter for SEB exchange requests:
   ```bash
   journalctl -u proctornet-backend --since "1 hour ago" | grep -E "seb/exchange|seb/ping|CONFIG_KEY"
   ```

3. **Deploy & Cutover Logs**:
   - `online-exam-proctoring/logs-deploy/deploy-09f4e4becef0fadba87830cbbc3871f1397e5213.log`
   - `online-exam-proctoring/test-results/deploy-prod-output.txt`
