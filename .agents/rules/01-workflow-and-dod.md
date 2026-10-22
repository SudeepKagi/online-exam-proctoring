---
trigger: always_on
description: Enforces spec-first development, vertical slicing, and strict Definition of Done.
---

# Rule 01: Workflow & Definition of Done

## 1. Spec-First Mandate
Before creating or modifying routes, controllers, or React views:
- Verify that `.agent/specs/SPEC.md` defines the exact role (`student`, `teacher`, `admin`), state transitions, API schemas, and edge cases.
- Verify that the planned UI layout uses only tokens and component primitives defined in `.agent/specs/DESIGN.md`.

## 2. Vertical Slice Isolation
Build and verify one vertical slice end-to-end before starting the next:
- **Slice 1:** Auth & Session Lifecycle (`login -> token validation -> 401 interceptor -> RBAC guards`)
- **Slice 2:** Student Exam Lifecycle (`view scheduled exam -> start exam -> answer & autosave -> submit -> result view`)
- **Slice 3:** Server Timer, Refresh Resume & Offline Recovery (`mid-exam refresh -> network drop buffer -> server timer auto-submit`)
- **Slice 4:** Teacher Dashboard (`create exam -> configure positive/negative/partial marking -> publish -> view student submissions`)
- **Slice 5:** Admin Controls & System Audit (`manage users/roles -> audit logs`)

## 3. Mandatory Verification Gate
Never declare a task complete until you run these commands and verify 100% pass rates:
```bash
npm run typecheck
npm run lint
npm test
npx playwright test
```
If any Playwright test fails, inspect the Playwright trace artifact to locate the exact DOM/network failure before fixing.
