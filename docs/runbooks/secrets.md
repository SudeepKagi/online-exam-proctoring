# Runbook: Managing & Rotating Production Secrets via AWS SSM Parameter Store

> **Security Rule:** Never paste production API keys, database credentials, or tokens into agent chats, git commits, or CI/CD logs. All production secrets are managed exclusively through **AWS SSM Parameter Store (SecureString)** and fetched on EC2 at runtime via tmpfs.

---

## 1. Parameter Hierarchy

ProctorNet production parameters are organized under the `/proctornet/prod/` path:

| Parameter Name | Type | Description |
| :--- | :--- | :--- |
| `/proctornet/prod/LLM_PROVIDER` | `String` | Provider identifier: `openai`, `google`, `anthropic`, or `none` |
| `/proctornet/prod/LLM_API_KEY` | `SecureString` | Production API key for the LLM provider |
| `/proctornet/prod/LLM_MODEL` | `String` | Model identifier (e.g., `gemini-1.5-flash`, `gpt-4o-mini`) |
| `/proctornet/prod/DATABASE_URL` | `SecureString` | Production PostgreSQL connection string |
| `/proctornet/prod/JWT_SECRET` | `SecureString` | Primary JWT signing secret |
| `/proctornet/prod/AUTH_EPOCH` | `String` | Global authentication epoch counter (integer) |

---

## 2. Setting or Updating Secrets (Human Operator Only)

Run these commands using the authenticated AWS CLI with appropriate IAM permissions on your terminal:

### 2.1 Set LLM Provider and Model
```bash
# Set LLM Provider (openai | google | anthropic | none)
aws ssm put-parameter \
  --name "/proctornet/prod/LLM_PROVIDER" \
  --value "google" \
  --type "String" \
  --overwrite \
  --region ap-south-1

# Set Model Name
aws ssm put-parameter \
  --name "/proctornet/prod/LLM_MODEL" \
  --value "gemini-1.5-flash" \
  --type "String" \
  --overwrite \
  --region ap-south-1
```

### 2.2 Store Secret API Key (SecureString)
```bash
# Securely prompt for the key without echoing to shell history:
read -s -p "Enter LLM API Key: " LLM_KEY
echo ""

aws ssm put-parameter \
  --name "/proctornet/prod/LLM_API_KEY" \
  --value "$LLM_KEY" \
  --type "SecureString" \
  --overwrite \
  --region ap-south-1

unset LLM_KEY
```

---

## 3. Secret Rotation Procedure

### 3.1 LLM Key Rotation
1. Generate a new API key in the provider console (Google AI Studio / OpenAI / Anthropic).
2. Execute the `put-parameter` command above with `--overwrite`.
3. Reload the application service on the EC2 instance via AWS SSM:
   ```bash
   aws ssm send-command \
     --instance-ids "<EC2_INSTANCE_ID>" \
     --document-name "AWS-RunShellScript" \
     --parameters commands='["systemctl restart proctornet"]' \
     --region ap-south-1
   ```
4. Verify `/api/v1/health` reports status `UP`.
5. Revoke the old API key in the provider console.

### 3.2 Database Credentials Rotation
1. Rotate database password in RDS / managed PostgreSQL.
2. Update `/proctornet/prod/DATABASE_URL` via `aws ssm put-parameter --type SecureString --overwrite`.
3. Restart `proctornet.service`.

### 3.3 JWT Secret Rotation & Epoch Bump
1. Generate new 64-byte random string (`openssl rand -hex 64`).
2. Update `/proctornet/prod/JWT_SECRET`.
3. Increment `/proctornet/prod/AUTH_EPOCH` (invalidates all outstanding JWTs across all sessions).
4. Restart `proctornet.service`.

---

## 4. Verification (Zero Leaks)

Verify parameter presence and metadata **without decrypting** values:
```bash
aws ssm describe-parameters \
  --parameter-filters "Key=Name,Option=BeginsWith,Values=/proctornet/prod/" \
  --region ap-south-1 \
  --query "Parameters[*].[Name,Type,LastModifiedDate,Version]" \
  --output table
```
