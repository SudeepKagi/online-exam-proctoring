#!/bin/bash

EXAM_SERVER_IP=${1:-"YOUR_EXAM_SERVER_IP"}

echo "Setting up iptables firewall rules..."

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state \
  --state ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -m state \
  --state ESTABLISHED,RELATED -j ACCEPT

# Allow WireGuard port
iptables -A INPUT -p udp --dport 51820 -j ACCEPT

# Allow SSH (keep server access)
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow DNS on VPN interface (Unbound)
iptables -A INPUT -i wg0 -p udp --dport 53 -j ACCEPT
iptables -A INPUT -i wg0 -p tcp --dport 53 -j ACCEPT

# VPN clients: ONLY allow traffic to exam server
iptables -A FORWARD -i wg0 \
  -d $EXAM_SERVER_IP -p tcp \
  --dport 443 -j ACCEPT

iptables -A FORWARD -i wg0 \
  -d $EXAM_SERVER_IP -p tcp \
  --dport 80 -j ACCEPT

# Block ALL other outbound traffic from VPN
iptables -A FORWARD -i wg0 -j DROP

# NAT for VPN traffic to exam server
iptables -t nat -A POSTROUTING \
  -o eth0 -s 10.0.0.0/24 \
  -d $EXAM_SERVER_IP -j MASQUERADE

# Save rules
iptables-save > /etc/iptables/rules.v4

echo "Firewall configured!"
echo "VPN clients can ONLY reach $EXAM_SERVER_IP"
