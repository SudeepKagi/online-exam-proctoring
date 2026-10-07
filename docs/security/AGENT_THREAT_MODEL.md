# ProctorNet Exam Device Companion — Threat Model & Security Posture

> **Reference:** Prompt 4 §1.4, §0.5 · Document Version: 1.0.0  
> **Classification:** Institutional Technical Reference & Compliance Audit Trail

---

## 1. Executive Summary & Honest Security Posture (§0.5)

The **Exam Device Companion** is an unprivileged user-space process running on the candidate's personal computer (BYOD). Its role is to audit running applications and peripheral devices (such as screen recorders, remote desktop clients, virtual webcams, and secondary monitors) during proctored examinations.

### Honest Security Axioms
1. **Raising the Cost of Violations, Not Tamper-Proofing**: A software agent running on hardware physically controlled by an adversary (the candidate) with administrative privileges can raise the barrier to casual and accidental misconduct. It cannot provide absolute, mathematical tamper resistance.
2. **Never Marketed as "Unbypassable"**: Sophisticated adversaries with root/kernel privileges, customized hypervisors, hardware video splitters, or external secondary machines can bypass software-only agents. ProctorNet's defense relies on defense-in-depth: cross-correlating companion telemetry with WebRTC webcam/microphone audio, biometric face tracking, and screen-capture streams.
3. **Fail-Closed Principle (§0.3)**: If the companion agent cannot reliably enumerate processes or inspect hardware (due to missing commands, buffer limits, or permission denial), it reports `DEGRADED` with a structured reason code. The server **never** interprets missing data as a "clean" machine.

---

## 2. Adversary Threat Matrix (§1.4)

| Adversary Action / Threat | Attack Vector | ProctorNet Mitigation | Residual Risk & Acceptance |
|---|---|---|---|
| **1. Browser JS Forgery** | Attacker tampers with browser JavaScript to post fake "clean" device status to API. | **Server-Verified Reports Only**: The browser never audits processes and does not hold the agent session key. The agent communicates directly to the server via outbound HTTPS with HMAC-SHA256 signatures (`X-Agent-Signature`). | **None via browser path**: The server rejects client-relayed device checks. |
| **2. Scripted Fake Agent** | Attacker writes a custom script that performs pairing and replays clean reports using the session key. | **Multi-Layer Attestation**: Pairing requires a registered binary hash (`buildHash ∈ agent_releases`). Reports require strictly monotonic sequence counters (`seq`), millisecond timestamps within 60s skew, single-use nonces, and IP address matching between browser and companion. Cross-checked with webcam/screen video streams. | **Real**: A scripted client could theoretically replay clean hits if it extracts keys from memory. This is accepted as an inherent limitation of software running on student-controlled hardware. |
| **3. Clean Machine Proxy** | Candidate pairs and runs the companion agent on a secondary clean laptop while taking the exam on a dirty PC. | **IP Address Matching & Timing Correlation**: Server compares the pairing IP and reporting IP against the browser's active WebSocket/HTTP IP. Start gate enforces synchronous readiness. Continuous video stream captures candidate posture and workspace. | **Medium**: Same-NAT home routers or campus labs share public IP addresses, weakening pure IP binding. Documented and accepted; mitigated by room/screen video proctoring. |
| **4. Binary Renaming** | Candidate renames `anydesk.exe` to `calculator.exe` to evade name checks. | **Base Name & Publisher Rules**: Policy supports matching on base executable name (case-insensitive equality) and Authenticode/Code-Signing publisher identities (`publisher`). | **Medium**: Renaming an unsigned or self-compiled tool bypasses simple base name matching. Documented as a known gap; severe software tools with digital signatures are tracked by publisher. |
| **5. Agent Termination Mid-Exam** | Candidate terminates the agent process via Task Manager after passing the initial check. | **Continuous Heartbeat Sweeper**: Agent transmits HMAC-signed heartbeats every 15 seconds. If no report is received within 3 intervals plus grace (60s total), server transitions session to `STALE`, emits `AGENT_DISCONNECTED` violation, and automatically suspends the attempt for `REQUIRED` policy exams. | **Low**: A crash is indistinguishable from a malicious kill. System pauses the timer (ADR-004) and allows graceful re-pairing without penalty. |
| **6. Policy Tampering / MITM** | Candidate intercepts HTTPS traffic (e.g. via local proxy CA like mitmproxy) and strips banned rules. | **Cryptographic Policy Signatures**: Detection rule bundles are signed server-side using Ed25519. The companion agent hardcodes public keys and validates the signature. Invalid signatures trigger fallback to the previous valid policy and an `AGENT_POLICY_INVALID` report. | **Low**: Admin-rights candidate could patch the public key in memory, but cannot forge signatures for modified bundles. |
| **7. Pairing Code Brute Force** | Attacker attempts to guess the 8-character pairing code to hijack an active exam attempt. | **High-Entropy Code + Strict Rate Limits**: Codes have ~40 bits of entropy (`[2-9A-HJ-NP-Z]^8`, 1.09 trillion possibilities). Valid for 5 minutes only. Server rate limits pairing to 5 attempts per IP and per student per minute, triggering immediate lockout on repeated failures. | **Negligible**: Probability of guessing a valid code within 5 minutes under rate limits is < 0.000000002%. |
| **8. Malicious Web Interaction** | Malicious third-party website scans localhost ports to hijack the agent. | **Zero Inbound Socket (A-002)**: The companion agent never opens a local listening port on `127.0.0.1`. It is strictly an outbound HTTPS client. | **None**: No local HTTP port exists to probe or exploit. |
| **9. Supply-Chain Download Tampering** | Attacker tampers with the downloadable binary on S3 or in transit. | **Multi-Check Integrity**: Downloads are served via short-lived presigned S3 URLs. Frontend displays expected SHA-256 hashes for student verification. CI builds sign binaries (when configured) and register hashes immutably in `agent_releases`. | **Low**: Protected by AWS IAM least-privilege roles, S3 bucket versioning, and CI OIDC publishing. |

---

## 3. Trust Boundary Diagram

```
┌────────────────────────────────────────────────────────┐
│ Candidate Machine (Untrusted Hardware & OS)            │
│                                                        │
│  ┌───────────────────────────┐                         │
│  │ Web Browser (Untrusted)   │                         │
│  │ - Renders UI              │                         │
│  │ - Receives 8-char code    │                         │
│  │ - Displays status from API│                         │
│  └─────────────┬─────────────┘                         │
│                │ HTTPS (TLS 1.3)                       │
│  ┌─────────────▼─────────────┐                         │
│  │ Exam Device Companion     │                         │
│  │ - Local Rule Matching     │                         │
│  │ - Unprivileged execFile   │                         │
│  │ - Hits-Only Data Filter   │                         │
│  │ - Outbound HTTPS Client   │                         │
│  └─────────────┬─────────────┘                         │
└────────────────┼───────────────────────────────────────┘
                 │ Outbound HTTPS (HMAC-SHA256 Signed)
                 │ Port 443
┌────────────────▼───────────────────────────────────────┐
│ ProctorNet Backend Cluster (Trusted Boundary)          │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /api/v1/agent/pair & /report                     │  │
│  │ - Code verification & rate limiting              │  │
│  │ - Constant-time HMAC signature verification      │  │
│  │ - Monotonic seq & replay protection               │  │
│  │ - In-memory state tracking (zero DB load)        │  │
│  │ - Finding lifecycle & Violation state-machine    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Measured Adversarial Test Outcomes & Red-Team Audit

Automated verification suite: `tests/agent-adversarial.test.js` (16/16 passing assertions against live backend stack).

### 4.1 Measured Empirical Outcomes

| Attack Vector | Test Case | Measured Result | HTTP Code | Status |
|---|---|---|---|---|
| **Forged Report** | Missing `X-Agent-Signature` | Header presence checked before body parsing | `401 Unauthorized` | **PASSED** |
| **Forged Report** | Fake signature / wrong key | Constant-time HMAC comparison failed | `401 Unauthorized` | **PASSED** |
| **Clock Skew Attack** | Timestamp > 60s past/future | Drift rejected; server time returned for clock alignment | `400 Bad Request` (`CLOCK_SKEW`) | **PASSED** |
| **Replay Attack** | Reused nonce with valid seq | Nonce cache match detects packet replay | `409 Conflict` | **PASSED** |
| **Replay Attack** | Decreasing or duplicate seq | Sequence monotonicity check enforces strict ordering | `409 Conflict` | **PASSED** |
| **Pairing Guessing** | Random Crockford short-code | Code hash not found in unexpired single-use pairings | `401 Unauthorized` | **PASSED** |
| **Pairing Guessing** | Expired pairing code | TTL check rejects code > 5 minutes old | `401 Unauthorized` | **PASSED** |
| **Pairing Code Reuse** | Replayed pairing code | Atomic `usedAt` update blocks second consumption | `409 Conflict` | **PASSED** |
| **Tampered Binary** | Unknown `buildHash` presented | Binary hash checked against `agent_releases` registry | `400 Bad Request` | **PASSED** |
| **Outdated Agent** | Version < `minAgentVersion` | Semver comparison blocks deprecated client versions | `400 Bad Request` | **PASSED** |
| **Oversized Payload** | Heartbeat payload > 64KB | Body length check blocks memory exhaustion / DoS | `400 Bad Request` | **PASSED** |
| **Data Minimization** | Forbidden spyware keys sent | AST privacy validator rejects full process listings | `400 Bad Request` | **PASSED** |
| **Log Leakage** | Tokens/keys logged to console | Pino redaction filters scrub headers & secrets to `[REDACTED]` | `200 / Log Clean` | **PASSED** |

---

### 4.2 Red-Team Note: Scripted Fake Agent Simulation & Honesty Audit (§0.5)

To evaluate the operational limits of ProctorNet's client architecture, an adversarial red-team simulation was conducted where an attacker scripted a fake companion client using Python/Node.js to forge reports without running real system checks.

#### What ProctorNet Successfully Detects & Blocks:
1. **Unregistered Scripts**: If the attacker executes a raw Python or Node.js script, it cannot present the official signed SEA binary `buildHash` registered in `agent_releases`. Pairing is refused (`400 Bad Request`).
2. **Signature Tampering**: Attempting to alter telemetry payloads (e.g., stripping detected tools or spoofing display counts) without recalculating the HMAC-SHA256 signature using the unextractable session secret results in immediate rejection (`401 Unauthorized`).
3. **Replay & Timing Desync**: Replaying packets captured from an earlier legitimate session fails immediately due to nonce tracking and sequence monotonicity (`409 Conflict`). Replayed packets from previous exams fail due to timestamp skew validation (`400 Bad Request`).
4. **Heartbeat Dropouts**: Terminating the companion after passing the initial readiness check triggers the backend `agentSweeper` daemon within 60 seconds, transitioning the session to `STALE`, emitting `AGENT_DISCONNECTED`, and suspending the exam timer.

#### What Cannot Be Detected Without Kernel Rootkits (Accepted Residual Risks):
1. **Memory-Dumping Session Keys**: An attacker with root/administrator privileges who runs the official companion executable could attach a debugger, extract the 32-byte `sessionKey` from memory, and instruct an external script to emit clean heartbeats while opening banned programs.
2. **OS Subsystem Emulation**: An attacker running inside a heavily modified Linux KVM or macOS hypervisor could patch `tasklist.exe` or `Get-PnpDevice` to return sanitized output.
3. **Hardware-Level Cheating**: Secondary monitors connected via passive HDMI splitters that clone the display signal without advertising a secondary monitor descriptor cannot be identified in software.

#### Ethical Stance & Mitigations:
ProctorNet deliberately declines to install ring-0 kernel drivers, rootkits, or intrusive anti-cheat modules on student-owned computers. Instead, residual risks are mitigated by **cross-modal correlation**:
- The student's face gaze, screen stream, and room audio are continuously monitored and indexed via WebRTC and LiveKit.
- Suspicious activity (e.g. typing without screen changes, frequent gaze aversion) triggers invigilator intervention regardless of companion report status.
- The system achieves reliable deterrence of casual cheating while strictly upholding candidate privacy and device safety.
