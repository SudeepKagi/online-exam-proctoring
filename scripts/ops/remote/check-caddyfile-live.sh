#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " CADDYFILE LIVE INSPECTION & VALIDATION"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

echo "--- 1. /etc/caddy/Caddyfile CONTENTS ---"
cat /etc/caddy/Caddyfile

echo ""
echo "--- 2. CADDY VALIDATE ---"
caddy validate --config /etc/caddy/Caddyfile
echo "[✓] caddy validate passed."

echo "================================================================="
