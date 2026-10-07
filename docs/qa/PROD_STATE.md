# Production State Baseline (PROD_STATE.md)
**Recorded Date:** 2026-10-07T18:20:00Z  
**Environment:** AWS EC2 `ap-south-1` (`i-0d242d962823f0a89`)  
**Deployment Pipeline:** AWS SSM + Release Tarball (`/opt/proctornet/releases`)  
**Active Release:** `release-v1.0.3` (symlinked via `/opt/proctornet/current`)  

---

## 1. Operating System & Runtime Environment
- **Kernel:** `Linux ip-10-0-1-104 6.8.0-1012-aws #12-Ubuntu SMP x86_64`
- **Distribution:** Ubuntu 22.04.4 LTS (Jammy Jellyfish)
- **Node.js Version:** `v20.18.0` *(Target: Upgrade to Node 22 LTS in Phase S6)*
- **npm Version:** `10.8.2`
- **Active Working Directory:** `/opt/proctornet/current/proctornet/backend`
- **Symlink Resolution:** `/opt/proctornet/current` $\to$ `/opt/proctornet/releases/release-v1.0.3`
- **Service User:** `proctornet`

---

## 2. Systemd Service Unit (`proctornet.service`)
```ini
[Unit]
Description=ProctorNet Lite Application Service
After=network.target

[Service]
Type=simple
User=proctornet
WorkingDirectory=/opt/proctornet/current/proctornet/backend
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=APP_PROFILE=lite
Environment=QUEUE_DRIVER=postgres
Environment=CACHE_DRIVER=memory
Environment=MEDIA_DRIVER=snapshot
Environment=FACE_DRIVER=rekognition
Environment=START_WORKERS=true
EnvironmentFile=-/opt/proctornet/shared/.env
ExecStart=/usr/bin/node --max-old-space-size=384 src/app.js
Restart=always
RestartSec=5
MemoryMax=450M

# Sandboxing & Hardening Flags (Appendix C)
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
```

---

## 3. Releases on Host
- `/opt/proctornet/releases/release-v1.0.0`
- `/opt/proctornet/releases/release-v1.0.1`
- `/opt/proctornet/releases/release-v1.0.2`
- `/opt/proctornet/releases/release-v1.0.3` *(ACTIVE)*

---

## 4. Edge & Routing (`/etc/caddy/Caddyfile`)
```caddy
{
    email admin@proctornet.com
}

http://43.204.45.86, http://43.204.45.86.sslip.io, http://43-204-45-86.sslip.io {
    redir https://43.204.45.86.sslip.io{uri} permanent
}

43.204.45.86.sslip.io, 43-204-45-86.sslip.io, 43.204.45.86 {
    @metrics {
        path /metrics
    }
    respond @metrics "Forbidden" 403

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(self), microphone=(self), display-capture=(self)"
    }

    handle /api/* {
        reverse_proxy 127.0.0.1:5000
    }

    handle /rt/* {
        reverse_proxy 127.0.0.1:5000 {
            transport http {
                keepalive 60s
            }
        }
    }

    handle /socket.io/* {
        reverse_proxy 127.0.0.1:5000
    }

    handle /healthz {
        reverse_proxy 127.0.0.1:5000
    }

    handle /readyz {
        reverse_proxy 127.0.0.1:9100
    }

    handle {
        root * /opt/proctornet/current/proctornet/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
```
- **Validation:** `caddy validate` $\to$ `Valid configuration` (Certificate: Let's Encrypt automated TLS on `43.204.45.86.sslip.io`).
- **Drift / Defect Identified:** `/readyz` is publicly reverse proxied to internal port 9100 (matches defect `EDGE-01`).

---

## 5. Shared Environment Configuration (`/opt/proctornet/shared/.env`)
*Keys only (values redacted for security):*
1. `APP_PROFILE`
2. `AWS_REGION`
3. `AWS_S3_BUCKET`
4. `BCRYPT_ROUNDS`
5. `CACHE_DRIVER`
6. `DATABASE_URL`
7. `DIRECT_URL`
8. `FACE_DRIVER`
9. `FRONTEND_URL`
10. `JWT_EXPIRES_IN`
11. `JWT_REFRESH_EXPIRES_IN`
12. `JWT_SECRET`
13. `MEDIA_DRIVER`
14. `NODE_ENV`
15. `PORT`
16. `PRISMA_CONNECTION_LIMIT`
17. `QUEUE_DRIVER`

---

## 6. System Resources & Utilization
| Resource | Capacity | In-Use | Available / Utilization |
|---|---|---|---|
| **RAM** | 914 MiB | 266 MiB | 460 MiB available (58% free) |
| **Swap** | 2,047 MiB | 98 MiB | 1,949 MiB (5% used) |
| **Root Disk** | 25 GiB | 7.3 GiB | 17 GiB available (31% used) |

---

## 7. Network Ports & Listening Sockets
| Port | Protocol | Process | Service Description |
|---|---|---|---|
| `:80` | TCP | Caddy (`pid 5450`) | HTTP redirect to HTTPS |
| `:443` | TCP | Caddy (`pid 5450`) | HTTPS frontend & API reverse proxy |
| `:2019` | TCP (Localhost) | Caddy (`pid 5450`) | Caddy Admin API |
| `:5000` | TCP | Node (`pid 7668`) | ProctorNet Express Application |
| `:9100` | TCP (Localhost) | Node (`pid 7668`) | Internal metrics & readiness probe |
| `:22` | TCP | SSH (`pid 755`) | Secure Shell |

---

## 8. Scheduled Timers & Cron
- Systemd timers: 11 active (apt-daily, logrotate, dpkg backup, fstrim, etc.).
- User crontabs: None.

---

## 9. Secret Audit (Pass / Fail Criteria)
| Check | Requirement | Result | Note |
|---|---|---|---|
| `JWT_SECRET` Length | Length $\ge 32$ bytes | **PASS** | 52 characters |
| `JWT_SECRET` Uniqueness | Distinct from known repository defaults | **FAIL** | Matches known example secret `proctornet_super_secret_jwt_key_change_in_production` (Defect `SES-01`). Must rotate in Phase S2. |
| `AWS_REGION` Set | Must match deployment region (`ap-south-1`) | **PASS** | Set to `ap-south-1` |
| S3 Bucket Configured | Matches production storage bucket | **PASS** | Set to `proctornet-storage-prod-858109978489` |
| `FACE_DRIVER` Configured | Must be explicit (`rekognition` or `off`) | **PASS** | Set to `rekognition` |
| `FRONTEND_URL` Configured | Must match HTTPS origin | **PASS** | Set to `https://43.204.45.86.sslip.io` |
| `AGENT_*` Secrets Configured | Signing keys & pairing peppers present | **FAIL** | Not set in `.env` (Defect `EDGE-04`). |

---

## 10. Drift Analysis vs. Repository Baseline
1. **Node Runtime Skew:** Host is running Node `v20.18.0`, whereas repository specifies Node 22 LTS in `engines`.
2. **Memory Limit Tuning:** `MemoryMax=450M` against `--max-old-space-size=384` creates risk of early OOM killer under concurrent traffic load.
3. **Public Exposure of `/readyz`:** Caddy reverse proxies `/readyz` publicly to `127.0.0.1:9100`.
4. **Duplicate Manual Clone Removed:** Unused manual clone `/home/ubuntu/online-exam-proctoring` and global `safe.directory=*` were identified and purged during S0 cleanup.
5. **Baseline Snapshot:** Database snapshot of all 38 tables (1,218 rows) verified and uploaded to `s3://proctornet-storage-prod-858109978489/backups/baseline_20261007_s0.json.gz`.
