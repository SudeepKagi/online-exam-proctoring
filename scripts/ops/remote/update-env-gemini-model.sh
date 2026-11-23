#!/usr/bin/env bash
set -e
if grep -q "^GEMINI_MODEL=" /opt/proctornet/shared/.env; then
  sed -i 's/^GEMINI_MODEL=.*/GEMINI_MODEL=gemini-3.5-flash/' /opt/proctornet/shared/.env
else
  echo "GEMINI_MODEL=gemini-3.5-flash" >> /opt/proctornet/shared/.env
fi
echo "Updated GEMINI_MODEL in /opt/proctornet/shared/.env"
