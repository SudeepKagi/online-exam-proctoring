# ProctorNet CI/CD Secrets & Variables Directory

**Notice**: This document contains **only** configuration keys, scopes, and descriptions. It contains **no secret values**.

---

## 1. Repository Secrets (`Settings -> Secrets and variables -> Actions`)

These secrets are shared at the repository level and consumed by CI and CD runner steps:

| Secret Name | Required By | Description |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | `cd-staging.yml`, `cd-production.yml` | AWS IAM user access key used by `aws-actions/configure-aws-credentials` to dispatch SSM commands. |
| `AWS_SECRET_ACCESS_KEY` | `cd-staging.yml`, `cd-production.yml` | AWS IAM secret access key corresponding to `AWS_ACCESS_KEY_ID`. |
| `AWS_ROLE_TO_ASSUME` | `cd-staging.yml`, `cd-production.yml` | (Optional) AWS IAM Role ARN for OIDC-based federation if not using long-lived access keys. |
| `AWS_EC2_INSTANCE_ID` | `cd-production.yml` | The AWS EC2 Instance ID (e.g. `i-0123456789abcdef0`) hosting production. |
| `AWS_EC2_STAGING_INSTANCE_ID` | `cd-staging.yml` | (Optional) The AWS EC2 Instance ID hosting staging. Falls back to `AWS_EC2_INSTANCE_ID` if co-hosted. |

---

## 2. Protected Environment Secrets (`Settings -> Environments`)

Environment-scoped secrets are injected only into jobs executing inside protected environments (`staging` or `production`):

### Staging Environment (`staging`)
| Variable / Secret Name | Scope | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Staging | Connection string for staging PostgreSQL (`postgresql://...`). |
| `DIRECT_URL` | Staging | Direct unpooled connection string for staging Prisma migrations. |
| `REDIS_URL` | Staging | Connection string for staging Redis instance (`redis://:...@host:port`). |
| `JWT_SECRET` | Staging | Cryptographic secret for signing staging session JWTs ($\ge 32$ chars). |
| `SEB_LINK_SECRET` | Staging | Secret for HMAC token generation on one-click SEB launch links ($\ge 32$ chars). |
| `SEB_CONFIG_KEY` | Staging | (Optional) 64-character hex fallback Safe Exam Browser Config Key. |
| `PUBLIC_ORIGIN` | Staging | Canonical external origin (e.g., `https://staging.proctornet.duckdns.org`). |

### Production Environment (`production`)
*Configured with manual reviewer protection rules.*

| Variable / Secret Name | Scope | Purpose |
| :--- | :--- | :--- |
| `DATABASE_URL` | Production | Connection string for production PostgreSQL database. |
| `DIRECT_URL` | Production | Direct unpooled connection string for production Prisma migrations. |
| `REDIS_URL` | Production | Connection string for production Redis cache. |
| `JWT_SECRET` | Production | High-entropy 64-character secret for signing production JWTs. |
| `SEB_LINK_SECRET` | Production | Secret for HMAC token generation on one-click SEB launch links ($\ge 32$ chars). |
| `SEB_CONFIG_KEY` | Production | (Optional) 64-character hex fallback Safe Exam Browser Config Key. |
| `PUBLIC_ORIGIN` | Production | Canonical public URL (e.g., `https://proctornet.duckdns.org`). |

---

## 3. GitHub Automatic Tokens

| Token Name | Scope | Usage |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | Generated per-run | Authenticates with GitHub Container Registry (`ghcr.io`) for building and pulling container images (`packages: write`), and runs Gitleaks scanner. |
