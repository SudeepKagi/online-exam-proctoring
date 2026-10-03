# ADR 010: WireGuard VPN Feature-Gated and Default OFF for Local/Staging

## Status
Accepted

## Date
2026-10-03

## Context
WireGuard network isolation enforces that candidates cannot browse the internet during exams by tunneling exam traffic through an internal gateway. In the current codebase, the VPN implementation had critical flaws:
- Hardcoded external Azure IP and SSH credentials (Finding V-01).
- Shell execution inside database transactions causing lock freezes (Finding V-05).
- Plaintext storage of client private keys in the database (Finding V-03).
- Fixed `/24` subnet limiting capacity to 253 peers (Finding V-02).

Project authority directed: "VPN tunnelling is disabled now, will be resumed at deploy — optimise/redesign it behind flags."

## Decision
1. **Feature Flag Architecture**:
   - Introduce granular configuration flags:
     - `VPN_ENABLED=false` (global master switch, default `false`).
     - `VPN_ENFORCEMENT=off|warn|enforce` (governs security check gatekeeper behavior).
2. **Decoupled Asynchronous Redesign**:
   - **Provider Interface**: Abstract WireGuard peer management behind an interface (`IVpnProvider`) with mock, local container, and remote SSH/sidecar implementations.
   - **Zero Plaintext Private Keys**: The server generates client configs or client keys client-side; private keys are **never** stored in the database.
   - **CIDR Expansion**: Expand IP pool to `/16` (65,534 available peer addresses) managed via an atomic database allocation pool with `FOR UPDATE SKIP LOCKED`.
   - **Outbox Peer Synchronization**: Peer additions and removals are pushed as outbox events processed by background workers, never executed synchronously inside database transactions.
3. **Local/CI Execution**:
   - In local and CI test environments, `VPN_ENABLED=false`. All exam flows, lobby checks, and start validations seamlessly pass or mock the network check without requiring kernel WireGuard interfaces.

## Consequences
### Positive
- Allows seamless development, testing, and CI pipelines without requiring root privileges or a remote VPN server.
- Completely removes shell injection vulnerabilities and transaction lock stalls.
- Production deployment can safely toggle `VPN_ENABLED=true` once the production VPN gateway is provisioned.

### Negative
- End-to-end kernel WireGuard packet filtering must be validated in a dedicated staging environment with appropriate network permissions.

## Notion Step-13 Alignment
Directly honors user requirement U5 and Notion 13.9 VPN architecture guidelines.
