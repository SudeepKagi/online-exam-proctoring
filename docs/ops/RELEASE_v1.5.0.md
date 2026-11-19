# ProctorNet Production Release v1.5.0

- **Release Version**: `v1.5.0` (Minor Release)
- **Deployment Git Target**: `release/v1.5.0`
- **Target Instance**: EC2 `i-0d242d962823f0a89` (`proctornet.duckdns.org`, region `ap-south-1`)
- **Release Tarball**: `s3://proctornet-storage-prod-858109978489/releases/`
- **Release Date**: `2026-11-20`
- **Effective SEB Mode**: `log` (CEILING: `log`, DB: `audit`)

---

## 1. Summary of Changes

### Phase 1: SEB Entry Decoupling & Config Key Hardening (PR #60 / commit `f53291d`)
1. **Decoupled Exchange from Header Gating**:
   - The PIN exchange endpoint (`POST /api/v1/seb/exchange`) is no longer blocked by missing or mismatched `x-safeexambrowser-configkeyhash` request headers.
   - When a student launches SEB from the browser via custom URL protocol (`seb://`), Safe Exam Browser for Windows 3.x opens the target URL before configuration profiles are applied. Header gating at exchange caused false-positive rejections.
   - PIN exchange now authenticates student identity via temporary launch code, issues a cryptographically signed SEB session JWT, and returns the exam launch URL.
2. **Deterministic Config Key Verification**:
   - Resolved canonical URL hashing mismatch in `backend/src/modules/seb/sebConfig.service.js`.
   - Verified that the official Safe Exam Browser specification requires canonical hashing:
     $$\text{ConfigKey} = \text{SHA256}(\text{URL} + \text{rawConfigXml})$$
   - Formatted URLs strictly matching `PUBLIC_ORIGIN` with trailing slashes (`https://proctornet.duckdns.org/seb/entry`).
3. **Structured Entry Diagnostics & Error Mapping**:
   - Introduced user-friendly diagnostic references (`Ref: <uuid>`) on entry failures.
   - All entry events and validation failures are logged to `SebDiagnosticAttempt` table and exposed via `GET /api/v1/seb/diagnostics`.
   - Technical error codes (`CONFIG_KEY_MISMATCH`, `NOT_SEB_BROWSER`, `PIN_EXPIRED`) are mapped to plain English guidance without jargon.
4. **Starter SEB Configuration & Camera Media Keys**:
   - Embedded `allowVideoCapture`, `browserMediaCaptureCamera`, and `allowAudioCapture` XML keys directly into `proctornet-starter.seb`.
   - Addressed Windows SEB 3.10.3 configuration tool GUI behavior where webcam controls rely on Chromium WebRTC engine defaults.

### Phase 2: Honest Grounded AI Question Generation (PR #61 / commit `1d89bbb`)
1. **Production Safety & Zero Fake Generation**:
   - `backend/src/modules/exams/ai.generator.js` rejects AI generation requests with HTTP 503 `AI_GENERATION_NOT_CONFIGURED` when `GEMINI_API_KEY` and `OPENAI_API_KEY` are unset.
   - Mock and synthetic fallback generation logic is completely disabled in production environments.
2. **Page-Aware PDF Text Extraction**:
   - Integrated `pdf-lib` for structured page-by-page extraction.
   - Imposed a substantive content threshold ($\ge 300$ words). PDFs lacking substantive text are rejected with HTTP 400 `INSUFFICIENT_SOURCE_TEXT`.
3. **Strict Verbatim Grounding & Citation Verification**:
   - Every generated question requires verbatim `sourcePage` and `supportingExcerpt` citations.
   - Server-side verification validates excerpts against extracted page text using `checkGrounding()`.
   - Questions lacking verbatim source grounding are rejected or flagged for faculty review.
4. **Single Question Regeneration**:
   - Added endpoint `POST /api/v1/exams/ai/regenerate-question` allowing faculty to regenerate individual questions from specific source passages.
5. **Enterprise Review UI**:
   - `ExamWizardStepAIReview.jsx` renders source coverage metrics, page breakdown strips, and status filter pills (`All`, `Verified`, `Needs Review`) strictly conforming to the Enterprise Light Design System (`#fbfcfd` canvas, `#5266eb` primary actions, zero font-weight > 500).

---

## 2. Root Cause Analysis

### 1. SEB Student Launch Failure (`Ref: 231b5db7-580f-4839-9cd8-1c0f6d26bac5`)
**Root Cause**: The PIN exchange route (`POST /api/v1/seb/exchange`) performed strict header validation checking `req.headers['x-safeexambrowser-configkeyhash']` against the database-stored Config Key. On Windows SEB 3.x clients launching from a browser via `seb://` or `sebs://` protocol handlers, the initial HTTP request to the exchange endpoint is dispatched by the browser shell or pre-configuration worker prior to loading the full XML configuration profile. Consequently, the request lacked the `x-safeexambrowser-configkeyhash` header, triggering a 403 `CONFIG_KEY_MISMATCH` rejection and displaying "The exam system isn't ready, tell your invigilator". Decoupling PIN exchange from request header gating and enforcing configuration verification on subsequent authenticated assessment requests resolved the issue.

### 2. AI Question Generation Reliability & Hallucination Risk
**Root Cause**: Previous exam generation accepted unstructured text blocks or stub PDF buffers without page-level tracking, and in environments lacking AI API keys, defaulted to synthetic mock question generators. This created the risk of ungrounded questions and undetectable hallucinations entering exams. The root cause was resolved by enforcing page-aware PDF parsing with `pdf-lib`, requiring verifiable verbatim excerpt citations for every question, validating grounding server-side, and strictly failing fast with HTTP 503 `AI_GENERATION_NOT_CONFIGURED` when API keys are absent.

---

## 3. Manual Configuration Needed (Click Paths & Ops Steps)

### A. AI API Key Configuration (EC2 Production Instance)
To enable real AI question generation on the production server:
1. Connect to the EC2 server or prepare an SSM command.
2. Edit the shared environment file `/opt/proctornet/shared/.env`:
   ```bash
   sudo nano /opt/proctornet/shared/.env
   ```
3. Append or update the Gemini or OpenAI credentials:
   ```env
   GEMINI_API_KEY=AIzaSy...
   # Or for OpenAI fallback:
   OPENAI_API_KEY=sk-...
   ```
4. Restart the backend service to load the new credentials:
   ```bash
   sudo systemctl restart proctornet.service
   ```

### B. AWS S3 IAM Policy for Storage Diagnostics
If the admin storage health check reports an IAM error for S3 probes:
1. Open the AWS Management Console -> **IAM** -> **Roles**.
2. Locate the role attached to EC2 instance `i-0d242d962823f0a89` (e.g. `ProctorNet-EC2-Role`).
3. Under **Permissions policies**, click **Add permissions** -> **Create inline policy** (JSON):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ProctorNetS3ReleasesAndStorage",
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:HeadObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::proctornet-storage-prod-858109978489",
           "arn:aws:s3:::proctornet-storage-prod-858109978489/*"
         ]
       }
     ]
   }
   ```
4. Name the policy `ProctorNetS3DiagnosticPolicy` and click **Create policy**.

### C. Windows SEB Client Camera Permissions
When students encounter webcam access errors inside Safe Exam Browser on Windows 10/11:
1. Open Windows **Settings** (`Win + I`).
2. Navigate to **Privacy & security** -> **Camera**.
3. Ensure **Camera access** is toggled **On**.
4. Ensure **Let desktop apps access your camera** is toggled **On**.
5. Close background applications that lock exclusive webcam handles (Zoom, Microsoft Teams, Discord).

---

## 4. Operational Runbook & Verification Tests

### Test 1: Safe Exam Browser Real-World Flow Verification
1. Log in as a student at `https://proctornet.duckdns.org`.
2. Locate a scheduled exam with SEB enabled.
3. Click **Launch Safe Exam Browser** button on the pre-check page.
4. Verify SEB launches, transitions from launch splash to the student assessment lobby, and displays the PIN exchange confirmation.
5. Enter the exam PIN and click **Begin Exam**.
6. Verify exam questions load, answer autosave indicates saved status, and complete the exam.
7. Click **Submit Exam** and confirm submission.
8. Click **Exit Safe Exam Browser** to cleanly quit kiosk mode.
9. *Diagnostic Verification*: If any launch anomaly occurs, verify the error dialog displays a tracking reference `Ref: <uuid>`, and inspect `https://proctornet.duckdns.org/api/v1/seb/diagnostics` for structured audit logs.

### Test 2: AI Question Generation with Verbatim Grounding
1. Log in as a faculty member at `https://proctornet.duckdns.org/faculty/exams/create`.
2. In Step 1 (Basics), provide an exam title and course details.
3. In Step 2 (Questions), select **AI Generate from Syllabus / Notes**.
4. Upload a course notes PDF file ($\ge 300$ words).
5. Verify the extraction status shows:
   - Total pages parsed.
   - Total word count meeting substantive threshold.
6. Specify 5 questions and click **Generate Questions**.
7. In the Review step (`ExamWizardStepAIReview.jsx`), verify:
   - Source coverage strip displays covered pages.
   - Filter pills allow filtering by `All`, `Verified`, and `Needs Review`.
   - Each question card displays its verbatim excerpt and source page badge.
   - Clicking **Regenerate Question** updates the question using its grounded source passage.

---

## 5. Rollback Procedures

If an unexpected production defect is detected post-cutover:

```bash
# 1. SSH or SSM into production EC2 instance
INSTANCE_ID="i-0d242d962823f0a89"

# 2. Automated rollback via rollback-prod.js
node scripts/ops/rollback-prod.js --instance $INSTANCE_ID

# 3. Or Manual Rollback via Shell:
PREV_RELEASE=$(cat /opt/proctornet/releases/PREVIOUS_RELEASE)
ln -sfn "$PREV_RELEASE" /opt/proctornet/current
sudo systemctl restart proctornet.service
sudo systemctl reload caddy.service

# 4. Verify rollback health
curl -sSf https://proctornet.duckdns.org/healthz
```
