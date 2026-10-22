# AGENTS.md — Strict Engineering & Enterprise Design Contract

You are an autonomous full-stack engineering agent building a production-grade Enterprise Exam Platform (React + TypeScript frontend, Node.js + Express + TypeScript backend).

## Non-Negotiable Operating Principles
1. **Spec & Design Before Code:** Never write application code unless the functional flow, roles (`student`, `teacher`, `admin`), and edge cases are documented in `.agent/specs/SPEC.md` and all UI components strictly adhere to `.agent/specs/DESIGN.md`.
2. **Strict Light-Only Enterprise UI:** You MUST follow `.agent/specs/DESIGN.md` and `.agent/rules/05-enterprise-ui-design.md`.
   - **STRICT LIGHT THEME ONLY:** Never build dark mode, dark pages, or dark cards. Every page lives on the light canvas (`#fbfcfd`) with tonal elevation (`#ffffff`, `#fbfbff`, `#edecfb`).
   - **NO Neon Colors, NO Box Outlines, NO Heavy Shadows:** Separate cards purely by surface fill color (`#edecfb` or `#fbfbff`), never `1px solid` box outlines or heavy drop shadows.
   - **Single Primary Action:** Only ONE solid `#5266eb` (Mercury Indigo) pill button per view/group; all secondary actions must be translucent capsule pills (`border-radius: 40px`).
   - **Light Typography Weights Only:** Use `Inter` (open-source substitute for `arcadia` / `arcadiaDisplay`) at weights `360` (body), `420` (UI), `480` (headings), and `500` (uppercase eyebrows). Never use font weights above `500` (`600`, `700`, `bold` are strictly forbidden).
3. **One Vertical Slice at a Time:** Build, style, test, and verify one complete end-to-end flow (`login -> start exam -> answer -> submit -> result`) before touching the next slice or dashboard.
4. **Tests Alongside Code:** Write unit, API integration, and Playwright E2E tests together with the feature—never after.

## Strict Definition of Done (DoD)
**NEVER mark a task or slice as "done" until ALL of the following have been executed in the terminal and verified passing:**
1. `npm test` passes in both `backend` and `frontend` workspaces (0 failing tests, 0 TypeScript errors, 0 ESLint errors).
2. `npx playwright test` passes for the affected flow(s) in a real browser.
3. You have run the app and verified failure cases via automated tests:
   - Bad/malformed input (Zod rejection returning `{ code, message }`)
   - Expired or tampered JWT token (`401` handling + redirect to `/login`)
   - Simulated network error / offline answer recovery
   - Rapid double-click on submit (button disables immediately + backend idempotency)
4. You have audited the UI against `.agent/specs/DESIGN.md` (strictly light theme, zero box outlines on cards, zero font-weight > 500, zero neon colors).
5. You have executed `.agent/workflows/red-team-flow.md` ("list 15 ways this flow can break") and converted each into an automated test.
