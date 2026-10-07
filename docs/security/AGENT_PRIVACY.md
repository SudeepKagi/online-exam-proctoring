# ProctorNet Exam Device Companion — Data Privacy & Minimization Contract

> **Reference:** Prompt 4 §3.6, Appendix B · Document Version: 1.0.0  
> **Status:** Enforceable Contract Verified by CI Automated Tests

---

## 1. Core Privacy Axioms

The **Exam Device Companion** adheres strictly to the principle of **radical data minimization**. It inspects candidate workstation state locally to ensure exam integrity, but **never** acts as spyware, keylogger, or background tracking software.

### The Privacy Guarantee
1. **Local Matching Only**: Process enumeration, display counts, and virtual driver audits are performed entirely in local memory on the student's computer.
2. **Hits-Only Reporting**: The companion sends only matched rule identifiers and the base executable name of flagged tools (so the candidate knows what application to close).
3. **No Persistence or Privileges**:
   - Requires **no administrator rights** (no UAC / root elevation).
   - Installs **no services, daemons, background tasks, or autostart registry entries**.
   - Terminates cleanly upon exam submission, session timeout, or remote `exit` instruction.
   - Cleans up all temporary files on process termination.

---

## 2. Forbidden Outbound Fields (Strict CI Schema Gate)

Automated tests in CI (`test/privacy-contract.test.js`) inspect the outbound payload schema. If any of the following fields exist anywhere in the transmitted JSON payload, the test suite and CI build fail immediately:

| Category | Forbidden Property Names | Rationale |
|---|---|---|
| **Process Data** | `processes`, `processList`, `cmdline`, `args`, `path`, `exePath` | The server never receives a full inventory of what candidate applications are installed or running. Command arguments (which may contain personal documents or tokens) are strictly forbidden. |
| **Identity & Host** | `user`, `username`, `hostname` | Candidate workstation usernames, account names, or computer network names are completely omitted. |
| **User Activity** | `windowTitle`, `screenshot`, `clipboard`, `keystrokes`, `url`, `history`, `files` | The companion never captures screen graphics, browser navigation histories, open file paths, or keyboard/mouse buffers. |
| **Media Streams** | `micAudio`, `cameraFrame` | Audio and video capture are handled exclusively by the browser via standard WebRTC permissions with explicit candidate consent indicators. |
| **Network Data** | `packets` | Raw packet inspection or promiscuous network sniffing is strictly prohibited. |

---

## 3. Allowed Outbound Fields (Exhaustive Allowlist)

The payload sent to `POST /api/v1/agent/report` is strictly restricted to:

```jsonc
{
  "seq": 42,                                   // Monotonically increasing sequence number
  "findings": [                                // Zero or more positive rule matches
    {
      "ruleId": "r-remote-anydesk",            // Unique policy rule identifier
      "program": "anydesk"                     // Base executable name only (.exe stripped)
    }
  ],
  "display": {
    "count": 1                                 // Integer count of active connected displays
  },
  "session": {
    "remote": false                            // Boolean indicating if machine is an RDP session
  },
  "vm": {
    "indicators": []                           // Bounded strings from a fixed vocabulary (e.g. "VirtualBox")
  },
  "cameras": {
    "virtual": []                              // Matched virtual webcam driver strings
  },
  "collection": {
    "ok": true,                                // Status of collection routines
    "errors": []                               // Error codes from a fixed vocabulary (e.g. "ERR_TASKLIST_TIMEOUT")
  },
  "integrity": {
    "buildHash": "a3f8b...e109"                // SHA-256 hash of the running companion binary
  }
}
```

---

## 4. Student Transparency & Inspection Tools

### Diagnostic Mode (`--diagnose`)
Students can inspect the exact outbound payload before or during an exam:
```bash
./proctornet-companion --diagnose
```
This prints the complete JSON payload directly to the console and copies it to the clipboard, proving that zero personal files, URLs, or background processes are being transmitted.

### On-Screen Transparency Window
During an active session, the companion displays a minimal, non-intrusive status interface showing:
- Active connection status: `Connected to ProctorNet`
- Time of last integrity check: `Last verified: 13:45:12`
- Clear instruction: `Keep this window open until your exam is submitted.`

---

## 5. Candidate Consent & Lifecycle

1. **Explicit Versioned Consent**:
   - Before downloading the companion, candidates are presented with a clear consent modal explaining what the companion checks, what it never collects, and how it exits.
   - The candidate must explicitly check the acknowledgment box (`privacyConsentVersion: 1`), which is recorded with the student's profile.
2. **Session Termination & Clean Exit**:
   - Upon exam submission, the server returns `{ exit: true }` in the report response.
   - The companion displays a final "Exam Completed — Companion Disconnected" notice and exits immediately.
   - Deleting the downloaded executable leaves zero residual files or background traces on the student's computer.
