# ProctorNet Enterprise Design System Specification (MASTER.md)

> **STRICT ENTERPRISE MANDATE:** This application operates exclusively in the **Light Surface World** (`--color-canvas` `#fbfcfd`, `--color-surface` `#ffffff`, `--color-surface-tint` `#fbfbff`, `--color-lavender` `#edecfb`). Dark mode, dark page canvases, dark sidebars, neon status colors, heavy drop shadows, font weights above `500`, and `1px` box outlines around cards are strictly prohibited across all screens.
>
> Single Source of Truth: Refer to [DESIGN.md](file:///c:/Final%20year%20project/online-exam-proctoring/.agent/specs/DESIGN.md) and [05-enterprise-ui-design.md](file:///c:/Final%20year%20project/online-exam-proctoring/.agent/rules/05-enterprise-ui-design.md).

---

## 1. Typography System

Typography strictly uses `Inter` variable font (`'Inter', -apple-system, BlinkMacSystemFont, sans-serif`) with `JetBrains Mono` for monospace codes/numbers.
**Strict constraint: Never exceed font-weight 500.** (`600`, `700`, `800`, `bold` are strictly banned).

| Role | Family | Size | Weight | Line Height | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`{typography.stat}`** | `Inter` | 60px | 480 | 1.1 | 0.01em | Large stat numerals (scores, exam analytics) |
| **`{typography.display}`** | `Inter` | 52px | 480 | 1.1 | 0.01em | Main landing and portal headlines |
| **`{typography.heading-1}`** | `Inter` | 42px | 480 | 1.15 | 0.42px | Section & dashboard headlines |
| **`{typography.heading-2}`** | `Inter` | 28px | 480 | 1.2 | 0.42px | Card titles, exam titles, question group headers |
| **`{typography.lead}`** | `Inter` | 24px | 480 | 1.2 | 0.48px | Lead statements, active question prompt |
| **`{typography.body-lg}`** | `Inter` | 18px | 360 | 1.35 | 0 | Card descriptions, intro copy |
| **`{typography.body}`** | `Inter` | 16px | 400 | 1.4 | 0 | Default body copy, question choices |
| **`{typography.ui}`** | `Inter` | 16px | 420 | 1 | 0 | Primary buttons, nav links, text inputs |
| **`{typography.ui-sm}`** | `Inter` | 14px | 420 | 1 | 0.07px | Small pills, badges, accordion/table labels |
| **`{typography.eyebrow}`** | `Inter` | 14px | 500 | 1 | 0.28px | Uppercase eyebrows (e.g., `QUESTION 4 OF 20`) |
| **`{typography.legal}`** | `Inter` | 12px | 400 | 1.4 | 0.24px | Disclaimers, timestamps, footer fine print |
| **`{typography.mono}`** | `JetBrains Mono` | 13px | 450 | 1.2 | 0 | Timers, USNs, exam codes, IP addresses |

---

## 2. Color Tokens (Light-Only Palette)

```css
:root {
  /* Brand & Accent */
  --color-primary: #5266eb;                  /* Mercury Indigo - single primary CTA per view */
  --color-on-primary: #ffffff;               /* Labels on primary indigo */
  --color-primary-tint-10: rgba(82, 102, 235, 0.10); /* button-tint-light fill */
  --color-outline-light-fill: rgba(85, 78, 123, 0.10);
  --color-outline-light-border: rgba(85, 78, 123, 0.22);
  --color-periwinkle: #9cb4e8;

  /* Light-Only Surfaces */
  --color-canvas: #fbfcfd;                   /* Default page background */
  --color-surface: #ffffff;                  /* Inner columns, inputs, workspace cards */
  --color-surface-tint: #fbfbff;             /* Wrapper cards, table containers */
  --color-lavender: #edecfb;                 /* Feature cards, summary cards, empty states */

  /* Typography & Dividers */
  --color-ink: #28253b;                      /* Primary headlines and body text */
  --color-ink-secondary: #554e7b;            /* Descriptions, captions, eyebrows, metadata */
  --color-fog: #c3c3cc;                      /* 1px horizontal dividers between accordion/table rows */
  --color-slate: #70707d;                    /* Muted icons / secondary indicators */
}
```

---

## 3. Role Badges (Muted Mercury Tonal Tints)

No neon or high-saturation backgrounds. Each role uses soft lavender/indigo/slate tonal washes:

| Role | Tokens | Color Profile |
| :--- | :--- | :--- |
| **`ADMIN`** | `bg-[rgba(82,102,235,0.12)] text-[#5266eb]` | Indigo Tint Capsule (`rounded-full`) |
| **`FACULTY`** | `bg-[#edecfb] text-[#28253b]` | Lavender Surface Tint |
| **`INVIGILATOR`** | `bg-[rgba(156,180,232,0.25)] text-[#28253b]` | Periwinkle Tint |
| **`STUDENT`** | `bg-[#fbfbff] text-[#554e7b]` | Surface Tint Capsule |

---

## 4. Semantic Status Indicators

Status badges use subdued, enterprise-calibrated tonal badges (no neon):
- **`ACTIVE` / `VERIFIED`**: `bg-indigo-50 text-indigo-700` (`rounded-full px-3 py-1 text-xs`)
- **`PENDING` / `WARNING`**: `bg-amber-50 text-amber-800` (`rounded-full px-3 py-1 text-xs`)
- **`SUSPENDED` / `VIOLATION`**: `bg-rose-50 text-rose-800` (`rounded-full px-3 py-1 text-xs`)
- **`SUBMITTED` / `COMPLETED`**: `bg-[#edecfb] text-[#28253b]` (`rounded-full px-3 py-1 text-xs`)

---

## 5. Border Radii & Spatial Geometry (8px Base Unit)

- **Cards & Modals**: `12px` (`rounded-xl` / `{rounded.md}`)
- **Primary Action Button**: `32px` (`rounded-2xl` / `{rounded.xl}`, height `40px`, padding `0 20px`)
- **Secondary Action Pills & Nav Links**: `40px` (`rounded-full` / `{rounded.pill}`, height `40px`, padding `0 20px`)
- **Icon Buttons**: `40px × 40px` (`rounded-full` / `{rounded.full}`)
- **Form Inputs**: `8px` (`rounded-lg` / `{rounded.sm}`) or `32px` (`rounded-xl` fused)
- **Zero Box Outlines**: Cards separate from `#fbfcfd` canvas purely by surface fill (`#edecfb` or `#ffffff`), never `1px solid` box borders.
- **Elevation**: Level 0 Flat by default. Level 1 Soft Stack (`0 4px 20px rgba(40, 37, 59, 0.04)`) for modals and toasts only.
- **Single Primary Action Rule**: Exactly ONE solid `#5266eb` button per view/group; all others are translucent capsules (`rgba(82, 102, 235, 0.10)`).
