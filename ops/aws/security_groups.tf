# ─────────────────────────────────────────────────────────────
# Security Groups: Enforcing 80/443 Only (No SSH Port 22)
# Access is strictly via AWS Systems Manager (SSM) Session Manager
# ─────────────────────────────────────────────────────────────

resource "aws_security_group" "web" {
  name        = "${var.project_name}-web-sg"
  description = "ProctorNet Web Security Group: Ingress 80/443 only; SSH (22) strictly prohibited"
  vpc_id      = aws_vpc.main.id

  # HTTP (Port 80) - Caddy ACME challenge & HTTPS redirection
  ingress {
    description = "HTTP for Lets Encrypt / ZeroSSL ACME challenge and redirect"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (Port 443) - Encrypted web traffic & WebSockets
  ingress {
    description = "HTTPS encrypted TLS traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All Outbound Traffic (Package updates, S3 API calls, SSM Agent, Rekognition)
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-web-sg"
    Rule    = "80-443-only"
    SSHPort = "disabled-use-ssm"
  }
}

# ─────────────────────────────────────────────────────────────
# Database Security Group (Internal only, port 5432 from web_sg)
# ─────────────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  count       = var.enable_rds ? 1 : 0
  name        = "${var.project_name}-rds-sg"
  description = "ProctorNet RDS PostgreSQL SG: accessible solely by application EC2 instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from web instance"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }

  egress {
    description = "Allow outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}
