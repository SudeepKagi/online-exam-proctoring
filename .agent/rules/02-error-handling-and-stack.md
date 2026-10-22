---
trigger: always_on
description: Enforces Backend (Express/Zod/Pino/Sentry) and Frontend (Error Boundary/RHF/Interceptors) error handling standards.
---

# Rule 02: Error Handling & Stack Checklist

## Backend Checklist (Node.js + Express + TypeScript)
1. **Central Express Error Middleware:**
   - Route all synchronous and asynchronous errors through a single Express error middleware.
   - Always return a consistent JSON shape:
     ```json
     {
       "code": "STRING_ERROR_CODE",
       "message": "Clear human-readable message",
       "details": []
     }
     ```
2. **Validate Every Request with Zod:**
   - Validate `req.body`, `req.params`, and `req.query` on every route using Zod middleware. Never trust the client.
3. **Security & Rate Limiting:**
   - Enable `helmet()` globally.
   - Enable `express-rate-limit` on all API routes, with stricter limits on `/api/auth/*` and `/api/exams/:id/start`.
4. **Logging & Error Tracking:**
   - Log all requests and errors with `pino` (`pino-http`). Forbid `console.log`.
   - Capture unhandled exceptions and `5xx` errors with `@sentry/node` (compatible with self-hosted Sentry).

## Frontend Checklist (React + TypeScript)
1. **Root React Error Boundary:**
   - Wrap the application root and the exam-runner view in a React Error Boundary styled with `.agent/specs/DESIGN.md` tokens (`#fbfcfd` canvas, `#edecfb` card, `#28253b` ink text).
2. **Mandatory View States:**
   - Every screen and asynchronous component MUST implement and test four explicit states: `loading`, `error`, `empty`, and `success`.
3. **Central Axios/Fetch Interceptor:**
   - Intercept `401 Unauthorized` responses to clear session state and redirect cleanly to `/login`.
   - Intercept network failures/timeouts to trigger a non-intrusive `ex-toast` notification and activate offline caching during active exams.
4. **Form Validation & Submit Locking:**
   - Validate all forms with `react-hook-form` + `@hookform/resolvers/zod`.
   - Disable submit buttons (`disabled={isSubmitting}`) while any request is in flight to prevent double-submissions.
