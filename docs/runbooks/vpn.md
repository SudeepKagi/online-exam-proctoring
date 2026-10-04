# Operations Runbook: WireGuard VPN Module (Phase P8 / ADR-010)

## 1. Overview & Operational Principles

The ProctorNet WireGuard VPN module provides a hardware/network boundary isolating candidate examination traffic from arbitrary network paths, proxy relays, and cheating collusion vectors.

### Core Architecture
- **Flag-Gated by Default:** In default environments, `VPN_ENABLED=false`. All core exam execution paths operate with zero VPN overhead and zero database/outbox operations.
- **Provider Interface (`infra/vpn/VpnProvider`):** Abstract provider enabling seamless switching between `NoopProvider` (default), `FakeProvider` (testing/CI), `WireGuardAgentProvider` (co-located sidecar daemon over Unix Domain Socket), and `WireGuardSshProvider` (remote VM over `ssh2` with pinned host keys).
- **Privileged Sidecar (`vpn-agent`):** Only the sidecar container runs with Linux `NET_ADMIN` capability. The Node.js application container never possesses elevated networking privileges.
- **Atomic IPAM (`vpn_ip_pool`):** $\mathcal{O}(1)$ concurrent IP allocation via PostgreSQL `SKIP LOCKED` across a `/16` subnet (~65,000 addresses). Zero mutexes, zero deadlocks.
- **Zero Private Key Persistence:** Client private keys are generated ephemerally in memory (or directly inside the candidate's browser via WebCrypto X25519). Only public keys are persisted to `vpn_peers`.
- **Transactional Outbox (`pn.vpn`):** Peer additions and removals are queued asynchronously via Postgres `outbox_events` and processed by `vpnWorker`. Zero shell commands or SSH calls exist in any HTTP request path or database transaction.
- **Reconciliation Engine:** A 60-second background worker synchronizes live kernel interface peers with database state, cleans orphan peers, re-adds dropped peers, and detects stale handshakes (> 3× keepalive + 45s debounce).

---

## 2. Configuration Matrix

| Variable | Default | Allowed Values | Description |
|---|---|---|---|
| `VPN_ENABLED` | `false` | `true`, `false` | Master feature flag. When `false`, all VPN operations are strict no-ops. |
| `VPN_PROVIDER` | `agent` | `noop`, `fake`, `agent`, `ssh` | WireGuard provider backend. |
| `VPN_ENFORCEMENT` | `none` | `none`, `warn`, `enforce` | Disconnect and route enforcement policy. |
| `VPN_INTERFACE` | `wg0` | string | Linux network interface name. |
| `VPN_PORT` | `51820` | integer | WireGuard UDP listening port. |
| `VPN_CIDR` | `10.8.0.0/16` | string | CIDR block for student VPN leases. |
| `VPN_SERVER_IP` | `127.0.0.1` | IPv4/hostname | Public or internal IP address of WireGuard gateway. |
| `VPN_SERVER_PORT` | `51820` | integer | Public UDP port for student client endpoints. |
| `VPN_SERVER_PUBLIC_KEY` | - | Base64 string | Server WireGuard public key (generated during setup). |
| `VPN_AGENT_SOCK` | `/var/run/wireguard/vpn-agent.sock` | path | Path to privileged sidecar Unix domain socket. |
| `VPN_AGENT_SECRET` | - | string | Shared HMAC-SHA256 secret for sidecar request signing. |
| `VPN_SSH_PINNED_HOST_KEY` | - | Base64 string | SSH host public key for strict verification (never `StrictHostKeyChecking=no`). |
| `VPN_RECONCILER_INTERVAL_MS` | `60000` | integer (ms) | Frequency of peer state reconciliation. |
| `TRUSTED_PROXIES` | `127.0.0.1,::1` | comma-separated IPs | Proxies permitted to set `X-Forwarded-For` for `vpnGuard`. |

---

## 3. Provisioning & Setup Procedure

### Step 1: Provision the WireGuard Host
Run the idempotent setup script on the WireGuard host (Ubuntu 22.04 LTS / 24.04 LTS recommended):
```bash
sudo WG_SUBNET="10.8.0.0/16" WG_PORT="51820" bash ops/vpn/setup-wireguard.sh
```
This script automatically:
1. Installs WireGuard and nftables.
2. Applies kernel sysctl tuning: `net.ipv4.ip_forward=1`, `net.core.default_qdisc=fq`, `net.ipv4.tcp_congestion_control=bbr`.
3. Creates `/etc/wireguard/wg0.conf` with `MTU = 1380` (avoids packet fragmentation).
4. Configures nftables: default drop; permits only peer traffic (`10.8.0.0/16`) to application port (443) and LiveKit SFU ports (7880-7882).
5. Outputs the Server Public Key and Endpoint.

### Step 2: Deploy the Privileged Sidecar (`vpn-agent`)
If deploying co-located with the backend container via Docker Compose:
```yaml
services:
  vpn-agent:
    build:
      context: .
      dockerfile: ops/vpn/Dockerfile.vpn-agent
    network_mode: host
    cap_add:
      - NET_ADMIN
    volumes:
      - /var/run/wireguard:/var/run/wireguard
    environment:
      VPN_AGENT_SOCK: /var/run/wireguard/vpn-agent.sock
      VPN_AGENT_SECRET: ${VPN_AGENT_SECRET}
      VPN_INTERFACE: wg0
    restart: unless-stopped
```

### Step 3: Pre-Seed the IPAM Lease Pool
In the PostgreSQL database, ensure the IP pool is seeded for the subnet:
```bash
cd proctornet/backend
node -e "const { vpnIpam } = require('./src/modules/vpn/ipam'); vpnIpam.seedPool({ count: 1000 }).then(c => console.log('Seeded IPs:', c))"
```

---

## 4. Enabling the VPN in Deployment

To enable WireGuard VPN in staging or production:

1. **Set Environment Variables:**
   ```bash
   VPN_ENABLED=true
   VPN_PROVIDER=agent
   VPN_ENFORCEMENT=warn    # Recommended initial mode before moving to 'enforce'
   VPN_SERVER_IP=<PUBLIC_IP_OR_DNS>
   VPN_SERVER_PORT=51820
   VPN_SERVER_PUBLIC_KEY=<SERVER_PUBLIC_KEY>
   VPN_AGENT_SECRET=<STRONG_RANDOM_SECRET_MIN_32_CHARS>
   ```
2. **Restart Backend Service:**
   ```bash
   pm2 restart proctornet-api
   # or docker compose restart backend
   ```
3. **Verify Health:**
   Check `/health` and verify logs indicate:
   ```
   [VpnReconciler] Background reconciler started
   [VpnWorker] Starting VpnWorker for asynchronous WireGuard peer management
   ```

---

## 5. Single-Node Nuance & LiveKit SFU Settings

When the application, WireGuard gateway, and LiveKit SFU terminate on the **same physical or virtual host**, candidate exam traffic reaches the application via the `10.8.0.1` WireGuard gateway address.

### LiveKit WebRTC Configuration (`ops/livekit/livekit.yaml` / `livekit.yaml`)
To ensure LiveKit media ICE candidates include the internal WireGuard network interface so WebRTC streams flow inside the tunnel without NAT hairpinning:
```yaml
rtc:
  use_external_ip: true
  interfaces:
    includes:
      - eth0
      - wg0
  tcp_port: 7881
  udp_port: 7882
```
This guarantees that candidates connecting through the tunnel can resolve ICE host candidates on `10.8.0.1` directly over the tunnel with low latency and zero packet loss.

---

## 6. Disabling & Emergency Rollback

If students report unexpected ISP UDP throttling, campus firewall blocks on port 51820, or gateway degradation, **execute an instant rollback**:

### Instant Rollback (Zero Code Changes)
1. **Set Master Flag:**
   ```bash
   VPN_ENABLED=false
   VPN_ENFORCEMENT=none
   ```
2. **Reload Backend (zero downtime):**
   ```bash
   pm2 reload proctornet-api
   ```
3. **Impact Verification:**
   - With `VPN_ENABLED=false`, `vpnGuard` middleware acts as an immediate no-op pass-through.
   - All background sweeps (`vpnReconciler`, `vpnWorker`) suspend execution.
   - Outbox processing bypasses `vpn.*` events.
   - Students can immediately resume taking exams over direct HTTPS without WireGuard tunnel requirements.
