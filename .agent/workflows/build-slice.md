---
description: Build a single vertical slice end-to-end with strict verification, failure testing, and Light-Only Mercury UI compliance.
---

# Workflow: Build Vertical Slice (`/build-slice`)

1. **Spec & Design Verification:**
   - Read `.agent/specs/SPEC.md` and `.agent/specs/DESIGN.md`.
   - Confirm the slice's API schemas, database constraints, and Light-Only UI tokens (`#fbfcfd` canvas, `#edecfb` lavender cards, `#5266eb` single primary pill, Inter 360–500 weights, zero box outlines).
2. **Backend & Database Implementation:**
   - Implement schema migrations, Zod request validation on every route, RBAC guards, and business logic routing errors to the central Express `{ code, message }` middleware.
3. **Backend API & DB Tests (Vitest + Supertest + Testcontainers):**
   - Write integration tests against a real test database covering happy path, Zod `400` bad inputs, `401` expired/tampered JWT, `403` role violations, and race conditions.
   - Run `npm --workspace=backend test` and ensure 100% pass.
4. **Frontend Implementation (React + RHF + Zod + DESIGN.md):**
   - Build the screen using only `.agent/specs/DESIGN.md` tokens (strictly light mode, tonal cards with `12px` radius and `32px` padding, capsule buttons with `32px`/`40px` radius, font weights `360–500`).
   - Implement `loading`, `error`, `empty`, and `success` states and disable submit buttons during submission.
5. **Frontend Component Tests (Vitest + RTL + MSW):**
   - Test all 4 view states (`loading`, `error`, `empty`, `success`), form validation, and button disabling on submit.
   - Run `npm --workspace=frontend test`.
6. **Playwright E2E & Design Audit:**
   - Write and run the Playwright E2E test for the flow (`npx playwright test`).
   - Assert in Playwright that computed styles on the page use `#fbfcfd` (`rgb(251, 252, 253)`) canvas background, no font weights above `500`, and only one solid primary button per view.
7. **Red-Team Adversarial Check:**
   - Run `/red-team-flow` to list 15 ways the slice can break and convert each into an automated test before marking the task done.
