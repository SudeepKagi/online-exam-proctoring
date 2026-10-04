# ==============================================================================
# CloudWatch Observability & Alarms (Phase P9 Task 9)
# Host Telemetry, Container Log Streams, & High-Resource Threshold Alarms
# ==============================================================================

resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/proctornet/${var.environment}/containers"
  retention_in_days = 30

  tags = {
    Name = "proctornet-${var.environment}-log-group"
  }
}

# CPU Utilization Alarm (> 85% for 5 minutes)
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "proctornet-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "Triggers when ProctorNet host CPU exceeds 85% across 2 consecutive periods"

  dimensions = {
    InstanceId = aws_instance.host.id
  }
}

# Status Check Failed Alarm (Host or Hardware Failure)
resource "aws_cloudwatch_metric_alarm" "status_check" {
  alarm_name          = "proctornet-${var.environment}-system-status-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Triggers immediately if EC2 hardware or system checks fail"

  dimensions = {
    InstanceId = aws_instance.host.id
  }
}
