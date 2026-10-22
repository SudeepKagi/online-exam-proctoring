# Enterprise Design System Specification (Mercury Light-World Standard)

> **STRICT OVERRIDE:** This application operates exclusively in the **Light Surface World** (`{colors.canvas}` `#fbfcfd`, `{colors.surface}` `#ffffff`, `{colors.surface-tint}` `#fbfbff`, `{colors.lavender}` `#edecfb`). Dark mode, dark page canvases, neon colors, heavy shadows, font weights above `500`, and `1px` box outlines around cards are strictly prohibited.

## 1. Overview
The interface feels like a private bank that happens to be a software company: quiet, precise, calm, and confident.
- Pages live on a near-white canvas (`{colors.canvas}` — `#fbfcfd`), with deep plum-ink text (`{colors.ink}` — `#28253b`), muted secondary ink (`{colors.ink-secondary}` — `#554e7b`), and pale lavender feature/content cards (`{colors.lavender}` — `#edecfb`) or pure white surface columns (`{colors.surface}` — `#ffffff`).
- One color carries primary actions: **Mercury Indigo** (`{colors.primary}` — `#5266eb`). Everything else clickable is softer: translucent secondary pills tinted with a 10% wash of indigo or grey-violet, all with generous `40px` capsule corners.
- Typography uses `Inter` (variable open-source match for `arcadiaDisplay` and `arcadia`) at unusually light variable weights (`360` for body copy, `420` for UI, `480` for headlines, `500` for small uppercase eyebrows). Nothing on the page is bold in the usual sense.

---

## 2. Color Tokens (CSS Variables)

```css
:root {
  /* Brand & Accent */
  --color-primary: #5266eb;                  /* Mercury Indigo - single primary CTA per view */
  --color-on-primary: #ffffff;               /* Labels on primary indigo */
  --color-primary-tint-10: rgba(82, 102, 235, 0.10); /* button-tint-light fill */
  --color-outline-light-fill: rgba(85, 78, 123, 0.10);
  --color-outline-light-border: rgba(85, 78, 123, 0.22);
  --color-periwinkle: #9cb4e8;

  /* Light-Only Surfaces (Mandatory Across All Views) */
  --color-canvas: #fbfcfd;                   /* Default page background */
  --color-surface: #ffffff;                  /* Inner columns, inputs, active workspace cards */
  --color-surface-tint: #fbfbff;             /* Wrapper cards, table/comparison containers */
  --color-lavender: #edecfb;                 /* Feature cards, question summary cards, empty states */

  /* Typography & Dividers */
  --color-ink: #28253b;                      /* Primary headlines and body text */
  --color-ink-secondary: #554e7b;            /* Descriptions, captions, eyebrows, metadata */
  --color-fog: #c3c3cc;                      /* 1px horizontal dividers between accordion/table rows */
  --color-slate: #70707d;                    /* Muted icons / secondary indicators */

  /* Reference Tokens from Base Spec (Do NOT use for dark theme page backgrounds) */
  --color-night: #171721;
  --color-night-raised: #1e1e2a;
  --color-on-dark: #ededf3;
}
```

---

## 3. Typography Scale
Use Inter variable font (`'Inter', -apple-system, BlinkMacSystemFont, sans-serif`) as the open-source substitute for `arcadiaDisplay` and `arcadia`. Never exceed `font-weight: 500`.

| Token | Role / Family | Size | Weight | Line Height | Letter Spacing | Use |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `{typography.stat}` | Display (Inter) | 60px | 480 | 1.1 | 0.01em | Large stat numerals (e.g., exam score, completion stats) |
| `{typography.display}` | Display (Inter) | 52px | 480 | 1.1 | 0.01em | Hero / main portal headlines |
| `{typography.heading-1}` | Display (Inter) | 42px | 480 | 1.15 | 0.42px | Section & dashboard headlines |
| `{typography.heading-2}` | Display (Inter) | 28px | 480 | 1.2 | 0.42px | Card titles, exam titles, question group headers |
| `{typography.lead}` | Display (Inter) | 24px | 480 | 1.2 | 0.48px | Lead statements, active exam question prompt |
| `{typography.body-lg}` | Text (Inter) | 18px | 360 | 1.35 | 0 | Card descriptions, intro copy |
| `{typography.body}` | Text (Inter) | 16px | 400 | 1.4 | 0 | Default body copy, question options |
| `{typography.ui}` | Text (Inter) | 16px | 420 | 1 | 0 | Buttons, nav links, text inputs |
| `{typography.ui-sm}` | Text (Inter) | 14px | 420 | 1 | 0.07px | Small pills, timer badges, accordion/table labels |
| `{typography.eyebrow}` | Text (Inter) | 14px | 500 | 1 | 0.28px | Uppercase eyebrows (QUESTION 4 OF 20, UPCOMING EXAMS) |
| `{typography.legal}` | Text (Inter) | 12px | 400 | 1.4 | 0.24px | Disclaimers, timestamps, footer fine print |

---

## 4. Layout, Spacing & Grid

### Spacing System (8px Base Unit)
- `{spacing.xs}`: 8px
- `{spacing.sm}`: 12px
- `{spacing.md}`: 16px
- `{spacing.lg}`: 20px
- `{spacing.xl}`: 24px
- `{spacing.xxl}`: 32px (Default internal padding for all cards)
- `{spacing.huge}`: 40px
- `{spacing.section}`: 80px (Minimum vertical gap between major page sections)
- `{spacing.section-lg}`: 128px

### Grid & Container
- **Max Container Width:** Centered 1100px–1200px column. Section headlines are centered and constrained to ~600px.
- **Card Grids:** 2-up and 3-up CSS Grid with 24px (`{spacing.xl}`) or 32px (`{spacing.xxl}`) gap.

### Responsive Breakpoints
- **Desktop (>= 1200px):** Full horizontal nav with pill links; 3-up card grids; split sections side-by-side.
- **Laptop (1024px–1199px):** Fluid container scaling.
- **Tablet (768px–1023px):** Grids reflow to 2-up; split sections stack vertically.
- **Mobile (< 768px):** Single-column cards; touch targets padded to minimum 44px.

---

## 5. Elevation & Shapes

### Elevation Levels (Tonal Depth, No Box Borders)
- **Level 0 — Flat:** No shadow and no border. Separated purely by surface fill (`#edecfb` Lavender or `#ffffff` Surface on `#fbfcfd` Canvas). Used for cards, pills, and inputs.
- **Level 1 — Soft Stack:** Very faint layered shadow (`0 2px 12px rgba(40, 37, 59, 0.04), 0 8px 24px rgba(40, 37, 59, 0.03)`). Used only for elevated comparison wrappers, modals (`ex-modal-card`), and toasts (`ex-toast`).

### Border Radius Scale
- `{rounded.none}`: 0px (Full-width bars, table columns)
- `{rounded.xs}`: 4px (Small tags, checkboxes)
- `{rounded.sm}`: 8px (Images, small controls, select menus)
- `{rounded.md}`: 12px (All feature cards, question cards, exam summary cards, modals)
- `{rounded.lg}`: 16px (Large media frames and workspace panels)
- `{rounded.xl}`: 32px (Primary action pill `button-primary`, fused input left edge)
- `{rounded.pill}`: 40px (All secondary action pills and navigation pills)
- `{rounded.full}`: 9999px (Round icon buttons, toggle switches, fused search/email capsules)

---

## 6. Component Primitives

### Buttons (Max 1 Solid Primary Button Per View)
- **`button-primary`**: `{colors.primary}` (`#5266eb`) fill, `{colors.on-primary}` (`#ffffff`) label, `{typography.ui}`, `{rounded.xl}` (32px), height 40px, padding 0 20px, border none.
- **`button-tint-light`**: `rgba(82, 102, 235, 0.10)` fill, `{colors.ink}` (`#28253b`) label, `{typography.ui}`, `{rounded.pill}` (40px), height 40px, padding 0 20px, border none. Used for secondary actions ("Save draft", "Previous question", "View details").
- **`button-outline-light`**: `rgba(85, 78, 123, 0.10)` fill with 1px solid `rgba(85, 78, 123, 0.22)` border, `{colors.ink}` label, `{rounded.pill}` (40px), height 40px, padding 0 20px.
- **`button-small`**: 32px tall variant of `button-tint-light` in `{typography.ui-sm}` with 0 16px padding.
- **`button-icon-round`**: 40px × 40px `{rounded.full}` (9999px) icon button using `rgba(82, 102, 235, 0.10)` fill.

### Inputs & Forms
- **`text-input`**: `{colors.surface}` (`#ffffff`) fill on `{colors.lavender}` or `{colors.surface-tint}` containers, `{typography.ui}` (16px, weight 420), 20px horizontal padding, 46px height, `{rounded.sm}` (8px) for standalone form fields or `{rounded.xl}` (32px) when fused inside a capsule. No harsh black/grey box outlines; use tonal fill contrast or a subtle 1px solid `rgba(85, 78, 123, 0.18)` focus ring.
- **`toggle-switch`**: `{colors.primary}` (`#5266eb`) pill switch (`{rounded.full}`) paired with `{colors.ink-secondary}` `{typography.ui}` label.

### Cards, Tables & Containers
- **`feature-card-light`**: `{colors.lavender}` (`#edecfb`) fill, `{rounded.md}` (12px), `{spacing.xxl}` (32px) padding, no border, no shadow. Title in `{typography.heading-2}` (`#28253b`) and description in `{typography.body-lg}` (`#554e7b`).
- **`surface-workspace-card`**: `{colors.surface-tint}` (`#fbfbff`) wrapper with `{rounded.md}` (12px) and inner `{colors.surface}` (`#ffffff`) columns/panels padded at 32px. Used for the active Exam Runner, Question Navigator, and Teacher Grading tables.
- **`accordion-row` / `ex-data-table-cell`**: Full-width row with 10px–16px vertical padding and a 1px solid `{colors.fog}` (`#c3c3cc`) horizontal bottom rule only (no vertical cell borders or outer box outlines). Table headers use `{typography.eyebrow}` (14px, uppercase, weight 500, `#554e7b`).
- **`ex-auth-form-card` / `ex-modal-card` / `ex-empty-state-card` / `ex-toast`**: All built from `feature-card-light` (`#edecfb` or `#ffffff` on `#fbfcfd`), `{rounded.md}` (12px), `{spacing.xxl}` (32px) padding, using tonal contrast instead of borders.
