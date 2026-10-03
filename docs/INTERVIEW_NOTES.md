# ProctorNet Engineering Interview Notes & Architectural Rationale

This document captures the principal engineering reasoning behind each phase of the single-node scalability and reliability re-architecture. Use this for technical interview discussions, architecture reviews, and design defense.

---

## Phase P0: Baseline & Safety Setup

### 1. The Problem
Scaling an existing full-stack application (React, Node/Express, Socket.IO, Prisma, WebRTC) cannot begin with arbitrary performance optimizations. Without establishing a deterministic baseline, identifying existing architectural defects, and putting strict regression guardrails in place, optimizations risk introducing silent regressions, breaking data integrity, or fixing non-existent bottlenecks while ignoring severe structural failures.

### 2. Options Considered
- **Option A (Ad-hoc refactoring)**: Immediately rewrite queries and start rewriting Socket.IO code.
  - *Drawback*: High risk of breaking the existing 65 passing end-to-end tests, no baseline numbers to measure speedup against, and no clear audit of security flaws (such as the answer key leak in `options`).
- **Option B (Comprehensive Architectural Baseline & ADR Framework — Chosen)**:
  - Establish a formal Git baseline tag (`baseline-pre-scalability`).
  - Formulate 12 Architecture Decision Records (ADRs) to lock in key trade-offs before code changes.
  - Perform an evidence-based line-by-line codebase audit of all 35 claimed bottlenecks.
  - Establish an automated experiment log and findings dispute register.

### 3. Why This Option?
Engineering at scale requires empirical measurement: *Measure -> Change -> Re-measure*. Verifying findings against code prevented wasting time on false assumptions (e.g., finding that `prisma/migrations` actually existed on disk and was merely excluded by `.gitignore`) while highlighting urgent vulnerabilities (e.g., `isCorrect` serialized into student JSON payloads).

### 4. Trade-offs
- Setting up the documentation, ADRs, and verification took upfront planning time before writing functional code.
- *Payoff*: Unambiguous boundaries, zero debate on subsequent phase scopes, and complete traceability.

### 5. Metric that Proves It
- **100% test pass rate** (65/65 tests across 17 suites in 15.68 seconds).
- **35 findings audited** with exact file line citations.
- **1 finding disputed/refined** (`prisma/migrations` discovered and un-ignored).
- Zero downtime or regressions introduced to the existing test suite.
