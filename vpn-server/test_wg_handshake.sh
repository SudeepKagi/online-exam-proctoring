#!/bin/bash
set -e

echo "=== Setting up WireGuard Server (wg0) ==="
ip netns del clientns 2>/dev/null || true
ip netns add clientns

ip link add dev wg0 type wireguard 2>/dev/null || true
ip addr add 10.0.0.1/24 dev wg0 2>/dev/null || true
wg set wg0 private-key /etc/wireguard/server_private.key listen-port 51820
ip link set up dev wg0

echo "=== Generating WireGuard Client Keypair ==="
CLIENT_PRIV=$(wg genkey)
CLIENT_PUB=$(echo "$CLIENT_PRIV" | wg pubkey)

echo "Client Public Key: $CLIENT_PUB"

echo "=== Registering Client Peer on wg0 Server ==="
wg set wg0 peer "$CLIENT_PUB" allowed-ips 10.0.0.2/32

echo "=== Setting up Client WireGuard Interface (wg1) in isolated network namespace ==="
ip link add dev wg1 type wireguard
ip link set wg1 netns clientns
ip netns exec clientns wg set wg1 private-key <(echo "$CLIENT_PRIV") peer kb5R61fn5t28/ZroTMc02eRvdzo6+rlzj5wDnqF0WD8= endpoint 127.0.0.1:51820 allowed-ips 10.0.0.0/24
ip netns exec clientns ip addr add 10.0.0.2/32 dev wg1
ip netns exec clientns ip link set up dev wg1
ip netns exec clientns ip route add 10.0.0.0/24 dev wg1 2>/dev/null || true

echo "=== Testing Live WireGuard Tunnel Encrypted Ping ==="
ip netns exec clientns ping -c 3 10.0.0.1

echo ""
echo "=== Inspecting Live WireGuard Kernel Status (wg show wg0) ==="
wg show wg0
