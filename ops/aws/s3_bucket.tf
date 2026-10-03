terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "bucket_name" {
  type        = string
  description = "Unique S3 bucket name for ProctorNet evidence and assets"
  default     = "proctornet-evidence-storage"
}

variable "frontend_url" {
  type        = string
  description = "Allowed CORS origin for direct browser-to-S3 uploads"
  default     = "http://localhost:5173"
}

variable "evidence_retention_days" {
  type        = number
  description = "Number of days before violation evidence objects expire"
  default     = 180
}

# ─────────────────────────────────────────────────────────────
# 1. Authoritative S3 Bucket
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "evidence_bucket" {
  bucket = var.bucket_name

  tags = {
    Name        = "ProctorNet Evidence & Media"
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}

# ─────────────────────────────────────────────────────────────
# 2. Block All Public Access (Strict Requirement)
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.evidence_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─────────────────────────────────────────────────────────────
# 3. Default Server-Side Encryption (SSE-S3 / AES256)
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.evidence_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ─────────────────────────────────────────────────────────────
# 4. Bucket Policy: Enforce TLS & Deny Non-Secure Transport
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket_policy" "enforce_tls" {
  bucket = aws_s3_bucket.evidence_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyNonTLSRequests"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.evidence_bucket.arn,
          "${aws_s3_bucket.evidence_bucket.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })
}

# ─────────────────────────────────────────────────────────────
# 5. Strict CORS Configuration for Direct Uploads (ADR-011)
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket_cors_configuration" "cors" {
  bucket = aws_s3_bucket.evidence_bucket.id

  cors_rule {
    id              = "DirectClientUploads"
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = [var.frontend_url]
    allowed_headers = [
      "Content-Type",
      "Content-Length",
      "x-amz-*",
      "ETag"
    ]
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3600
  }
}

# ─────────────────────────────────────────────────────────────
# 6. Lifecycle Management: Storage Tiering & Retention Purging
# ─────────────────────────────────────────────────────────────
resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.evidence_bucket.id

  # Evidence Screenshots: Transition to Standard-IA at 30 days, expire at 180 days
  rule {
    id     = "evidence-tiering-and-expiry"
    status = "Enabled"

    filter {
      prefix = "evidence/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = var.evidence_retention_days
    }
  }

  # Evidence Thumbnails: Transition to Standard-IA at 30 days, expire at 180 days
  rule {
    id     = "thumbs-tiering-and-expiry"
    status = "Enabled"

    filter {
      prefix = "thumbs/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = var.evidence_retention_days
    }
  }

  # Abort incomplete multipart uploads after 1 day
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
