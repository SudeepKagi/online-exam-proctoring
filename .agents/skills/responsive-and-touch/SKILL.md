---
name: responsive-and-touch
description: Enforces mobile-first responsive design, dynamic viewport heights (dvh), safe area insets, 44x44px minimum touch targets, container queries, tables-to-cards transformations, and mobile bottom sheets. Trigger when creating or reviewing responsive layouts, mobile interactions, tables, or touch ergonomics.
---

# Responsive Layout & Touch Ergonomics Standard

This skill establishes the cross-device layout, touch target, and viewport ergonomics standards for ProctorNet across mobile, tablet, and desktop viewports.

**Official Sources & Standards:**
- MDN Web Docs: CSS Viewport Units (`dvh`, `svh`), CSS Container Queries (`@container`), Safe Area Insets (`env(safe-area-inset-*)`)
- W3C WCAG 2.2: Success Criterion 2.5.8 Target Size (Minimum 24px) & Criterion 2.5.5 Target Size (Enhanced 44px)
- Apple Human Interface Guidelines / Google Material Design (44x44pt Minimum Touch Target)
- Date of Authorship: 2026-11-22

---

## 1. Mobile-First Fluid Breakpoints

Layouts must be designed mobile-first starting at 360px portrait and fluidly expanding:

| Viewport | Range | Layout Paradigm |
| :--- | :--- | :--- |
| **Mobile** | `360px`–`767px` | Single-column stacked cards, bottom navigation, bottom sheets. |
| **Tablet** | `768px`–`1023px` | Collapsible sidebar, two-column cards, adaptive tables. |
| **Desktop** | `1024px`–`1440px+` | Persistent navigation, multi-column workspace, full data grids. |

---

## 2. Dynamic Viewport Heights (`dvh`) & Safe Areas

1. **Dynamic Viewport Heights:**
   - Always use `100dvh` or `min-h-[100dvh]` for full-height views.
   - NEVER use `100vh` on full-screen containers (causes mobile browser address bars to clip bottom primary action buttons).
2. **Safe Area Insets:**
   - Anchor floating bottom bars and sticky action footers with:
     `padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));`
     `padding-top: max(12px, env(safe-area-inset-top, 0px));`

---

## 3. Touch Targets (44x44px Minimum)

- **Target Size Standard:** Every interactive element (buttons, tabs, inputs, checkboxes, radio tiles, icon buttons) must provide a hit target of at least `44px` $\times$ `44px`.
- **Small Visual Elements:** If a button icon is visually `16px` or `20px`, expand its hit area using padding (`p-2.5` or `p-3`) or pseudo-elements (`after:inset-[-8px]`).

---

## 4. Tables-to-Cards Transformation (< 768px)

On mobile viewports ($< 768$px):
- Multi-column tables must NOT force horizontal scrolling.
- Transform data rows into stacked vertical cards (`bg-[#edecfb]` or `bg-[#ffffff]` with `rounded-[16px]` and `p-4`).
- Display column headers as inline labels alongside cell values (key-value pairs).

---

## 5. Mobile Bottom Sheets (< 640px)

- On viewports $< 640$px, centered dialogs transform into bottom-anchored sheets (`rounded-t-[20px]`).
- The primary action pill stays docked at the bottom above the safe area.

---

## 6. Zero Horizontal Overflow (Anti-Cheating Invariant)

- `document.documentElement.scrollWidth` must never exceed `clientWidth`.
- NEVER use `overflow-x: hidden` or `overflow-x: clip` on `html` or `body` to hide overflowing elements. Fix the underlying layout width.

---

## 7. Implementation Checklist

- [ ] Full-screen views use `100dvh` instead of `100vh`.
- [ ] Safe areas (`env(safe-area-inset-bottom)`) applied to sticky footers.
- [ ] All interactive buttons and inputs have $\ge 44 \times 44$px clickable target.
- [ ] Tables transform to cards on screen widths $< 768$px.
- [ ] Dialogs render as bottom sheets on screen widths $< 640$px.
- [ ] Zero horizontal page overflow at 360px, 768px, and 1366px viewports.
- [ ] No `overflow-x: hidden` cheats on `html` or `body`.

---

## 8. Common Failures

- **Clipped buttons:** Using `h-screen` (`100vh`) causing submit buttons to be hidden behind mobile safari/chrome navbars.
- **Micro touch targets:** Icon buttons styled as `w-6 h-6` with no hit area padding.
- **Horizontal table blowouts:** Wide tables overflowing mobile viewport width.
- **Masking cheats:** Applying `overflow-x: hidden` to `body` to pass overflow checks.

---

## 9. Verification Commands

```bash
# Automated responsive audit across mobile, tablet, and desktop viewports
npx playwright test scripts/ci/responsive-audit.spec.ts

# Production build syntax verification
npm run build
```
