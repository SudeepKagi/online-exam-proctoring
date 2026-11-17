#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/opt/proctornet/shared/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE does not exist!" >&2
  exit 1
fi

echo "Current SEB_MODE in $ENV_FILE:"
grep -E '^SEB_MODE=' "$ENV_FILE" || echo "SEB_MODE not set"

cp "$ENV_FILE" "${ENV_FILE}.bak-$(date +%s)"

if grep -q '^SEB_MODE=' "$ENV_FILE"; then
  sed -i 's/^SEB_MODE=.*/SEB_MODE=enforce/' "$ENV_FILE"
else
  echo "SEB_MODE=enforce" >> "$ENV_FILE"
fi

echo "Updated SEB_MODE in $ENV_FILE:"
grep -E '^SEB_MODE=' "$ENV_FILE"

echo "Restarting proctornet.service..."
systemctl restart proctornet.service

sleep 3

echo "Verifying service health..."
curl -sSf http://127.0.0.1:5000/healthz | jq -c .

echo "Checking SEB state via node script..."
cd /opt/proctornet/current/backend
NODE_ENV=production node -r dotenv/config -e '
const { getInstitutionSebState } = require("./src/modules/seb/seb.service");
async function check() {
  const state = await getInstitutionSebState({ bypassCache: true });
  console.log("Requested Mode:", state.requestedMode);
  console.log("Effective Mode:", state.effectiveMode);
  console.log("Enforcement Reason:", state.enforcementReason || "None (Fully Enforced)");
}
check().catch(console.error);
' dotenv_config_path=/opt/proctornet/shared/.env

echo "SEB_MODE update completed successfully."
