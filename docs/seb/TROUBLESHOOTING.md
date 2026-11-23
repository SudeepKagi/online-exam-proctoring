# Safe Exam Browser (SEB) Troubleshooting Runbook

This guide documents common Safe Exam Browser launch and verification issues, their verified root causes, and exact step-by-step confirmation procedures.

---

## 1. Symptom: "Configuration failed" Native Dialog on SEB Startup

### Problem Description
When clicking the launch link or opening the `.seb` file, Safe Exam Browser fails to open the Start URL or show the code form; instead, Windows displays a native SEB error modal:
> **"The local client configuration has failed! Please consult the log files for more information. SEB will now shut down..."**

### Root Cause
The `.seb` configuration XML plist contains Windows Background Services (e.g., `UltraViewer_Service.exe`, `TeamViewer_Service.exe`, `AnyDesk_Service.exe`) in the `<key>prohibitedProcesses</key>` list with `<key>active</key><true/>`.
Because these services run as `NT AUTHORITY\SYSTEM` in Session 0, user-space SEB (`SafeExamBrowser.Client.exe`) lacks permission to send `WM_CLOSE` or execute `Process.Kill()`. The Win32 API returns `ERROR_ACCESS_DENIED` (`Win32Exception: Access is denied`), causing the SEB initialization sequence to abort.

### Confirmation Steps
1. Open the local SEB log directory:
   ```powershell
   Get-ChildItem "$env:LOCALAPPDATA\SafeExamBrowser\Logs\*_Client.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content | Select-String "Access is denied" -Context 2,2
   ```
2. Look for log lines matching:
   ```text
   [Process '<service>.exe'] Attempting to close process...
   [Process '<service>.exe'] Failed to check whether process is terminated!
   Exception Message: Access is denied
   INFO: Application startup failed!
   ```
3. Run the Config Doctor instrument against the public URL:
   ```bash
   node scripts/seb/config-doctor.js https://proctornet.duckdns.org/api/v1/seb/config/<token>.seb
   ```
   If dangerous services are active, the tool outputs:
   `[FAIL] Active non-killable background Windows services detected: UltraViewer_Service.exe`

### Resolution
The backend automatically sanitizes plain XML configurations upon upload and dynamic download via `sebConfigChecker.sanitizeProhibitedProcesses()`, setting `<key>active</key><false/>` on background services while keeping standard user-level executables prohibited.

---

## 2. Symptom: HTTP 403 `CONFIG_KEY_MISMATCH` / `SEB_HEADER_MISMATCH` on Exam Start

### Problem Description
The student launches SEB and enters the exam lobby, but clicking "Start Exam" fails with:
> **"Safe Exam Browser configuration check failed. Configuration Key header mismatch."**

### Root Cause
The 64-character SHA-256 Configuration Key stored in the PostgreSQL database does not match the cryptographic hash computed by SEB from the actual `.seb` file downloaded by the client. This typically happens when:
1. An administrator modified exam settings without re-exporting and re-uploading the `.seb` file.
2. The client is running the default starter template while the database expects an institution-specific file.
3. Proxy or URL normalization altered the hashed URL (e.g., trailing slash, HTTP vs HTTPS scheme, default port `:443`).

### Confirmation Steps
1. Inspect the EC2 application logs:
   ```bash
   journalctl -u proctornet --since "10 min ago" | grep "SEB request verification failed"
   ```
   Note the `receivedPrefix8` and `urlHashed`.
2. Inspect the mismatch hypothesis engine via the Admin Dashboard or API:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://proctornet.duckdns.org/api/v1/admin/seb/launch-traces
   ```
3. Run the Config Doctor with the expected key:
   ```bash
   node scripts/seb/config-doctor.js <config-url> --stored-key <active-key-hex>
   ```

### Resolution
- If keys drifted: In **Admin Dashboard > Safe Exam Browser Settings**, re-upload the current `.seb` configuration file.
- If in a pilot or rehearsal: Switch enforcement mode to `audit` or `off` while synchronizing keys.

---

## 3. Symptom: Automated Launch Handoff

### Problem Description
The exam opens directly to `/student/exams/:id/start` without requiring manual entry.

### Root Cause
This is intentional SEB 3.x query-forwarding behavior. The launch URL format is:
`sebs://proctornet.duckdns.org/api/v1/seb/config/<downloadToken>.seb??launch=<exchangeToken>`
SEB 3.x appends `?launch=<exchangeToken>` to the `startURL` (`/seb/enter?launch=...`).
The React frontend in `SebHandoffPage.jsx` detects `launchParam`, automatically calls `GET /api/v1/seb/exchange?launch=...`, authenticates the student session, and redirects to the exam seamlessly.

### Confirmation Steps
1. Check `2026-11-22_09h02m41s_Client.log`:
   ```text
   Browser Window #1 Navigated to https://proctornet.duckdns.org/seb/enter?launch=...
   ```
2. Check live EC2 journal:
   ```text
   Safe Exam Browser launch token successfully exchanged for user session
   ```
3. If exchange fails: Verify that `SebHandoffPage.jsx` displays the Reference ID, instructions to restart from the main browser, and the password sign-in fallback button.

---

## 4. Symptom: HTTP 401 `TOKEN_EXPIRED`

### Problem Description
SEB displays an error stating the launch link has expired.

### Root Cause
Single-use launch tokens carry a strict 5-minute Time-To-Live (`LAUNCH_TOKEN_TTL_MS = 5 * 60 * 1000`). If SEB startup, system reboot, or candidate delay exceeds 5 minutes, the token expires.

### Confirmation Steps
1. In SEB, note the Reference ID shown on screen: `Ref: #<requestId>`.
2. As Admin, query the diagnostic lookup endpoint:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" https://proctornet.duckdns.org/api/v1/admin/seb/diagnostics/lookup/<requestId>
   ```
3. Expected output:
   ```json
   {
     "code": "TOKEN_EXPIRED",
     "likelyCause": "Launch token exceeded the 5-minute activation window."
   }
   ```

### Resolution
Instruct the candidate to return to their standard browser and click "Relaunch Safe Exam Browser" to generate a fresh link, or sign in directly with their institutional password via the "Sign in with password" button inside SEB.

---

## 5. Symptom: Proxy Body Corruption or Header Stripping

### Problem Description
SEB reports `DataValidator: The configuration data is invalid` or fails to send `X-SafeExamBrowser-ConfigKeyHash`.

### Root Cause
The reverse proxy (Caddy/Nginx) stripped `X-SafeExamBrowser-*` headers or applied dynamic GZip/Zstandard re-compression to the binary `.seb` payload.

### Confirmation Steps
1. Run `scripts/seb/config-doctor.js`:
   ```bash
   node scripts/seb/config-doctor.js https://proctornet.duckdns.org/api/v1/seb/config/<token>.seb
   ```
2. Verify headers:
   - `Content-Type`: `application/seb`
   - `Content-Disposition`: `attachment; filename="ProctorNet-Exam.seb"`
   - `Cache-Control`: `no-store, no-cache, must-revalidate`
3. Verify body SHA-256 matches the stored S3 object byte-for-byte.

### Resolution
In `ops/caddy/Caddyfile`, ensure `encode` does not compress `.seb` binary streams and `reverse_proxy` passes all request headers transparently.

---

## 6. Numbered Real-SEB End-to-End Verification Test Script

Execute this numbered manual procedure on a Windows candidate workstation with Safe Exam Browser 3.x installed:

1. **Generate Launch Credentials**:
   - In Chrome/Edge, log in as student at `https://proctornet.duckdns.org/student/exams/<examId>/start`.
   - Click "Open exam in secure browser". Chrome transitions to "Waiting for the secure browser…" with live server status polling.

2. **Launch Safe Exam Browser**:
   - Click the `seb://` or `sebs://` launch link, or download the `.seb` file and open it.
   - Verify Windows prompts to open Safe Exam Browser.

3. **Verify Configuration & Session Startup**:
   - Confirm Safe Exam Browser opens without the native Windows "Configuration failed" dialog.
   - Verify the splash card appears: *"Connecting Secure Session…"*.

4. **Verify Auto-Exchange or Password Fallback (Never a Dead End)**:
   - **Path A (Normal)**: Within 3 seconds, the session auto-exchanges and transitions directly to `/student/exams/<examId>/start` without candidate typing anything. Chrome confirms: *"Your exam is open in the secure browser, you can close this tab"*.
   - **Path B (Manual Password Fallback)**: If token is omitted, invalid, or expired, verify the UI displays:
     - Clear human-readable error with `Ref: #<correlationId>`
     - Solid primary button "Sign in with password"
     - Diagnostics link to `/seb/diagnostics`
     - Clean password sign-in working end-to-end inside SEB webview.

6. **Enter Arena**:
   - On the start screen, confirm identity verified status and institutional security banner.
   - Click "Start exam".
   - Confirm successful entry into the exam arena.

---

## 7. Artifact Collection Checklist (If Any Step Fails)

If a launch or verification step fails, gather and submit the following 5 artifacts immediately for rapid root-cause diagnosis:

1. **Local SEB Windows Logs** (from candidate PC):
   - `%LOCALAPPDATA%\SafeExamBrowser\Logs\<timestamp>_Client.log`
   - `%LOCALAPPDATA%\SafeExamBrowser\Logs\<timestamp>_Runtime.log`
   - `%LOCALAPPDATA%\SafeExamBrowser\Logs\<timestamp>_Browser.log`
   *(Sanitize tokens and passwords before sharing; timestamps and error stack traces must be retained).*

2. **Candidate UI Screenshot**:
   - Full-screen capture of the SEB display showing the exact modal or card, error text, and visible `Ref: #<id>`.

3. **Reference ID / Correlation ID**:
   - The 12-character alphanumeric Reference ID (e.g., `Ref: #3a99511f9453`).

4. **Config Doctor Output**:
   - Run from an admin terminal:
     ```bash
     node scripts/seb/config-doctor.js "https://proctornet.duckdns.org/api/v1/seb/config/<token>.seb"
     ```
   - Copy the plain-text verdict and header comparison report.

5. **Server Hop Journal (EC2)**:
   - Run on the production backend:
     ```bash
     journalctl -u proctornet --since "15 min ago" --no-pager | grep -E "SEB|exchange|launch|hop"
     ```
   - Or retrieve from the Admin Dashboard at `https://proctornet.duckdns.org/admin/seb` ("Launch Traces" table).
