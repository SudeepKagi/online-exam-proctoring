# ==============================================================================
# ProctorNet Single-Node Production Infrastructure (Terraform Skeleton)
# Phase P9 Task 9 — AWS Provider & State Configuration
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.35"
    }
  }

  # In production, configure remote state backend:
  # backend "s3" {
  #   bucket         = "proctornet-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-south-1"
  #   dynamodb_table = "proctornet-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ProctorNet"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
