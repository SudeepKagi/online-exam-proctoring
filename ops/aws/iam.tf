# ─────────────────────────────────────────────────────────────
# IAM Instance Role & Policy (Zero Static Secrets)
# ─────────────────────────────────────────────────────────────

resource "aws_iam_role" "ec2_role" {
  name = "${var.project_name}-ec2-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ec2-role"
  }
}

# Attach AWS Managed Policy: AmazonSSMManagedInstanceCore (Enables SSM Session Manager)
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Attach AWS Managed Policy: CloudWatchAgentServerPolicy (Enables CloudWatch Agent metrics/logs)
resource "aws_iam_role_policy_attachment" "cloudwatch_agent" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Custom Scoped Policy: S3 Prefix-Scoped Access + Rekognition Detect/Compare Faces
resource "aws_iam_policy" "app_scoped_policy" {
  name        = "${var.project_name}-app-scoped-policy"
  description = "Scoped permissions for S3 storage prefixes, Rekognition, and Parameter Store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # S3 Object Operations scoped strictly to required prefixes
      {
        Sid    = "AllowS3ObjectOperationsOnWhitelistedPrefixes"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.evidence_bucket.arn}/evidence/*",
          "${aws_s3_bucket.evidence_bucket.arn}/identity/*",
          "${aws_s3_bucket.evidence_bucket.arn}/thumbs/*",
          "${aws_s3_bucket.evidence_bucket.arn}/live/*",
          "${aws_s3_bucket.evidence_bucket.arn}/questions/*",
          "${aws_s3_bucket.evidence_bucket.arn}/releases/*",
          "${aws_s3_bucket.evidence_bucket.arn}/backups/*"
        ]
      },
      # S3 Bucket Listing with prefix filter condition
      {
        Sid    = "AllowS3ListBucketWithPrefixRestriction"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.evidence_bucket.arn
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "evidence/*",
              "identity/*",
              "thumbs/*",
              "live/*",
              "questions/*",
              "releases/*",
              "backups/*"
            ]
          }
        }
      },
      # Rekognition: Biometric verification (DetectFaces, CompareFaces only)
      {
        Sid    = "AllowRekognitionFacialOperations"
        Effect = "Allow"
        Action = [
          "rekognition:DetectFaces",
          "rekognition:CompareFaces"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_scoped_attachment" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = aws_iam_policy.app_scoped_policy.arn
}

resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.project_name}-ec2-instance-profile"
  role = aws_iam_role.ec2_role.name
}
