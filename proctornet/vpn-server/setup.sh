#!/usr/bin/env bash
# ProctorNet legacy wrapper script - delegates to idempotent production script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PARENT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

if [ -f "${PARENT_DIR}/ops/vpn/setup-wireguard.sh" ]; then
  exec bash "${PARENT_DIR}/ops/vpn/setup-wireguard.sh" "$@"
else
  exec bash "${SCRIPT_DIR}/../../ops/vpn/setup-wireguard.sh" "$@"
fi
