#!/bin/bash
set -euo pipefail

echo "=== VARIABLE NAMES AND LENGTHS IN /opt/proctornet/shared/.env ==="
while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    
    KEY=$(echo "$line" | cut -d'=' -f1 | tr -d ' ')
    VAL=$(echo "$line" | cut -d'=' -f2-)
    LEN=${#VAL}
    echo "KEY: $KEY | LENGTH: $LEN"
done < /opt/proctornet/shared/.env
