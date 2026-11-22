---
trigger: always_on
description: Mandatory core engineering lessons: evidence-only reporting, repo-only scope, zero admin PR overrides, deploy preconditions, secrets masking, and single-concern commits.
---

# Rule 06: Core Engineering Lessons & Operational Safeguards

1. **Evidence-Only Reporting:**
   - Never declare a task, test, or check "verified", "passed", or "confirmed" without printed command output redirected to files and inspected.
   - Attribute errors by grepping exact strings in all candidate codebases (repo, dependencies, SEB Windows C# source) before proposing fixes.
2. **Repo-Only Scope:**
   - Never write to or modify files outside `online-exam-proctoring` (e.g., host `%LOCALAPPDATA%`, `%APPDATA%`, global configs). Read-only inspection of host logs and starter configs is allowed where specified.
3. **Zero Admin Overrides on PRs:**
   - Never use `gh pr merge --admin` to bypass branch protection. Wait for full CI pass and required reviews or permissions.
4. **Deploy Preconditions (Rule 4):**
   - Deploy only when: full release check gate (`npm run release:check`) is 100% green; zero in-progress attempts; no exam window open or starting within 30 minutes; fresh verified database backup under 30 minutes; migrations rehearsed; rollback plan armed.
5. **Secrets Redaction:**
   - Never commit or print secrets, tokens, or private keys. In SSM or command outputs, print at most the last 4 characters.
6. **One Concern Per Commit:**
   - One branch and PR per concern. Never combine unrelated refactorings or fixes into a single commit or PR.
7. **Read Source Code Instead of Guessing:**
   - Inspect the Safe Exam Browser (SEB) C# source for native SEB behaviors, session initialization, process termination, and header hashes rather than trial-and-error.
