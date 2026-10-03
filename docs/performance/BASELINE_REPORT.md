# Phase P0: Baseline & Safety Report

**Date**: 2026-10-03  
**Branch**: `feature/p0-baseline-and-safety`  
**Git Starting Tag**: `baseline-pre-scalability`  
**Host Specifications**:
- **CPU**: 12th Gen Intel(R) Core(TM) i5-12450H (8 Cores, 12 Threads)
- **RAM**: 15.71 GB (16 GB visible)
- **Storage**: NVMe High-Speed Solid State Drive
- **Operating Environment**: Single Host Node / Windows 11 (PowerShell & Docker runtime)

---

## 1. Test Suite Execution & Baseline Metrics

The existing automated test suite was executed against the baseline codebase:

```bash
cd proctornet/backend
npm test
```

### Results
- **Total Test Suites**: 17
- **Total Tests**: 65
- **Passed**: 65 (100%)
- **Failed**: 0
- **Duration**: 15.68 seconds
- **Memory Consumption**: Node process peaked at ~148 MB during test execution.

### Suite Breakdown
1. **Architectural & Regression Guardrails**: 6 passing
2. **Black-Box Browser Security Verification**: 13 passing
3. **End-to-End Lifecycle & Failure Matrix**: 3 passing
4. **Live Proctoring Pipeline State Machine & Auth**: 9 passing
5. **Phase C Remediation Verification**: 8 passing
6. **Cookie, Token, and CSRF Security Matrix**: 20 passing
7. **Collusion & Biometric Fail-Closed Service**: 6 passing

---

## 2. Codebase Audit Summary

The 35 audit findings from §3 were audited against the actual source code:

1. **Database & Data Access**:
   - Confirmed 0 non-PK indexes in `schema.prisma`.
   - Confirmed O(N^2) question shuffling and full question bank loads per candidate on `startOrResumeExam`.
   - Confirmed N+1 query loops and synchronous scoring during submissions.
   - Confirmed critical security flaw: answer key (`isCorrect: true`) is serialized and transmitted to student browsers in question options!
   - Disputed finding B-11: `prisma/migrations` exists on disk but was ignored in `.gitignore`.

2. **Realtime & Media**:
   - Confirmed O(N^2) socket broadcast of student camera and screen frames to the whole exam room.
   - Confirmed unevicted in-memory frame cache (`global.latestLiveFrames`).
   - Confirmed full-mesh WebRTC P2P mesh and absence of TURN servers.
   - Confirmed LiveKit is deployed in Docker Compose but unused by frontend.

3. **Storage & Evidence**:
   - Confirmed 7-day presigned URLs stored in database columns, causing permanent broken links after 7 days.
   - Confirmed base64 file payloads buffered in Express memory.

4. **VPN & Infrastructure**:
   - Confirmed hardcoded Azure IP and synchronous shell executions during database transactions.
   - Confirmed plaintext client private keys in DB.
   - Confirmed development credentials committed in `docker-compose.yml`.

---

## 3. P0 Hygiene Actions Completed

1. **Tagging**: Tagged baseline `baseline-pre-scalability` on `main`.
2. **Branching**: Created `feature/p0-baseline-and-safety`.
3. **ADRs**: Created all 12 Architecture Decision Records (`001` through `012`) in `docs/adr/`.
4. **Experiment & Findings Logs**: Initialized `EXPERIMENT_LOG.md` and `FINDINGS_DISPUTED.md`.
5. **Dependency Hygiene**:
   - Moved `@prisma/client` from `devDependencies` to `dependencies` in `backend/package.json`.
   - Un-ignored `backend/prisma/migrations/` in `proctornet/.gitignore`.
