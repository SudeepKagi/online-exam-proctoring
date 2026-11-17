# Enterprise UI Design Rules & Quality Standards

This document establishes the mandatory visual and ergonomic standards for ProctorNet, codifying `.agent/specs/DESIGN.md` and Rule 05.

---

## 1. Strict Light Surface World

Every screen, page, dashboard, modal, drawer, and runner runs exclusively on the Light Surface World:

| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| `canvas` | `#fbfcfd` | Default page background across student, faculty, admin, and public routes. |
| `surface` | `#ffffff` | Inner columns, active workspace cards, input fields, and content containers. |
| `surface-tint` | `#fbfbff` | Elevated comparison wrappers, table containers, and subtle panels. |
| `lavender` | `#edecfb` | Feature cards, summary cards, empty states, and inactive card backgrounds. |
| `primary` | `#5266eb` | Mercury Indigo — exclusive color for the single primary call-to-action per view. |
| `ink` | `#28253b` | Primary text, titles, headings, and high-contrast labels. |
| `ink-secondary` | `#554e7b` | Subheadings, descriptions, eyebrows, metadata, and helper text. |
| `fog` | `#c3c3cc` | Allowed 1px horizontal dividers between table rows and accordion items. |

> **STRICT INVARIANT:** Dark mode, dark page backgrounds (`#171721`, `#1e1e2a`), dark cards, and `@media (prefers-color-scheme: dark)` are strictly prohibited.

---

## 2. Forbidden Visual Patterns

1. **NO Neon or Saturated Colors in Chrome:**
   Never use neon greens (`#00ff00`), bright reds (`#ff0000`), cyber blues, or vibrant oranges.
   Status indicators, alerts, and badges must use soft, muted indigo/lavender/slate tints (`rgba(82, 102, 235, 0.10)`, `#edecfb`, `#554e7b`).
2. **NO Box Outlines on Cards or Containers:**
   Never use `1px solid` borders to separate cards from the page canvas.
   Cards separate from `#fbfcfd` purely by tonal fill (`#edecfb` Lavender or `#ffffff` / `#fbfbff` Surface).
   The ONLY permitted `1px` lines are horizontal dividers in `{colors.fog}` (`#c3c3cc`) and `button-outline-light`.
3. **NO Heavy Drop Shadows:**
   Elevation is tonal (Level 0 Flat). Floating cards or modals may use Level 1 Soft Stack (`0 4px 20px rgba(40, 37, 59, 0.04)`).
4. **NO Font Weights Above 500:**
   Never use `font-weight: 600`, `700`, `800`, or `bold`.
   Allowed weights: `360` (body copy), `420` (UI text, buttons, links), `480` (headings, card titles), and `500` (uppercase eyebrows).
5. **NO Square Action Buttons:**
   All interactive buttons and pills must use rounded corners: `{rounded.xl}` (`32px`) or `{rounded.pill}` (`40px`).

---

## 3. Button Hierarchy & Single Primary Action Rule

- Only **ONE** solid `#5266eb` button (`button-primary`) is permitted per view or group (e.g. "Start exam", "Submit exam", "Create exam", "Save changes").
- All secondary actions must be soft translucent capsules (`button-tint-light`: `rgba(82, 102, 235, 0.10)` fill with `#28253b` text and `40px` radius, or `button-outline-light`).
- All buttons must declare an explicit variant (`primary`, `secondary`, `outline`, `ghost`, `tint`). Raw unstyled `<button>` elements are forbidden.

---

## 4. Typography Scale Reference

- **Stat Display:** `60px`, weight `480`, line-height `1.1`
- **Page Display:** `52px`, weight `480`, line-height `1.1`
- **Heading 1:** `42px`, weight `480`, line-height `1.15`
- **Heading 2:** `28px`, weight `480`, line-height `1.2`
- **Lead Copy:** `24px`, weight `480`, line-height `1.2`
- **Body Large:** `18px`, weight `360`, line-height `1.35`
- **Body Regular:** `16px`, weight `360`–`400`, line-height `1.4`
- **UI Label:** `14px`–`16px`, weight `420`, line-height `1.0`
- **Eyebrow:** `11px`–`14px`, weight `500`, uppercase, tracking `0.28px`
- **Legal / Metadata:** `12px`, weight `360`–`400`, line-height `1.4`
