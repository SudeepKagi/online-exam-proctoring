#!/usr/bin/env bash
set -euo pipefail

echo "=== Current Deployment Target ==="
CURRENT_TARGET=$(readlink -f /opt/proctornet/current || echo "not-a-symlink")
echo "Current target: ${CURRENT_TARGET}"

if [ -d "/opt/proctornet/current" ]; then
  echo "=== Directory Details ==="
  ls -ld /opt/proctornet/current
  if [ -d "/opt/proctornet/current/.git" ]; then
    echo "=== Git Head ==="
    git -C /opt/proctornet/current rev-parse HEAD
  elif [ -f "/opt/proctornet/current/RELEASE_COMMIT" ]; then
    echo "=== RELEASE_COMMIT File ==="
    cat /opt/proctornet/current/RELEASE_COMMIT
  fi
fi

echo "=== Service Status ==="
systemctl is-active proctornet.service || true

