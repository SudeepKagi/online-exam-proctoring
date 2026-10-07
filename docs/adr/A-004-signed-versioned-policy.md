# ADR A-004: Versioned, Ed25519-Signed Detection Policy Bundles

## Status
Accepted

## Date
2026-10-07

## Context
In the legacy agent, prohibited processes were hardcoded strings in `agent.js` (`BANNED_PROCESS_PATTERNS`). Whenever new screen-sharing tools or generative AI assistants emerged, updating the rule list required modifying source code and redistributing the application. Furthermore, sending raw process lists to the server for cloud evaluation violates the data privacy contract (§3.6).

## Decision
1. **Policy as Versioned Data**: Detection rules are represented as a versioned JSON bundle (`agent_policy_versions`) maintained on the server and delivered to the companion agent upon pairing (and re-checked during heartbeats).
2. **Ed25519 Cryptographic Signature**: Every policy bundle is signed with an institutional Ed25519 private key. The companion agent embeds the current and next public keys and verifies the bundle signature before parsing rules. If verification fails, the agent rejects the bundle, retains the last valid policy, and reports `AGENT_POLICY_INVALID`.
3. **Local Evaluation, Hits-Only Reporting**:
   - The agent evaluates detection rules **locally** on candidate hardware.
   - The agent **never transmits full process or hardware inventories** to the server.
   - The agent transmits **only positive hits** (matched rule ID and executable base name) along with bounded numeric counts (e.g. display count).

## Consequences
### Positive
- Admin staff can update banned application lists and severity thresholds without requiring students to re-download agent executables.
- Students or proxies cannot tamper with or weaken detection rules in flight without invalidating the Ed25519 signature.
- Strict data minimization: no candidate workstation process lists or hardware logs leave the student's machine.

### Negative
- Requires robust key management for the Ed25519 policy signing key.
