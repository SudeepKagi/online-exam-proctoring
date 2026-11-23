#!/usr/bin/env bash
set -e
echo "=== Searching journalctl for request ae97b547 ==="
journalctl -u proctornet.service --since "2026-11-23 07:55:00" --until "2026-11-23 08:05:00" --no-pager | grep -i "ae97b547" -C 5 || echo "None with exact id"
echo "=== Searching journalctl for SEB_CONFIG_KEY_MISMATCH or 403 ==="
journalctl -u proctornet.service --since "2026-11-23 07:55:00" --until "2026-11-23 08:05:00" --no-pager | grep -i "SEB_" -C 3 | tail -n 50
