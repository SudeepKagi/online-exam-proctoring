# ProctorNet Cloud Infrastructure (AWS Terraform Skeleton)

## 1. Overview

This Terraform skeleton provisions a hardened single-node production deployment on AWS for ProctorNet, aligning with **ADR-001 (Single-Node Topology with Horizontal-Ready Boundaries)** and **Phase P9**.

### Architecture Components
- **Dedicated VPC**: Isolated CIDR (`10.0.0.0/16`) with public and private routing tables.
- **Edge Security Group**: Allows ingress only on ports 80/443 (Web) and 7880–7882/3478/5349 (LiveKit SFU). All internal database ports (5432, 6379, 5672) are strictly unreachable from the internet.
- **Compute Sizing**:
  - `c6i.2xlarge` (8 vCPU / 16 GB RAM) compute-optimized instance.
  - EBS gp3 100 GB root volume with provisioned 3,000 IOPS and 125 MB/s throughput for fast PostgreSQL WAL flushes.
- **IAM Instance Profile**: Eliminates static AWS credentials. Provides scoped access to S3 evidence buckets, AWS Secrets Manager / Parameter Store, and CloudWatch metrics.
- **S3 Evidence Bucket**: Encrypted with SSE-S3, public access blocked, CORS enabled for browser uploads, and 90-day lifecycle rule.
- **CloudWatch Telemetry**: Automated alarms for high CPU and system failure.

---

## 2. Cost Discipline Protocol

> *"Create → Test → Measure → Destroy"*

Running cloud environments without disciplined lifecycle management generates unnecessary operational expenditure. In benchmarking, load testing, or non-exam periods, strictly follow this protocol:

1. **Create (`terraform apply`)**:
   - Provision isolated environment for validation or the examination window:
     ```bash
     terraform init
     terraform apply -var-file="terraform.tfvars" -auto-approve
     ```
2. **Test & Verify**:
   - Deploy container stack via Docker Compose (`docker compose -f docker-compose.prod.yml up -d`).
   - Execute smoke tests and validation checks.
3. **Measure & Profile**:
   - Run k6 load simulation.
   - Capture Prometheus metrics, CloudWatch metrics, and pg_stat_statements query profiles.
   - Export analysis artifacts to `reports/`.
4. **Destroy (`terraform destroy`)**:
   - After testing or when examination sessions conclude, tear down all provisioned resources:
     ```bash
     terraform destroy -var-file="terraform.tfvars" -auto-approve
     ```
   - Retains S3 snapshots if `force_destroy = false`, ensuring no accidental evidence data loss while reducing active compute costs to $0.
