---
trigger: always_on
description: Enforces the strict Light-Only Enterprise Mercury Design System (.agent/specs/DESIGN.md) with zero dark theme, zero neon colors, zero box outlines, and light variable typography.
---

# Rule 05: Enterprise UI Design System (Strict Light-Only Mandate)

You MUST style every page, layout, form, table, modal, and component strictly according to `.agent/specs/DESIGN.md` with the following **mandatory enterprise constraints**:

## 1. STRICT LIGHT THEME ONLY (No Dark Mode / No Dark Surfaces)
- **Light Mode Exclusively:** Every page, dashboard, exam runner, login screen, and modal MUST use the Light Surface World (`{colors.canvas}` `#fbfcfd` background, `{colors.surface}` `#ffffff`, `{colors.surface-tint}` `#fbfbff`, and `{colors.lavender}` `#edecfb` cards).
- **No Dark Mode Toggle or `dark:` Classes:** Never implement a dark theme toggle, `@media (prefers-color-scheme: dark)`, or dark surface layouts.
- **No Dark Cards or Panels:** Never use `#171721` or `#1e1e2a` for page backgrounds, modals, sidebars, or feature cards. (If a top navigation bar or footer is used, keep the application workspace clean on `#fbfcfd` / `#ffffff` with `{colors.ink}` `#28253b` text).

## 2. Forbidden Visual Patterns (Strictly Banned)
- **NO Neon or Saturated Status Colors in Chrome:** Never use neon greens, bright reds, cyber blues, or vibrant oranges in the UI chrome. Status indicators and badges must use soft, muted indigo/lavender/slate tints (`rgba(82, 102, 235, 0.10)`, `#edecfb`, `#554e7b`).
- **NO Box Outlines on Cards or Containers:** Never use `1px solid` borders to separate cards from the page canvas. Cards separate from `#fbfcfd` purely by tonal fill (`#edecfb` Lavender or `#fbfbff` Surface Tint). The ONLY permitted `1px` rules are horizontal accordion/table row dividers in `{colors.fog}` (`#c3c3cc`) and `button-outline-light` (`1px` border at `22%` opacity).
- **NO Heavy Drop Shadows:** Elevation is tonal (Level 0 Flat). At most, floating pricing/comparison wrappers or modals may use Level 1 Soft Stack (`0 4px 20px rgba(40, 37, 59, 0.04)`).
- **NO Font Weights Above 500:** Never use `font-weight: 600`, `700`, `800`, or `bold`. Hierarchy is achieved through size, color (`#28253b` vs `#554e7b`), and tracking.
- **NO Square Action Buttons:** All interactive buttons and pills MUST use `{rounded.xl}` (`32px`) or `{rounded.pill}` (`40px`).

## 3. Single Primary Action Rule
- Only **ONE** solid `{colors.primary}` (`#5266eb`) button (`button-primary`, height `40px`, radius `32px`, padding `0 20px`) may appear in any view or button group (e.g., "Start exam", "Submit exam", "Create exam").
- Every other button on the screen MUST be a soft translucent capsule (`button-tint-light`: `rgba(82, 102, 235, 0.10)` fill with `#28253b` label and `40px` radius, or `button-outline-light`).
