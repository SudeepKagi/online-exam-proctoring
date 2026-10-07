# ADR A-006: Removal of Insecure VPN Control and Temp File Writing

## Status
Accepted

## Date
2026-10-07

## Context
In the legacy `agent.js` implementation, an endpoint `/vpn-activate` accepted a WireGuard configuration payload, wrote the plaintext private-key configuration to a predictable path (`os.tmpdir()/proctornet_tunnel.conf`), and executed `wireguard.exe /installtunnelservice`.
This presented critical security vulnerabilities:
1. **Local Secret Race Condition**: Any non-privileged process on the host could read the private key from the predictable temporary path.
2. **Privileged Escalation / Execution**: Invoking system installer commands on behalf of an unauthenticated HTTP request created an exploitable attack vector.
3. **Stale Network Assumptions**: Hardcoded `10.0.0.x` subnet checks conflicted with the production `/16` IPAM pool (`10.8.0.0/16`).
4. **Current Status**: Network VPN enforcement is currently paused in favor of direct TLS transports with WebRTC media SFU.

## Decision
1. **Remove `/vpn-activate` and All Tunnel Installation Logic**: The companion agent shall never install network services, modify network configuration, or write temporary VPN configuration files to disk.
2. **Read-Only Telemetry (If and When Needed)**: If network interface audit is re-enabled in a future phase, the agent may only *read* passive network interface metrics (e.g. presence of WireGuard adapter) without modifying host state.
3. **Clean Process Boundary**: The agent operates as a completely unprivileged user-space process requiring no administrative elevation.

## Consequences
### Positive
- Removes local credential exposure and shell injection risks.
- Companion agent runs reliably without requesting Windows UAC / macOS root elevation.
- Eliminates brittle reliance on external `wireguard.exe` system installations.

### Negative
- Local WireGuard tunnel automation is decoupled from the agent; managed network environments must rely on institutional MDM or dedicated client software if full-tunnel isolation is mandated.
