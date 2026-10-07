#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# ProctorNet Lite Production Bootstrapper (Cloud-Init)
# ─────────────────────────────────────────────────────────────

echo "=== [1/8] Configuring 2 GB Swap & Kernel Swappiness ==="
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

sysctl vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf

echo "=== [2/8] Hardening Journald Max Storage (100M Cap) ==="
mkdir -p /etc/systemd/journald.conf.d/
cat << 'EOF' > /etc/systemd/journald.conf.d/size.conf
[Journal]
SystemMaxUse=100M
SystemMaxFileSize=25M
MaxRetentionSec=1month
EOF
systemctl restart systemd-journald

echo "=== [3/8] Updating Packages & Security Patches ==="
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg \
    ca-certificates \
    apt-transport-https \
    unattended-upgrades \
    unzip \
    jq \
    postgresql-client \
    awscli

# Enable automatic security patches
dpkg-reconfigure -plow unattended-upgrades

echo "=== [4/8] Installing Node.js LTS (v20.x) ==="
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "=== [5/8] Installing Caddy Web Server (Auto HTTPS) ==="
if ! command -v caddy &> /dev/null; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -y
    apt-get install -y caddy
fi

echo "=== [6/8] Installing Amazon CloudWatch Agent ==="
if ! command -v amazon-cloudwatch-agent-ctl &> /dev/null; then
    wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
    dpkg -i -E ./amazon-cloudwatch-agent.deb
    rm -f ./amazon-cloudwatch-agent.deb
fi

cat << 'EOF' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "namespace": "ProctorNet/System",
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": ["disk_used_percent"],
        "metrics_collection_interval": 60,
        "resources": ["/"]
      },
      "swap": {
        "measurement": ["swap_used_percent"],
        "metrics_collection_interval": 60
      }
    },
    "append_dimensions": {
      "InstanceId": "$${aws:InstanceId}"
    }
  }
}
EOF
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

echo "=== [7/8] Configuring Application User & Directory Tree ==="
id -u proctornet &>/dev/null || useradd -r -m -s /bin/bash -d /opt/proctornet proctornet

mkdir -p /opt/proctornet/releases
mkdir -p /opt/proctornet/shared
chown -R proctornet:proctornet /opt/proctornet

# Base systemd service unit
cat << 'EOF' > /etc/systemd/system/proctornet.service
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
EOF

systemctl daemon-reload

echo "=== [8/8] Configuring Caddy Reverse Proxy & Static SPA Serving ==="
DOMAIN_NAME="${domain_name}"

cat << EOF > /etc/caddy/Caddyfile
{
    email admin@proctornet.com
}

# Redirect raw IP and legacy hostnames to canonical domain
http://43.204.45.86, http://43.204.45.86.sslip.io, https://43.204.45.86.sslip.io {
    redir https://$${DOMAIN_NAME}{uri} permanent
}

$${DOMAIN_NAME} {
    encode zstd gzip

    # Block internal telemetry endpoints publicly (EDGE-01)
    handle /metrics* {
        respond "Not Found" 404
    }

    handle /readyz* {
        respond "Not Found" 404
    }

    # Security Headers & Content-Security-Policy (S1 Specification)
    header {
        Strict-Transport-Security "max-age=300"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(self), microphone=(self), display-capture=(self)"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com; img-src 'self' data: blob: https://proctornet-storage-prod-858109978489.s3.ap-south-1.amazonaws.com https://proctornet-storage-prod-858109978489.s3.amazonaws.com https://*.amazonaws.com; connect-src 'self' wss://$${DOMAIN_NAME} https://proctornet-storage-prod-858109978489.s3.ap-south-1.amazonaws.com https://proctornet-storage-prod-858109978489.s3.amazonaws.com https://*.amazonaws.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self';"
        ?X-Request-ID "{uuid}"
    }

    # Request body limit
    request_body {
        max_size 10MB
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

    @assets {
        path /assets/*
    }
    handle @assets {
        root * /opt/proctornet/current/proctornet/frontend/dist
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    handle {
        root * /opt/proctornet/current/proctornet/frontend/dist
        header Cache-Control "no-store, no-cache, must-revalidate"
        try_files {path} /index.html
        file_server
    }
}
EOF

systemctl enable caddy
systemctl restart caddy

echo "=== ProctorNet Cloud-Init Bootstrap Complete ==="
