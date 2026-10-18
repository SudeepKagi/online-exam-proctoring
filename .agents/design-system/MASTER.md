# ProctorNet Design System Specification (MASTER.md)

This document is the **Single Source of Truth** for UI/UX engineering, visual hierarchy, spatial rhythm, token styling, and accessible component behaviors across all ProctorNet applications.

---

## 1. Typography System

ProctorNet bans generic AI typography (`Inter`, `Roboto`, `Arial`, `Space Grotesk`). All interfaces load and use three distinct typefaces:

| Role | Family | Weights | Usage |
| :--- | :--- | :--- | :--- |
| **Display / Headings** | `Plus Jakarta Sans` | 600 (Semibold), 700 (Bold), 800 (Extrabold) | Hero titles, page headings (`h1`–`h4`), modal titles, card headers |
| **Interface / Body** | `DM Sans` | 400 (Regular), 500 (Medium), 600 (Semibold) | Labels, descriptions, buttons, body copy, tooltips, dialog text |
| **Monospace / Metric** | `JetBrains Mono` | 400 (Regular), 500 (Medium), 700 (Bold) | Timers, countdowns, USNs, exam codes, scores, IP addresses, logs |

### Font Size & Hierarchy Scale
- **Display 1 (Hero)**: `text-4xl sm:text-5xl font-extrabold tracking-tight`
- **Heading 1 (`h1`)**: `text-2xl sm:text-3xl font-bold tracking-tight text-slate-900`
- **Heading 2 (`h2`)**: `text-xl font-bold tracking-tight text-slate-900`
- **Heading 3 (`h3`)**: `text-base font-bold text-slate-900`
- **Body Large**: `text-sm font-medium text-slate-700 leading-relaxed`
- **Body Regular**: `text-xs font-normal text-slate-600 leading-normal`
- **Caption / Meta**: `text-[11px] font-medium text-slate-500`
- **Badge / Micro**: `text-[10px] font-bold tracking-wide uppercase`
- **Metric / Monospace**: `font-mono text-xs font-bold tracking-tight tabular-nums`

---

## 2. Color Palette & Atmospheric Tokens

ProctorNet applies a layered, institutional aesthetic utilizing high-contrast slate canvases and royal blue accents.

### Surface Elevation System
- **App Canvas**: `#F8FAFC` (`bg-slate-50`)
- **Card / Modal Surface**: `#FFFFFF` (`bg-white`)
- **Sub-surface / Input Inset**: `#F1F5F9` / `#F8FAFC` (`bg-slate-100` / `bg-slate-50`)
- **Active Navigation / Sidebar**: `#0F172A` (`bg-slate-900`) with `#1E293B` borders
- **Surface Borders**: `1px solid rgba(226, 232, 240, 0.9)` (`border-slate-200`)
- **Shadow Elevations**:
  - Resting Card: `shadow-xs border border-slate-200`
  - Elevated Popover / Dropdown: `shadow-md shadow-slate-900/5 border border-slate-200`
  - Modal / Dialog: `shadow-xl shadow-slate-900/10 border border-slate-200`

### Brand & Interactive Colors
- **Primary Blue**: `#2563EB` (`bg-blue-600 hover:bg-blue-700 text-white`)
- **Primary Focus Ring**: `focus-visible:ring-2 focus-visible:ring-blue-600/25 focus-visible:border-blue-600`
- **Secondary Slate**: `#475569` (`text-slate-600 bg-slate-100 hover:bg-slate-200`)

---

## 3. Role Badges & Identities

Each institutional role uses dedicated, consistent badge colors:

| Role | Tailwind Token Combination | Hex / Color Profile |
| :--- | :--- | :--- |
| **`ADMIN`** | `bg-indigo-50 text-indigo-700 border-indigo-200` | Royal Indigo `#4338CA` |
| **`FACULTY`** | `bg-blue-50 text-blue-700 border-blue-200` | Academe Blue `#1D4ED8` |
| **`INVIGILATOR`**| `bg-violet-50 text-violet-700 border-violet-200` | Sentinel Violet `#6D28D9` |
| **`STUDENT`** | `bg-emerald-50 text-emerald-700 border-emerald-200` | Scholar Emerald `#047857` |

---

## 4. Semantic Status Badges & Indicators

Status tokens convey operational state unambiguously:

| Status | Tokens | Semantic Meaning |
| :--- | :--- | :--- |
| **`ACTIVE`** | `bg-emerald-50 text-emerald-700 border-emerald-200` | Verified, Operational, In-Progress |
| **`PENDING_APPROVAL`** | `bg-amber-50 text-amber-700 border-amber-200` | Awaiting Administrative Review |
| **`PENDING_SETUP`** | `bg-amber-50 text-amber-700 border-amber-200` | Candidate Provisioned, Setup Required |
| **`REJECTED`** | `bg-rose-50 text-rose-700 border-rose-200` | Identity Failed or Disapproved |
| **`SUSPENDED`** | `bg-rose-50 text-rose-700 border-rose-200` | Attempt or Account Locked |
| **`SUBMITTED`** | `bg-blue-50 text-blue-700 border-blue-200` | Exam Successfully Finalized |

---

## 5. Border Radii & Spatial Geometry

- **Cards & Dialog Containers**: `rounded-xl` (`12px`) or `rounded-2xl` (`16px`)
- **Interactive Inputs, Selects, Buttons**: `rounded-lg` (`8px`) or `rounded-xl` (`12px`)
- **Pill / Status Badges**: `rounded-full` or `rounded-md` (`6px`)
- **Interactive Touch Targets**: Minimum height `40px`–`44px` (`h-10` / `h-11`)
- **Padding Standards**:
  - Page Canvas: `p-4 sm:p-6 lg:p-8`
  - Card Inner: `p-5 sm:p-6`
  - Component Gap: `gap-4 sm:gap-6`

---

## 6. Accessibility & Form Ergonomics (WCAG 2.1 AA)

1. **Text Contrast**: Normal text must maintain `>= 4.5:1` contrast (`text-slate-700` or `text-slate-900` on light backgrounds).
2. **Accessible Labels**: Every form field must have a visible or screen-reader accessible `<Label htmlFor="...">`.
3. **Password Visibility**: All password fields must provide a toggle button with `aria-label="Toggle password visibility"`.
4. **Loading Feedback**: All async buttons must display an animated spinner and `disabled={isSubmitting}` during network transit.
