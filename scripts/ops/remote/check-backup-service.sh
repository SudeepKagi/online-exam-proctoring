#!/bin/bash
set -eu

echo "=== BACKUP SERVICE JOURNALCTL ==="
journalctl -u proctornet-backup.service -n 50 --no-pager

echo "=== BACKUP LOG FILE ==="
if [ -f /var/log/proctornet/backup.log ]; then
    cat /var/log/proctornet/backup.log
else
    echo "No /var/log/proctornet/backup.log found."
fi

echo "=== RUN SCRIPT DIRECTLY AS PROCTORNET USER ==="
su -s /bin/bash proctornet -c "set -a; . /opt/proctornet/shared/.env; set +a; /bin/bash /opt/proctornet/current/scripts/ops/backup-postgres.sh" || true
