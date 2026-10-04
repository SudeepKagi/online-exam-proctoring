# ==============================================================================
# Terraform Outputs
# ==============================================================================

output "public_ip" {
  description = "Elastic IP address of the ProctorNet host"
  value       = aws_eip.host_ip.public_ip
}

output "instance_id" {
  description = "EC2 Instance ID"
  value       = aws_instance.host.id
}

output "s3_evidence_bucket" {
  description = "Name of the provisioned S3 evidence bucket"
  value       = aws_s3_bucket.evidence.id
}

output "security_group_edge_id" {
  description = "ID of the edge security group"
  value       = aws_security_group.edge.id
}
