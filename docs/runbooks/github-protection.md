# GitHub Environment & Branch Protection Runbook (HUMAN_REQUIRED)

> **Document Purpose**: Exact, human-actionable click-paths to configure GitHub Environment protection and `main` branch protection rules as mandated by Phase C5 (§1 DEP-6 / C5.7) of Prompt 6.

---

## 1. Production Environment Configuration (`production`)

GitHub Actions `deploy-aws.yml` targets the `production` environment. To prevent unreviewed deployments and enforce human-in-the-loop gates:

### Step-by-Step Click Path:
1. Navigate to the repository on GitHub: `https://github.com/SudeepKagi/online-exam-proctoring`.
2. Click **Settings** (top navigation bar).
3. In the left sidebar under *Code and automation*, click **Environments**.
4. If `production` is not listed, click **New environment**, type `production`, and click **Configure environment**.
5. Under **Deployment protection rules**:
   - Check **Required reviewers**.
   - Add your GitHub username (and any designated secondary reviewers).
   - Check **Wait timer** and set to `5` minutes (optional cool-down period before deployment commands dispatch).
6. Under **Deployment branches**:
   - Select **Selected branches**.
   - Click **Add deployment branch rule**, enter `main`, and click **Add rule**.
7. Under **Environment secrets** (or repository secrets):
   - Add `AWS_ROLE_TO_ASSUME`: The AWS IAM Role ARN configured for GitHub OIDC (e.g., `arn:aws:iam::<ACCOUNT_ID>:role/proctornet-github-actions-deploy`).
   - Add `AWS_S3_BUCKET`: The S3 bucket name storing release archives (e.g., `proctornet-releases-ap-south-1`).
   - Add `AWS_EC2_INSTANCE_ID`: The target EC2 instance ID for SSM deployment commands (e.g., `i-0123456789abcdef0`).
   - (Optional) Add `AWS_REGION`: `ap-south-1` (defaults to `ap-south-1` if omitted).

---

## 2. Branch Protection Rules (`main`)

To prevent direct pushes that bypass the CI suite and eliminate the CI whack-a-mole regression cycle:

### Step-by-Step Click Path:
1. In repository **Settings**, click **Branches** in the left sidebar.
2. Under **Branch protection rules**, click **Add branch protection rule** (or edit rule for `main`).
3. Set **Branch name pattern** to `main`.
4. Enable the following settings:
   - **Require a pull request before merging**:
     - Check **Require approvals** (minimum `1`).
     - Check **Dismiss stale pull request approvals when new commits are pushed**.
     - Check **Require review from Code Owners** (if CODEOWNERS exists).
   - **Require status checks to pass before merging**:
     - Check **Require branches to be up to date before merging**.
     - In the search bar for status checks, search and select each required check:
       - `Lint & Architecture Gates`
       - `Database Migration & Schema Alignment`
       - `Frontend Build & Asset Verification`
       - `Full Test Suite Execution`
       - `Security Audits & Vulnerability Gates`
   - Check **Require conversation resolution before merging**.
   - Check **Do not allow bypassing the above settings** (enforces rules on administrators too).
   - Check **Restrict who can push to matching branches** (only merged via approved PR).
5. Click **Save changes** (or **Create**).

---

## 3. AWS IAM OIDC Role Trust Policy (Reference for AWS Console / Terraform)

The GitHub Actions workflow uses OpenID Connect (OIDC) rather than static long-lived IAM keys (`DEP-3`).

### IAM Trust Policy (`repo:SudeepKagi/online-exam-proctoring:*`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:SudeepKagi/online-exam-proctoring:*"
        }
      }
    }
  ]
}
```

### IAM Permissions Policy (Least Privilege for SSM and S3 Releases):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::<RELEASE_BUCKET>/releases/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:SendCommand",
        "ssm:GetCommandInvocation"
      ],
      "Resource": [
        "arn:aws:ssm:ap-south-1:<ACCOUNT_ID>:document/AWS-RunShellScript",
        "arn:aws:ec2:ap-south-1:<ACCOUNT_ID>:instance/<INSTANCE_ID>"
      ]
    }
  ]
}
```
