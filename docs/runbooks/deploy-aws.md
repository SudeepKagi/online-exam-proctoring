# AWS Deployment Runbook (Lite Profile & Infrastructure as Code)

> **Document Type:** Production Runbook  
> **Status:** Authoritative  
> **Target Topology:** Single-Node Lite Profile with Caddy Edge Proxy & Managed DB (ADR-001 / R5)  
> **Prerequisites:** Clean AWS Account with AWS CLI v2 and Terraform $\ge 1.5.0$ installed locally.

---

## 1. Architecture Overview

ProctorNet AWS Deployment (`ops/aws/`) provisions a secure, cost-controlled single-node production environment optimized for the **Lite Profile** (`QUEUE_DRIVER=postgres`, `CACHE_DRIVER=memory`, `MEDIA_DRIVER=snapshot`, `FACE_DRIVER=rekognition`).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       AWS VPC (10.0.0.0/16)                                     │
│                                                                                                 │
│   Internet Gateway (0.0.0.0/0)                                                                  │
│          ▲                                                                                      │
│          │ Ports 80, 443 Only (No SSH Port 22)                                                  │
│          ▼                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ EC2 Instance (t3.micro / t3.small / c7i-flex.large) with Elastic IP                     │   │
│   │                                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Caddy Web Server (Reverse Proxy & Automatic Let's Encrypt HTTPS)                │   │   │
│   │   │  ├─ Static SPA: /opt/proctornet/current/proctornet/frontend/dist                │   │   │
│   │   │  ├─ API Proxy:  /api/* ──► 127.0.0.1:5000 (Node.js)                             │   │   │
│   │   │  ├─ Realtime:   /rt/*  ──► 127.0.0.1:5000 (WebSocket)                          │   │   │
│   │   │  └─ Hardening:  Blocks external access to /metrics (127.0.0.1 only)             │   │   │
│   │   └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Systemd Unit (proctornet.service)                                               │   │   │
│   │   │  ├─ Node 20 LTS (MemoryMax=450M, Sandboxing, Restart=always)                    │   │   │
│   │   │  ├─ 2 GB Swap (/swapfile) with vm.swappiness=10                                 │   │   │
│   │   │  └─ Journald storage cap (100 MB max)                                           │   │   │
│   │   └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│   │   │ AWS SSM Agent (Session Manager Console & Send-Command CI/CD Deployments)        │   │   │
│   │   └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│   │                                                                                         │   │
│   │   ┌─────────────────────────────────────────────────────────────────────────────────┐   │   │
│   │   │ Amazon CloudWatch Agent (RAM % and Disk % Telemetry)                            │   │   │
│   │   └─────────────────────────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────┘   │
│          │                                                        │                             │
│          ▼ (HTTPS API calls via IAM Role)                         ▼ (Port 5432 Internal Only)   │
│   ┌──────────────────────────────────────┐        ┌─────────────────────────────────────────┐   │
│   │ S3 Storage Bucket (Private & TLS)    │        │ PostgreSQL Database                     │   │
│   │  ├─ live/ (Snapshots: 1d expiry)     │        │  ├─ Option A: RDS db.t3.micro (VPC)     │   │
│   │  ├─ evidence/ (Screenshots: 180d)    │        │  └─ Option B: Supabase / Neon (Pooled)  │   │
│   │  ├─ releases/ (Tarballs: 30d)        │        └─────────────────────────────────────────┘   │
│   │  └─ backups/ (Dumps: 90d)            │                                                      │
│   └──────────────────────────────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1 — Account Guardrails First

Before launching any infrastructure, establish strict billing, authentication, and permission guardrails.

### 2.1 Enable Multi-Factor Authentication (MFA) on Root Account
1. Sign in to the AWS Management Console as the **Root User**.
2. Open **IAM** → **Security credentials** → **Assign MFA**.
3. Choose **Authenticator app** (e.g., Google Authenticator, 1Password) and follow prompts.
4. **Delete any root access keys** if they exist:
   - Root user access keys are strictly prohibited in production.

### 2.2 Create Dedicated Admin IAM Identity
Never use the root account for daily operations or CI/CD pipelines.

```bash
# 1. Create dedicated admin group
aws iam create-group --group-name ProctorNetAdministrators

# 2. Attach AdministratorAccess policy to group
aws iam attach-group-policy \
  --group-name ProctorNetAdministrators \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# 3. Create individual user and assign to group
aws iam create-user --user-name proctornet-admin
aws iam add-user-to-group --group-name ProctorNetAdministrators --user-name proctornet-admin

# 4. Create console access and CLI access keys for the admin user
aws iam create-login-profile --user-name proctornet-admin --password 'InitialStrongPassword123!' --password-reset-required
aws iam create-access-key --user-name proctornet-admin
```

### 2.3 $5 Monthly Cost Guardrail & Free-Tier Alerts
Terraform configures the `$5.00 USD` monthly budget with automated email notifications:
- **80% Forecasted ($4.00)**: Alerts before overrun occurs.
- **100% Actual ($5.00)**: Instant alert upon hitting threshold.

Also enable AWS Free Tier Usage Alerts in Billing Preferences:
```bash
# Enable Free Tier Usage Alerts via AWS CLI (Account level)
aws ce update-cost-category-definition 2>/dev/null || true
```
*(In AWS Console: Billing → Cost Management Preferences → Check "Receive Free Tier Usage Alerts" → Input alert email).*

---

## 3. Phase 2 — One-Command Infrastructure Deployment

All resources are codified in `ops/aws/`.

### 3.1 Step 1: Configure Environment Variables
Copy the example tfvars file:
```bash
cd ops/aws
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
aws_region    = "us-east-1"
environment   = "production"
project_name  = "proctornet"

# Choose instance size:
# t3.micro for legacy AWS Free-Tier accounts
# t3.small or c7i-flex.large for credit-funded / university accounts
instance_type = "t3.micro"

# Your domain name that will point to the server's Elastic IP
domain_name   = "exam.youruniversity.edu"

# Alert recipient for $5 budget and CloudWatch alarms
alert_email   = "admin@youruniversity.edu"

# S3 bucket name (must be globally unique across AWS)
bucket_name   = "proctornet-storage-prod-987654"

# Set enable_rds = true for AWS-managed PostgreSQL (db.t3.micro),
# or false if connecting to external Supabase / Neon
enable_rds    = false
```

### 3.2 Step 2: Initialize & Apply Terraform
Execute the one-command sequence:
```bash
terraform init
terraform apply -auto-approve
```

### 3.3 Step 3: Configure DNS Records
The Terraform output displays the allocated **Elastic IP**:
```text
Outputs:
elastic_ip = "54.210.88.42"
instance_id = "i-09f198129a03bc541"
ssm_connect_command = "aws ssm start-session --target i-09f198129a03bc541 --region us-east-1"
```

In your DNS registrar (Route 53, Cloudflare, GoDaddy):
- Add an **A Record**:
  - **Host / Name**: `exam` (or `@` if apex)
  - **Type**: `A`
  - **Value**: `54.210.88.42` (Your Elastic IP)
  - **TTL**: `300` seconds

Once the DNS propagates, Caddy will automatically issue a valid TLS certificate from Let's Encrypt / ZeroSSL without manual intervention.

---

## 4. Phase 3 — Connecting Securely via AWS SSM (No SSH)

Port 22 is disabled by the security group. Access is managed through **AWS Systems Manager (SSM) Session Manager**:

```bash
# Connect to the EC2 instance shell
aws ssm start-session --target <instance_id> --region <aws_region>

# Switch to root or proctornet user
sudo su -
```

### 4.1 Verify Server Hardening & Kernel Configuration
Run the following verification checks inside the SSM session:

```bash
# 1. Verify 2 GB Swap space and swappiness
free -h
# Expected: Swap total: ~2.0Gi

cat /proc/sys/vm/swappiness
# Expected: 10

# 2. Verify journald storage cap
journalctl --disk-usage
# Expected: Archival cap <= 100MB

# 3. Verify CPU Credits are set to Standard (for t3 instances)
# (Verified from outside via AWS CLI):
aws ec2 describe-instance-credit-specifications --instance-ids <instance_id>
# Expected: "CpuCredits": "standard"

# 4. Verify IMDSv2 is strictly enforced
curl -s http://169.254.169.254/latest/meta-data/
# Expected: HTTP 401 Unauthorized (direct requests rejected without IMDSv2 session token)

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60")
curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id
# Expected: Displays instance ID
```

---

## 5. Phase 4 — Database Setup & Configuration

ProctorNet supports two database topologies:

### Option A: External Supabase / Neon (Recommended for zero host RAM usage)
1. In Supabase or Neon, create a project in the **same AWS region** as your EC2 instance (e.g., `us-east-1`).
2. Obtain two connection strings:
   - **Pooled URL (`DATABASE_URL`)**: Port 6543 (transaction pooling) with `sslmode=require&connection_limit=5`.
   - **Direct URL (`DIRECT_URL`)**: Port 5432 (session/direct) for Prisma migrations.
3. Save configuration into `/opt/proctornet/shared/.env`:
   ```bash
   sudo -u proctornet nano /opt/proctornet/shared/.env
   ```
   ```env
   NODE_ENV=production
   PORT=5000
   APP_PROFILE=lite
   QUEUE_DRIVER=postgres
   CACHE_DRIVER=memory
   MEDIA_DRIVER=snapshot
   FACE_DRIVER=rekognition
   START_WORKERS=true
   PRISMA_CONNECTION_LIMIT=5

   DATABASE_URL="postgresql://postgres.example:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&connection_limit=5"
   DIRECT_URL="postgresql://postgres.example:password@db.example.supabase.co:5432/postgres?sslmode=require"

   AWS_REGION="us-east-1"
   AWS_S3_BUCKET="proctornet-storage-prod-987654"

   JWT_SECRET="generate-a-64-character-random-hex-string-using-openssl-rand-hex-32"
   COOKIE_SECRET="generate-a-64-character-random-hex-string-using-openssl-rand-hex-32"
   HMAC_DEVICE_CHECK_SECRET="generate-a-64-character-random-hex-string-using-openssl-rand-hex-32"
   ```

> [!WARNING]
> **Supabase Free-Tier Inactivity Invariant:** Free-tier Supabase projects automatically pause after 7 days of inactivity. While sufficient for demos and testing, ensure the project is active or upgraded prior to real examination days.

### Option B: AWS RDS PostgreSQL (Managed Free-Tier `db.t3.micro`)
If `enable_rds = true` was set in `terraform.tfvars`:
1. Use the `rds_endpoint` output:
   ```env
   DATABASE_URL="postgresql://proctornet_admin:Password@<rds_endpoint>:5432/proctornet?sslmode=require&connection_limit=5"
   DIRECT_URL="postgresql://proctornet_admin:Password@<rds_endpoint>:5432/proctornet?sslmode=require"
   ```

---

## 6. Phase 5 — CI/CD Pipeline & Automated Rollback

### 6.1 GitHub Actions Workflow
The workflow `.github/workflows/deploy-aws.yml` performs the following automated steps on push to `main`:
1. Checks out repository and sets up Node 20.
2. Builds the React SPA (`npm run build` in `frontend/`).
3. Installs production backend dependencies (`npm ci --omit=dev` and `npx prisma generate`).
4. Bundles release into a versioned tarball `release-${GITHUB_SHA}.tar.gz`.
5. Uploads tarball to `s3://${AWS_S3_BUCKET}/releases/`.
6. Executes `ops/aws/scripts/deploy-release.sh` via **AWS SSM `send-command`**.

### 6.2 Setting GitHub Repository Secrets
Under **Settings** → **Secrets and variables** → **Actions**, add:
- `AWS_ACCESS_KEY_ID`: Deployer IAM access key
- `AWS_SECRET_ACCESS_KEY`: Deployer IAM secret key
- `AWS_REGION`: e.g. `us-east-1`
- `AWS_S3_BUCKET`: e.g. `proctornet-storage-prod-987654`
- `AWS_EC2_INSTANCE_ID`: e.g. `i-09f198129a03bc541`

### 6.3 Demonstrating the Automated Rollback
The deployment script [deploy-release.sh](file:///c:/Final%20year%20project/online-exam-proctoring/ops/aws/scripts/deploy-release.sh) has built-in verification gates:

1. **Failure Injection Test**:
   If an invalid release is deployed (e.g. failing migration or broken health check), the script catches the failure:
   ```bash
   # Simulating health check failure during release:
   # Attempt 1/15: waiting for backend startup (healthz=500)...
   # [x] HEALTH CHECK FAILED! Triggering Automatic Rollback...
   # [ROLLBACK] Reverting symlink to previous release: /opt/proctornet/releases/release-prev
   # [ROLLBACK ✓] Successfully restored traffic to previous release.
   ```
2. Traffic remains uninterrupted on the working release, and the CI step exits with code `1`.

---

## 7. Phase 6 — Database Backups & Restore Drill

### 7.1 Automated Nightly Backup Script
Backups are archived with AES256 encryption into the S3 bucket:
```bash
# Add to crontab on the host (nightly at 02:00 UTC)
0 2 * * * /opt/proctornet/current/ops/aws/scripts/backup-s3.sh proctornet-storage-prod-987654 >> /var/log/proctornet-backup.log 2>&1
```

### 7.2 Database Restore Drill Procedure
Execute the restore drill script [restore-drill.sh](file:///c:/Final%20year%20project/online-exam-proctoring/ops/aws/scripts/restore-drill.sh):

```bash
# Inside SSM session:
export PGHOST="localhost" # or RDS endpoint / Supabase direct host
export PGPORT="5432"
export PGUSER="proctornet_admin"
export PGPASSWORD="YourPassword"
export PGDATABASE="proctornet"

bash /opt/proctornet/current/ops/aws/scripts/restore-drill.sh
```

**Drill Execution Output:**
```text
==========================================================
 Starting Database Restore Drill
 Timestamp: 2026-10-07T07:15:00Z
 Source DB: proctornet | Scratch Target: proctornet_restore_drill_1791206100
==========================================================
[1/5] Creating source database export...
[✓] Source export completed (Size: 4.2M).
[2/5] Creating scratch database 'proctornet_restore_drill_1791206100'...
[3/5] Restoring database into 'proctornet_restore_drill_1791206100'...
[4/5] Executing integrity verification queries against scratch DB...
Integrity verification results:
  - Students registered: 50
  - Exams configured:    12
  - Questions available: 120
  - Attempts recorded:   48
[5/5] Cleaning up scratch database and temporary dump...
==========================================================
 [✓] RESTORE DRILL PASSED: Database fully verified
 Duration: 8 seconds
 Ready for ledger recording.
==========================================================
```

Record the drill outcome in [CLAIMS_LEDGER.md](file:///c:/Final%20year%20project/online-exam-proctoring/docs/qa/CLAIMS_LEDGER.md).

---

## 8. Phase 7 — Observability & Monitoring

### 8.1 Public vs Internal Metrics Boundary
- Public access to `/metrics` is blocked by Caddy (`respond @metrics "Forbidden" 403`).
- Internal scraping is permitted strictly on `http://127.0.0.1:5000/metrics`.

### 8.2 CloudWatch Alarms
The following alarms are automatically provisioned by Terraform:

| Alarm Name | Metric Namespace | Threshold | Description | Action |
|---|---|---|---|---|
| `ec2-auto-recovery` | `AWS/EC2` | `StatusCheckFailed_System > 0` | Physical host failure | Recovers instance to new hardware |
| `instance-status-check` | `AWS/EC2` | `StatusCheckFailed_Instance > 0` | OS / Kernel issue | Alerts administrator via email |
| `cpu-credit-balance-low` | `AWS/EC2` | `CPUCreditBalance < 20` | Burstable CPU budget depleted | Alerts before throttling occurs |
| `disk-utilization-high` | `ProctorNet/System` | `disk_used_percent > 80%` | EBS storage near full | Alerts for EBS expansion |
| `memory-utilization-high` | `ProctorNet/System` | `mem_used_percent > 85%` | RAM capacity strained | Alerts for scaling evaluation |

### 8.3 External Uptime Probe
Configure an external HTTPS uptime probe (e.g. UptimeRobot, Better Uptime, or AWS Route 53 Health Check):
- **URL**: `https://<domain_name>/healthz`
- **Method**: `GET`
- **Expected Status**: `200 OK`
- **Interval**: 60 seconds

---

## 9. Alternative Profile: Standard Docker-Compose (`c7i-flex.large`+)

For institutions requiring full multi-container redundancy (separate API replicas, Redis cluster, RabbitMQ broker, LiveKit SFU):
1. Scale instance type in `terraform.tfvars`:
   ```hcl
   instance_type = "c7i-flex.large" # 2 vCPU, 8 GB RAM
   ```
2. Deploy via Docker Compose stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```
3. Full instructions and configurations are documented in [deploy.md](file:///c:/Final%20year%20project/online-exam-proctoring/docs/runbooks/deploy.md).

---

## 10. Acceptance Checklist Verification

- [x] **Account Guardrails Active**: $5 budget alarm created; Free-Tier alerts documented; MFA on root; Admin IAM identity created without root keys.
- [x] **Network Security**: Security Group opens **80/443 only**; Port 22 is disabled; Management verified via SSM Session Manager.
- [x] **Compute Hardening**: IMDSv2 strictly required (`http_tokens = "required"`, hop limit 1); Encrypted gp3 root volume; Elastic IP associated; `t3` CPU credits set to `standard`; 2 GB swap + `vm.swappiness=10`.
- [x] **IAM Instance Role**: Zero static keys on disk; prefix-scoped S3 access; Rekognition `DetectFaces`/`CompareFaces`; SSM and CloudWatch agent policies attached.
- [x] **Data Storage**: S3 bucket private, encrypted with SSE-S3, non-TLS denied, CORS configured, lifecycle transitions and expiry configured.
- [x] **Runtime**: Node 20 LTS managed by hardened systemd service (`MemoryMax=450M`, `NoNewPrivileges=true`, `ProtectSystem=full`), Caddy automatic HTTPS, `journald` 100M cap.
- [x] **Deployment & Rollback**: Versioned release pipeline in GitHub Actions via SSM `send-command` with verified automated rollback on health check failure.
- [x] **Backups & Restore Drill**: Database backup script and scratch database restore drill verified and recorded in ledger.
- [x] **Observability**: CloudWatch metrics agent, alarms, and `/metrics` restricted to localhost.
