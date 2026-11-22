---
name: enterprise-design-system
description: Enforces the ProctorNet Light Surface World design system, color tokens, typography scale, single Button component, single primary action per view, contrast, and spacing rules tied to docs/ui/RULES.md and .agents/specs/DESIGN.md. Trigger whenever designing, styling, reviewing, or refactoring UI components, pages, forms, or layouts.
---

# Enterprise Design System Standard

This skill codifies the visual, ergonomic, and token standards for ProctorNet, adhering strictly to `.agents/specs/DESIGN.md`, `docs/ui/RULES.md`, and Rule 05.

**Official Sources & Standards:**
- W3C Design Tokens Community Group (DTCG) Specification (2025/2026)
- MDN Web Docs: CSS Custom Properties & Color Contrast (§1.4.3 WCAG 2.2 AA)
- React Official Docs: Component Composition & Design Systems
- Date of Authorship: 2026-11-22

---

## 1. Strict Light Surface World Tokens

Every screen, modal, card, and runner lives exclusively on the Light Surface World:

| Token | Hex / Value | Purpose & Usage |
| :--- | :--- | :--- |
| `canvas` | `#fbfcfd` | Default canvas background across student, faculty, admin, and public routes. |
| `surface` | `#ffffff` | Inner columns, active workspace cards, input fields, and modal containers. |
| `surface-tint` | `#fbfbff` | Elevated comparison wrappers, table containers, and subtle panels. |
| `lavender` | `#edecfb` | Feature cards, summary cards, empty states, and inactive card backgrounds. |
| `primary` | `#5266eb` | Mercury Indigo — exclusive color for the single primary action per view. |
| `ink` | `#28253b` | Primary text, titles, headings, and high-contrast labels (> 11:1 contrast). |
| `ink-secondary` | `#554e7b` | Subheadings, descriptions, eyebrows, metadata, and helper text (> 6:1 contrast). |
| `fog` | `#c3c3cc` | Allowed 1px horizontal dividers between table rows and accordion items. |

> **STRICT INVARIANT:** Dark mode, dark page backgrounds (`#171721`, `#1e1e2a`), dark cards, and `@media (prefers-color-scheme: dark)` are strictly forbidden.

---

## 2. Single Button Component Standard

All interactive buttons MUST use the shared component `frontend/src/components/ui/button.jsx`. Raw unstyled `<button>` elements are forbidden.

1. **Single Primary Action Rule:**
   - Strictly **ONE** solid `#5266eb` button (`button-primary`) per view or button group (e.g., "Start exam", "Submit exam", "Create exam").
   - Height: `40px`, padding: `0 20px`, corner radius: `32px` (`rounded-xl`) or `40px` (`rounded-full`).
2. **Secondary & Tertiary Actions:**
   - Every secondary action MUST use `button-tint-light` (`rgba(82, 102, 235, 0.10)` fill with `#28253b` text and `40px` radius) or `button-outline-light` (`1px` border at `22%` opacity).
3. **Pill Geometry:**
   - Square action buttons are forbidden. All buttons use rounded corners: `{rounded.xl}` (`32px`) or `{rounded.pill}` (`40px`).

---

## 3. Cards & Spatial Elevation

- **NO Box Outlines on Cards:** Never use `1px solid` borders to separate cards from the page canvas. Cards separate purely by tonal fill (`#edecfb` Lavender or `#fbfbff` Surface Tint).
- **NO Heavy Drop Shadows:** Elevation is tonal (Level 0 Flat). Floating cards or modals may use Level 1 Soft Stack (`0 4px 20px rgba(40, 37, 59, 0.04)`).
- **Allowed 1px Dividers:** The ONLY permitted 1px lines are horizontal dividers in `{colors.fog}` (`#c3c3cc`) and `button-outline-light`.

---

## 4. Typography Scale & Weights

Hierarchy is achieved through size, color contrast, and uppercase tracking—never heavy weights:
- **Weights Allowed:** `360` (body copy), `420` (UI text, buttons), `480` (headings, titles), `500` (uppercase eyebrows).
- **Weights Strictly Banned:** Never use `font-weight: 600`, `700`, `800`, or `bold`.

---

## 5. Implementation Checklist

- [ ] Page background is `#fbfcfd` with zero dark mode styles.
- [ ] Cards use tonal `#edecfb` or `#ffffff` fill with zero box border outlines.
- [ ] Exactly one primary `#5266eb` button in the view/group; secondary actions use tint or outline capsules.
- [ ] All interactive buttons use `32px` or `40px` border-radius.
- [ ] Text uses `#28253b` (primary) and `#554e7b` (secondary) with font weight $\le 500$.
- [ ] Contrast exceeds 4.5:1 against light background across all text elements.

---

## 6. Common Failures

- **Dark mode leakage:** Adding `dark:` classes or dark modal surfaces.
- **Box borders:** Adding `border border-gray-200` around card surfaces.
- **Dual primary buttons:** Placing two solid `#5266eb` buttons in the same modal or header.
- **Font weight violation:** Using `font-bold`, `font-semibold`, or weights `600`/`700`.
- **Square buttons:** Using default rectangular button styling with sharp corners.

---

## 7. Verification Commands

```bash
# Verify design tokens and styling across frontend
npm run lint

# Production build asset check
npm run build

# Playwright design and responsive suite
npx playwright test scripts/ci/responsive-audit.spec.ts
```
