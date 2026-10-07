# ADR A-001: Node.js Single Executable Application (SEA) Agent Runtime

## Status
Accepted

## Date
2026-10-07

## Context
The legacy BYOD device agent (`proctornet/device-agent/agent.js`) required students to manually install Node.js and execute scripts via terminal. For an institutional assessment platform, non-technical candidates cannot be expected to install development runtimes or manage command prompts. Furthermore, native C/C++ node addons (`node-gyp`) introduce complex toolchain dependencies (Visual Studio Build Tools, Xcode, gcc) that break cross-platform builds.

## Decision
1. Package the companion agent as a **Node.js Single Executable Application (SEA)** for target operating systems (Windows x64, macOS arm64/x64, Linux x64).
2. **Zero Native C++ Modules**: All hardware, process, and operating system inspection routines must use built-in Node.js libraries (`node:fs`, `node:crypto`, `node:http`, `node:https`) and invoke native operating system tools via `child_process.execFile` without shell interpolation.
3. Fallback Evaluation: If SEA tooling proves problematic during CI packaging, Go is evaluated as an alternative based on binary size, cold-start latency, and code-signing friction.

## Consequences
### Positive
- Candidates download and execute a standalone binary without installing Node.js, Python, or command-line utilities.
- Shared JavaScript codebase between server, web frontend, and companion agent reduces maintenance overhead.
- No native binary module compilation issues during CI/CD builds.

### Negative
- SEA executables bundle the Node.js runtime, producing larger binary sizes (~70–100 MB compared to ~10 MB for Go/Rust).
- Mitigation: Students are prompted to download and verify the Exam Device Companion days prior to the exam during onboarding.
