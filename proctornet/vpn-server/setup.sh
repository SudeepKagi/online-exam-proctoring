#!/bin/bash

echo "Setting up ProctorNet VPN Server..."

# Update system
apt-get update -y
apt-get upgrade -y

# Install WireGuard
apt-get install -y wireguard wireguard-tools
apt-get install -y unbound dnsutils iptables-persistent

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p

# Generate server keys
cd /etc/wireguard
wg genkey | tee server_private.key | \
  wg pubkey > server_public.key
chmod 600 server_private.key

SERVER_PRIVATE=$(cat server_private.key)
SERVER_PUBLIC=$(cat server_public.key)
SERVER_IP=$(curl -s ifconfig.me)

echo "Server Public Key: $SERVER_PUBLIC"
echo "Server IP: $SERVER_IP"

# Create WireGuard config
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = $SERVER_PRIVATE
Address = 10.0.0.1/24
ListenPort = 51820
SaveConfig = true

# DNS filtering via Unbound
DNS = 10.0.0.1

# NAT rules
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT
PostUp = iptables -t nat -A POSTROUTING \
  -o eth0 -j MASQUERADE
PostUp = ip6tables -A FORWARD -i wg0 -j ACCEPT
PostUp = ip6tables -t nat -A POSTROUTING \
  -o eth0 -j MASQUERADE

PostDown = iptables -D FORWARD -i wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING \
  -o eth0 -j MASQUERADE
PostDown = ip6tables -D FORWARD -i wg0 -j ACCEPT
PostDown = ip6tables -t nat -D POSTROUTING \
  -o eth0 -j MASQUERADE
EOF

# Start WireGuard
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

echo "WireGuard server setup complete!"
echo "Server Public Key: $SERVER_PUBLIC"
echo "Save this key in your .env file"
