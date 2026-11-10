#!/bin/bash
set -eu

echo "=== 1. TEST RUNNING WITH BASH -X ==="
bash -x /opt/proctornet/current/scripts/ops/backup-postgres.sh || true

echo "=== 2. SYSTEMCTL STATUS DETAILS ==="
systemctl status proctornet-backup.service -l --no-pager || true
