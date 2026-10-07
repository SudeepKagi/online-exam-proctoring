# ─────────────────────────────────────────────────────────────
# Authoritative S3 Bucket: Private, Encrypted, TLS-Enforced
# ─────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "evidence_bucket" {
  bucket        = var.bucket_name
  force_destroy = false

  tags = {
    Name        = "ProctorNet Storage Bucket"
    Environment = var.environment
  }
}

# 1. Block All Public Access
resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.evidence_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. Server-Side Encryption (SSE-S3 / AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "encryption" {
  bucket = aws_s3_bucket.evidence_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# 3. Bucket Policy: Enforce TLS & Deny Plaintext HTTP Requests
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

# 4. Strict CORS Configuration for Direct Browser Uploads
resource "aws_s3_bucket_cors_configuration" "cors" {
  bucket = aws_s3_bucket.evidence_bucket.id

  cors_rule {
    id              = "DirectClientUploads"
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = [
      "https://${var.domain_name}",
      "http://${var.domain_name}",
      "http://localhost:5173"
    ]
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

# 5. Lifecycle Rules (Live 1d, Evidence 180d, Releases 30d, Multipart 1d)
resource "aws_s3_bucket_lifecycle_configuration" "lifecycle" {
  bucket = aws_s3_bucket.evidence_bucket.id

  # Transient live snapshots expire after 1 day
  rule {
    id     = "live-snapshots-1day-expiry"
    status = "Enabled"

    filter {
      prefix = "live/"
    }

    expiration {
      days = 1
    }
  }

  # Evidence Screenshots: Standard-IA at 30 days, expire at 180 days
  rule {
    id     = "evidence-retention-and-tiering"
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

  # Evidence Thumbnails: Standard-IA at 30 days, expire at 180 days
  rule {
    id     = "thumbs-retention-and-tiering"
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

  # Automated Database Backups: Standard-IA at 30 days, expire at 90 days
  rule {
    id     = "backups-retention"
    status = "Enabled"

    filter {
      prefix = "backups/"
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 90
    }
  }

  # Versioned Deploy Tarballs: Expire after 30 days
  rule {
    id     = "releases-expiry"
    status = "Enabled"

    filter {
      prefix = "releases/"
    }

    expiration {
      days = 30
    }
  }

  # Abort incomplete multipart uploads after 1 day
  rule {
    id     = "abort-incomplete-multipart"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
