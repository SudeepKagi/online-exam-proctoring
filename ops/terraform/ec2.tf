# ==============================================================================
# Single-Node Compute Architecture (Phase P9 Task 9)
# 8 vCPU / 16 GB RAM Compute Optimized with Fast NVMe gp3 EBS Storage
# ==============================================================================

data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

resource "aws_instance" "host" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.public.id
  iam_instance_profile = aws_iam_instance_profile.instance_profile.name

  vpc_security_group_ids = [
    aws_security_group.edge.id,
    aws_security_group.internal.id
  ]

  # Provisioned EBS gp3 Storage for Fast PostgreSQL WAL & Docker Runtimes
  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    iops                  = var.root_volume_iops
    throughput            = var.root_volume_throughput
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "proctornet-${var.environment}-root-ebs"
    }
  }

  user_data = <<-EOF
              #!/bin/bash
              set -euo pipefail

              # Update system packages
              apt-get update && apt-get upgrade -y
              apt-get install -y ca-certificates curl gnupg lsb-release

              # Install Docker Engine & Compose Plugin
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg

              echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

              apt-get update
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

              # Enable Docker Daemon with JSON-file logging limits
              cat << 'DOCKER_CONF' > /etc/docker/daemon.json
              {
                "log-driver": "json-file",
                "log-opts": {
                  "max-size": "10m",
                  "max-file": "3"
                },
                "default-ulimits": {
                  "nofile": {
                    "Name": "nofile",
                    "Hard": 65535,
                    "Soft": 65535
                  }
                }
              }
              DOCKER_CONF

              systemctl restart docker
              systemctl enable docker

              # Apply Kernel Performance Tuning
              cat << 'SYSCTL_CONF' > /etc/sysctl.d/99-proctornet.conf
              net.core.somaxconn = 4096
              net.ipv4.tcp_max_syn_backlog = 4096
              net.ipv4.ip_local_port_range = 10240 65535
              net.ipv4.tcp_tw_reuse = 1
              fs.file-max = 1000000
              net.core.rmem_max = 16777216
              net.core.wmem_max = 16777216
              vm.swappiness = 10
              net.core.default_qdisc = fq
              net.ipv4.tcp_congestion_control = bbr
              SYSCTL_CONF

              sysctl --system

              echo "ProctorNet host setup completed successfully."
              EOF

  tags = {
    Name = "proctornet-${var.environment}-single-node-host"
  }
}

resource "aws_eip" "host_ip" {
  instance = aws_instance.host.id
  domain   = "vpc"

  tags = {
    Name = "proctornet-${var.environment}-eip"
  }
}
