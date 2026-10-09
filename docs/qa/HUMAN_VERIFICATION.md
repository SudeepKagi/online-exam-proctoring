# ProctorNet — Human Verification Pack

> **Status:** `HUMAN_REQUIRED`  
> **Reference Protocol:** §Prompt 7 T7, Master Claims Ledger (`docs/qa/CLAIMS_LEDGER.md`)  
> **Governing Policy:** Automated tests cannot forge human biometric consent, physical operating system matrix behaviors, wireless campus roaming, or screen reader audio perception. Every row in this register remains strictly `HUMAN_REQUIRED` until a designated human tester conducts the drill on physical devices and commits real observation data.

---

## 1. Companion Agent Physical OS Matrix Verification

### Scope
Verifies the ProctorNet Companion Desktop Agent across physical devices for installation warnings, pairing latency, CPU/RAM footprint, and false-positive rates under benign student workloads.

### Test Matrix

| Device ID | Operating System | Architecture | SmartScreen / Gatekeeper Warning | Pairing Time (s) | Idle CPU (%) | Idle RAM (MB) | False Positives (Benign Apps) | Sign-off Date & Tester | Status |
|:---:|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **WIN-01** | Windows 11 23H2 | x86_64 | `[ ]` Warning `[ ]` Bypassed | _______ s | ____ % | ____ MB | `[ ]` 0 Flags `[ ]` False Positive: ______ | ____________________ | `HUMAN_REQUIRED` |
| **WIN-02** | Windows 10 22H2 | x86_64 | `[ ]` Warning `[ ]` Bypassed | _______ s | ____ % | ____ MB | `[ ]` 0 Flags `[ ]` False Positive: ______ | ____________________ | `HUMAN_REQUIRED` |
| **MAC-01** | macOS 14 Sonoma | Apple Silicon (M-series) | `[ ]` Quarantine `[ ]` Allowed in Privacy | _______ s | ____ % | ____ MB | `[ ]` 0 Flags `[ ]` False Positive: ______ | ____________________ | `HUMAN_REQUIRED` |
| **MAC-02** | macOS 13 Ventura | Intel x86_64 | `[ ]` Quarantine `[ ]` Allowed in Privacy | _______ s | ____ % | ____ MB | `[ ]` 0 Flags `[ ]` False Positive: ______ | ____________________ | `HUMAN_REQUIRED` |
| **LNX-01** | Ubuntu 22.04 LTS | x86_64 (X11 / Wayland) | `[ ]` Permissions Granted | _______ s | ____ % | ____ MB | `[ ]` 0 Flags `[ ]` False Positive: ______ | ____________________ | `HUMAN_REQUIRED` |

### Execution Protocol:
1. Download official packaged binary from `GET /api/v1/agent/release/latest`.
2. Launch companion agent and record OS security prompt (Windows Defender SmartScreen, macOS Gatekeeper).
3. Enter 6-character Crockford-32 pairing code generated during student `SecurityCheck`.
4. Measure pairing completion time (must pair within $< 5$ seconds).
5. Open common legitimate student software (VS Code, Spotify, Discord in background, Calculator).
6. Verify benign applications are **NOT** falsely flagged as forbidden cheat tools.

---

## 2. Biometric Face Verification FAR / FRR Evaluation

### Consent & Privacy Safeguard
> **Mandatory Rule:** In accordance with the biometric evaluation protocol (`docs/qa/FACE_EVAL.md`), only consenting volunteer test subjects may participate. Raw biometric face crops and embeddings are deleted immediately following evaluation sessions. No personally identifiable imagery is committed to git. Only anonymized statistical metrics are recorded.

### Test Protocol
- **Cohort Size:** 10–20 consenting volunteer subjects.
- **Trial Count:** 10 genuine authentication attempts per subject, 10 impostor mismatch cross-checks per subject.

### Results Template

| Cohort Size | Total Genuine Trials | False Rejections (FRR) | FRR (%) | Total Impostor Trials | False Acceptances (FAR) | Fail-Closed REVIEW Trigger Count | Provider Outage Fallback Tested | Tester & Date | Status |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 15 Volunteers | 150 trials | _____ failures | ____ % | 150 cross-trials | _____ acceptances | ____ % | _____ occurrences | `[ ]` Verified | ____________________ | `HUMAN_REQUIRED` |

### Decision Criteria:
- **FRR Target:** $< 3.0\%$ (legitimate student not blocked unnecessarily).
- **FAR Target:** $< 0.1\%$ (zero unauthorized person substitutions allowed to pass).
- **Quality Gate:** Poor lighting ($\text{brightness} < 40$) or motion blur correctly surfaces student guidance banner before AWS Rekognition transmission.

---

## 3. Live 10–20 Student Campus Wi-Fi Dress Rehearsal

### Scenario
Simulates a realistic university cohort (10–20 students) taking a live proctored exam simultaneously over shared institutional Wi-Fi, while the designated Invigilator monitors from a separate network (e.g. mobile hotspot or home broadband).

### Rehearsal Checklist

- [ ] **Exam Publishing:** Exam published with `PRECHECK_OPEN_MINUTES=30` and 15 multiple-choice questions.
- [ ] **Concurrent Onboarding:** All 10–20 students enter `SecurityCheck` simultaneously at $T-15\text{ min}$.
- [ ] **Continuity Verification:**
  - [ ] Pairing state preserved across exam transition ($T=0$).
  - [ ] Zero students required to re-pair companion agent upon entering `ExamInterface`.
  - [ ] Clock starts **strictly** on attempt activation, not during pre-check.
- [ ] **Invigilator Remote Grid:**
  - [ ] Live grid populates all student tiles over WebSocket/SFU.
  - [ ] Intentional violation test (student opens alt-tab): violation event streams to invigilator within $< 2\text{ s}$.
- [ ] **Invigilator Review Override:**
  - [ ] One student placed in `REVIEW` status.
  - [ ] Invigilator clicks "Approve Candidate" in dashboard.
  - [ ] Student browser automatically unblocks and enters exam without manual page reload.
- [ ] **Final Submission Burst:**
  - [ ] All students click "Submit Exam" within a 60-second window.
  - [ ] Zero HTTP 500 errors; zero lost answers.
  - [ ] Every student views score summary cleanly upon completion.

### Rehearsal Record:
- **Date & Location:** __________________________________________________
- **Student Count:** _______ candidates | **Network SSIDs:** __________________
- **Lead Invigilator:** ____________________ | **Supervising Faculty:** ____________________
- **Overall Verdict:** `[ ] SUCCESS` / `[ ] BLOCKED (Explain Below)`

---

## 4. Screen-Reader & Accessibility Audit (Student Exam Flow)

### Accessibility Standard
Enforces **WCAG 2.1 Level AA** compliance across the core candidate path:
1. Login (`/login`)
2. Dashboard & Exam Selection (`/student/dashboard`)
3. Pre-Exam Security & Identity Check (`/student/security-check`)
4. Exam Interface (`/student/exam/:id`)
5. Submission Summary & Results (`/student/results/:id`)

### Screen Reader Verification Matrix

| Flow Step | Tested With NVDA (Windows) | Tested With VoiceOver (macOS / iOS) | All Interactive Elements Have ARIA Labels | Keyboard-Only Tab Navigation (No Mouse) | Color Contrast Ratio $\ge 4.5:1$ | Sign-off Date & Auditor | Status |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1. Login & Auth Modal** | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | ____________________ | `HUMAN_REQUIRED` |
| **2. Security Check** | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | ____________________ | `HUMAN_REQUIRED` |
| **3. Exam Question Radios** | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | ____________________ | `HUMAN_REQUIRED` |
| **4. Timer Countdown** | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | ____________________ | `HUMAN_REQUIRED` |
| **5. Submit Confirmation** | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | `[ ]` Pass | ____________________ | `HUMAN_REQUIRED` |

---

## 5. Production Disaster Recovery & Restore Drill Sign-Off

### Scenario
Validates that a fresh clean-room database instance can be restored from the automated pre-migration S3 snapshot using `pg_restore` / `psql` within a 15-minute Recovery Time Objective (RTO).

### Drill Verification Steps

1. **Snapshot Location:** `s3://<S3_BUCKET>/backups/pre-migration-*.sql`
2. **Scratch Database Provisioning:** Create temporary test schema `proctornet_restore_test`.
3. **Execution Command:**
   ```bash
   psql -U postgres -d proctornet_restore_test -f pre-migration-snapshot.sql
   ```
4. **Verification Queries:**
   ```sql
   SELECT COUNT(*) FROM admins; -- Must match production admin count
   SELECT COUNT(*) FROM platform_settings; -- Must match configuration count
   SELECT COUNT(*) FROM exams; -- Must match historical exam count
   ```
5. **Session Invalidation Check:**
   - Confirm all restored tokens are rejected until valid admin authentication occurs.

### Sign-off Details:
- **Snapshot File Tested:** __________________________________________________
- **Restore Duration (RTO):** _______ minutes (Target: $< 15\text{ min}$)
- **Data Parity Confirmed:** `[ ] 100% Match`
- **Drill Executed By:** ____________________ | **Date:** ____________________
- **Status:** `HUMAN_REQUIRED`
