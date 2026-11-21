---
name: enterprise-motion-tokens
description: Design tokens, cubic beziers, spring curves, and accessibility specifications for fluid, enterprise-grade web interfaces adhering to the Mercury Light Design System.
---

# Enterprise Motion Tokens & Physics Guidelines

This specification defines the exact timing functions, spring configurations, and spatial animations permitted in the Mercury Light Enterprise Design System.

## 1. Timing & Duration Scale

| Token | Duration | Usage |
| :--- | :--- | :--- |
| `duration-instant` | `80ms` | Instant state toggles, checkbox checks, radio fills |
| `duration-micro` | `140ms` | Button hover, tap compression, tab indicator travel |
| `duration-base` | `220ms` | Accordion expand/collapse, dropdown menus, tooltips |
| `duration-surface`| `320ms` | Modals, drawers, dialog appearance, slide-overs |
| `duration-page` | `400ms` | Full-page transitions, route loading skeletons |

---

## 2. Easing Curves (Cubic Beziers)

```css
:root {
  /* Fluid deceleration for entrances and reveals */
  --ease-out-fluid: cubic-bezier(0.16, 1, 0.3, 1);
  
  /* Natural acceleration for exits and dismissals */
  --ease-in-fluid: cubic-bezier(0.7, 0, 0.84, 0);
  
  /* Balanced standard transition for colors and borders */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 3. Spring Physics Specifications

When implementing spring physics in Framer Motion, use these calibrated values:

```javascript
export const ENTERPRISE_SPRINGS = {
  // Micro interactions (buttons, pills, icons)
  buttonPress: {
    type: 'spring',
    stiffness: 520,
    damping: 32,
    mass: 0.6
  },
  
  // Floating dropdown menus & popovers
  popover: {
    type: 'spring',
    stiffness: 420,
    damping: 28,
    mass: 0.8
  },
  
  // Dialogs, full modals, and center cards
  modal: {
    type: 'spring',
    stiffness: 340,
    damping: 30,
    mass: 1.0
  },
  
  // Sliding side sheets and drawers
  drawer: {
    type: 'spring',
    stiffness: 280,
    damping: 30,
    mass: 1.1
  }
}
```

---

## 4. Accessibility Contract: Reduced Motion

When `@media (prefers-reduced-motion: reduce)` is active:
- Remove all 2D/3D translation (`translate3d`, `translateX`, `translateY`).
- Remove scale transforms (`scale(0.95) -> scale(1)`).
- Replace movement with subtle opacity fades (`duration: 100ms`).
- Preserve layout stability (zero CLS).
