#!/usr/bin/env bash
# ==============================================================================
# ProctorNet Host Kernel Tuning Application Script (P9 Task 5)
# Idempotently applies sysctl settings and configures transparent hugepages
# ==============================================================================
set -euo pipefail

SYSCTL_CONF="/etc/sysctl.d/99-proctornet.conf"
SOURCE_CONF="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/sysctl.d/99-proctornet.conf"

echo "=== ProctorNet Kernel & OS Tuning ==="

if [[ $EUID -ne 0 ]]; then
   echo "[-] This script must be run as root (or via sudo)."
   exit 1
fi

if [[ -f "$SOURCE_CONF" ]]; then
    echo "[+] Copying $SOURCE_CONF to $SYSCTL_CONF..."
    cp "$SOURCE_CONF" "$SYSCTL_CONF"
fi

echo "[+] Applying sysctl parameters..."
sysctl --system > /dev/null

echo "[+] Configuring Transparent Hugepages (THP) to 'madvise' for PostgreSQL..."
if [[ -f /sys/kernel/mm/transparent_hugepage/enabled ]]; then
    echo madvise > /sys/kernel/mm/transparent_hugepage/enabled
    echo "[+] THP set to: $(cat /sys/kernel/mm/transparent_hugepage/enabled)"
fi

echo "[+] Setting system ulimits..."
cat << 'EOF' > /etc/security/limits.d/99-proctornet.conf
*       soft    nofile  65535
*       hard    nofile  65535
root    soft    nofile  65535
root    hard    nofile  65535
EOF

echo "[+] Verifying critical settings:"
echo "    - net.core.somaxconn: $(sysctl -n net.core.somaxconn)"
echo "    - net.ipv4.tcp_tw_reuse: $(sysctl -n net.ipv4.tcp_tw_reuse)"
echo "    - net.core.rmem_max: $(sysctl -n net.core.rmem_max)"
echo "    - vm.swappiness: $(sysctl -n vm.swappiness)"
echo "    - fs.file-max: $(sysctl -n fs.file-max)"

echo "[✓] Kernel tuning applied successfully."
