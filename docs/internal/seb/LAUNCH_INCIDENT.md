# Safe Exam Browser (SEB) Launch Incident Report

> **Incident ID**: INC-SEB-2026-11-17  
> **Date**: 2026-11-17 18:35 IST (13:05 UTC)  
> **Scope**: Safe Exam Browser Desktop Launch, Token Forwarding, and Frontend Authentication Interception  
> **Target Environment**: Production (`https://proctornet.duckdns.org`, AWS EC2 `i-0d242d962823f0a89`)  

---

## 1. Evidence: Latest SEB Session on Workstation (sebs:// Protocol Launch)

### a. Session Telemetry & Navigation Sequence
Extracted directly from runtime log `C:\Users\sudee\AppData\Local\SafeExamBrowser\Logs\2026-11-17_18h11m08s_Runtime.log`, client log `2026-11-17_18h11m08s_Client.log`, browser log `2026-11-17_18h11m08s_Browser.log`, and Caddy access logs on production:

1. **SEB Version**:
   ```text
   SEB version: 3.10.3.960 (x64)
   Browser Engine: Chromium 152.0.7977.140, CEF r152.0.10+g82a832e+chromium-152.0.7977.140, CefSharp 152.0.100.0
   ```

2. **Configuration Resource Loaded**:
   SEB received the protocol argument via `sebs://`:
   ```text
   sebs://proctornet.duckdns.org/api/v1/seb/config/5f30ed06aa7213a161e20851929ebce696f81a24cc1e2672cbf5cbceaed60adc.seb??launch=13135ed79640cb6d7f3347c020c0bedff95b06e319d230a97e4f0b60ca8ec138
   ```
   SEB's `NetworkResourceLoader` fetched `https://proctornet.duckdns.org/api/v1/seb/config/...` and parsed the XML configuration stream successfully (`Result: Success`).

3. **First 5 URLs Navigated to (Query Strings Stripped)**:
   Recorded in Caddy reverse proxy access logs on production between 12:41:25 UTC and 12:41:35 UTC:
   - **Request 1**: `GET /seb/enter` (Full: `/seb/enter?launch=13135ed...`) — SEB's browser window opened the configured Start URL with appended query parameter.
   - **Request 2**: `GET /assets/BfdF8-r3.js` — Client loaded the code-split bundle for `SebPinEntryPage`.
   - **Request 3**: `GET /api/v1/auth/me` — Frontend `AuthContext` executed session check. Returned **HTTP 401 Unauthorized**.
   - **Request 4**: `POST /api/v1/seb/ping` — Initial background verification dispatched.
   - **Request 5**: `GET /login` — Triggered immediately by the frontend Axios 401 response interceptor.

---

## 2. Server-Stored Institution Configuration (.seb)

Parsed from S3 object `seb/institution-config.seb` via production backend storage adapter and `Fast / Plist XML Parser`:

- **GZip Compressed**: `false` (Uncompressed Apple XML property list)
- **Stream Magic Prefix**: `<?xm` (Apple XML Property List `<?xml version="1.0" ...>`)
- **Container Classification**: **Plain XML Plist (Unencrypted)**
- **Parsed Parameters**:
  - `startURL`: `https://proctornet.duckdns.org/seb/enter`
    - Host: `proctornet.duckdns.org`
    - Path: `/seb/enter`
  - `sendBrowserExamKey`: `true` (Security header transmission enabled)
  - `startURLAppendQueryParameter`: `true` (Query parameter forwarding enabled)
  - `quitURL`: `https://proctornet.duckdns.org/seb/done`
    - Host: `proctornet.duckdns.org`
    - Path: `/seb/done`
  - `totalKeys`: `205` dictionary entries (includes full prohibited processes filter)

---

## 3. Deployed Frontend Build & Route Verification

- **Deployed Release Directory**: `/opt/proctornet/releases/release-4d5745e0873dec11601afd0255913606f9435cb1`
- **Active Git Commit**: `4d5745e0873dec11601afd0255913606f9435cb1` (`Merge branch 'fix/seb-auth-session-hydration' into main (v1.3.3)`)
- **Route `/seb/enter` in Build**: Verified present in `/opt/proctornet/current/frontend/dist/assets/Dq8zqIWR.js` and `App.jsx:93`.
- **Launch-Code Card in Build**: Verified present in `/opt/proctornet/current/frontend/dist/assets/BfdF8-r3.js` (`SebPinEntryPage` containing `"Enter Launch Code"` and `POST /seb/exchange-pin`).

---

## 4. Frontend Route Guards and Login Redirect Analysis

Audit of route guards and navigation handlers for signed-out visitors with an SEB User-Agent:

| Path Requested | Component / Guard | File & Line | Behavior for Signed-Out SEB Client | End Destination |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `LandingPage` (Public) | `App.jsx:83` | `LandingPage` mounts. Simultaneously, `AuthProvider` (`AuthContext.jsx:26`) calls `api.get('/auth/me')`. `/auth/me` returns 401. Axios interceptor (`apiClient.js:74`) catches 401 and calls `window.location.href = '/login'`. | `/login` |
| `/seb/enter` | `SebPinEntryPage` (Public) | `App.jsx:93` | `SebPinEntryPage` mounts. Simultaneously, `AuthProvider` (`AuthContext.jsx:26`) calls `api.get('/auth/me')`. `/auth/me` returns 401. Axios interceptor (`apiClient.js:74`) catches 401. Because `window.location.pathname` (`/seb/enter`) does not start with `/login`, interceptor executes `window.location.href = '/login'`. | `/login` |
| `/login` | `LoginPage` (Public) | `App.jsx:86` | Allowed because `window.location.pathname.startsWith('/login')` is true. `verifySebSession` (`LoginPage.jsx:76`) posts to `/api/v1/seb/ping` with `href: .../login`. Header mismatch recorded on server. | `/login` |
| Protected Deep Link (e.g. `/student/dashboard`) | `ProtectedRoute` | `App.jsx:36` | `loading` completes, `!user` is true -> renders `<Navigate to="/login" replace />`. | `/login` |

### Key Code Flaw in `frontend/src/lib/apiClient.js` (lines 42–76):
```javascript
if (error.response?.status === 401) {
  ...
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    try {
      localStorage.removeItem('user')
      localStorage.removeItem('auth')
    } catch (_) {}
    window.location.href = '/login'  // <-- FORCES ANY VISITOR ON ANY ROUTE TO /login ON 401
  }
}
```
Because the initial `/auth/me` session probe returns 401 for all signed-out visitors, any visitor landing on `/seb/enter` was violently redirected to `/login` within milliseconds.

---

## 5. SEB 3.x Query Parameter Forwarding vs. Launch-Code Design

### Confirmation of Query Parameter Forwarding in SEB 3.x (Windows)
Safe Exam Browser 3.x for Windows **does support** forwarding query parameters from the `sebs://` configuration URL to the `startURL`.
- **C# Implementation**:
  - `SafeExamBrowser.Runtime/Operations/Session/ConfigurationOperation.cs` (lines 246–257): Searches for `uri.Query.LastIndexOf('?') > 0`.
  - `SafeExamBrowser.Browser/Responsibilities/Browser/WindowHandlingResponsibility.cs` (lines 134–151): When `startURLAppendQueryParameter == true`, appends `StartUrlQuery` to `StartURL`.
- **Empirical Evidence from Live Log (18:11:31 IST)**:
  Caddy access log on EC2 recorded:
  ```json
  "uri": "/seb/enter?launch=13135ed79640cb6d7f3347c020c0bedff95b06e319d230a97e4f0b60ca8ec138"
  ```
  SEB 3.10.3 successfully appended `?launch=TOKEN` to `https://proctornet.duckdns.org/seb/enter`.

### Why Launch-Code Fallback is Necessary
1. **OS Protocol Handler Failures**: If the user's browser prompts or blocks opening `sebs://` links, or if the user opens a downloaded `.seb` template without custom query parameters, the query string is absent.
2. **Robustness Across Platforms**: macOS, iOS, and older SEB Windows releases handle query strings inconsistently.
3. **Ergonomic Safety Net**: A 6-digit numeric code entered into the clean white card guarantees 100% test completion regardless of browser launch quirks.

---

## 6. Root Cause Summary

When Safe Exam Browser launched via `sebs://`, it correctly downloaded the server-stored configuration and navigated to its Start URL: `https://proctornet.duckdns.org/seb/enter?launch=...`. However, on initial load of the React Single Page Application, `AuthContext` executed an unauthenticated session check (`GET /api/v1/auth/me`). Because SEB starts in an isolated process with an empty cookie jar, the server appropriately returned `HTTP 401 Unauthorized`. The central Axios response interceptor in `frontend/src/lib/apiClient.js` (lines 42–76) caught this 401 and unconditionally executed `window.location.href = '/login'` for all paths not beginning with `/login`. This aborted `SebPinEntryPage` at `/seb/enter` and forced the user to `/login`, where `LoginPage.jsx` automatically pinged the backend with a `/login` URL, triggering a configuration key header mismatch.
