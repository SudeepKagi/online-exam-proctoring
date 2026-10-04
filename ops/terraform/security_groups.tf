# ==============================================================================
# Security Group Hardening (Phase P9 Task 9)
# Public edge restricted to 80/443 + LiveKit ports; Data services private
# ==============================================================================

resource "aws_security_group" "edge" {
  name        = "proctornet-${var.environment}-edge-sg"
  description = "Public edge ingress security group"
  vpc_id      = aws_vpc.proctornet.id

  # --- Web HTTPS / HTTP ---
  ingress {
    description = "HTTP edge redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS production application traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- LiveKit WebRTC SFU Streaming Media ---
  ingress {
    description = "LiveKit SFU WebRTC signaling"
    from_port   = 7880
    to_port     = 7880
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "LiveKit ICE TCP fallback"
    from_port   = 7881
    to_port     = 7881
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "LiveKit WebRTC Media UDP single mux"
    from_port   = 7882
    to_port     = 7882
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "LiveKit TURN UDP traversal"
    from_port   = 3478
    to_port     = 3478
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "LiveKit TURN TLS traversal"
    from_port   = 5349
    to_port     = 5349
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- WireGuard Tunnel (Optional flag-gated deployment) ---
  ingress {
    description = "WireGuard VPN UDP handshake port"
    from_port   = 51820
    to_port     = 51820
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # --- Administrative SSH (Restricted to Authorized Admin CIDRs) ---
  ingress {
    description = "Admin SSH access restricted to admin CIDRs"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_cidrs
  }

  # --- Outbound Egress ---
  egress {
    description = "Allow all outbound internet access"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "proctornet-${var.environment}-edge-sg"
  }
}

# --- Security Group for Internal Services (Never Exposed Publicly) ---
resource "aws_security_group" "internal" {
  name        = "proctornet-${var.environment}-internal-sg"
  description = "Private security group for internal databases and cache"
  vpc_id      = aws_vpc.proctornet.id

  # Allow ingress from Edge SG only
  ingress {
    description     = "Internal Postgres communication"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.edge.id]
  }

  ingress {
    description     = "Internal Redis communication"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.edge.id]
  }

  ingress {
    description     = "Internal RabbitMQ communication"
    from_port       = 5672
    to_port         = 5672
    protocol        = "tcp"
    security_groups = [aws_security_group.edge.id]
  }

  egress {
    description = "Allow all outbound from internal tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "proctornet-${var.environment}-internal-sg"
  }
}
