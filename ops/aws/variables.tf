variable "aws_region" {
  type        = string
  description = "AWS Region for deployment"
  default     = "ap-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment name"
  default     = "production"
}

variable "project_name" {
  type        = string
  description = "Project name tag"
  default     = "proctornet"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type (t3.micro for legacy free-tier; t3.small or c7i-flex.large for credit accounts)"
  default     = "t3.micro"
}

variable "domain_name" {
  type        = string
  description = "Fully-qualified domain name pointing to the Elastic IP (e.g., exam.example.com)"
  default     = "proctornet.local"
}

variable "alert_email" {
  type        = string
  description = "Email address for $5 budget alerts and CloudWatch alarms"
  default     = "admin@example.com"
}

variable "bucket_name" {
  type        = string
  description = "Unique S3 bucket name for evidence, releases, and backups"
  default     = "proctornet-storage-r5"
}

variable "evidence_retention_days" {
  type        = number
  description = "Number of days before violation evidence objects expire"
  default     = 180
}

variable "enable_rds" {
  type        = bool
  description = "Set to true to provision AWS RDS PostgreSQL (db.t3.micro free-tier); false if using external Supabase/Neon"
  default     = false
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name"
  default     = "proctornet"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL master username"
  default     = "proctornet_admin"
}

variable "db_password" {
  type        = string
  description = "PostgreSQL master password (required if enable_rds is true)"
  sensitive   = true
  default     = "ChangeMeInProduction_12345!"
}
