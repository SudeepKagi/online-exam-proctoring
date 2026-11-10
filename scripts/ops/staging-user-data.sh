#!/bin/bash
set -euo pipefail
apt-get update -y && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg lsb-release jq nodejs npm
# Snap installs or verifies amazon-ssm-agent
snap install amazon-ssm-agent --classic || true
systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service || true
systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service || true
# Install Docker Engine & Compose plugin
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
# Create application deployment root
mkdir -p /opt/proctornet-staging
chmod 750 /opt/proctornet-staging
