# Safe Exam Browser (SEB) Pilot Deployment Guide

This document outlines the step-by-step procedures for faculty and administrators conducting pilot examinations with Safe Exam Browser (SEB) enabled in ProctorNet.

---

## 1. Overview & Verification Status

ProctorNet implements SEB request verification based on the official SEB Config Key specification.

> [!IMPORTANT]
> All settings marked **[UNVERIFIED]** in this guide must be verified directly against the running SEB Config Tool GUI during the pilot testing phase.

---

## 2. Setting Up an Exam in the SEB Config Tool

When configuring a `.seb` settings profile using the official Safe Exam Browser Config Tool:

### A. General Tab
- **Start URL:**
  - Production: `https://proctornet.duckdns.org/login?redirect=/student/exams/<examId>/lobby`
  - Local Dev/Test: `http://localhost:5173/login?redirect=/student/exams/<examId>/lobby`
- **Quit URL:**
  - Production: `https://proctornet.duckdns.org/student/exams/<examId>/result`
  - Local Dev/Test: `http://localhost:5173/student/exams/<examId>/result`

### B. Exam Tab
- **Send Config Key Header [UNVERIFIED]:**
  - Check **"Use Browser & Config Keys (send in HTTP header)"** (`sendBrowserExamKey = true`).
  - *Note:* If this is unchecked, SEB will not attach the `X-SafeExamBrowser-ConfigKeyHash` header to outgoing HTTP requests.
- **Confirm Quitting [UNVERIFIED]:**
  - Set **"Confirm quitting"** to `false` (`confirmQuitting = false`). This enables the student to exit SEB cleanly upon clicking the post-submission exit link without being trapped in confirmation dialog loops.
- **Quit Password (Optional):**
  - If set, an invigilator or proctor can manually unlock SEB in emergencies using this password.

### C. User Interface / Media Tab
- **Allow Video Capture [UNVERIFIED]:**
  - Ensure **"Allow video capture"** (`allowVideoCapture = true`) is enabled.
  - ProctorNet requires local webcam feed access for continuous automated face presence monitoring. If video capture is disabled in SEB, `navigator.mediaDevices.getUserMedia` will reject with `NotAllowedError`.
- **Audio Capture:** Optional, depending on institutional exam proctoring policy.

### D. Network Tab / URL Filter Allowlist
Configure the URL Filter with default rule `Block` and add the following allowed regex or wildcards:

1. **Frontend Application Origin:**
   - `https://proctornet.duckdns.org/*`
   - (For local testing: `http://localhost:5173/*`, `http://127.0.0.1:5173/*`)
2. **Backend API & WebSocket Origin:**
   - `https://proctornet.duckdns.org/api/v1/*`
   - `wss://proctornet.duckdns.org/socket.io/*`
   - (For local testing: `http://localhost:5000/*`, `ws://localhost:5000/*`)
3. **Storage / S3 Evidence Bucket:**
   - `https://*.s3.ap-south-1.amazonaws.com/*`
   - `https://proctornet-*.s3.amazonaws.com/*`
   - (For local testing: `http://localhost:9000/*`)
4. **Post-Submission Quit URL Destination:**
   - Ensure the configured Quit URL domain and path are allowed so the browser does not block navigation on completion.

---

## 3. Extracting and Saving the Config Key

1. In SEB Config Tool, open the **Exam** tab.
2. Locate the **Config Key** field (64 hexadecimal characters).
   > [!WARNING]
   > Do **NOT** copy the *Browser Exam Key* (BEK). The Browser Exam Key changes across operating systems and SEB versions. Copy only the **Config Key**.
3. In ProctorNet Faculty Portal:
   - Navigate to the exam settings.
   - Toggle **Require Safe Exam Browser (SEB)** to ON.
   - Paste the 64-hex string into the **SEB Config Key** field.
   - Save the configuration. ProctorNet stores the key securely and displays only `••••••••<last4>`.

---

## 4. Operational Modes: Log vs Enforce

ProctorNet supports three server operational modes configured via the `SEB_MODE` environment variable:

| Mode | Behavior on Gated Endpoints | Socket.IO Join | Recommended Use |
|---|---|---|---|
| `off` | Middleware passes through without inspection. | Allowed without checks. | Default; standard non-SEB testing. |
| `log` | Inspects and validates headers; logs telemetry (`matched`, `receivedPrefix8`, `expectedPrefix8`, `urlHashed`). Never blocks requests. | Allowed without checks. | **Recommended for Pilot Testing**: Allows gathering verification metrics without risk of locking students out. |
| `enforce` | Rejects missing/mismatched headers with `403 Forbidden` (`{ code: "SEB_REQUIRED" }`). | Refused unless attempt passed prior verified HTTP request. | Production deployments once verification formula is confirmed. |

---

## 5. Verification Tool: `scripts/seb/verify-formula.js`

To diagnose header discrepancies and verify formula variants during the pilot, use the verification script:

### A. Comparing Observed Request Headers Against Keys
```bash
node scripts/seb/verify-formula.js <url> <configKey> <observedHeader>
```
Example:
```bash
node scripts/seb/verify-formula.js \
  "https://proctornet.duckdns.org/api/v1/attempts/start" \
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" \
  "be0a4a4d51f5eb741a8141dc7051e1d09478e47c77dc6f486e67b88986a5321e"
```
Output:
- `MATCH: Variant A (sha256_hex(url + key))` (exit code 0)
- `MATCH: Variant B (sha256_hex(url + sha256_hex(key)))` (exit code 0)
- `MISMATCH: Neither variant matched observed header.` (exit code 1)

### B. Generating Test Headers for `curl`
```bash
node scripts/seb/verify-formula.js --make <url> <configKey>
```
Example:
```bash
node scripts/seb/verify-formula.js --make \
  "http://localhost:5000/api/v1/attempts/start" \
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```
Prints both Variant A and Variant B hashes and formatted `X-SafeExamBrowser-ConfigKeyHash` header ready for testing.
