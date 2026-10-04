# Phase P8 Report — VPN (WireGuard) Module: Disabled Now, Deploy-Ready Later

**Branch**: `feature/p8-vpn-wireguard-module`  
**Status**: Complete  
**Date**: October 2026  
**Reference**: ADR-010 / Notion 13.9, 13.15  

---

## 1. Executive Summary

Phase P8 delivers a completely redesigned, flag-gated, and rigorously tested **WireGuard VPN architecture** for ProctorNet.

### Core Architectural Principle
> *"A feature flag plus an interface lets me ship the hard part now and enable it with config at deploy time."*

The legacy implementation suffered from severe design flaws:
- Hardcoded public IP addresses and keys in source code (Flaw V-01).
- Unbounded in-memory mutexes over an exhausted `/24` subnet causing concurrency bottlenecks (Flaw V-02).
- Plaintext storage of client private keys in the database (Flaw V-03).
- Unvalidated HTTP endpoints creating arbitrary peers with upsert side-effects (Flaw V-04).
- Synchronous shell command execution and SSH connections inside HTTP request handlers and database transactions (Flaw V-05).
- Configuration drift and unmonitored silent client disconnections (Flaw V-06).

Phase P8 eliminates all six flaws while keeping the VPN disabled by default (`VPN_ENABLED=false`). When disabled, the system operates with zero VPN overhead and zero database or outbox interactions. When enabled via configuration at deployment time, the system activates a robust, enterprise-grade network boundary.

---

## 2. Flaw Elimination Matrix

| Flaw ID | Legacy Problem | Phase P8 Resolution |
|---|---|---|
| **V-01** | Hardcoded Azure IP (`20.198.83.12`) and default public key in code. | Purged all hardcoded IPs/keys. Configured entirely via environment variables (`VPN_SERVER_IP`, `VPN_SERVER_PUBLIC_KEY`). |
| **V-02** | `/24` subnet exhaustion (254 IPs) and in-memory JS mutexes failing across processes. | Atomic $\mathcal{O}(1)$ `SKIP LOCKED` allocation over a `/16` subnet (`vpn_ip_pool`, ~65k IPs). Safe across concurrent replicas. |
| **V-03** | Client private keys saved in database tables (`vpn_peers.private_key`). | Ephemeral key generation: config delivered **once** in memory; only public keys stored in DB. Browser WebCrypto X25519 support. |
| **V-04** | `POST /vpn/provision` had upsert side effects and no attempt state validation. | Scoped to `/api/v1/attempts/:attemptId/vpn`. Enforces attempt ownership and valid states (`READY\|ACTIVE\|SUSPENDED`). |
| **V-05** | Synchronous `exec` / SSH inside request handlers and DB transactions. | Transactional outbox events (`vpn.peer.add`, `vpn.peer.remove`) processed asynchronously by `VpnWorker` with exponential backoff. |
| **V-06** | Configuration drift and unhandled tunnel dropouts. | 60-second background `VpnReconciler` syncs kernel WireGuard state, purges orphans, and emits debounced server-originated `VPN_DISCONNECT`. |

---

## 3. Deliverables & Technical Implementation

### 3.1 Provider Interface & Implementations (`src/infra/vpn/`)
- **Abstract Interface (`VpnProvider`)**:
  - `addPeer({ publicKey, ip, expiresAt })`
  - `removePeer(publicKey)`
  - `listPeers()` (returns map of peer public keys, allowed IPs, transfer bytes, and last handshake epoch)
  - `syncPeers(peers)` (atomic full configuration synchronization)
- **Implementations**:
  - `NoopProvider`: Default zero-overhead provider used when `VPN_ENABLED=false`. All operations return safe no-ops.
  - `FakeProvider`: In-memory test provider supporting simulated handshakes and peering state.
  - `WireGuardAgentProvider`: Production client for local sidecar over a Unix domain socket (`/var/run/wireguard/vpn-agent.sock`). Implements HMAC-SHA256 request signing and robust `wg show <iface> dump` parsing.
  - `WireGuardSshProvider`: Production client for remote WireGuard hosts using the `ssh2` library. Implements **strict pinned host key verification** (never `StrictHostKeyChecking=no`), argument sanitization, and execution timeouts.
- **Security Hardening**:
  - All shell string interpolation, raw `exec()`, and Windows/WSL branches completely removed.
  - Any remaining OS execution uses `execFile` with an explicit argument array and strict execution timeout (5,000 ms).

### 3.2 Privileged Sidecar `vpn-agent` (`ops/vpn/`)
- Small container with isolated `NET_ADMIN` privileges communicating with host WireGuard interface (`wg0`).
- The Node.js application container runs with zero Linux capabilities and zero host network access.
- Exposes IPC protocol over Unix Domain Socket with timestamped HMAC-SHA256 authorization signatures.
- **Batching Optimization**: When synchronizing > 20 peers at once, the agent generates an atomic configuration file and invokes `wg syncconf wg0 <file>`, preventing individual `wg set` IPC churn.

### 3.3 Relational IPAM (`src/modules/vpn/ipam.js`)
- Pre-seeded PostgreSQL table:
  ```sql
  CREATE TABLE vpn_ip_pool (
    ip INET PRIMARY KEY,
    attempt_id UUID UNIQUE,
    leased_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ
  );
  ```
- **Atomic Single-Query Allocation ($\mathcal{O}(1)$)**:
  ```sql
  UPDATE vpn_ip_pool
  SET attempt_id = $1::uuid, leased_at = NOW(), released_at = NULL
  WHERE ip = (
    SELECT ip FROM vpn_ip_pool
    WHERE attempt_id IS NULL OR attempt_id = $1::uuid
    ORDER BY (attempt_id = $1::uuid) DESC, ip ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING ip;
  ```
- Guaranteed deadlock-free and concurrency-safe across multiple backend instances and worker processes.
- Idempotent: re-invoking allocation for an already leased attempt returns the existing leased IP.

### 3.4 Key Management & Browser WebCrypto Support (`src/modules/vpn/keyService.js`)
- Ephemeral X25519 Curve25519 keypair generation using `node:crypto`.
- Formats standard WireGuard `.conf` payload delivered **once** in the HTTP response body.
- The server discards the client private key immediately after serialization.
- **Zero-Trust Browser Key Support**: Candidates can generate X25519 keys directly in their browser using the WebCrypto API (`window.crypto.subtle.generateKey`), sending only the public key to `POST /api/v1/attempts/:attemptId/vpn`. The server provisions the peer without ever having touched or seen the private key.

### 3.5 Authorization & Attempt Guarding (`src/modules/vpn/vpn.service.js`)
- Scoped REST routes under `/api/v1/attempts/:attemptId/vpn`:
  - `POST /`: Allocate IP, register public key, enqueue `vpn.peer.add`.
  - `GET /`: Retrieve VPN status, leased IP, and connection instructions.
  - `DELETE /`: Revoke lease, release IP, enqueue `vpn.peer.remove`.
- **Guards**:
  - Rejects immediately if candidate does not own the attempt (`403 Forbidden`).
  - Rejects if attempt is in a terminal state (`SUBMITTED`, `TERMINATED`, `EXPIRED`) (`400 Bad Request`).
  - Rejects if VPN is not enabled for the exam (`400 Bad Request`).
  - Rejects if global `VPN_ENABLED=false` (`403 Forbidden`).

### 3.6 Transactional Outbox Worker (`src/modules/vpn/vpnWorker.js`)
- Asynchronous processing via RabbitMQ `vpn` queue and PostgreSQL `outbox_events`.
- Handles `vpn.peer.add` and `vpn.peer.remove` events.
- Deduplication via `processed_events` table ensures idempotency.
- Exponential backoff with jitter on transient network/sidecar failures.
- Zero shell or network calls within HTTP request transactions.

### 3.7 Background Reconciler & Server-Originated Disconnect (`src/modules/vpn/vpnReconciler.js`)
- Executes periodic 60-second synchronization cycles:
  1. Queries WireGuard kernel state via `provider.listPeers()`.
  2. Queries active attempt leases from PostgreSQL.
  3. **Orphan Purge**: Removes peers active in WireGuard but missing or expired in the database.
  4. **Missing Peer Re-Add**: Re-provisions active database peers absent in WireGuard kernel.
  5. **Heartbeat & Disconnect Detection**: Computes handshake age against `PersistentKeepalive` (25s). If a peer's handshake is older than $3 \times 25\text{s} = 75\text{s}$ for greater than a 45-second debounce window:
     - Under `VPN_ENFORCEMENT=enforce`: Suspends the exam attempt and emits a `VPN_DISCONNECT` violation event.
     - Under `VPN_ENFORCEMENT=warn`: Logs a non-suspending `VPN_DISCONNECT` audit warning.

### 3.8 Network Boundary Middleware (`src/middleware/vpnGuard.js`)
- Applied to exam-critical routes (`GET /api/v1/attempts/:id/state`, `PUT /api/v1/attempts/:id/answers/:qid`, `POST /api/v1/attempts/:id/submission`).
- Resolves true client IP from trusted proxies.
- Validates client IP against the attempt's leased VPN IP.
- **Boundary, Not Authorization**: Passing the VPN check does not bypass JWT authentication or RBAC permissions; both boundary and identity authorization must succeed.

### 3.9 Server Infrastructure & Runbook (`ops/vpn/setup-wireguard.sh` & `docs/runbooks/vpn.md`)
- Idempotent provisioning script configuring:
  - Kernel sysctl: `net.ipv4.ip_forward=1`, `net.core.default_qdisc=fq`, `net.ipv4.tcp_congestion_control=bbr`.
  - WireGuard interface `wg0` with MTU 1380.
  - Hardened `nftables` firewall rules: default DROP policy; permits peer traffic only to application HTTPS (port 443) and SFU media ports (7880–7882).
- Single-node topology documented: candidates reach both API and LiveKit SFU via the `wg0` tunnel address (`rtc.interfaces.includes: [eth0, wg0]`).

---

## 4. Test Suite & Verification Results

Mandatory test suite executed in `proctornet/backend/tests/p8-vpn-wireguard.test.js`:

```
✔ P8 WireGuard VPN Module Test Suite (99974.0601ms)
  ✔ 1. IPAM Concurrency & Leases (Kills V-02) (33923.4735ms)
    ✔ allocates 1,000 unique IPs concurrently with zero collisions or deadlocks
    ✔ releases leased IP on terminal state and reuses for subsequent attempts
  ✔ 2. Provider Contract Verification (78.3304ms)
    ✔ NoopProvider returns safe defaults without throwing
    ✔ FakeProvider tracks peers and parses handshake times
    ✔ WireGuardAgentProvider parses dump output correctly
    ✔ WireGuardSshProvider validates host key pins and rejects mismatches
  ✔ 3. Security Invariant: Zero Private Keys Persisted or Logged (11711.2152ms)
    ✔ provisions keys ephemerally, delivers config once, and stores ONLY public key in database
    ✔ supports browser-generated WebCrypto X25519 public keys without server private key generation
  ✔ 4. Flag Matrix Verification (8520.6234ms)
    ✔ VPN_ENABLED=false: rejects VPN provisioning, triggers zero outbox events, and vpnGuard is a no-op
    ✔ VPN_ENABLED=true + VPN_ENFORCEMENT=enforce: blocks mismatched client IP and permits matched IP
  ✔ 5. Authorisation & Attempt State Guards (Kills V-04) (3401.1964ms)
    ✔ rejects VPN provisioning for attempts in TERMINATED state with no upsert side-effects
    ✔ rejects VPN provisioning when student does not own attempt
  ✔ 6. Reconciler Sync & Server-Originated Disconnect (Kills V-06) (16911.0405ms)
    ✔ removes orphan peers and re-adds missing active peers
    ✔ emits debounced server-originated VPN_DISCONNECT when handshake is stale > 120s
  ✔ 7. Asynchronous Outbox Worker & Retries (2663.0421ms)
    ✔ processes vpn.peer.add and vpn.peer.remove idempotently via provider

ℹ tests 14
ℹ suites 8
ℹ pass 14
ℹ fail 0
ℹ duration_ms 100405.9568
```

### Full Regression Suite
- `tests/p4-state-machine.test.js`: 10 passed, 0 failed.
- `tests/p5-client-compression.test.js`: 3 passed, 0 failed.
- `tests/p6-frontend-autosave.test.js`: 2 passed, 0 failed.
- `tests/p7-media-livekit.test.js`: 19 passed, 0 failed.
- **Combined total: 48 tests passed, 0 failed.**
