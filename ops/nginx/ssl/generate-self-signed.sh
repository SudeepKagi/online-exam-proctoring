#!/usr/bin/env bash
# ==============================================================================
# Generate Self-Signed TLS Certificates for Development / Testing (P9 Task 4)
# Generates ECDSA P-256 certificate and key for local HTTPS validation
# ==============================================================================
set -euo pipefail

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/live"
mkdir -p "$SSL_DIR"

if [[ ! -f "$SSL_DIR/fullchain.pem" || ! -f "$SSL_DIR/privkey.pem" ]]; then
    echo "[+] Generating self-signed TLS certificates for development..."
    openssl req -x509 -nodes -days 365 \
      -newkey ec:<(openssl ecparam -name prime256v1) \
      -keyout "$SSL_DIR/privkey.pem" \
      -out "$SSL_DIR/fullchain.pem" \
      -subj "/CN=localhost/O=ProctorNet/C=US" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
    echo "[✓] Certificates generated in $SSL_DIR"
else
    echo "[✓] Certificates already present in $SSL_DIR"
fi
