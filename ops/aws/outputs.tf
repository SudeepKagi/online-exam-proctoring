output "instance_id" {
  description = "EC2 Instance ID (used for AWS SSM Session Manager and deployments)"
  value       = aws_instance.app_server.id
}

output "elastic_ip" {
  description = "Public Elastic IP address for DNS A-Record pointing"
  value       = aws_eip.app_eip.public_ip
}

output "ssm_connect_command" {
  description = "Command to connect securely via AWS SSM Session Manager (No SSH port 22 needed)"
  value       = "aws ssm start-session --target ${aws_instance.app_server.id} --region ${var.aws_region}"
}

output "s3_bucket_name" {
  description = "S3 bucket for evidence, releases, and database backups"
  value       = aws_s3_bucket.evidence_bucket.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint (if enable_rds=true)"
  value       = var.enable_rds ? aws_db_instance.postgres[0].endpoint : "External (Supabase/Neon)"
}

output "dns_setup_instructions" {
  description = "DNS configuration step for automated Caddy HTTPS"
  value       = "Create a DNS A-Record pointing '${var.domain_name}' to '${aws_eip.app_eip.public_ip}'. Caddy will automatically issue and renew TLS certificates."
}
