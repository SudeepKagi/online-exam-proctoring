# ─────────────────────────────────────────────────────────────
# EC2 Compute Node: Hardened, IMDSv2-Enforced, Standard Credits
# ─────────────────────────────────────────────────────────────

locals {
  is_burstable = can(regex("^t[2-4]", var.instance_type))
}

resource "aws_instance" "app_server" {
  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.public.id
  iam_instance_profile = aws_iam_instance_profile.ec2_profile.name

  # Security Group: 80 and 443 only; SSH (22) is forbidden
  vpc_security_group_ids = [aws_security_group.web.id]

  # Root EBS Volume: Encrypted gp3
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 25
    encrypted             = true
    delete_on_termination = true

    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  # IMDSv2 Strictly Enforced (hop limit 1, tokens required)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # If t3/t4 burstable instance, set CPU credits to standard (no surprise charges)
  dynamic "credit_specification" {
    for_each = local.is_burstable ? [1] : []
    content {
      cpu_credits = "standard"
    }
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tpl", {
    domain_name = var.domain_name
  })

  tags = {
    Name = "${var.project_name}-server"
    Role = "app-server"
  }
}

# ─────────────────────────────────────────────────────────────
# Elastic IP (Persistent Public IP for DNS A-Record)
# ─────────────────────────────────────────────────────────────
resource "aws_eip" "app_eip" {
  instance = aws_instance.app_server.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }

  depends_on = [aws_internet_gateway.igw]
}

# ─────────────────────────────────────────────────────────────
# CloudWatch Auto-Recovery Alarm (System Check Failed)
# ─────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "auto_recovery" {
  alarm_name          = "${var.project_name}-ec2-auto-recovery"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Auto-recovers EC2 instance if hardware/hypervisor system check fails"

  dimensions = {
    InstanceId = aws_instance.app_server.id
  }

  alarm_actions = [
    "arn:aws:automate:${var.aws_region}:ec2:recover"
  ]
}

# ─────────────────────────────────────────────────────────────
# CloudWatch Instance Status Alarm
# ─────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "instance_status_check" {
  alarm_name          = "${var.project_name}-instance-status-check"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Alarms when instance operating system check fails"

  dimensions = {
    InstanceId = aws_instance.app_server.id
  }
}

# ─────────────────────────────────────────────────────────────
# CloudWatch CPU Credit Balance Alarm (for t3/t4 burstable instances)
# ─────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "cpu_credits_low" {
  count               = local.is_burstable ? 1 : 0
  alarm_name          = "${var.project_name}-cpu-credit-balance-low"
  namespace           = "AWS/EC2"
  metric_name         = "CPUCreditBalance"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Minimum"
  threshold           = 20
  alarm_description   = "Triggered when CPU credit balance drops below 20 credits"

  dimensions = {
    InstanceId = aws_instance.app_server.id
  }
}

# ─────────────────────────────────────────────────────────────
# CloudWatch Agent Disk Utilization Alarm (> 80%)
# ─────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "disk_space_high" {
  alarm_name          = "${var.project_name}-disk-utilization-high"
  namespace           = "ProctorNet/System"
  metric_name         = "disk_used_percent"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "Alarms when root filesystem disk usage exceeds 80%"

  dimensions = {
    InstanceId = aws_instance.app_server.id
    path       = "/"
  }
}

# ─────────────────────────────────────────────────────────────
# CloudWatch Agent Memory Utilization Alarm (> 85%)
# ─────────────────────────────────────────────────────────────
resource "aws_cloudwatch_metric_alarm" "memory_utilization_high" {
  alarm_name          = "${var.project_name}-memory-utilization-high"
  namespace           = "ProctorNet/System"
  metric_name         = "mem_used_percent"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Alarms when instance RAM utilization exceeds 85%"

  dimensions = {
    InstanceId = aws_instance.app_server.id
  }
}
