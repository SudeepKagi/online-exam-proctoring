#!/usr/bin/env bash
set -e
cd /opt/proctornet/current
NODE_ENV=production node --env-file=/opt/proctornet/shared/.env scripts/ops/ai-smoke.js
