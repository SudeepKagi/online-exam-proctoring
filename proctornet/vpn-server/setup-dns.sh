#!/bin/bash

# Setup Unbound DNS server
# Only allows exam domain, blocks everything else

EXAM_DOMAIN=${1:-"proctornet.yourdomain.com"}
EXAM_IP=${2:-"YOUR_EXAM_SERVER_IP"}

cat > /etc/unbound/unbound.conf << EOF
server:
    # Listen on VPN interface
    interface: 10.0.0.1
    port: 53
    
    # Access control
    access-control: 0.0.0.0/0 refuse
    access-control: 10.0.0.0/24 allow
    access-control: 127.0.0.1/8 allow
    
    # Logging
    verbosity: 1
    logfile: "/var/log/unbound.log"
    
    # Performance
    num-threads: 2
    cache-min-ttl: 0
    cache-max-ttl: 30
    
    # Security
    hide-identity: yes
    hide-version: yes
    harden-glue: yes
    harden-dnssec-stripped: yes
    
    # Block ALL domains by default
    # Return NXDOMAIN for everything
    local-zone: "." refuse

    # ALLOW ONLY exam domain
    local-zone: "$EXAM_DOMAIN" transparent
    local-data: "$EXAM_DOMAIN A $EXAM_IP"
    local-data: "www.$EXAM_DOMAIN A $EXAM_IP"
    
    # Allow API subdomain if separate
    local-zone: "api.$EXAM_DOMAIN" transparent
    local-data: "api.$EXAM_DOMAIN A $EXAM_IP"
    
    # Allow socket subdomain
    local-zone: "socket.$EXAM_DOMAIN" transparent
    local-data: "socket.$EXAM_DOMAIN A $EXAM_IP"

forward-zone:
    name: "$EXAM_DOMAIN"
    forward-addr: $EXAM_IP
EOF

# Restart Unbound
systemctl enable unbound
systemctl restart unbound

echo "DNS filtering configured!"
echo "Only $EXAM_DOMAIN is accessible via VPN"
