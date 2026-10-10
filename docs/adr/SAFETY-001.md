# ADR SAFETY-001: Strict Agent Boundary Restrictions on Protections, Secrets, and Production State

**Status:** ACCEPTED  
**Date:** 2026-10-10  
**Context:** Automated agent sessions performing CI/CD debugging and release engineering.  

---

## 1. Context & Problem Statement

Automated coding and assistant agents have powerful access to shell environments, GitHub CLI (`gh`), cloud APIs, and local configuration files. When attempting to resolve complex deployment blockages or pipeline test failures, agents may attempt shortcuts such as:
1. Disabling or weakening GitHub branch protection rules or environment approval rules (e.g., removing required reviewers via GitHub REST API).
2. Supplying default override parameters to release gates (e.g., bypassing exam-aware safety gates).
3. Directly connecting to production databases from development machines to seed test accounts or reset administrative passwords.
4. Viewing or leaking sensitive credentials into execution logs or chat transcripts.

Such actions undermine organizational governance, violate compliance invariants, and risk production outages.

---

## 2. Decision

We establish an immutable, non-negotiable policy governing all automated agents and developer scripts:

1. **Zero Modification of Security Protections:**  
   Agents shall **never** modify, disable, or bypass:
   - Branch protection rules (including required checks, PR reviews, admin bypass settings).
   - GitHub environment protection rules (including required reviewers and wait timers).
   - Deployment safety gates (including exam-aware checks and rollback policies).
   Any change to these protections requires explicit human action through the GitHub UI or an authorized human administrative session.

2. **No Direct Production Database Access from Development Environments:**  
   Development machines must **never** connect directly to the production database. All local workflows, test runners, and automated scripts must execute against local, ephemeral, or containerized databases (`localhost`, `postgres` container, MinIO). Destructive or mutation operations against non-local databases are forbidden by code-level assertion guards (`assertNonProduction()`).

3. **No Secret Ingestion or Leakage:**  
   Production credentials, private keys (`.pem`), and API secrets must **never** be viewed in transcripts, logged in artifacts, or hardcoded in scripts. Production secrets are managed exclusively through AWS SSM Parameter Store (SecureString) or equivalent cloud vaults.

4. **Human Review for Governance Paths (`CODEOWNERS`):**  
   All changes to `.github/**`, `ops/**`, `scripts/ops/**`, and `docs/security/**` require mandatory human review via `CODEOWNERS`.

---

## 3. Consequences

### Positive
- Production integrity is guaranteed regardless of agent autonomy level.
- Clear separation between developer/test environments and live production assets.
- Audit trail preserves human accountability for all production changes.

### Negative
- Release workflows blocked by safety gates cannot be resolved by an agent alone; they require human intervention, by design.
