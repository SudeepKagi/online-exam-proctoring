# ProctorNet Staging & Production Deployment Checklist (`docs/ops/DEPLOY_CHECKLIST_STAGING.md`)

> **Document Type:** Production Readiness & Infrastructure Specification  
> **Classification:** Confidential — DevOps & Platform Engineering  
> **Target Scope:** AWS EC2 Staging/Production Provisioning, S3 Configuration, GitHub Actions CI/CD Secrets, and Zero-Trust Network Controls  

---

## 1. GitHub Environment Secrets & Variables

Configure these settings under **Settings > Environments > `staging`** (and `production`):

### A. Environment Secrets
| Secret Name | Required Length / Format | Description & Purpose |
|:---|:---|:---|
| `AWS_ROLE_TO_ASSUME` | AWS IAM Role ARN (OIDC) | IAM Role assumed via GitHub OIDC for SSM dispatch (recommended over static keys). |
| `AWS_ACCESS_KEY_ID` | 20 chars alphanumeric | Fallback IAM access key if OIDC is not used. |
| `AWS_SECRET_ACCESS_KEY` | 40 chars base64 | Fallback IAM secret key if OIDC is not used. |
| `AWS_EC2_STAGING_INSTANCE_ID` | `i-[0-9a-f]{17}` | Target EC2 Instance ID hosting the staging stack (e.g. `i-0123456789abcdef0`). |
| `STAGING_POSTGRES_PASSWORD` | ≥ 24 chars hex | High-entropy password for staging PostgreSQL (`openssl rand -hex 24`). |
| `STAGING_REDIS_PASSWORD` | ≥ 24 chars hex | High-entropy password for staging Redis (`openssl rand -hex 24`). |
| `STAGING_RABBITMQ_DEFAULT_PASS` | ≥ 24 chars hex | High-entropy password for staging RabbitMQ (`openssl rand -hex 24`). |
| `STAGING_JWT_SECRET` | ≥ 32 chars hex | Cryptographic signing key for access tokens (`openssl rand -hex 32`). Non-default enforced. |
| `STAGING_JWT_REFRESH_SECRET` | ≥ 32 chars hex | Cryptographic signing key for refresh tokens (`openssl rand -hex 32`). Non-default enforced. |
| `STAGING_SEB_LINK_SECRET` | ≥ 32 chars hex | HMAC key for 10-minute student SEB launch link generation (`openssl rand -hex 32`). |

### B. Environment Variables
| Variable Name | Value | Purpose |
|:---|:---|:---|
| `STAGING_ENABLED` | `true` | Safety circuit breaker. Deployment job skips unless explicitly set to `'true'`. |
| `PUBLIC_HOST` | `staging.proctornet.duckdns.org` | Canonical domain used by Caddy for automatic ACME TLS issuance. |
| `AWS_REGION` | `ap-south-1` | AWS region where EC2 instance and S3 evidence bucket reside. |

---

## 2. Server Environment Configuration (`/opt/proctornet-staging/.env`)

On the dedicated Staging EC2 instance, provision `/opt/proctornet-staging/.env` with strict permissions (`chmod 600 /opt/proctornet-staging/.env`):

```bash
# ==============================================================================
# ProctorNet Staging Environment Configuration (/opt/proctornet-staging/.env)
# ==============================================================================

# Application Environment & Port
NODE_ENV=production
PORT=5000

# Canonical Public Identity (no trailing slash, bare origin)
PUBLIC_HOST=staging.proctornet.duckdns.org
PUBLIC_ORIGIN=https://staging.proctornet.duckdns.org
ALLOWED_ORIGINS=https://staging.proctornet.duckdns.org

# Database Credentials (Isolated Docker internal network)
POSTGRES_USER=proctornet
POSTGRES_PASSWORD=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
POSTGRES_DB=proctornet
DATABASE_URL=postgresql://proctornet:<PASSWORD>@postgres:5432/proctornet?schema=public
DIRECT_URL=postgresql://proctornet:<PASSWORD>@postgres:5432/proctornet?schema=public

# Redis L2 Cache & Socket.io Broker
REDIS_PASSWORD=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
REDIS_URL=redis://:<PASSWORD>@redis:6379

# RabbitMQ Event Broker
RABBITMQ_DEFAULT_USER=proctornet
RABBITMQ_DEFAULT_PASS=<OUTPUT_OF_OPENSSL_RAND_HEX_24>
RABBITMQ_URL=amqp://proctornet:<PASSWORD>@rabbitmq:5672

# Cryptographic Application Secrets (≥ 32 chars, validated at boot)
JWT_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>
JWT_REFRESH_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>
SEB_LINK_SECRET=<OUTPUT_OF_OPENSSL_RAND_HEX_32>

# Safe Exam Browser (SEB) Settings
SEB_MODE=log
SEB_CONFIG_KEY=
SEB_PRE_DOWNLOAD_MINUTES=30

# AWS & Storage Drivers
S3_BUCKET=proctornet-staging-evidence
AWS_REGION=ap-south-1
CACHE_DRIVER=redis
FACE_DRIVER=off
MEDIA_DRIVER=snapshot
COOKIE_SECURE=true
```

---

## 3. AWS S3 Bucket Configuration & Usage Architecture

### A. S3 Bucket Security Settings
- **Bucket Name:** `proctornet-staging-evidence` (or `proctornet-evidence` in prod).
- **Public Access:** **STRICT PRIVATE**. All 4 S3 Block Public Access settings MUST be enabled (`BlockPublicAcls=true`, `IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`). Zero public objects.
- **Default Encryption:** Server-Side Encryption with Amazon S3 managed keys (`SSE-S3` / AES-256).
- **Versioning:** **Enabled**. Prevents deletion or tampering of student evidence.
- **Object Lifecycle:** Auto-transition to S3 Standard-IA after 30 days, Glacier Flexible Retrieval after 90 days, expire after 365 days (per institutional compliance).

### B. S3 Cross-Origin Resource Sharing (CORS)
Required to support direct browser presigned uploads for student onboarding photos and exam snapshots without routing multipart binary blobs through the backend API:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
    "AllowedOrigins": [
      "https://staging.proctornet.duckdns.org",
      "https://proctornet.duckdns.org"
    ],
    "ExposeHeaders": ["ETag", "x-amz-server-side-encryption"],
    "MaxAgeSeconds": 3600
  }
]
```

### C. AWS IAM Actions Required (EC2 Instance Profile)
The EC2 IAM role requires a policy scoped strictly to the bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ProctorNetS3EvidenceAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::proctornet-staging-evidence",
        "arn:aws:s3:::proctornet-staging-evidence/*"
      ]
    }
  ]
}
```

### D. Exactly What S3 is Used For
1. **Student Onboarding Reference Photos:** Captured at registration/profile setup for identity verification.
2. **Student Institutional ID Cards:** Scanned identity credentials uploaded during onboarding.
3. **Periodic Webcam Violation Snapshots:** Presigned upload of periodic visual evidence during live exams (`MEDIA_DRIVER=snapshot`).
4. **Institution-Wide Safe Exam Browser Configs:** Encrypted or signed `.seb` configuration files uploaded by institution administrators (`seb-configs/institution.seb`).

### E. Explicit Production Non-Dependencies (Confirmed)
- **NO LiveKit Dependency:** In production, `MEDIA_DRIVER=snapshot` captures interval snapshots via browser canvas and presigned S3 URLs. LiveKit video rooms are not required or started.
- **NO TURN / STUN Server Dependency:** Video streaming and TURN relays are not deployed; chat and event signaling use WebSockets via Socket.io over Caddy (port 443).
- **NO MinIO Dependency:** Storage connects directly to AWS S3 using AWS SDK v3 (`@aws-sdk/client-s3`). MinIO is used exclusively in local unit test mock adapters.

---

## 4. Domain & DNS Configuration

| Hostname | Type | Target / Value | Purpose |
|:---|:---|:---|:---|
| `staging.proctornet.duckdns.org` | A | Staging EC2 Elastic IP | Public entrypoint for Staging environment |
| `proctornet.duckdns.org` | A | Production EC2 Elastic IP | Public entrypoint for Production environment |

Caddy handles ACME HTTP-01 / TLS-ALPN-01 challenges on port 80/443 automatically and retrieves Let's Encrypt certificates.

---

## 5. AWS Security Group Specification

Security Group `proctornet-staging-sg` (attached to the EC2 instance):

### Inbound Rules
| Port | Protocol | Source | Description |
|:---|:---|:---|:---|
| `80` | TCP | `0.0.0.0/0` | HTTP traffic (ACME challenges & permanent 308 redirect to HTTPS) |
| `443` | TCP | `0.0.0.0/0` | HTTPS traffic (served exclusively by Caddy reverse proxy) |
| `22` | TCP | **None (Closed)** | SSH access is CLOSED. Administration is conducted via AWS SSM Session Manager. |

> [!IMPORTANT]
> **Strict Internal Port Isolation:** Ports `5432` (PostgreSQL), `6379` (Redis), `5672`/`15672` (RabbitMQ), and `5000` (Backend API) have **zero** inbound firewall rules and **zero** published host ports. They communicate exclusively over Docker's internal bridge network.

### Outbound Rules
| Port | Protocol | Destination | Description |
|:---|:---|:---|:---|
| `443` | TCP | `0.0.0.0/0` | Outbound HTTPS for AWS S3 API calls, AWS Systems Manager, GHCR pulls, and ACME certificate renewal. |

---

## 6. AWS Systems Manager (SSM) Deployment Role

Attach an IAM Role with `AmazonSSMManagedInstanceCore` to the EC2 instance:
1. Enables the AWS SSM Agent running inside Amazon Linux / Ubuntu to communicate with the AWS Systems Manager service.
2. Allows GitHub Actions workflow `cd-staging.yml` to dispatch commands (`aws ssm send-command`) to `/opt/proctornet-staging` without opening port 22 or storing static SSH private keys.
3. Enables interactive console debugging via AWS Console Session Manager when needed.
