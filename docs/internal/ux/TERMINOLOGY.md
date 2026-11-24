# ProctorNet UX Terminology Guide

This document defines the canonical plain-language terminology standards for all user-facing interfaces across ProctorNet (Student, Faculty, Invigilator, and Administrator).

## 1. Principles

1. **Clear & Human-Centered:** Academic software should communicate in clear, standard educational terms rather than internal engineering or surveillance jargon.
2. **Context-Appropriate:** Candidates are students; test overseers are invigilators or instructors; exam environments are workspaces.
3. **No Technical Leaks:** Internal architecture concepts (e.g. "Dossier", "SFU Grid", "Live Probe", "Token") are never exposed in user-facing copy.
4. **Consistency:** Terminology is standardized via `proctornet/frontend/src/lib/labels.js` and enforced via static ratchet checks in `scripts/ci/quality.js`.

---

## 2. Canonical Terminology Dictionary

| Jargon / Deprecated Term | Canonical User-Facing Term | User Context / Page | Rationale |
| :--- | :--- | :--- | :--- |
| **Dossier** | **Student Profile** / **Report** | Student results, faculty candidate view, admin | "Dossier" carries unhelpful espionage connotations. "Student Profile" or "Report" is professional and standard. |
| **Live Grid** / **Grid** | **Live Monitoring** | Invigilator real-time surveillance screen | "Live Monitoring" clearly communicates real-time proctoring duties. |
| **Violations** (Navigation) | **Incidents** | Navigation labels, incident logs, summary cards | "Incidents" is neutral, objective, and aligns with standard examination protocols. |
| **Console** | **Workspace** | Student Dashboard, Faculty Workspace, Admin Workspace | "Console" refers to terminal/developer tooling; "Workspace" is intuitive for end users. |
| **Diagnostic Log** | **Readiness Check** | Student pre-exam verification screen (`SecurityCheck.jsx`) | "Readiness Check" describes the purpose: confirming equipment works before starting. |
| **Live Probe** | **Live Status** | Pre-exam verification diagnostics badge | "Live Probe" sounds clinical/invasive; "Live Status" is clear. |
| **AI Generator** | **Question Assistant** | Faculty exam creation & question pool | "Question Assistant" emphasizes that human faculty review and authorize questions. |
| **Precheck** | **Practice Check** / **Readiness Check** | Pre-exam checkup window | Clearly distinguishes practice verification from live exam attempt activation. |
| **Pairing Token** | **Pairing Code** | Device companion code input | "Code" is intuitive; "token" is technical jargon. |
| **Candidate** | **Student** | Student-facing dashboards and lobby screens | Candidate is appropriate in formal exams; Student is standard throughout portal navigation. |

---

## 3. Role-Based Navigation & Label Standards

### Student Flow
- **Dashboard:** "Student Workspace"
- **Identity Check:** "Candidate Biometric Verification"
- **Hardware Check:** "Hardware Media Feeds"
- **Device Check:** "Exam Device Companion Audit"
- **Readiness:** "Readiness Check" (replacing "Diagnostic Log")
- **Live State:** "Live Status" (replacing "LIVE PROBE")
- **Results:** "Exam Results & Analytics" (replacing "Performance Dossier")

### Faculty Flow
- **Dashboard:** "Faculty Workspace"
- **Student Inspection:** "Student Profile" (replacing "Candidate Dossier")
- **Question Creation:** "Question Assistant" (replacing "AI Generator")
- **Exam Results:** "Evaluated Results Summary" (replacing "Results Dossier")

### Invigilator Flow
- **Real-Time Proctoring:** "Live Monitoring" (replacing "Live Grid")
- **Alert Log:** "Security Incidents" (replacing "Violations & Security Flags")
- **Audit Logging:** "Session Audit Log" (replacing "Audit Dossier")
- **Investigation:** "Incident Investigation Workspace" (replacing "Investigation Console")

### Administrator Flow
- **Dashboard:** "Administrator Workspace"
- **Incident Overview:** "Security Incidents" (replacing "Violations")
- **Account Creation:** "Student Profiles" (replacing "Candidate Dossiers")

---

## 4. Ratchet Enforcement

The terminology standard is protected by `scripts/ci/scan-banned-terms.js` and consolidated into `scripts/ci/quality.js`.
Any PR introducing deprecated terms (`Dossier`, `Live Grid`, `Diagnostic Log`, `LIVE PROBE`) into user-facing JSX text nodes will fail quality validation.
