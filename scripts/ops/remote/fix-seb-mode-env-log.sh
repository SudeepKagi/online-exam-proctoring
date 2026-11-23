#!/usr/bin/env bash
set -e
sed -i 's/^SEB_MODE=.*/SEB_MODE=log/' /opt/proctornet/shared/.env
echo "Updated SEB_MODE to log:"
grep "^SEB_MODE=" /opt/proctornet/shared/.env
systemctl restart proctornet.service
sleep 3
systemctl status proctornet.service --no-pager
