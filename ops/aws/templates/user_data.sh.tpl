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
if [ "$${DOMAIN_NAME}" = "localhost" ] || [ -z "$${DOMAIN_NAME}" ]; then
    CADDY_SITE=":80"
else
    CADDY_SITE="$${DOMAIN_NAME}, :80"
fi

cat << EOF > /etc/caddy/Caddyfile
$${CADDY_SITE} {
    # Block /metrics externally — accessible only via localhost (127.0.0.1:5000/metrics)
    @metrics {
        path /metrics
    }
    respond @metrics "Forbidden" 403

    # Security Headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(self), microphone=(self), display-capture=(self)"
    }

    # Proxy API & WebSocket endpoints to Node backend
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

    # Serve Built Frontend SPA
    handle {
        root * /opt/proctornet/current/proctornet/frontend/dist
        try_files {path} /index.html
        file_server
    }
}
EOF

systemctl enable caddy
systemctl restart caddy

echo "=== ProctorNet Cloud-Init Bootstrap Complete ==="
