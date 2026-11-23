# Audit Report: Safe Exam Browser Security Configuration Header Mismatch Root Cause Resolution

**Date**: 2026-11-23  
**Status**: RESOLVED & VERIFIED  
**Incident Reference**: `ae97b547-558b-4088-92d2-2e2bc6328944` (Timestamp: `2026-11-23 07:59:50 UTC`)  
**Target URL**: `POST https://proctornet.duckdns.org/api/v1/attempts/exams/8147f0dd-2323-47fe-bd53-b50a608db88d/start`  
**Target EC2 Instance**: `i-0d242d962823f0a89` (`ap-south-1`)  
**Target Domain**: `https://proctornet.duckdns.org`  

---

## 1. Executive Summary & Incident Attribution

Students attempting to start an exam from Safe Exam Browser (SEB) encountered the error:
> *"Safe Exam Browser Configuration Mismatch: The security configuration header did not match this server"*  
> Incident Ref: `ae97b547-558b-4088-92d2-2e2bc6328944`

### Incident Log Telemetry
- **Student**: `sudeepkagi@gmail.com` (`dd389f54-7ad3-40fa-bc6e-d5dd5d57326c`)
- **Exam ID**: `8147f0dd-2323-47fe-bd53-b50a608db88d`
- **Received `X-SafeExamBrowser-ConfigKeyHash`**:
  `425b8c300e1a6367bec320834fecbd71a656790985208e4c57f5b84ddd093efd`
- **Expected Header**:
  Backend rejected the request because the database `SystemSetting` key `seb_config` contained an outdated or naively calculated hash `b3795424...a843`.

---

## 2. Root Cause Analysis (Ground Truth Evidence)

### 2.1 The Official SafeExamBrowser Specification
SEB calculates its Configuration Key (CK) using the official C# implementation in `SafeExamBrowser.Configuration.DataProcessor`:
1. **XML Parsing**: SEB parses `.seb` files into an in-memory dictionary using `SafeExamBrowser.Configuration.DataFormats.XmlParser`.
2. **JSON Canonicalization**: The dictionary is serialized to JSON with strict ordering:
   - Dictionary keys sorted alphabetically using .NET `StringComparer.InvariantCulture` (case-sensitive, uppercase preceding lowercase).
   - Empty dictionaries (`{}`) are omitted from serialization.
   - Elements are serialized without formatting whitespace (`{"key":"value",...}`).
3. **SHA-256 Digest**: The Configuration Key is the SHA-256 digest of this canonical JSON string.
4. **Request Header Computation**:
   When SEB sends an HTTP request to `url`, it computes:
   $$\text{Header} = \text{SHA-256}(\text{canonicalUrl} + \text{ConfigurationKey})$$

### 2.2 Ground Truth Experiment & Reproduction
To establish ground truth without guessing, we compiled a native C# tool against the installed SEB binaries (`C:\Program Files\SafeExamBrowser\Application\SafeExamBrowser.Core.dll`, `SafeExamBrowser.Configuration.dll`, and `SafeExamBrowser.Logging.dll`):
- Binary: `C:\seb-lab\CalculateKey.exe`
- Raw S3 file: `2493c0d6fdf45acbadb01fd143680c1deddafcd0752dea2e5515c9a1718db910`
- Sanitized S3 file (as delivered by `/api/v1/seb/config` after stripping prohibited processes):
  $$\text{Configuration Key} = \text{e6b6658de7e289d476020f39661f3ec79a11aba8832409101f5a5c7c544ce9c0}$$
- Recomputing the request hash for the exact incident endpoint:
  ```
  URL: https://proctornet.duckdns.org/api/v1/attempts/exams/8147f0dd-2323-47fe-bd53-b50a608db88d/start
  Key: e6b6658de7e289d476020f39661f3ec79a11aba8832409101f5a5c7c544ce9c0
  Computed Hash: 425b8c300e1a6367bec320834fecbd71a656790985208e4c57f5b84ddd093efd
  ```
  **Result**: 100% exact match against incident `ae97b547`.

---

## 3. Implementation of the Permanent Fix

1. **`backend/src/modules/seb/sebConfigChecker.js`**:
   - Replaced naive XML normalization with `parsePlistXml` matching SEB's `XmlParser`.
   - Implemented `serializeSebJson` with `Intl.Collator('en', { sensitivity: 'case', caseFirst: 'upper' })` matching .NET `InvariantCulture` dictionary sorting.
   - Computes `calculateSebConfigKey` on sanitized configuration content.
2. **`backend/src/middleware/seb.js`**:
   - Correctly prioritizes `sebSettings.effectiveMode` while respecting environment constraints.
3. **`backend/src/modules/exams/exams.service.js`**:
   - Checks `config.sebMode || process.env.SEB_MODE` so runtime configuration remains deterministic.
4. **`backend/tests/seb-config-key-official.test.js`**:
   - Added unit test suite validating the official SEB specification and certifying the incident `ae97b547` ground truth.

---

## 4. Verification Gate & Live Deployment

### 4.1 Release Check Gate (`npm run release:check`)
- ESLint: 0 errors
- TypeScript: 0 errors
- Frontend Build: Passed
- Backend Test Suite: 497 passed (138 suites)
- Playwright E2E Suite: 164 passed, 0 failed
- Security Audit: Passed
- Migration Drift Check: Schema up to date

### 4.2 Production Database Key Update
Dispatched SSM script `scripts/ops/remote/update-seb-config-key.sh` to update `SystemSetting` `seb_config`:
- **Updated Key Length**: 64 hex characters
- **Updated Key Suffix**: `e9c0` (Ground-truth key `e6b6658de7e289d476020f39661f3ec79a11aba8832409101f5a5c7c544ce9c0`)
- **Requested Mode**: `audit` (demo-safe)
- **Live Smoke Test**: 7/7 checks PASSED cleanly.
