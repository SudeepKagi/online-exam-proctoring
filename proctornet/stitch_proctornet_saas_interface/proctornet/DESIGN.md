---
name: ProctorNet
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#005e6e'
  on-tertiary: '#ffffff'
  tertiary-container: '#00788c'
  on-tertiary-container: '#d7f6ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#4cd7f6'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  page-title:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  section-title:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  card-title:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  caption:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1440px
  sidebar-width: 260px
  gutter: 1.5rem
  margin-page: 2rem
  stack-sm: 0.5rem
  stack-md: 1rem
---

## Brand & Style
This design system is engineered for **ProctorNet**, a high-stakes educational environment where clarity, reliability, and focus are paramount. The aesthetic follows a **Corporate/Modern** SaaS dashboard direction, prioritizing information density without compromising cognitive load.

The brand personality is authoritative yet unobtrusive. It avoids decorative elements in favor of functional clarity, using a "Quiet UI" approach that allows student data and proctoring feeds to remain the focal point. The use of deep blues and professional grays evokes a sense of institutional security and academic integrity.

## Colors
The palette is anchored by **Primary Blue (#2563EB)**, signifying trust and intelligence. A range of blues and cyans provides depth for interactive elements and data visualization.

- **Primary**: Used for main actions, active states, and brand presence.
- **Secondary/Tertiary**: Reserved for multi-series data charts and progressive disclosure elements.
- **Surface**: The application uses a "Layered White" approach, where the sidebar and cards are `#FFFFFF` to pop against the `#F1F5F9` page background.
- **Status Colors**: High-saturation tones for immediate recognition of proctoring alerts (Success, Warning, Danger).

## Typography
The system utilizes **Inter** exclusively to maintain a utilitarian, highly legible environment. The type hierarchy is intentionally tight, reflecting the data-rich nature of an exam dashboard.

- **Contrast**: Primary text uses `#0F172A` for maximum readability. Secondary text (`#64748B`) is used for descriptions, and muted text (`#94A3B8`) for timestamps or placeholder hints.
- **Scaling**: On mobile devices, the `page-title` should scale down to `20px` to maintain screen real estate, while body text remains consistent at `14px` for accessibility.

## Layout & Spacing
The layout uses a **fixed sidebar + fluid content** model. The interface is built on a 4px baseline grid to ensure mathematical alignment of data tables and proctoring video grids.

- **Grid System**: Use a 12-column fluid grid for dashboard widgets.
- **Sidebar**: Fixed at `260px`. It features a `#E2E8F0` right border rather than a shadow to maintain a clean, flat aesthetic.
- **Responsive Behavior**: At tablet breakpoints (768px), the sidebar collapses into a hamburger menu. Card margins reduce from `2rem` to `1rem` on mobile devices.

## Elevation & Depth
This system avoids heavy shadows to prevent the UI from feeling cluttered. Depth is achieved primarily through **Tonal Layers** and subtle outlines.

- **Shadows**: Only one level of shadow is permitted (`shadow-sm`): `0 1px 2px 0 rgba(0, 0, 0, 0.05)`. This is applied to cards and primary buttons to provide just enough lift to signify interactivity.
- **Borders**: Interactive elements and containers use a subtle `1px` border (`#E2E8F0`) to define boundaries on the white surfaces.

## Shapes
The shape language is "Soft-Modern." It uses generous rounding for large containers to soften the "institutional" feel, while smaller components remain more structured.

- **Cards**: `12px` to `16px` border-radius (defaulting to `rounded-lg` or `rounded-xl` in utility frameworks).
- **Buttons & Inputs**: `8px` border-radius to maintain a professional, clickable appearance.
- **Status Indicators**: Small circular dots or fully pill-shaped badges for tags.

## Components
Consistent implementation of these core components ensures the dashboard feels unified:

- **Buttons**:
  - **Primary**: Solid `#2563EB` with white text, 8px radius, `shadow-sm`.
  - **Secondary**: Light blue background (`#EFF6FF`) with primary blue text.
- **Input Fields**: White background with `#E2E8F0` border. On focus, the border transitions to Primary Blue with a 2px outer glow (ring).
- **Cards**: The primary container for all data. Must have a white background, `1px` border in `#E2E8F0`, and `16px` rounded corners.
- **Data Tables**: Minimalist approach. Header row has a light gray background (`#F8FAFC`) with uppercase muted text. No vertical grid lines; use horizontal dividers only.
- **Icons**: Utilize the **Lucide** set. Use `1.5pt` or `2pt` stroke weights. Icons should always be paired with text or have clear tooltips to ensure the proctoring workflow is unambiguous.
- **Proctoring Feed Widgets**: Video containers should use a dark background (`#0F172A`) to minimize distractions and emphasize the video feed, with status overlays (e.g., "Live", "Alert") positioned in the top-right.