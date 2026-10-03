# ProctorNet Performance Experiment Log

## Protocol
Every performance modification, database query optimization, indexing change, concurrency tuning, and caching experiment must be recorded in this log following the strict discipline:
**Hypothesis -> Change -> Before Metrics -> After Metrics -> Verdict**.

---

## Experiment 000: Baseline Benchmark (Phase P0)
* **Date**: 2026-10-03
* **Phase**: P0 (Baseline & Safety)
* **Target Node Hardware**: 12th Gen Intel(R) Core(TM) i5-12450H (8 physical cores, 12 logical processors), 16.0 GB RAM, NVMe SSD, Windows 11 host.
* **Component Under Test**: Backend test suite & initial service layer baseline.

### Hypothesis
Current backend test suite runs 65 tests cleanly under single-process Node runtime; establishing test execution latency and architectural invariants provides the safety guardrail for subsequent refactorings.

### Change
Established baseline git tag `baseline-pre-scalability`, audited all 35 findings against codebase, verified test pass rate, and initiated multi-phase re-architecture.

### Before Metrics (Pre-Optimization)
- **Unit & Integration Tests**: 65 tests across 17 suites.
- **Pass Rate**: 100% (65 pass, 0 fail).
- **Test Suite Duration**: 15,683 ms (15.68 s).
- **Concurrency Test Coverage**: 0 load/concurrency tests.
- **Hot-Path Round Trips**:
  - `startOrResumeExam`: 3 database queries + full question bank load.
  - `saveStudentAnswer`: 3 database queries per autosave.
  - `submitStudentExam`: N sequential/concurrent upserts + N-row grading update loop.
- **Database Index Coverage**: 0 non-PK/non-unique indexes.

### After Metrics
*(P0 establishes the initial baseline; delta metrics will be recorded starting in P1/P2/P3).*

### Verdict
Baseline recorded and established. All 65 existing tests pass. Guardrails active.
