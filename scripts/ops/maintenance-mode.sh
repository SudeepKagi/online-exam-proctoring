#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# maintenance-mode.sh
# Toggle maintenance page on EC2 via Caddy in seconds
# Usage: ./maintenance-mode.sh on|off
# ─────────────────────────────────────────────────────────────

set -eo pipefail

MODE="${1:-}"
MAINT_FILE="/etc/caddy/maintenance.html"
CADDYFILE="/etc/caddy/Caddyfile"
BACKUP_CADDYFILE="/etc/caddy/Caddyfile.active"

if [ "$MODE" = "on" ]; then
    echo "Enabling Maintenance Mode..."
    if [ ! -f "$MAINT_FILE" ]; then
        echo "Creating default maintenance page at $MAINT_FILE..."
        cp /opt/proctornet/current/ops/caddy/maintenance.html "$MAINT_FILE" 2>/dev/null || cat << 'HTMLEOF' > "$MAINT_FILE"
<!DOCTYPE html><html><body><h1>ProctorNet Scheduled Maintenance</h1><p>System maintenance in progress.</p></body></html>
HTMLEOF
    fi

    # Backup current Caddyfile if not already backed up
    if [ ! -f "$BACKUP_CADDYFILE" ]; then
        cp "$CADDYFILE" "$BACKUP_CADDYFILE"
    fi

    cat << 'EOF' > "$CADDYFILE"
{
    email admin@proctornet.com
}

http://43.204.45.86, http://43.204.45.86.sslip.io, https://43.204.45.86.sslip.io {
    redir https://proctornet.duckdns.org{uri} permanent
}

proctornet.duckdns.org {
    handle {
        root * /etc/caddy
        rewrite * /maintenance.html
        file_server
        header Cache-Control "no-store, no-cache, must-revalidate"
    }
}
EOF

    caddy validate --adapter caddyfile --config "$CADDYFILE"
    systemctl reload caddy
    echo "[✓] Maintenance mode ENABLED."

elif [ "$MODE" = "off" ]; then
    echo "Disabling Maintenance Mode..."
    if [ -f "$BACKUP_CADDYFILE" ]; then
        mv "$BACKUP_CADDYFILE" "$CADDYFILE"
    else
        echo "Warning: No backup Caddyfile found. Retaining current or check template."
    fi

    caddy validate --adapter caddyfile --config "$CADDYFILE"
    systemctl reload caddy
    echo "[✓] Maintenance mode DISABLED. Live traffic restored."

else
    echo "Usage: $0 on|off"
    exit 1
fi
