---
name: client-error-resilience
description: Enforces frontend client error handling, the 6 mandatory async states (loading, empty, error, offline, forbidden, session_expired), React error boundaries, retries with backoff and AbortController, idempotent submits, inline field-level validation, toasts vs inline cards, and plain-English actionable error messages. Trigger when building or auditing data fetching, form submits, error boundaries, or network resilience.
---

# Client Error Handling & Fault Resilience Standard

This skill establishes the engineering standards for handling client-side exceptions, network dropouts, API rejections, and state degradation in ProctorNet.

**Official Sources & Standards:**
- React Official Documentation: Error Boundaries, Suspense & Async UI Patterns
- MDN Web Docs: `AbortController`, `fetch()`, `IndexedDB`, Online/Offline Events
- RFC 9110: HTTP Semantics & Method Idempotency
- Date of Authorship: 2026-11-22

---

## 1. The 6 Mandatory Async View States

Every asynchronous screen, table, modal, and widget MUST implement explicit states:

1. **`loading`:** Skeleton screens in `#edecfb` matching exact layout dimensions (prevents CLS).
2. **`empty`:** Clear explanation with supportive icon and primary next-step action.
3. **`error`:** Human-readable title, plain recovery steps, retry button, and traceable reference code (`Ref: #${refId}`).
4. **`offline`:** Visual offline banner; answers buffered locally in `IndexedDB`/`localStorage` with automatic re-sync upon reconnection.
5. **`forbidden`:** 403 access explanation with clean return link; zero answer or rubric leakage.
6. **`session_expired`:** 401 interceptor cleanly redirects to `/login` preserving return URL; never a frozen screen.

---

## 2. React Error Boundary Standard

Wrap the application root and critical workflows (e.g., the Exam Runner) in an isolated `ErrorBoundary` styled with light enterprise tokens:

```jsx
import React, { Component } from 'react'

export class RouteErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    if (window.reportError) window.reportError(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] bg-[#fbfcfd] flex items-center justify-center p-4 text-[#28253b]">
          <div className="max-w-md w-full bg-[#ffffff] rounded-[24px] p-6 shadow-[0_4px_20px_rgba(40,37,59,0.04)] text-center space-y-4">
            <div className="w-12 h-12 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center font-[480]">!</div>
            <h2 className="text-lg font-[480] text-[#28253b]">An unexpected display issue occurred</h2>
            <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
              Your saved exam progress is securely preserved. Please reload to restore your session.
            </p>
            <button onClick={this.handleReset} className="w-full h-10 rounded-full bg-[#5266eb] text-white text-xs font-[420] hover:bg-[#4355d6]">
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## 3. Network Resilience & AbortController

- **Stale Request Cancellation:** Always pass an `AbortSignal` (`const controller = new AbortController()`) to `fetch` or Axios requests; abort on unmount or route change.
- **Transient Retries:** Retry 502, 503, 504, and network timeouts with exponential backoff (e.g. 500ms, 1500ms, 3000ms) with random jitter. NEVER retry 4xx client errors (400, 401, 403, 404, 422).
- **Idempotent Submissions:** Submit buttons disable immediately upon click (`disabled={isSubmitting}`) with loading indicator. Backend uses atomic conditional updates (`WHERE status = 'IN_PROGRESS'`).

---

## 4. Plain-English Errors & Toasts vs Inline Cards

- **Toasts:** Use toasts only for non-blocking, transient notifications (e.g., "Answer autosaved").
- **Inline Cards:** Use inline lavender cards (`#edecfb`) for blocking errors or dead ends.
- **Zero Raw Leaks:** Never display raw stack traces, SQL errors, or unhandled rejection strings. Always translate error codes into plain English with a concrete next action.

---

## 5. Implementation Checklist

- [ ] All 6 async states implemented and tested.
- [ ] Error Boundary wraps application root and exam runner.
- [ ] Requests use `AbortController` to cancel in-flight queries on unmount.
- [ ] Submit buttons lock immediately (`disabled={isSubmitting}`) preventing double-clicks.
- [ ] Offline autosave buffers answers in `IndexedDB`/`localStorage` and drains on reconnect.
- [ ] Error messages display plain language and reference ID; raw stacks forbidden.

---

## 6. Common Failures

- **Blank screen crash:** Uncaught JavaScript exception without an Error Boundary.
- **Double submissions:** Unprotected submit button allowing rapid double-clicks.
- **Infinite 401 loops:** Interceptor continuously re-requesting unauthorized endpoints.
- **Raw stack traces:** Showing database error messages or internal JSON in the user interface.

---

## 7. Verification Commands

```bash
# Verify component syntax and error boundary exports
npm run lint

# Backend error handling and resilience tests
npm test --workspace=backend

# Playwright offline recovery and double-click test
npx playwright test e2e/offline-recovery.spec.ts e2e/idempotent-submit.spec.ts
```
