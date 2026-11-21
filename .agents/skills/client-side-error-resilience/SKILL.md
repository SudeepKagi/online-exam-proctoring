---
name: client-side-error-resilience
description: Complete standards for robust client-side error handling, React error boundaries, form validation, offline resilience, and the four mandatory view states (loading, error, empty, success).
---

# Client-Side Error Handling & Fault Resilience Standard

This skill establishes the engineering standards for handling client-side exceptions, network dropouts, API rejections, and state degradation in enterprise web applications.

## 1. The 4 Mandatory View States

Every asynchronous view, table, modal, and widget MUST implement and test four explicit states:

1. **Loading State:**
   - Skeleton screens or minimal spinner with informative text (`Loading exam schedule...`).
   - Retains layout dimensions to prevent Cumulative Layout Shift (CLS).
   - Interactive triggers are disabled (`disabled={loading}`).

2. **Error State:**
   - Never show a blank screen, raw stack trace, or unhandled rejection toast.
   - Distinct, human-readable error title and action-oriented explanation.
   - Clear recovery button (`Retry`, `Return to Dashboard`, `Contact Technical Support`).
   - Display a traceable reference ID (`Ref: #${requestId}`) for ops/support triage.

3. **Empty State:**
   - Informative headline (`No examinations scheduled`).
   - Plain-language explanation (`You do not have any active or upcoming examinations at this time.`).
   - Clear call to action when applicable (`Refresh Schedule`, `Browse Courses`).

4. **Success State:**
   - Normal content render with smooth entrance transition.

---

## 2. React Error Boundary Standard

Wrap the application root, each major route layout, and critical workflows (such as the Exam Runner) in an isolated `ErrorBoundary`:

```jsx
import React, { Component } from 'react'

export class RouteErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log to Sentry or monitoring endpoint without throwing
    if (window.reportError) {
      window.reportError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fbfcfd] flex items-center justify-center p-4 font-sans text-[#28253b]">
          <div className="max-w-md w-full bg-[#ffffff] rounded-[20px] p-6 shadow-[0_4px_20px_rgba(40,37,59,0.04)] text-center space-y-4">
            <div className="w-12 h-12 bg-[#edecfb] text-[#5266eb] rounded-full mx-auto flex items-center justify-center font-[480]">
              !
            </div>
            <h2 className="text-lg font-[480] text-[#28253b]">Something went wrong</h2>
            <p className="text-xs text-[#554e7b] font-[360] leading-relaxed">
              An unexpected issue occurred while rendering this view. Your saved exam progress is preserved.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={this.handleReset}
                className="w-full h-10 rounded-full bg-[#5266eb] text-white text-xs font-[420] hover:bg-[#4355d6] transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
```

---

## 3. Network Drop Resilience & Offline Caching

During active student exam sessions:
1. **Selection Autosave:** Every answer selection must trigger an immediate write to local state and asynchronous HTTP post.
2. **Offline Queue:** If `window.navigator.onLine === false` or the HTTP request fails with network error / timeout:
   - Immediately buffer the answer payload in `localStorage` or `IndexedDB`.
   - Update UI indicator to "Offline (Answers Saved Locally)" in soft slate/lavender.
   - Attach an `online` event listener to drain and sync buffered answers immediately upon reconnection.
3. **No Duplicate Submissions:** Never allow double submissions. Disable submit buttons immediately upon click (`disabled={submitting || isSubmitting}`).

---

## 4. Standard Error Mapping Contract

All API errors must be mapped using consistent utility functions:
```javascript
export function mapClientError(err, fallbackMessage = 'An unexpected error occurred.') {
  const data = err.response?.data || {}
  const status = err.response?.status
  const code = data.code || err.code || 'UNKNOWN_ERROR'
  const message = data.message || err.message || fallbackMessage
  const requestId = data.requestId || data.refId || 'N/A'

  if (status === 401) {
    return {
      title: 'Session Expired',
      message: 'Your login session has expired. Please log in again to continue.',
      code,
      requestId,
      shouldRedirectLogin: true
    }
  }

  if (status === 403) {
    return {
      title: 'Access Restricted',
      message: message || 'You do not have permission to access this resource.',
      code,
      requestId
    }
  }

  if (!window.navigator.onLine || err.message === 'Network Error') {
    return {
      title: 'Connection Lost',
      message: 'Network connection was interrupted. Please check your internet connection.',
      code: 'OFFLINE',
      requestId
    }
  }

  return {
    title: 'Request Failed',
    message,
    code,
    requestId
  }
}
```
