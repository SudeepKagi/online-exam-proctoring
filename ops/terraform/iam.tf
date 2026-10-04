# ==============================================================================
# IAM Instance Role & Policy Configuration (Phase P9 Task 3 & 9)
# Eliminates static AWS credentials on the instance; uses IAM Instance Profile
# ==============================================================================

resource "aws_iam_role" "instance_role" {
  name = "proctornet-${var.environment}-instance-role"

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
    Name = "proctornet-${var.environment}-instance-role"
  }
}

resource "aws_iam_policy" "proctornet_policy" {
  name        = "proctornet-${var.environment}-policy"
  description = "Scoped policy for S3 evidence access, Secrets Manager, and CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Scoped S3 Object Storage Access (Evidence & Identity Snapshots)
      {
        Sid    = "S3EvidenceBucketAccess"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.evidence.arn,
          "${aws_s3_bucket.evidence.arn}/*"
        ]
      },
      # AWS Systems Manager & Secrets Manager Access
      {
        Sid    = "SSMParametersAccess"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/proctornet/${var.environment}/*",
          "arn:aws:secretsmanager:${var.aws_region}:*:secret:proctornet/${var.environment}/*"
        ]
      },
      # CloudWatch Agent Logging & Metrics Publishing
      {
        Sid    = "CloudWatchAgentPolicy"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "proctornet_attach" {
  role       = aws_iam_role.instance_role.name
  policy_arn = aws_iam_policy.proctornet_policy.arn
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "instance_profile" {
  name = "proctornet-${var.environment}-instance-profile"
  role = aws_iam_role.instance_role.name
}
