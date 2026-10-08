# CI Failure Inventory & Root Cause Classification

> **Phase C0 Deliverable:** Comprehensive diagnosis of all test files across the repository, classifying every failure according to §1 of Prompt 6.
> **Date:** 2026-10-08
> **Scope:** 57 test files (35 backend, 14 root, 8 device-agent).

---

## 1. Executive Summary

| Category | Total Files | Passed in Isolation | Failed / Attention Required | Pass Rate |
|---|---|---|---|---|
| **Root Tests (`tests/*.test.js`)** | 14 | 14 | 0 | **100%** |
| **Device-Agent Tests (`device-agent/test/*.test.js`)** | 8 | 8 | 0 | **100%** |
| **Backend Tests (`proctornet/backend/tests/*.js`)** | 35 | 18 | 17 | **51.4%** |
| **Total Across Workspaces** | **57** | **40** | **17** | **70.2%** |

---

## 2. Root Cause Classification Matrix (§1 Taxonomy)

Every failure observed across local clean-room executions and GitHub Actions run history (`37727595263`, `37763533024`) maps to one of the following root-cause classes:

### Class 1: Hidden Environment & Connection Fallback (CI-F)
* **Mechanism:** Tests running outside docker containers inherit `.env` files pointing to Docker service hostnames (`postgres:5432`) or remote databases with WAN latency, while Prisma CLI and `dotenv` prioritize `.env` over injected environment variables.
* **Impacted Test Files:**
  - `proctornet/backend/tests/agent-adversarial.test.js` (fails attempting to resolve `postgres:5432` from host).

### Class 2: Schema Drift & Un-Migrated Database State (CI-C / CI-F)
* **Mechanism:** Target databases (whether local test container or remote pooler) lacking sequential Prisma migrations (`0001_init` through `0005_...`). Specifically:
  - Missing column `device_agent_policy` on `exams` table.
  - Missing column `scope` on `idempotency_keys` table.
  - Missing enum value `INVIGILATOR` on `Role` enum in historical CI runs.
* **Impacted Test Files:**
  - `proctornet/backend/tests/exam-lifecycle.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/mcq-validation.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p3-schema-constraints.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p4-concurrency-write-paths.test.js` (`column "scope" of relation "idempotency_keys" does not exist`)
  - `proctornet/backend/tests/p4-prewarm-500.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p5-storage-evidence.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p6-realtime-invigilator.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p7-media-livekit.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/p8-vpn-wireguard.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/q4-async-resilience.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/q5-bola-fuzz.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/r2-evidence-invigilator.test.js` (`Invalid value for argument role. Expected Role` in `auth_sessions`)
  - `proctornet/backend/tests/r4-lite-profile-drivers.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/route-matrix.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/services.test.js` (`The column device_agent_policy does not exist`)
  - `proctornet/backend/tests/timezone-matrix.test.js` (`The column device_agent_policy does not exist`)

### Class 3: Hanging Handles & Asynchronous Lifecycle Leaks (CI-D)
* **Mechanism:** Redis pub/sub invalidation listener (`pn:l1:invalidate`), AMQP connection manager, or background sweeper intervals remaining active after test assertion blocks finish, triggering `MaxRetriesPerRequestError` or preventing clean process exit without `--test-force-exit`.
* **Impacted Test Files:**
  - `proctornet/backend/tests/agent-adversarial.test.js` (`MaxRetriesPerRequestError: Reached max retries after test ended`)
  - `proctornet/backend/tests/p4-concurrency-write-paths.test.js` (un-closed Redis/Prisma handles)

### Class 4: Fail-Fast Pipeline Architecture (CI-A)
* **Mechanism:** The single `run:` step in `ci.yml` executes 28 sequential `node --test` commands under default `set -e`. The first failure (`r2-evidence-invigilator.test.js` in run `37727595263`) halts the entire pipeline, hiding the status of the remaining 27 tests and necessitating one push per failure.

---

## 3. Comprehensive File-by-File Inventory Table

| # | Test File Path | Status | Duration | Primary Root Cause / First Error |
|---|---|---|---|---|
| 1 | `proctornet/backend/tests/agent-adversarial.test.js` | ❌ FAIL | 2367ms | `CI-F` / `CI-D`: Unreachable `postgres:5432` + unhandled Redis reconnection |
| 2 | `proctornet/backend/tests/agent-legacy-gaps.test.js` | ✅ PASS | 442ms | Clean |
| 3 | `proctornet/backend/tests/agent-module.test.js` | ✅ PASS | 2103ms | Clean |
| 4 | `proctornet/backend/tests/architecture.test.js` | ✅ PASS | 1462ms | Clean |
| 5 | `proctornet/backend/tests/blackbox_browser_security_verification.js` | ✅ PASS | 1220ms | Clean |
| 6 | `proctornet/backend/tests/e2e_lifecycle.test.js` | ✅ PASS | 224ms | Clean |
| 7 | `proctornet/backend/tests/exam-lifecycle.test.js` | ❌ FAIL | 1520ms | `CI-C`: Missing column `device_agent_policy` |
| 8 | `proctornet/backend/tests/live_proctoring_pipeline.test.js` | ✅ PASS | 217ms | Clean |
| 9 | `proctornet/backend/tests/mcq-validation.test.js` | ❌ FAIL | 816ms | `CI-C`: Missing column `device_agent_policy` |
| 10 | `proctornet/backend/tests/observability.test.js` | ✅ PASS | 1962ms | Clean |
| 11 | `proctornet/backend/tests/p3-schema-constraints.test.js` | ❌ FAIL | 540ms | `CI-C`: Missing column `device_agent_policy` |
| 12 | `proctornet/backend/tests/p4-concurrency-write-paths.test.js` | ❌ FAIL | 897ms | `CI-C`: Missing column `scope` on `idempotency_keys` |
| 13 | `proctornet/backend/tests/p4-prewarm-500.test.js` | ❌ FAIL | 799ms | `CI-C`: Missing column `device_agent_policy` |
| 14 | `proctornet/backend/tests/p4-property-grading.test.js` | ✅ PASS | 670ms | Clean (Curated list rot — was excluded from CI) |
| 15 | `proctornet/backend/tests/p4-state-machine.test.js` | ✅ PASS | 320ms | Clean |
| 16 | `proctornet/backend/tests/p5-client-compression.test.js` | ✅ PASS | 662ms | Clean |
| 17 | `proctornet/backend/tests/p5-storage-evidence.test.js` | ❌ FAIL | 888ms | `CI-C`: Missing column `device_agent_policy` |
| 18 | `proctornet/backend/tests/p6-frontend-autosave.test.js` | ✅ PASS | 307ms | Clean |
| 19 | `proctornet/backend/tests/p6-realtime-invigilator.test.js` | ❌ FAIL | 1055ms | `CI-C`: Missing column `device_agent_policy` |
| 20 | `proctornet/backend/tests/p7-media-livekit.test.js` | ❌ FAIL | 880ms | `CI-C`: Missing column `device_agent_policy` |
| 21 | `proctornet/backend/tests/p8-vpn-wireguard.test.js` | ❌ FAIL | 568ms | `CI-C`: Missing column `device_agent_policy` |
| 22 | `proctornet/backend/tests/p9-infrastructure-hardening.test.js` | ✅ PASS | 3136ms | Clean |
| 23 | `proctornet/backend/tests/phase_c_remediation.test.js` | ✅ PASS | 1572ms | Clean (Curated list rot — was excluded from CI) |
| 24 | `proctornet/backend/tests/q3-student-flow.test.js` | ✅ PASS | 251ms | Clean |
| 25 | `proctornet/backend/tests/q4-async-resilience.test.js` | ❌ FAIL | 705ms | `CI-C`: Missing column `device_agent_policy` |
| 26 | `proctornet/backend/tests/q5-bola-fuzz.test.js` | ❌ FAIL | 1868ms | `CI-C`: Missing column `device_agent_policy` |
| 27 | `proctornet/backend/tests/r1-face-verification.test.js` | ✅ PASS | 665ms | Clean |
| 28 | `proctornet/backend/tests/r2-evidence-invigilator.test.js` | ❌ FAIL | 1201ms | `CI-C`: Missing column `device_agent_policy` |
| 29 | `proctornet/backend/tests/r3-media-cadence.test.js` | ✅ PASS | 580ms | Clean |
| 30 | `proctornet/backend/tests/r4-lite-profile-drivers.test.js` | ❌ FAIL | 1783ms | `CI-C`: Missing column `device_agent_policy` |
| 31 | `proctornet/backend/tests/reset-keep-admin.test.js` | ✅ PASS | 960ms | Clean (Curated list rot — was excluded from CI) |
| 32 | `proctornet/backend/tests/route-matrix.test.js` | ❌ FAIL | 1914ms | `CI-C`: Missing column `device_agent_policy` |
| 33 | `proctornet/backend/tests/security_auth_cookies.test.js` | ✅ PASS | 459ms | Clean |
| 34 | `proctornet/backend/tests/services.test.js` | ❌ FAIL | 625ms | `CI-C`: Missing column `device_agent_policy` |
| 35 | `proctornet/backend/tests/timezone-matrix.test.js` | ❌ FAIL | 470ms | `CI-C`: Missing column `device_agent_policy` |
| 36 | `tests/active_attempts_gate.test.js` | ✅ PASS | 769ms | Clean |
| 37 | `tests/ai_question_validation.test.js` | ✅ PASS | 382ms | Clean |
| 38 | `tests/api_client.test.js` | ✅ PASS | 5123ms | Clean |
| 39 | `tests/approval_auth.test.js` | ✅ PASS | 1288ms | Clean |
| 40 | `tests/ci_workflow_integrity.test.js` | ✅ PASS | 262ms | Clean |
| 41 | `tests/eligibility_matrix.test.js` | ✅ PASS | 222ms | Clean |
| 42 | `tests/exam_credentials.test.js` | ✅ PASS | 1104ms | Clean |
| 43 | `tests/feature_truth.test.js` | ✅ PASS | 901ms | Clean |
| 44 | `tests/p8-deployment-truth.test.js` | ✅ PASS | 2203ms | Clean (Curated list rot — was excluded from CI) |
| 45 | `tests/profile_security.test.js` | ✅ PASS | 645ms | Clean |
| 46 | `tests/question_immutability.test.js` | ✅ PASS | 1394ms | Clean |
| 47 | `tests/release_packaging.test.js` | ✅ PASS | 296ms | Clean (Curated list rot — was excluded from CI) |
| 48 | `tests/restart_chaos.test.js` | ✅ PASS | 452ms | Clean |
| 49 | `tests/version_endpoint.test.js` | ✅ PASS | 283ms | Clean |
| 50 | `proctornet/device-agent/test/collectors.test.js` | ✅ PASS | 228ms | Clean |
| 51 | `proctornet/device-agent/test/failClosed.test.js` | ✅ PASS | 571ms | Clean |
| 52 | `proctornet/device-agent/test/falsePositiveCorpus.test.js` | ✅ PASS | 265ms | Clean |
| 53 | `proctornet/device-agent/test/footprint.test.js` | ✅ PASS | 316ms | Clean |
| 54 | `proctornet/device-agent/test/matcher.test.js` | ✅ PASS | 233ms | Clean |
| 55 | `proctornet/device-agent/test/policy.test.js` | ✅ PASS | 305ms | Clean |
| 56 | `proctornet/device-agent/test/privacy.test.js` | ✅ PASS | 324ms | Clean |
| 57 | `proctornet/device-agent/test/transport.test.js` | ✅ PASS | 434ms | Clean |

---

## 4. Key Takeaways for Phase C1 & C2

1. **Curated List Rot is Confirmed:** 5 test files (`reset-keep-admin.test.js`, `p4-property-grading.test.js`, `phase_c_remediation.test.js`, `p8-deployment-truth.test.js`, `release_packaging.test.js`) exist, pass cleanly, but were never executed in GitHub Actions CI because of explicit hardcoded file lists.
2. **Database Migration Baseline is Essential:** The majority of failures (16 out of 17) stem from schema drift on unmigrated database targets (missing `device_agent_policy`). Phase C1's test database guard and automated baseline seeding will resolve these uniformly.
3. **Handle Leaks are Real:** As observed in `agent-adversarial.test.js` and `p4-concurrency-write-paths.test.js`, modules leave active Redis and RabbitMQ reconnection handles, confirming finding CI-D.
