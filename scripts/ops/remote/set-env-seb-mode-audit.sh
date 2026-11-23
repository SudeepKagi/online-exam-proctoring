#!/usr/bin/env bash
set -e
if grep -q "^SEB_MODE=" /opt/proctornet/shared/.env; then
  sed -i 's/^SEB_MODE=.*/SEB_MODE=audit/' /opt/proctornet/shared/.env
else
  echo "SEB_MODE=audit" >> /opt/proctornet/shared/.env
fi
echo "Updated SEB_MODE in /opt/proctornet/shared/.env:"
grep "^SEB_MODE=" /opt/proctornet/shared/.env

systemctl restart proctornet.service
echo "proctornet.service restarted successfully."
