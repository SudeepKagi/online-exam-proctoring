---
name: build-slice
description: Guides end-to-end implementation of a vertical slice adhering to spec-first development, zero box outlines, and automated test coverage.
---

# Build Vertical Slice

Follow this sequence for implementing vertical slices:

## Steps
1. **Spec & Design Verification:**
   - Read `.agents/specs/SPEC.md` and `.agents/specs/DESIGN.md`.
   - Confirm slice API schemas, DB constraints, and Light-Only UI tokens (`#fbfcfd` canvas, `#edecfb` cards, `#5266eb` primary pill).
2. **Backend & Database Implementation:**
   - Implement schema migrations, Zod request validation on every route, RBAC guards, and centralized error handling.
3. **Backend API Tests:**
   - Write integration tests against a real test database (happy path, Zod rejections, 401/403 errors, race conditions).
4. **Frontend Implementation:**
   - Build screen using `.agents/specs/DESIGN.md` tokens (strictly light mode, tonal cards, capsule buttons).
   - Implement all 4 view states: `loading`, `error`, `empty`, and `success`.
   - Disable submit buttons while requests are in flight.
5. **Frontend Component & E2E Tests:**
   - Test view states and form validation with React Testing Library.
   - Write Playwright E2E tests asserting Light UI compliance and user workflows.
6. **Red-Team Pass:**
   - Execute `/red-team-flow` to test edge cases before marking done.
