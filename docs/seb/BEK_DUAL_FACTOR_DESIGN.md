# Design Specification: Browser Exam Key (BEK) Dual-Factor Verification

> **Status:** Architectural Design (Design Only — Zero Code Implementation)  
> **Audience:** Lead Architects, Security Officers, Institutional Administrators  
> **Target:** High-Stakes Proctored Examinations  

---

## 1. Threat Model: Why Config Key Alone Has Limitations

Safe Exam Browser (SEB) provides two distinct cryptographic keys:
1. **Configuration Key (CK)**: Derived purely from the XML configuration parameters of the `.seb` file.
2. **Browser Exam Key (BEK)**: Derived from the combination of the configuration file **AND** the binary integrity/signature of the installed Safe Exam Browser application executable.

### The Attack Vector Against Unencrypted `.seb` Files
When an institution uses `SEB_MODE=enforce` with Config Key verification:
- The backend verifies that incoming requests contain `X-SafeExamBrowser-ConfigKeyHash = SHA256(requestURL + configKey)`.
- If the student downloads an **unencrypted `.seb` configuration file** (or a file protected only by a widely known institutional password), the candidate can inspect the file, extract the settings, or use the SEB Config Tool / open-source SEB parser to obtain the 64-character hex `Config Key`.
- An adversarial student can run a custom script (e.g., Python `requests`, Node.js, or a Chromium extension) that computes the SHA-256 HMAC/hash for each requested URL and injects the header `X-SafeExamBrowser-ConfigKeyHash`.
- As a consequence, the student could take the exam inside an ordinary, unconstrained Google Chrome or Firefox browser with full access to developer tools, external websites, second monitors, and communication software, completely bypassing the OS-level kiosk lock.

---

## 2. Browser Exam Key (BEK) as a Second Factor

To mitigate this attack on high-stakes exams (e.g., certification, university finals, bar exams), the institution can require **Dual-Factor SEB Verification**:
1. **Factor 1 (Configuration Integrity):** Validates that the client operates under institutional exam settings via `X-SafeExamBrowser-ConfigKeyHash`.
2. **Factor 2 (Binary & Runtime Integrity):** Validates that the client runs inside an authentic, unmodified Safe Exam Browser binary via `X-SafeExamBrowser-RequestHash`.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Client Request from SEB                  │
                    │                                                        │
                    │ Headers:                                               │
                    │  • X-SafeExamBrowser-ConfigKeyHash  (Factor 1: Config) │
                    │  • X-SafeExamBrowser-RequestHash    (Factor 2: Binary) │
                    └────────────────────────────────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │            Backend Dual-Factor Middleware              │
                    ├────────────────────────────────────────────────────────┤
                    │ Step 1: Compute expected Config Key Hash               │
                    │         Expected = SHA256(URL + configKey)             │
                    │         Match against X-SafeExamBrowser-ConfigKeyHash  │
                    │                                                        │
                    │ Step 2: Query BEK Allowlist for Exam                   │
                    │         For each allowed BEK in exam_bek_allowlist:    │
                    │           ExpectedBEKHash = SHA256(URL + bek)          │
                    │         Match against X-SafeExamBrowser-RequestHash    │
                    └────────────────────────────────────────────────────────┘
                                                │
                                    ┌───────────┴───────────┐
                                    ▼                       ▼
                              Both Pass                Any Fails
                              (200 OK)                 (403 SEB_REQUIRED)
```

---

## 3. Cryptographic Specification & Header Structure

When "Use Browser Exam Key and Configuration Key" is enabled in SEB:
- Header **`X-SafeExamBrowser-ConfigKeyHash`**:
  $$\text{Hash}_{\text{CK}} = \text{SHA256}(\text{CanonicalRequestURL} \parallel \text{ConfigKey})$$
- Header **`X-SafeExamBrowser-RequestHash`** (BEK Request Hash):
  $$\text{Hash}_{\text{BEK}} = \text{SHA256}(\text{CanonicalRequestURL} \parallel \text{BrowserExamKey})$$

Where `CanonicalRequestURL` uses the exact same URL normalization rules defined in ProctorNet (strict bare origin + full path, without query strings).

---

## 4. Platform Diversity & Allowlist Architecture

Unlike the Config Key (which is platform-independent), the **Browser Exam Key is strictly platform-, build-, and architecture-dependent**:
- A single `.seb` file produces **different BEKs** on:
  - Windows 64-bit (x64) vs Windows 32-bit (x86)
  - macOS Intel vs macOS Apple Silicon
  - iOS / iPadOS
  - Different point releases (e.g. SEB 3.10.3 vs SEB 3.10.2).

### Proposed Schema Extension for High-Stakes Exams
```sql
CREATE TABLE exam_bek_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    os VARCHAR(32) NOT NULL,            -- 'windows', 'macos', 'ios'
    architecture VARCHAR(16) NOT NULL,  -- 'x64', 'arm64', 'x86'
    seb_version VARCHAR(32) NOT NULL,   -- '3.10.3'
    bek_hash CHAR(64) NOT NULL,         -- 64-hex BEK string
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exam_bek_lookup ON exam_bek_allowlist(exam_id, bek_hash);
```

### Verification Algorithm
```javascript
// High-Stakes Verification Logic (Pseudocode)
async function verifyDualFactor(req, examId) {
  const canonicalUrl = getCanonicalUrl(req);
  
  // 1. Verify Config Key
  const ck = await getExamConfigKey(examId);
  const expectedCkHash = crypto.createHash('sha256').update(canonicalUrl + ck).digest('hex');
  if (req.headers['x-safeexambrowser-configkeyhash'] !== expectedCkHash) {
    return { verified: false, reason: 'CONFIG_KEY_MISMATCH' };
  }

  // 2. Verify BEK against Allowlist
  const allowedBeks = await getExamAllowedBeks(examId);
  if (allowedBeks.length > 0) {
    const incomingBekHash = req.headers['x-safeexambrowser-requesthash'];
    const bekMatched = allowedBeks.some(bek => {
      const exp = crypto.createHash('sha256').update(canonicalUrl + bek).digest('hex');
      return exp.toLowerCase() === (incomingBekHash || '').toLowerCase();
    });
    if (!bekMatched) {
      return { verified: false, reason: 'UNAUTHORIZED_BROWSER_BUILD' };
    }
  }

  return { verified: true };
}
```

---

## 5. Deployment Strategies & Operational Recommendations

| Environment | Recommended Mode | Rationale |
| :--- | :--- | :--- |
| **Institutional Computer Labs** | **Enforce Dual-Factor (CK + BEK)** | Gold standard. All university lab machines run identical pinned SEB versions (e.g. 3.10.3 x64). Dual factor guarantees 100% kiosk protection with zero bypass vectors. |
| **BYOD (Bring Your Own Device)** | **Config Key Only (`SEB_MODE=enforce`)** | In BYOD environments, students run varied SEB minor versions on Windows 10, Windows 11, and macOS. Unless the institution maintains dozens of hashes in the allowlist, students face frequent lockouts on update. |
| **Mock / Low-Stakes Quizzes** | **`SEB_MODE=log`** | Non-blocking monitoring; records hash mismatches without disrupting candidate progress. |

