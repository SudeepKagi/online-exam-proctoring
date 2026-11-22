---
name: enterprise-motion-restraint
description: Enforces enterprise motion restraint, micro-interaction timing, cheap-to-animate properties, stagger, skeletons, page/sheet transitions, CSS-first orchestration, lazy React motion, prefers-reduced-motion, and strict zero-motion limits in the exam arena. Trigger when implementing or reviewing animations, transitions, loaders, or visual feedback.
---

# Enterprise Motion Restraint Standard

This skill defines the technical standards, durations, and accessibility constraints for fluid, high-performance UI motion in ProctorNet.

**Official Sources & Standards:**
- MDN Web Docs: `@media (prefers-reduced-motion)`, CSS Transitions & Transforms, View Transitions API
- web.dev: High Performance Animations (GPU Composite Layer Optimization)
- Motion for React (framer-motion / motion/react official specifications)
- Date of Authorship: 2026-11-22

---

## 1. Principles of Motion Restraint

1. **Restraint over Spectacle:** Motion serves orientation and status feedback, never decoration.
2. **GPU-Accelerated Transforms Only:** Strictly animate `transform` (`translate3d`, `scale`) and `opacity`. NEVER animate `width`, `height`, `top`, `left`, `margin`, or `padding` (prevents reflow and CLS).
3. **CSS First:** Use native CSS transitions for standard hover/focus states; load React motion (`motion/react` via `MotionWrapper.jsx`) only where exit animations or gesture coordination are required.

---

## 2. Timing, Easing & Stagger Scales

| Scope | Duration | Easing Function | Application |
| :--- | :--- | :--- | :--- |
| **Micro** | `120ms`–`150ms` | `ease-out` / `cubic-bezier(0.16, 1, 0.3, 1)` | Button press, tab pill indicator, checkbox fill. |
| **Surface** | `200ms`–`240ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | Bottom sheets, modal entrance, card reveal. |
| **Exit** | `120ms`–`150ms` | `ease-in` / `cubic-bezier(0.7, 0, 0.84, 0)` | Modal dismissal, toast dismissal. |

- **Stagger Reveal:** Stagger child list items by `30ms`–`40ms` with a cap of 5 items (`delayChildren: 0.02`, `staggerChildren: 0.04`).
- **Skeletons:** Subtle pulse between `#edecfb` and `#f4f3fd` over `1.8s` linear. Zero high-contrast metallic shimmers.
- **Page Transitions:** Use View Transitions API (`document.startViewTransition`) where supported; fallback to 6px vertical slide + fade (`duration: 0.22s`).

---

## 3. STRICT EXAM ARENA ZERO-MOTION INVARIANT

Inside the active examination runner (`/student/exams/:id/live`):
- **Zero Distracting Motion:** Continuous loops, pulsing borders, ambient floating icons, and bouncing indicators are strictly forbidden.
- **Timer Sanctity:** Strictly NO animation, scale pulse, or bounce near the countdown timer. The timer is purely text-rendered.
- **Answer Selection:** Radio/checkbox clicks transition instantly or with micro-fade ($\le 80$ms) with zero layout travel.

---

## 4. Accessibility: Reduced Motion Standard

When `@media (prefers-reduced-motion: reduce)` is enabled:
- Set animation duration to `0.001ms` (or `none`).
- Suppress all translation/scaling effects.
- Replace travel transitions with instantaneous state changes or subtle 100ms opacity fades.

---

## 5. Implementation Checklist

- [ ] Only `transform` and `opacity` are animated.
- [ ] Micro-interactions complete in $\le 150$ms; modal entrances in $\le 240$ms.
- [ ] No looping or distracting animations inside the live exam arena.
- [ ] Countdown timer has zero motion effects.
- [ ] Skeletons use tonal `#edecfb` lavender pulse with matching card dimensions.
- [ ] `@media (prefers-reduced-motion: reduce)` removes all spatial transforms.
- [ ] Motion components are loaded through `frontend/src/components/common/MotionWrapper.jsx`.

---

## 6. Common Failures

- **Layout thrashing:** Animating `height: auto` causing 60fps frame drops.
- **Arena violations:** Adding animated pulsing warnings near the active exam countdown timer.
- **Ignoring reduced motion:** Failing to test with `reducedMotion: 'reduce'`.
- **Heavy initial bundles:** Importing heavy animation bundles synchronously in main entry point.

---

## 7. Verification Commands

```bash
# Verify component syntax and motion imports
npm run lint

# Test motion and reduced-motion emulation in Playwright
npx playwright test tests/e2e/exam-runner-motion.spec.ts --project=chromium

# Verify production build bundle size
npm run build
```
