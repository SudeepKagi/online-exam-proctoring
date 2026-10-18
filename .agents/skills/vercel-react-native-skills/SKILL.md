---
name: vercel-react-native-skills
description: Vercel Touch Targets & Fluid Responsive UX standards for input heights, tap zones, and mobile responsiveness.
---

# Vercel Touch Targets & Fluid Responsive UX

This skill ensures effortless touch and mouse ergonomics across all devices and viewport sizes.

## 1. Ergonomic Touch Targets
- All primary buttons, secondary actions, form inputs, and select menus must have a minimum interactive height of `40px`–`44px` (`h-10` or `h-11`).
- Never build tiny `h-6` or `h-7` buttons for primary flows on candidate/faculty interfaces.

## 2. Responsive Table Wrappers
- Any data table must be wrapped in an overflow container (`overflow-x-auto`) with fixed minimum column widths to prevent text clipping on smaller displays.

## 3. Dynamic Breakpoint Scaling
- Adapt layouts gracefully:
  - Mobile (`< 640px`): Single-column stacks with full-width action buttons.
  - Tablet (`640px`–`1024px`): 2-column grids with horizontal tab controls.
  - Desktop (`> 1024px`): Rich multi-card dashboards with side-by-side verification and live console tiles.
