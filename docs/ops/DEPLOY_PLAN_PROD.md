# ProctorNet Production Deployment Plan (Bare-Metal In-Place Update)

**Target Instance:** `i-0d242d962823f0a89` (`proctornet-server`, Ubuntu 22.04 LTS)  
**Public IP & Domain:** `43.204.45.86` / `https://proctornet.duckdns.org`  
**Execution Date:** 2026-11-10  
**Target Release:** `release/rc1` (`v0.9.0-rc1`)  
**Deployment Topology:** Single-Node Lite Profile (`proctornet.service` Systemd unit + Host Caddy reverse proxy)  

---

## 1. What Runs Where (Current vs Target State)

| Component | Current State | Target State |
| :--- | :--- | :--- |
| **Edge Proxy** | Host Caddy 2.8 (`/etc/caddy/Caddyfile`) | Host Caddy 2.8 with updated CSP & routes |
| **Backend Service** | Systemd unit `proctornet.service` (Node 20) | In-place reload pointing to new release directory |
| **Release Path** | `/opt/proctornet/releases/release-185e4cb3bc...` | `/opt/proctornet/releases/release-<HEAD_SHA>` |
| **Symlink** | `/opt/proctornet/current -> release-185e4cb...` | Atomically switched (`ln -sfn`) to new release |
| **Static Assets** | `/opt/proctornet/current/frontend/dist` | Built production bundle in new release directory |
| **Database** | Managed Supabase Pooler (`aws-1-ap-southeast-1`) | Same managed DB, forward migrations applied |
| **Active Attempts** | **0** in-progress attempts verified | 0 (Zero exam disruption) |
| **Disk Space** | 16 GB available on `/dev/root` (38% used) | > 15 GB available |

---

## 2. In-Place Update Sequence

1. **Phase 1: Local Release Gate**
   - Run hermetic release check: `npm run release:check` (frontend/backend build, lint, typecheck, SEB journey test).
   - Commit all verified artifacts.
   - Push `release/rc1` to `origin` and create annotated tag `v0.9.0-rc1`.

2. **Phase 2: Variables & Environment Hardening**
   - Package new release into `/opt/proctornet/releases/release-<SHA>`.
   - Run `preflight-env.js` on target server against `/opt/proctornet/shared/.env`.
   - Generate missing secrets locally on the server (never transmitted across network):
     - `JWT_REFRESH_SECRET` (256-bit secure hex)
     - `SEB_LINK_SECRET` (256-bit secure hex)
   - Ensure canonical variables are set:
     - `PUBLIC_ORIGIN=https://proctornet.duckdns.org`
     - `ALLOWED_ORIGINS=https://proctornet.duckdns.org`
     - `SEB_MODE=log`
     - `SEB_PRE_DOWNLOAD_MINUTES=30`
     - `SUPPORT_URL=https://proctornet.duckdns.org`
     - `SEB_DOWNLOAD_URL=https://safeexambrowser.org/download_en.html`
   - Audit `JWT_SECRET` against known default lists; rotate if matching any burned value.
   - Enforce file permissions: `chmod 600 /opt/proctornet/shared/.env` (owned by `proctornet:proctornet`).

3. **Phase 3: Database Backup & Rehearsal**
   - Execute live database dump: `pg_dump -Fc` using `DIRECT_URL`.
   - Verify dump integrity with `pg_restore --list`.
   - Download dump to local storage `C:\backups\prod_<date>\` and compute SHA256 checksum.
   - Restore dump into local Docker scratch database (`proctornet_rehearsal_test`).
   - Run `prisma migrate resolve --applied` for existing migrations (`0001`, `0002`, `0003`).
   - Run `prisma migrate deploy` for new migrations (`0004_system_settings`, `0005_readiness_and_incident_review`).
   - Verify zero schema drift with `prisma migrate diff --exit-code`.
   - Clean up scratch database.

4. **Phase 4: Production Cutover**
   - Build frontend locally or on host, verify bundle integrity in `frontend/dist`.
   - Install production dependencies in new release directory (`npm ci --omit=dev`).
   - Execute forward migrations on production database: `npx prisma migrate deploy`.
   - Validate Caddy configuration: `caddy validate --config /etc/caddy/Caddyfile`.
   - Atomically switch symlink: `ln -sfn /opt/proctornet/releases/release-<SHA> /opt/proctornet/current`.
   - Restart backend service: `systemctl restart proctornet.service`.
   - Reload Caddy: `systemctl reload caddy.service`.
   - Execute verification suite (healthz, login SPA, SEB ping, WebSocket/Socket.IO, smoke test).

5. **Phase 5: Post-Deployment Audit & Hardening**
   - Network port exposure audit (`ss -tlnp` and external port scan).
   - Install and enable systemd backup timer `proctornet-backup.timer`.
   - Rehearse SEB kill switch (`SEB_MODE=off -> restart -> log -> restart`).
   - Print inventory of seeded/test accounts.

---

## 3. Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| Active Student Exam Disruption | Data loss / corrupted attempt | Verified 0 in-progress attempts; pre-cutover gate blocks if attempts > 0. |
| Migration Syntax / Compatibility Error | Deployment failure | Rehearsed on local replica using identical dump before touching production. |
| Bad Frontend Asset Caching | White screen / broken UI | Assets hashed with `[name]-[hash].js`; Caddy serves immutable cache on `/assets/*` and `no-store` on `index.html`. |
| Caddy Reverse Proxy Misconfiguration | Site unreachable | Run `caddy validate` before reloading; fallback to existing Caddyfile if validation fails. |

---

## 4. Rollback Strategy

1. **Instant Application Rollback:**
   ```bash
   ln -sfn /opt/proctornet/releases/release-185e4cb3bc7882547b9d6eb25a24f989cfa7efa7 /opt/proctornet/current
   sudo systemctl restart proctornet.service
   sudo systemctl reload caddy.service
   ```
2. **Database Backward Compatibility:**
   - Migrations `0004` and `0005` are strictly additive (new tables and optional columns).
   - Old release `185e4cb` remains 100% operational against the migrated database without requiring a database rollback.

---

## 5. Missing / Required Variables Register

| Variable Name | Status | Destination | Generation / Source |
| :--- | :--- | :--- | :--- |
| `PUBLIC_ORIGIN` | Missing (had `FRONTEND_URL`) | `/opt/proctornet/shared/.env` | `https://proctornet.duckdns.org` |
| `ALLOWED_ORIGINS` | Missing | `/opt/proctornet/shared/.env` | `https://proctornet.duckdns.org` |
| `JWT_REFRESH_SECRET`| Missing | `/opt/proctornet/shared/.env` | Server-generated `openssl rand -hex 32` |
| `SEB_LINK_SECRET` | Missing | `/opt/proctornet/shared/.env` | Server-generated `openssl rand -hex 32` |
| `SEB_MODE` | Missing | `/opt/proctornet/shared/.env` | Set to `log` |
| `SEB_PRE_DOWNLOAD_MINUTES` | Missing | `/opt/proctornet/shared/.env` | Default `30` |
| `SUPPORT_URL` | Missing | `/opt/proctornet/shared/.env` | `https://proctornet.duckdns.org` |
| `SEB_DOWNLOAD_URL` | Missing | `/opt/proctornet/shared/.env` | `https://safeexambrowser.org/download_en.html` |
