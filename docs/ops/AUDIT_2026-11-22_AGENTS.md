# Agent Folder Consolidation Audit & Inventory (2026-11-22)

## 1. Inventory of Agent Configuration Folders

| Path (relative to repo root) | Size (bytes) | Type | Referenced By | Last Meaningful Change | Classification & Justification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `AGENTS.md` | 1,820 | Root Rule / Contract | Primary agent prompt, GitHub PRs, test suites | 2026-11-22 | **KEEP & REFINE**: Authoritative root contract and strict Definition of Done (DoD). |
| `.agents/rules/01-workflow-and-dod.md` | 1,543 | Rule (`always_on`) | `AGENTS.md`, `INSTRUCTIONS.md` | 2026-11-21 | **KEEP**: Mandates spec-first development, vertical slice isolation, and mandatory test gates. |
| `.agents/rules/02-error-handling-and-stack.md` | 2,125 | Rule (`always_on`) | `AGENTS.md`, `INSTRUCTIONS.md` | 2026-11-21 | **KEEP**: Central Express error middleware, Zod validation, Sentry, React Error Boundary, RHF. |
| `.agents/rules/03-exam-domain-invariants.md` | 2,588 | Rule (`always_on`) | `AGENTS.md`, `workflows/execution-order.md` | 2026-10-23 | **KEEP**: 10 core exam system domain invariants (server timer, auto-submit, refresh resume, autosave, double-click safety, single attempt, RBAC, JWT tamper, scoring, exam windows). |
| `.agents/rules/04-testing-ci-security.md` | 1,804 | Rule (`always_on`) | `AGENTS.md`, `docs/testing/TEST_AUDIT.md` | 2026-10-23 | **KEEP**: Automated testing stack (Playwright E2E, Vitest, Supertest, Testcontainers, RTL+MSW, Schemathesis, k6). |
| `.agents/rules/05-enterprise-ui-design.md` | 2,862 | Rule (`always_on`) | `AGENTS.md`, `specs/DESIGN.md`, `docs/ui/RULES.md` | 2026-11-21 | **KEEP**: Strict Light-Only Enterprise Mercury UI design system, single primary action, light typography weights. |
| `.agents/rules/06-engineering-lessons.md` | New | Rule (`always_on`) | Agent operating contract | 2026-11-22 | **NEW**: Codifies hard-won engineering lessons: evidence-only reporting, repo-only edits, zero admin PR overrides, Rule 4 deploy preconditions, secrets redaction, one concern per commit, SEB Windows source attribution. |
| `.agents/specs/DESIGN.md` | 9,148 | Design Spec | `rules/05`, `AGENTS.md`, `docs/ui/RULES.md`, `phase4-design-audit.spec.ts` | 2026-10-23 | **KEEP**: Authoritative single source of truth for color tokens, typography scale, spacing, border radii, elevations. |
| `.agents/specs/SPEC.md` | 1,605 | Functional Spec | `rules/01`, `AGENTS.md`, `workflows/build-slice.md` | 2026-10-23 | **KEEP**: 5 core user journeys and 3 institutional roles (`student`, `teacher`, `admin`). |
| `.agents/INSTRUCTIONS.md` | 5,189 | Legacy Constitution | Self-declared superseded by AGENTS.md | 2026-11-21 | **DELETE**: Redundant duplicate of `AGENTS.md` and `specs/DESIGN.md`; contains stale references to removed face streaming, screen sharing, and SEA binaries. |
| `.agents/design-system/MASTER.md` | 5,758 | Legacy Design Doc | `skills/ui-ux-pro-max/SKILL.md` | 2026-11-21 | **DELETE**: Complete duplicate of `.agents/specs/DESIGN.md`. Consolidate to single source of truth. |
| `.agents/workflows/build-slice.md` | 2,120 | Legacy Workflow | `INSTRUCTIONS.md` | 2026-11-21 | **MIGRATE**: Migrated to modern skill `.agents/skills/build-slice/SKILL.md` per Antigravity workflow deprecation standard. |
| `.agents/workflows/execution-order.md` | 1,947 | Legacy Workflow | `INSTRUCTIONS.md` | 2026-11-21 | **DELETE**: Obsolete phase roadmap superseded by active roadmap and git history. |
| `.agents/workflows/red-team-flow.md` | 1,423 | Legacy Workflow | `AGENTS.md:25` | 2026-10-23 | **MIGRATE**: Migrated to modern skill `.agents/skills/red-team-flow/SKILL.md`. |
| `.agents/skills/exam-platform-terminology/` | 32,162 | Skill | `check-terms.mjs`, UI copy | 2026-10-23 | **KEEP**: Essential domain language dictionary, regex check script, and deny-list. |
| `.agents/skills/client-side-error-resilience/` | 5,594 | Skill | `StudentExamStartPage.jsx`, student errors | 2026-11-21 | **KEEP**: Client-side error resilience, async states, network retry with AbortController, error codes. |
| `.agents/skills/enterprise-motion-tokens/` | 2,459 | Skill | Motion tokens | 2026-11-21 | **KEEP**: Enterprise motion restraint, zero arena distraction, prefers-reduced-motion. |
| `.agents/skills/framer-motion-mastery/` | 5,162 | Skill | `frontend/src/components/common/MotionWrapper.jsx` | 2026-11-21 | **KEEP**: Production Framer Motion orchestration and lazy loading. |
| `.agents/skills/apple-design/` | 23,918 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Bloated 24KB third-party skill pack; does not apply to enterprise exam system, violates light-only design rules. |
| `.agents/skills/emil-design-eng/` | 28,727 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Bloated 29KB third-party skill pack; duplicates frontend guidelines. |
| `.agents/skills/better-ui/` | 41,200 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Bloated multi-file third-party skill pack (30+ KB); duplicates design system tokens. |
| `.agents/skills/product-social-images/` | 24,960 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Marketing social media image generator; unrelated to exam platform. |
| `.agents/skills/the-nuclear-code-review/` | 12,629 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Generic third-party code review pack. |
| `.agents/skills/ui-ux-pro-max/` | 1,142 | Third-party Pointer | None | 2026-10-18 | **DELETE**: Pointer to deleted `MASTER.md`. |
| `.agents/skills/12-principles-of-animation/` | 5,565 | Third-party Skill Pack | None | 2026-10-18 | **DELETE**: Disney animation rules; exam arena strictly bans decorative motion. |
| `skills/{frontend-design, web-design-guidelines, react-best-practices, accesslint, vercel-react-native-skills, bencium-ux-designer, client-side-error-resilience, enterprise-motion-tokens, framer-motion-mastery}` | 21,458 | Legacy / Third-party Skills | General frontend reference | 2026-10-18 | **CONSOLIDATED & REPLACED**: Replaced in Phase 3 by 6 author-crafted, spec-backed skills cited from official standards (W3C, MDN, web.dev, React docs). |

---

## 4. Phase 3 Frontend Skills Architecture

In accordance with Phase 3 specifications, 6 concise, high-quality, spec-backed skills were authored from official primary sources (each `< 150` lines in `SKILL.md` with accompanying guides in `references/`):

1. **`enterprise-design-system`** (99 lines):
   - *Sources:* W3C Design Tokens Community Group (DTCG), MDN Web Docs, WCAG 2.2 §1.4.3.
   - *Scope:* Canvas `#fbfcfd`, surface `#ffffff`, lavender `#edecfb`, primary indigo `#5266eb`, single Button component, single primary action rule, font weights $\le 500$, zero box outlines on cards.
2. **`enterprise-motion-restraint`** (90 lines):
   - *Sources:* MDN Web Docs (`@media (prefers-reduced-motion)`), web.dev High Performance Animations, Motion for React.
   - *Scope:* GPU composite transforms (`transform`, `opacity` only), micro-interactions (120-150ms), bottom sheets/modals (200-240ms), tonal lavender skeletons, strict zero-motion invariant in exam arena (`/student/exams/:id/live`), zero motion near countdown timer.
3. **`responsive-and-touch`** (101 lines):
   - *Sources:* MDN Web Docs (`dvh`, safe-area insets, container queries), WCAG 2.2 §2.5.8/§2.5.5, Apple HIG / Google Material Design (44x44px touch targets).
   - *Scope:* Mobile-first 360px layout, dynamic viewport heights (`100dvh`), safe area insets, 44x44px minimum tap targets, tables-to-cards transformations ($< 768$px), bottom sheets for mobile modals ($< 640$px), zero horizontal overflow.
4. **`client-error-resilience`** (125 lines):
   - *Sources:* React Official Docs (Error Boundaries, Suspense), MDN Web Docs (`AbortController`, `fetch`, `IndexedDB`), RFC 9110 (Idempotency).
   - *Scope:* 6 explicit async states (`loading`, `empty`, `error`, `offline`, `forbidden`, `session_expired`), React error boundaries, request cancellation via `AbortController`, transient retries with exponential backoff & jitter, idempotent submits (`disabled={isSubmitting}`), offline answer buffering and reconnection drain, plain-English messages.
5. **`enterprise-accessibility`** (87 lines):
   - *Sources:* W3C WCAG 2.2 AA Standard, W3C WAI-ARIA Authoring Practices Guide (APG), axe-core.
   - *Scope:* Keyboard navigation flow, `:focus-visible` focus rings (2px solid `#5266eb`, 2px offset), modal focus trapping and escape handling, ARIA live regions (`polite` for timer/autosave, `assertive` for critical errors), accessible labels, color independence.
6. **`frontend-performance`** (100 lines):
   - *Sources:* web.dev Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1), React Official Docs (Code Splitting, `React.lazy`, `Suspense`), MDN Web Docs.
   - *Scope:* Initial gzipped bundle $< 250$kB, route-level code splitting via `React.lazy()` and `<Suspense>`, zero CLS (explicit bounding boxes on icons/images, reserved skeleton geometry), strategic memoization (`useMemo`, `useCallback`).

Total line count across all 6 frontend skills is 602 lines (average ~100 lines per skill), providing concise, trigger-oriented guidance without bloat.

---

## 2. Canonical Folder Decision & Antigravity Evidence

1. **Antigravity Customization Architecture**:
   - As documented in `C:\Users\sudee\.gemini\antigravity\builtin\skills\agy-customizations\SKILL.md`:
     - Path discovery: `.agents/` (or `.agent/`, `_agents/`, `_agent/`) at workspace/repository root.
     - Hierarchical paths: `GEMINI.md`, `AGENTS.md`, `.agents/rules/*.md`, `.agents/rules.json`, `.agents/skills/*/SKILL.md`, `.agents/skills.json`.
     - Workflows are deprecated per `C:\Users\sudee\.gemini\antigravity\builtin\skills\migrate-workflows\SKILL.md`:
       *"Workflows (`.agents/workflows/*.md` or `_agents/workflows/*.md`) are deprecated. Skills (`.agents/skills/<name>/SKILL.md`) provide all the capabilities of workflows..."*
2. **Repository Version Control Policy**:
   - The repository `.gitignore` explicitly commits to `.agents`:
     `# .agents is tracked for shared skills, design system, and instructions`
   - In PR #64, `.agent` (singular) was deleted in git and consolidated into `.agents`.
   - The outer folder `C:\Final year project\.agents` (outside the git repo) exists because the workspace root opened in IDE was `C:\Final year project`. But Rule 1 strictly forbids modifying files outside the git repo. All canonical files must live within the repository's `.agents/`.
   - To eliminate confusion and broken links, all internal references pointing to `.agent/` or `.agents/workflows/` have been updated to canonical `.agents/rules/` and `.agents/skills/`.

---

## 3. Always-Loaded Rules Budget Audit

Per Antigravity documentation, always-on rules share a 20,000-token rules budget (`defaultRulesBudget`). To prevent context dilution:
- `rules/01-workflow-and-dod.md`: 29 lines
- `rules/02-error-handling-and-stack.md`: 38 lines
- `rules/03-exam-domain-invariants.md`: 31 lines
- `rules/04-testing-ci-security.md`: 32 lines
- `rules/05-enterprise-ui-design.md`: 24 lines
- `rules/06-engineering-lessons.md`: 24 lines
**Total lines across all rules: 178 lines** (~1,500 tokens), well under the 20,000-token limit while providing complete coverage of all operating invariants and project lessons.
