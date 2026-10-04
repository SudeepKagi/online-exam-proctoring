# ==============================================================================
# Terraform Input Variables for ProctorNet
# ==============================================================================

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance size (Target: 8 vCPU / 16GB RAM compute-optimized)"
  type        = string
  default     = "c6i.2xlarge"
}

variable "root_volume_size" {
  description = "EBS root volume size in GB"
  type        = number
  default     = 100
}

variable "root_volume_iops" {
  description = "Provisioned IOPS for gp3 volume"
  type        = number
  default     = 3000
}

variable "root_volume_throughput" {
  description = "Provisioned throughput in MB/s for gp3 volume"
  type        = number
  default     = 125
}

variable "ssh_allowed_cidrs" {
  description = "CIDR blocks allowed for bastion SSH access (restricted to admin IP)"
  type        = list(string)
  default     = ["103.21.244.0/24"]
}
