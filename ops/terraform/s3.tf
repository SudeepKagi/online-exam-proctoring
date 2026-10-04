# ==============================================================================
# S3 Object Storage Architecture (Phase P9 Task 9)
# Encrypted Evidence Bucket, Public Access Block, CORS, & 90-Day Retention
# ==============================================================================

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "evidence" {
  bucket        = "proctornet-${var.environment}-evidence-${random_id.bucket_suffix.hex}"
  force_destroy = false

  tags = {
    Name = "proctornet-${var.environment}-evidence"
  }
}

# Block all public access (zero public read/write)
resource "aws_s3_bucket_public_access_block" "evidence_block" {
  bucket = aws_s3_bucket.evidence.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-Side Encryption at Rest (SSE-S3 default)
resource "aws_s3_bucket_server_side_encryption_configuration" "evidence_encryption" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CORS Rule for Direct Browser Presigned POST & GET Previews
resource "aws_s3_bucket_cors_configuration" "evidence_cors" {
  bucket = aws_s3_bucket.evidence.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = [
      "https://exam.university.edu",
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ]
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3600
  }
}

# Automated Lifecycle Rule: Archive to Glacier after 30 days, expire after 90 days
resource "aws_s3_bucket_lifecycle_configuration" "evidence_lifecycle" {
  bucket = aws_s3_bucket.evidence.id

  rule {
    id     = "auto-archive-and-expire-evidence"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "GLACIER"
    }

    expiration {
      days = 90
    }

    noncurrent_version_expiration {
      noncurrent_days = 14
    }
  }
}
