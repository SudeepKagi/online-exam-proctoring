# ProctorNet Environment Variables & Configuration Reference (`VARIABLES.md`)

This document is the authoritative, code-audited inventory of all environment variables across ProctorNet. Every variable has been verified against backend source code (`backend/src/`), frontend source code (`frontend/src/`), operations scripts (`scripts/ops/`), E2E test suites (`e2e/`), Docker Compose files (`docker-compose.prod.yml`, `docker-compose.yml`), and GitHub Actions workflows (`.github/workflows/`).

---

## 1. Grouped Variable Classifications

ProctorNet categorizes all variables into seven distinct operational groups:

| Group | Category | Management Strategy | Example Names |
| :--- | :--- | :--- | :--- |
| **Group A** | **Generated on Server** | Cryptographically generated with `crypto.randomBytes`; never printed to terminal or committed to git. | `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SEB_LINK_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `RABBITMQ_DEFAULT_PASS`, `PII_ENCRYPTION_KEY` |
| **Group B** | **Decide Yourself** | Institutional and architectural policy parameters decided by the engineering administrator. | `PUBLIC_ORIGIN`, `PUBLIC_HOST`, `RETENTION_DAYS`, `SEB_MODE`, `COOKIE_SECURE`, `COOKIE_SAMESITE`, `CACHE_DRIVER`, `MEDIA_DRIVER`, `FACE_DRIVER` |
| **Group C** | **Get from AWS** | Cloud infrastructure identifiers obtained from AWS Console, IAM, or Terraform/CloudFormation outputs. | `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ROLE_TO_ASSUME`, `AWS_EC2_STAGING_INSTANCE_ID` |
| **Group D** | **SEB Config Tool / Admin** | Safe Exam Browser integrity key generated when saving a `.seb` configuration bundle. | `SEB_CONFIG_KEY` |
| **Group E** | **GitHub-Only CI/CD** | Pipeline authorization tokens and branch deployment flags stored in GitHub Actions Environments. | `PROD_CD_ENABLED`, `STAGING_ENABLED`, `GITHUB_TOKEN` |
| **Group F** | **Frontend Build-Time** | Client-side variables prefixed with `VITE_` bundled into JavaScript assets at build time. | `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_SUPPORT_EMAIL`, `VITE_SUPPORT_URL`, `VITE_SEB_DOWNLOAD_URL`, `VITE_SEB_QUIT_URL` |
| **Group G** | **Forbidden in Production** | Debug flags, mock drivers, and bypass switches that MUST NEVER be enabled in staging or production. | `SEB_DEBUG_LOG_HASHES`, `S3_MOCK`, `DISABLE_RATE_LIMIT`, `LOADTEST`, `LOADTEST_ALLOW`, `ALLOW_CONFIG_THROW_FOR_TEST` |

---

## 2. Complete Code-Audited Variable Inventory

| Variable Name | Used By (Code Files) | Needed In | Default | Kind | Exact Storage Location | How to Obtain / Configure | Validation Rule | Impact if Missing or Wrong | Example Format (Non-Secret) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`JWT_SECRET`** | `backend/src/shared/config.js`<br>`backend/src/shared/validateConfig.js`<br>`backend/src/utils/jwt.js` | Local, CI, Staging, Prod | None in Prod | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(32).toString('hex')` | String length >= 32; must NOT match `KNOWN_DEFAULTS` | Server aborts at startup with exit code 1; cannot sign session tokens | `a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90` |
| **`JWT_REFRESH_SECRET`** | `backend/src/shared/config.js`<br>`backend/src/shared/validateConfig.js`<br>`backend/src/modules/auth/auth.service.js` | Staging, Prod | None in Prod | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(32).toString('hex')` | String length >= 32; must NOT match `KNOWN_DEFAULTS` | Server aborts at startup with exit code 1; silent token refresh fails mid-exam | `b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1` |
| **`SEB_LINK_SECRET`** | `backend/src/modules/seb/sebToken.js`<br>`backend/src/shared/config.js`<br>`backend/src/shared/validateConfig.js` | Staging, Prod | None in Prod | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(32).toString('hex')` | String length >= 32; must NOT match `KNOWN_DEFAULTS` | Server aborts at startup; Safe Exam Browser one-click launch links cannot be signed | `c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2` |
| **`POSTGRES_PASSWORD`** | `docker-compose.prod.yml`<br>`scripts/ops/backup-postgres.js` | Staging, Prod | None | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(24).toString('hex')` | String length >= 16 | Docker Compose fails to start container; PostgreSQL rejects database connection | `d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b` |
| **`REDIS_PASSWORD`** | `docker-compose.prod.yml`<br>`backend/src/shared/config.js` | Staging, Prod | None | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(24).toString('hex')` | String length >= 16 | Redis server fails auth; Socket.IO multi-process scaling and L1 cache pub/sub fail | `e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c` |
| **`RABBITMQ_DEFAULT_PASS`** | `docker-compose.prod.yml` | Staging, Prod | None | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(24).toString('hex')` | String length >= 16 | RabbitMQ broker initialization fails | `f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d` |
| **`PII_ENCRYPTION_KEY`** | `backend/src/utils/crypto.js` | Staging, Prod | None | Secret | Server env `/opt/proctornet/.env.production` (mode 0600) | Generate on server with `scripts/ops/init-env.js` or `crypto.randomBytes(32).toString('hex')` | 64-hex string (256-bit AES key) | Envelope encryption utility throws error if invoked | `0718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6` |
| **`PUBLIC_ORIGIN`** | `backend/src/middleware/security.js`<br>`backend/src/shared/config.js`<br>`scripts/ops/preflight-env.js` | Local, Staging, Prod | `http://localhost:5000` | Public Config | Server env `/opt/proctornet/.env.production` | Set to canonical institutional URL: `https://proctornet.duckdns.org` (prod) or `https://staging.proctornet.duckdns.org` | Bare origin with `http:` or `https:`, no trailing slash, path, query or fragment | Safe Exam Browser HMAC verification fails (403 SEB_INVALID_HASH); CORS rejected | `https://proctornet.duckdns.org` |
| **`PUBLIC_HOST`** | `docker-compose.prod.yml`<br>`ops/caddy/Caddyfile` | Staging, Prod | `proctornet.duckdns.org` | Public Config | Server env `/opt/proctornet/.env.production` | Canonical domain without protocol: `proctornet.duckdns.org` | FQDN without scheme or port | Caddy cannot issue ACME SSL certificate via Let's Encrypt | `proctornet.duckdns.org` |
| **`RETENTION_DAYS`** | `backend/src/jobs/retentionJob.js`<br>`scripts/ops/backup-postgres.js` | Staging, Prod | `90` | Config | Server env `/opt/proctornet/.env.production` | Administrator decision: academic retention window (default: 90 days) | Positive integer >= 1 | Automated retention worker skips evidence deletion or throws NaN | `90` |
| **`SEB_MODE`** | `backend/src/middleware/seb.js`<br>`backend/src/shared/config.js`<br>`backend/src/shared/validateConfig.js` | Local, Staging, Prod | `off` | Config | Server env `/opt/proctornet/.env.production` | Choose `log` for staging/pilot testing; `enforce` for live locked examinations | Strictly `'off'`, `'log'`, or `'enforce'` | Non-SEB students unexpectedly blocked or SEB checks skipped | `log` |
| **`AWS_REGION`** | `backend/src/infra/s3/s3.client.js`<br>`backend/src/shared/validateConfig.js` | Staging, Prod | `ap-south-1` | Config | Server env `/opt/proctornet/.env.production` | AWS Console top-right navigation or `aws configure get region` | Valid AWS region code | S3 client targets invalid region; snapshot presigned URLs return 400 | `ap-south-1` |
| **`S3_BUCKET`** | `backend/src/infra/s3/s3.client.js`<br>`backend/src/shared/validateConfig.js`<br>`docker-compose.prod.yml` | Staging, Prod | `proctornet-storage` | Config | Server env `/opt/proctornet/.env.production` | AWS Console -> S3 -> Buckets -> Name of private evidence bucket | Valid S3 bucket name (3-63 chars, lowercase, numbers, hyphens) | Candidate webcam snapshots and ID cards cannot be uploaded | `proctornet-storage-staging` |
| **`AWS_ACCESS_KEY_ID`** | `backend/src/infra/s3/s3Adapter.js`<br>`.github/workflows/deploy-aws.yml` | Staging, Prod | None | Secret | Server env (or IAM Instance Profile on EC2) | AWS IAM -> Users -> Security Credentials -> Create Access Key | Standard 20-char AWS key starting with `AKIA` | S3 client unauthorized (403 Access Denied) unless IAM profile active | `AKIAIOSFODNN7EXAMPLE` |
| **`AWS_SECRET_ACCESS_KEY`** | `backend/src/infra/s3/s3Adapter.js`<br>`.github/workflows/deploy-aws.yml` | Staging, Prod | None | Secret | Server env (or IAM Instance Profile on EC2) | AWS IAM -> Users -> Security Credentials -> Secret Access Key | 40-character AWS secret | S3 client signature rejected | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| **`AWS_ROLE_TO_ASSUME`** | `.github/workflows/cd-staging.yml`<br>`.github/workflows/cd-production.yml` | CI/CD | None | Secret | GitHub Repository Secrets (`AWS_ROLE_TO_ASSUME`) | AWS IAM -> Roles -> Create role with GitHub OIDC trust policy | AWS IAM Role ARN format | GitHub Actions runner cannot authenticate to AWS | `arn:aws:iam::123456789012:role/ProctorNetDeploy` |
| **`AWS_EC2_STAGING_INSTANCE_ID`** | `.github/workflows/cd-staging.yml` | CI/CD | None | Secret | GitHub Repository Secrets (`AWS_EC2_STAGING_INSTANCE_ID`) | AWS EC2 Console -> Instances -> Instance ID | `i-[0-9a-f]{17}` | AWS Systems Manager (SSM) cannot target instance for deploy | `i-0123456789abcdef0` |
| **`PROD_CD_ENABLED`** | `.github/workflows/cd-production.yml` | CI/CD | Unset | Config | GitHub -> Settings -> Environments -> production -> Variables | Set to `true` ONLY during official maintenance cutover window | `'true'` or unset | Automated deployment to live production domain blocked (intentional safeguard) | `true` |
| **`STAGING_ENABLED`** | `.github/workflows/cd-staging.yml` | CI/CD | `true` | Config | GitHub -> Settings -> Environments -> staging -> Variables | Set to `true` to enable automated deployment to staging | `'true'` or `'false'` | Staging CD pipeline skips deployment steps | `true` |
| **`SEB_CONFIG_KEY`** | `backend/src/modules/exams/exams.service.js`<br>`docker-compose.prod.yml` | Staging, Prod | None | Config / Secret | Server env OR Admin Web UI (`/admin/seb-config`) | Safe Exam Browser Config Tool -> Save `.seb` file -> Copy Config Key | Exactly 64 hex characters | SEB cannot validate examination configuration in enforce mode | `43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c` |
| **`VITE_API_URL`** | `frontend/src/lib/apiClient.js` | Frontend Build | `/api/v1` | Public Config | Frontend build arg / `.env.production` | Use `/api/v1` for reverse-proxy routing through Caddy | Relative path or valid URL | Frontend API requests fail with 404 or network errors | `/api/v1` |
| **`VITE_SOCKET_URL`** | `frontend/src/lib/socketClient.js` | Frontend Build | Empty | Public Config | Frontend build arg / `.env.production` | Leave empty for same-origin WebSocket proxy through Caddy | Relative path or valid URL | Real-time candidate monitoring and violation alerts disconnected | `` |
| **`VITE_SUPPORT_EMAIL`** | `frontend/src/lib/studentErrors.js`<br>`frontend/src/lib/systemCheck.js` | Frontend Build | None | Public Config | Frontend build arg / `.env.production` | Institutional student helpdesk email | Valid email address | Fallback generic email displayed on student hardware pre-check failure | `support@proctornet.duckdns.org` |
| **`VITE_SUPPORT_URL`** | `frontend/src/lib/studentErrors.js` | Frontend Build | None | Public Config | Frontend build arg / `.env.production` | Institutional support portal or knowledge base | Valid HTTP/HTTPS URL | "Need help?" links point to empty destination | `https://proctornet.duckdns.org/help` |
| **`VITE_SEB_DOWNLOAD_URL`** | `frontend/src/pages/student/SebRequiredPage.jsx` | Frontend Build | `https://safeexambrowser.org/download_en.html` | Public Config | Frontend build arg / `.env.production` | Official Safe Exam Browser download page | Valid HTTPS URL | Student cannot download browser if missing on their PC | `https://safeexambrowser.org/download_en.html` |
| **`VITE_SEB_QUIT_URL`** | `frontend/src/pages/student/ExamArenaPage.jsx` | Frontend Build | `/student/dashboard` | Public Config | Frontend build arg / `.env.production` | Student dashboard destination after exam submission | Relative path or URL | SEB fails to cleanly exit back to student portal | `/student/dashboard` |

---

## 3. Discrepancy Reconciliation & Resolution Matrix

Audit of legacy configuration files identified several inconsistencies that have been reconciled into a single authoritative contract:

| Variable / Area | Inconsistency Found | Code Evidence & Root Cause | Resolution Implemented |
| :--- | :--- | :--- | :--- |
| **S3 Bucket Naming** | `.env.example` used `AWS_S3_BUCKET_NAME`, `docker-compose.prod.yml` used `S3_BUCKET`, code supported both. | `backend/src/shared/validateConfig.js` lines 32–41 explicitly normalizes `S3_BUCKET_NAME` and `AWS_S3_BUCKET` to `S3_BUCKET`. | **Canonical name is `S3_BUCKET`**. Both `.env.production.example` and `preflight-env.js` strictly use `S3_BUCKET` with backwards compatibility fallback. |
| **JWT Secrets in Production** | `.env.example` listed only `JWT_SECRET`, omitting `JWT_REFRESH_SECRET` and `SEB_LINK_SECRET`. | `validateConfig.js` lines 138–160 aborts boot in `NODE_ENV=production` if `JWT_REFRESH_SECRET` or `SEB_LINK_SECRET` is missing. | **Mandatory on all environments**. Added `JWT_REFRESH_SECRET` and `SEB_LINK_SECRET` to all production and staging templates. |
| **Legacy Stale Backend Variables** | `backend/.env.example` contained `PYTHON_SERVICE_URL`, `COMPREFACE_URL`, `LIVEKIT_API_KEY`, `VPN_SERVER_IP`. | Technical audit confirmed these were deprecated during migration to client-side face analysis, native Socket.IO clustering, and Caddy proxying. | **Removed dead variables** from all template files to prevent administrator confusion. |
| **Staging Compose Architecture** | Legacy docs referenced `docker-compose.staging.yml` on port 8081 with Nginx. | Unified in commit `0ca5686`: staging runs `docker-compose.prod.yml` with its own `.env.staging` on its own dedicated instance. | **Removed stale `docker-compose.staging.yml`**; both staging and production use the hardened Caddy stack. |
| **Frontend VITE Variables** | `frontend/.env.example` had `VITE_PYTHON_URL` and lacked `VITE_SUPPORT_EMAIL`, `VITE_SEB_DOWNLOAD_URL`. | Code audit of `frontend/src` revealed 7 active variables across `studentErrors.js`, `systemCheck.js`, and `SebRequiredPage.jsx`. | **Updated `frontend/.env.example`** with the 7 active variables and cleared dead Python URLs. |

---

## 4. Production Provisioning Guide (`scripts/ops/init-env.js`)

To bootstrap an environment file securely on an EC2 instance without exposing secrets on terminal outputs or copying credentials across unencrypted channels:

```bash
# For Staging Deployment
node scripts/ops/init-env.js --staging --domain staging.proctornet.duckdns.org

# For Production Deployment
node scripts/ops/init-env.js --domain proctornet.duckdns.org
```

### Script Invariants:
1. Generates 256-bit cryptographic entropy for all 7 Group-A secrets directly in memory.
2. Writes the target `.env` file with restrictive POSIX file permissions (`chmod 600`), readable only by the process owner.
3. Leaves Group-C cloud variables marked with placeholder `REPLACE_ME`.
4. Executes `scripts/ops/preflight-env.js` automatically.
5. Prints ONLY the unresolved variable names to stdout, never printing secret values.

