# ADR A-002: Elimination of Local HTTP Listener (Outbound HTTPS Only)

## Status
Accepted

## Date
2026-10-07

## Context
The legacy companion agent listened locally on `127.0.0.1:49152` and accepted HTTP GET/POST requests from the candidate's web browser. This architecture exhibited severe structural vulnerabilities:
1. **Insecure CORS & DNS Rebinding**: Browser communication with localhost bypasses same-origin policies; fallback `Access-Control-Allow-Origin: *` exposed candidate process telemetry to any website open in other tabs.
2. **Private Network Access (PNA) Blocks**: Modern Chromium browsers restrict public web applications (`https://proctornet.domain`) from making unauthenticated requests to local loopback addresses (`http://127.0.0.1`).
3. **Local Inbound Attack Surface**: Any local desktop malware or script could query or abuse the open port on `49152`.

## Decision
1. **Decommission Port 49152**: The agent shall **never** open a local TCP or HTTP listening socket.
2. **Outbound HTTPS Only**: The agent acts strictly as an outbound HTTPS client connecting directly to the ProctorNet API server.
3. **Indirect Browser-Agent Signaling**: The web browser learns agent status, health, and findings from the central server via REST status endpoints and WebSocket events (`agent:state`), never by connecting directly to the candidate machine.

## Consequences
### Positive
- Completely closes DNS rebinding, CORS hijacking, and Private Network Access issues.
- Zero inbound port listeners; no firewall prompts requesting permission to accept incoming connections.
- Malicious third-party websites or local processes cannot interact with or tamper with the companion agent.

### Negative
- Requires internet connectivity for agent reporting (which is already a prerequisite for taking an online proctored exam).
