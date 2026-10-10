# Production Rollout & Remediation Runbook (`p9-rollout.md`)

> **Protocol Reference (§6):** Standard operating procedure for deploying Phase P9 releases to production AWS EC2 (`ap-south-1`). All operations are performed exclusively via the GitHub Actions deployment pipeline or AWS Systems Manager (SSM) Session Manager. Never run manual SSH or direct mutating commands without dry-run validation.

---

## 1. Safety Rules & Pre-Flight Checks

1. **Zero Destructive Actions:** Never run raw SQL `DROP`, `TRUNCATE`, or unconstrained `DELETE`.
2. **SSM Execution Only:** Direct SSH (port 22) is permanently disabled. All instance commands use AWS SSM Session Manager (`aws ssm send-command`).
3. **Dry-Run by Default:** Operational remediation scripts run in read-only dry-run mode unless explicitly passed `--apply`.
4. **Exam-Aware Deployment Gate:** The deployment pipeline will automatically refuse to deploy if any exam attempts are in `ACTIVE` state (exit code 3).

---

## 2. Step-by-Step Rollout Procedure

### Step 1: Deploy Release via GitHub Actions
Deployments are initiated automatically upon merge to `main` following successful CI/CD pipeline execution (`ProctorNet CI/CD Pipeline` green on `ci-gate`), or manually via workflow dispatch:

```bash
gh workflow run "Deploy to AWS (Production Release)" --ref main
```

Monitor execution:
```bash
gh run watch
```

---

### Step 2: Replay Failed Outbox Events (Remediation for F1)

Due to F1 on earlier commits, events produced with `QUEUE_DRIVER=postgres` ended in `status='FAILED'`. Once the fix release is active, replay these events to evaluate grading and violation evidence.

#### 2.1 Dry-Run (Inspect Counts & Types)
Run the dry-run command via SSM to inspect failed events:

```bash
INSTANCE_ID="i-0858109978489" # or $(aws ec2 describe-instances --filters "Name=tag:Project,Values=proctornet" --query "Reservations[0].Instances[0].InstanceId" --output text)

aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "P9 F1: Replay Failed Outbox (Dry-Run)" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/replay-failed-outbox.js"]}' \
  --output text
```

#### 2.2 Mutating Apply (Reset to PENDING)
Once counts are confirmed, reset the failed events:

```bash
aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "P9 F1: Replay Failed Outbox (Apply)" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/replay-failed-outbox.js --apply"]}' \
  --output text
```

---

### Step 3: Backfill Terminal Attempt Results (Remediation for F2 & F3)

Idempotently evaluates any past attempts in `SUBMITTED`, `EXPIRED`, or `TERMINATED` that missed evaluation:

#### 3.1 Dry-Run
```bash
aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "P9 F2/F3: Backfill Unevaluated Terminal Results (Dry-Run)" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/backfill-expired-results.js"]}' \
  --output text
```

#### 3.2 Mutating Apply
```bash
aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "P9 F2/F3: Backfill Unevaluated Terminal Results (Apply)" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/backfill-expired-results.js --apply"]}' \
  --output text
```

---

### Step 4: Administrator Default Credentials Audit (F5)

Execute the read-only security audit to confirm no administrator accounts match known default passwords:

```bash
aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "P9 F5: Check Default Administrator Credentials" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/check-default-credentials.js"]}' \
  --output text
```

*Expected Exit Code:* `0` (`[PASS] All administrator account(s) verified clean.`)  
*If Exit Code is 1:* An admin is using a default password. Rotate immediately via SSM.

---

### Step 5: Post-Deployment Health & Invariant Verification

#### 5.1 Read-Only Production Smoke Verification
Runs synthetic read-only HTTP/HTTPS probes against the production domain:

```bash
node scripts/ops/production-smoke.js
```

#### 5.2 Outbox & Invariants Health Check via SSM
Asserts that outbox failed events = 0, stale pending events = 0, and unevaluated terminal attempts = 0:

```bash
aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --comment "Post-Deployment Invariant Health Gate" \
  --parameters '{"commands": ["cd /opt/proctornet/current && node scripts/ops/outbox-health.js"]}' \
  --output text
```

---

### Step 6: Optional Isolated Canary Run (`prod-canary`)

To run an end-to-end synthetic assessment against the live production environment using isolated `canary-*` accounts:

```bash
gh workflow run "Production Canary Assessment" \
  --ref main \
  -f confirm="I-UNDERSTAND"
```

The canary test runs a 3-minute exam, validates scoring, and purges only the temporary `canary-*` database records.
