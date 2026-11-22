---
name: frontend-performance
description: Enforces frontend performance standards, Core Web Vitals (LCP, INP, CLS < 0.1), bundle size budgets, route-level code splitting with React.lazy and Suspense, selective memoization, font preloading, and zero layout shift. Trigger when creating routes, loading third-party libraries, optimizing components, or auditing bundle size.
---

# Frontend Performance & Bundle Optimization Standard

This skill establishes the Core Web Vitals targets, bundle size limits, and code-splitting architecture for ProctorNet.

**Official Sources & Standards:**
- web.dev: Core Web Vitals Metrics (LCP < 2.5s, INP < 200ms, CLS < 0.1)
- React Official Documentation: Code Splitting, `React.lazy()`, `<Suspense>`, Profiler API
- MDN Web Docs: Resource Hints (`preload`, `prefetch`), Font Loading API
- Date of Authorship: 2026-11-22

---

## 1. Core Web Vitals & Performance Budgets

| Metric | Target Budget | Optimization Strategy |
| :--- | :--- | :--- |
| **Initial Bundle** | $< 250\text{kB}$ gzipped | Route-level code splitting with dynamic chunking in Vite. |
| **LCP** (Largest Contentful Paint) | $< 2.5\text{s}$ | Preload critical font files, optimize CSS delivery, server-side data caching. |
| **INP** (Interaction to Next Paint) | $< 200\text{ms}$ | Debounce high-frequency inputs, offload heavy calculations from main thread. |
| **CLS** (Cumulative Layout Shift) | $< 0.10$ (Strict $\approx 0$) | Explicit dimensions on media, fixed skeleton sizes matching loaded cards. |

---

## 2. Route-Level Code Splitting & Suspense

Every top-level application route MUST be loaded lazily:

```jsx
import React, { Suspense, lazy } from 'react'
import { RouteSkeleton } from '@/components/common/RouteSkeleton'

const StudentExamArenaPage = lazy(() => import('@/pages/student/StudentExamArenaPage'))
const FacultyDashboardPage = lazy(() => import('@/pages/faculty/FacultyDashboardPage'))

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <Routes>
        <Route path="/student/exams/:id/live" element={<StudentExamArenaPage />} />
        <Route path="/faculty/dashboard" element={<FacultyDashboardPage />} />
      </Routes>
    </Suspense>
  )
}
```

---

## 3. Zero Cumulative Layout Shift (CLS) Rules

1. **Reserved Skeleton Geometry:** Skeletons must match the exact height and width of the resolved content cards.
2. **Fixed Icon & Image Bounding Boxes:** All icons and avatars must specify fixed CSS or inline width and height (`w-5 h-5` / `width="20" height="20"`).
3. **No Dynamic Top Injections:** Banners, alerts, or notices must animate height smoothly or reserve space so they do not abruptly shift content downward.

---

## 4. Strategic Memoization Standard

- **`useMemo`:** Use ONLY for computationally expensive operations (e.g. sorting/filtering hundreds of student submissions or audit logs). Avoid premature memoization of primitive calculations.
- **`useCallback`:** Use ONLY when passing callback functions to memoized child components (`React.memo`) or as dependencies in `useEffect`.

---

## 5. Implementation Checklist

- [ ] Top-level routes split with `React.lazy()` and `<Suspense>`.
- [ ] Initial vendor JS bundle $< 250$kB gzipped.
- [ ] Cumulative Layout Shift is $< 0.10$ across all routes.
- [ ] Icons, images, and avatars declare explicit bounding box dimensions.
- [ ] Fonts use `font-display: swap` with critical WOFF2 preloaded.
- [ ] Heavy third-party libraries (e.g. charts, motion) loaded asynchronously.

---

## 6. Common Failures

- **Monolithic entry bundle:** Synchronously importing all dashboard pages in `App.jsx`.
- **Layout jumping (CLS):** Dynamically inserting error banners at the top of the page without space reservation.
- **Over-memoization:** Wrapping every single primitive variable in `useMemo`, adding memory overhead with zero gain.
- **Stale closures:** Omitting required state variables in `useCallback` dependency arrays.

---

## 7. Verification Commands

```bash
# Verify production bundle build and chunk distribution
npm run build

# Verify ESLint hooks and dependency arrays
npm run lint

# Lighthouse / Web Vitals audit via Playwright
npx playwright test scripts/ci/responsive-audit.spec.ts
```
