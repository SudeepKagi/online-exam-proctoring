#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET LIVE CADDYFILE UPDATE & VALIDATION"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

# 1. Backup existing Caddyfile
cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak-$(date +%s)
echo "[✓] Backed up /etc/caddy/Caddyfile"

# 2. Write updated Caddyfile to a temporary file
cat << 'EOF' > /tmp/Caddyfile.new
{
    email admin@proctornet.com
}

# Redirect raw IP and legacy hostnames to canonical domain
http://43.204.45.86, http://43.204.45.86.sslip.io, https://43.204.45.86.sslip.io {
    redir https://proctornet.duckdns.org{uri} permanent
}

# Canonical site with automatic TLS & HTTP->HTTPS redirection
proctornet.duckdns.org {
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
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer"
        Permissions-Policy "camera=(self), microphone=(self), display-capture=()"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; font-src 'self' data: https://fonts.gstatic.com https://cdn.fontshare.com; img-src 'self' data: blob: https://*.s3.ap-south-1.amazonaws.com https://*.s3.amazonaws.com https://*.amazonaws.com; connect-src 'self' data: blob: https://proctornet.duckdns.org wss://proctornet.duckdns.org https://*.s3.ap-south-1.amazonaws.com https://*.s3.amazonaws.com https://*.amazonaws.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self';"
        ?X-Request-ID "{uuid}"
    }

    # Access logging with query parameter redaction
    log {
        output stdout
        format filter {
            wrap json
            fields {
                uri query {
                    replace launch "[REDACTED]"
                    replace token "[REDACTED]"
                    replace pin "[REDACTED]"
                }
            }
        }
    }

    # Request body limit
    request_body {
        max_size 25MB
    }

    # Reverse proxy backend API and WebSockets
    handle /api/* {
        reverse_proxy 127.0.0.1:5000 {
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }

    handle /rt/* {
        reverse_proxy 127.0.0.1:5000 {
            transport http {
                keepalive 60s
            }
        }
    }

    handle /socket.io/* {
        reverse_proxy 127.0.0.1:5000 {
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
            header_up X-Forwarded-Host {host}
        }
    }

    handle /healthz {
        reverse_proxy 127.0.0.1:5000
    }

    handle /health {
        reverse_proxy 127.0.0.1:5000
    }

    # Hashed static assets — Immutable caching
    @assets {
        path /assets/*
    }
    handle @assets {
        root * /opt/proctornet/current/frontend/dist
        header Cache-Control "public, max-age=31536000, immutable"
        file_server
    }

    # Single Page Application (SPA) - HTML fallback with no-store
    handle {
        root * /opt/proctornet/current/frontend/dist
        header Cache-Control "no-store, no-cache, must-revalidate"
        try_files {path} /index.html
        file_server
    }
}
EOF

# 3. Validate new Caddyfile
echo "Validating new Caddyfile..."
caddy validate --config /tmp/Caddyfile.new
echo "[✓] caddy validate passed on new config!"

# 4. Atomically install and reload
mv /tmp/Caddyfile.new /etc/caddy/Caddyfile
systemctl reload caddy.service
echo "[✓] Caddy reloaded cleanly with updated configuration!"

# 5. Quick smoke test of Caddy responses
curl -sSf http://127.0.0.1:5000/healthz | jq -c .
curl -sSf -k --resolve proctornet.duckdns.org:443:127.0.0.1 https://proctornet.duckdns.org/healthz | jq -c .
echo "[✓] Caddy reverse proxy verified functional."

echo "================================================================="
