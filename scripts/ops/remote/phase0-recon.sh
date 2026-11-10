#!/bin/bash
set -euo pipefail

echo "=== 1. SYSTEM IDENTITY & HOSTNAME ==="
whoami
uname -a
hostname

echo "=== 2. OS, MEMORY & DISK USAGE ==="
cat /etc/os-release | grep -E '^(NAME|VERSION)=' || true
free -m
df -h /

echo "=== 3. APP RUNTIME (SYSTEMD / PM2 / DOCKER) ==="
echo "--- Systemd Services ---"
systemctl list-unit-files 'proctor*' 'caddy*' || true
echo "--- Systemd ProctorNet Status ---"
systemctl status proctornet.service --no-pager || true
echo "--- PM2 Status ---"
if command -v pm2 >/dev/null 2>&1; then
    pm2 list || true
else
    echo "pm2 not found"
fi
echo "--- Docker Containers ---"
if command -v docker >/dev/null 2>&1; then
    docker ps -a || true
else
    echo "docker not found"
fi

echo "=== 4. LISTENING PORTS (ss -tlnp) ==="
ss -tlnp || netstat -tlnp || true

echo "=== 5. PROXY CONFIGURATION (CADDY) ==="
if command -v caddy >/dev/null 2>&1; then
    caddy version || true
fi
systemctl status caddy --no-pager || true
if [ -f /etc/caddy/Caddyfile ]; then
    echo "Found /etc/caddy/Caddyfile:"
    cat /etc/caddy/Caddyfile
fi

echo "=== 6. APP DIRECTORY & RELEASE LAYOUT ==="
if [ -d /opt/proctornet ]; then
    ls -la /opt/proctornet
    if [ -d /opt/proctornet/current ]; then
        ls -la /opt/proctornet/current
    fi
    if [ -d /opt/proctornet/releases ]; then
        ls -la /opt/proctornet/releases
    fi
    if [ -d /opt/proctornet/shared ]; then
        ls -la /opt/proctornet/shared
    fi
else
    echo "/opt/proctornet does not exist"
fi

echo "=== 7. NODE.JS RUNTIME ==="
if command -v node >/dev/null 2>&1; then
    node -v
    npm -v
else
    echo "node not on PATH"
fi
if [ -d /home/ubuntu/.nvm ]; then
    echo "nvm present in /home/ubuntu/.nvm"
fi

echo "=== 8. ENVIRONMENT FILE PERMISSIONS ==="
for env_path in /opt/proctornet/shared/.env /opt/proctornet/.env /opt/proctornet/current/.env /opt/proctornet/current/proctornet/backend/.env; do
    if [ -f "$env_path" ]; then
        ls -la "$env_path"
    fi
done

echo "=== 9. DEPLOYED COMMIT ==="
for dir in /opt/proctornet/current /opt/proctornet/current/proctornet; do
    if [ -d "$dir/.git" ]; then
        echo "Git commit in $dir:"
        git --git-dir="$dir/.git" --work-tree="$dir" log -1 --oneline || true
    fi
done

echo "=== 10. BACKUP TIMERS & CRONTABS ==="
systemctl list-timers | grep -E '(proctor|backup)' || true
crontab -l 2>/dev/null || echo "No crontab for root"

echo "=== 11. DATABASE & REDIS INSPECTION ==="
echo "--- PostgreSQL Service ---"
systemctl status postgresql --no-pager || true
echo "--- Redis Service ---"
systemctl status redis --no-pager || systemctl status redis-server --no-pager || true

echo "=== 12. READ-ONLY DATABASE EXAMINATION ==="
# Locate the live database connection string safely
ENV_FILE=""
for f in /opt/proctornet/shared/.env /opt/proctornet/.env /opt/proctornet/current/.env; do
    if [ -f "$f" ]; then
        ENV_FILE="$f"
        break
    fi
done

if [ -n "$ENV_FILE" ]; then
    echo "Env file found at: $ENV_FILE"
    # Check DATABASE_URL scheme / host safely (without printing password)
    DB_HOST_MASKED=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's/.*@([^:\/]+).*/\1/' || true)
    echo "Database host target: $DB_HOST_MASKED"
    
    # Run a node helper using the app's existing node_modules to query attempt count and test accounts
    APP_DIR=""
    for d in /opt/proctornet/current /opt/proctornet/current/proctornet /opt/proctornet; do
        if [ -d "$d/node_modules" ] || [ -d "$d/backend/node_modules" ]; then
            APP_DIR="$d"
            break
        fi
    done
    echo "App directory for query: $APP_DIR"
fi
