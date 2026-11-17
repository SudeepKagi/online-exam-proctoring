#!/usr/bin/env bash
set -euo pipefail

echo "================================================================="
echo " PROCTORNET AUTOMATIC CLEANUP"
echo " Timestamp: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "================================================================="

echo "--- 1. PRUNING OLD RELEASES BEYOND CURRENT + 2 ---"
# Keep current plus 2 most recent previous releases
cd /opt/proctornet/releases
CURRENT_TARGET=$(readlink -f /opt/proctornet/current)

# List releases by mtime descending, skip top 3 (current + 2), delete the rest
ls -1dt release-* | sed -e '1,3d' | while read -r old_release; do
  if [ -d "$old_release" ] && [ "/opt/proctornet/releases/$old_release" != "$CURRENT_TARGET" ]; then
    echo "Pruning old release: $old_release"
    rm -rf "$old_release"
  fi
done

echo "Active and retained releases:"
ls -ld /opt/proctornet/releases/release-*

echo ""
echo "--- 2. CLEANING /tmp LEFTOVERS ---"
rm -f /tmp/remote-task* /tmp/Caddyfile* /tmp/ssm* /tmp/release-*.tar.gz /tmp/*.dump 2>/dev/null || true
echo "[✓] Server /tmp cleaned."

echo "================================================================="
