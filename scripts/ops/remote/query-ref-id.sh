#!/usr/bin/env bash
set -e
echo "=== Searching for Ref ae97b547 in proctornet journal ==="
journalctl -u proctornet.service --no-pager | grep -i "ae97b547" -B 5 -A 10 || echo "Not found in journalctl proctornet.service"

echo "=== Searching in caddy journal ==="
journalctl -u caddy.service --no-pager | grep -i "ae97b547" -B 5 -A 10 || echo "Not found in caddy journal"

echo "=== Searching in /opt/proctornet/ logs ==="
grep -rn "ae97b547" /opt/proctornet/logs/ 2>/dev/null || echo "No matches in /opt/proctornet/logs"
grep -rn "ae97b547" /var/log/ 2>/dev/null | head -n 30 || echo "No matches in /var/log"
