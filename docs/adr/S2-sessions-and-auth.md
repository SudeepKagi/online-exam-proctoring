# ADR S2: Unified Session Lifecycle, Token Rotation & Authentication Hardening

## Status
Accepted (Phase S2 Stabilization)

## Context
A static and runtime audit revealed multiple vulnerabilities and availability risks in the authentication and session subsystem:
1. **`SES-01`**: Multiple disparate JWT secret definitions (`utils/jwt.js` vs `shared/config.js`) falling back to hardcoded strings with no boot-time validation.
2. **`SES-02`**: Single monolithic 7-day bearer tokens with no server-side revocation capability. Compromised or suspended tokens remained valid for days.
3. **`SES-03`**: Duplicate JWT token storage in browser `localStorage`, returned directly in API JSON payloads, undermining `HttpOnly` cookie protections.
4. **`SES-04`**: Client-side Axios interceptors executing destructive 401 redirection (`window.location.href`) and clearing storage, tearing down active exam sessions during transient network hiccups or access token expiration.
5. **`SES-05`**: Multi-tab desynchronization and uncoordinated role transitions within the same browser origin.
6. **`SES-06`**: Lack of concurrent student session policies allowing credential sharing during active examination windows.

## Decision

### 1. Unified Single Token Authority (`tokenService.js`)
All token generation, verification, and rotation logic is consolidated into `src/modules/auth/tokenService.js`. Legacy secret fallbacks in `utils/jwt.js` and `config.jwtSecret` are abolished. Boot-time configuration validator (`validateConfig.js`) enforces secret length ($\ge 32$ chars) and rejects known default values.

### 2. Dual-Token Architecture with Rotation & Family Reuse Detection
- **Access Token (`pn_at`)**:
  - Format: Signed JWT (`id, role, sid, epoch, examId?`).
  - Lifetime: 15 minutes (900 seconds).
  - Storage: Cookie `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900`.
- **Refresh Token (`pn_rt`)**:
  - Format: 32-byte cryptographically secure random string.
  - Lifetime: 12 hours (43,200 seconds) or bounded to exam window $+ 30$ minutes.
  - Storage: Cookie `Path=/api/v1/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`.
  - Stored in database table `auth_sessions` as SHA-256 hash `refresh_hash`.
  - **Rotation**: On `/api/v1/auth/refresh`, the old refresh token is marked `revoked_at = NOW(), revoke_reason = 'ROTATED'` and a new token is generated within the same `family_id`.
  - **Reuse Detection**: If a revoked refresh token is presented, all sessions belonging to the same `family_id` are immediately revoked (`'REUSE_DETECTED'`).

### 3. Server-Side Session Tracking (`auth_sessions`) & Global Epoch
- Each session row tracks `id (sid)`, `user_id`, `role`, `exam_id`, `family_id`, `refresh_hash`, `created_at`, `last_seen_at`, `expires_at`, `revoked_at`, `revoke_reason`, `ip`, `user_agent`.
- **Validation Caching**: In-process bounded LRU/Map cache (TTL $\le 30$ seconds) ensures verification does not hammer PostgreSQL on t3.micro while guaranteeing revocations take effect across the fleet in $\le 30$ seconds.
- **Global Epoch**: Stored in `platform_settings` table under key `auth_epoch`. Bumping the epoch invalidates all extant tokens instantly across all nodes.

### 4. Zero-LocalStorage Policy
- The SPA never stores JWTs in `localStorage`.
- API endpoints do not return JWTs in response bodies to browser clients.
- Authentication state is verified on mount via `GET /api/v1/auth/me` relying on credentials cookies.

### 5. Exam-Aware Non-Destructive Client Interceptor
- Axios interceptor catches `401 TOKEN_EXPIRED` and executes a silent `POST /api/v1/auth/refresh`.
- Concurrent in-flight requests are queued and replayed upon successful refresh.
- If refresh fails, client triggers a non-destructive modal without navigating away or discarding unsaved answers (`sessionStorage` autosave buffer persists).

### 6. Concurrent Login Enforcement for Students
- When a student initiates a login while an attempt is `ACTIVE`, the previous session is superseded and notified via Socket.IO `session:replaced`, recording a `CONCURRENT_LOGIN` audit violation.

## Consequences
- **Security**: Complete elimination of token theft via XSS/localStorage; instant revocation on suspension, password change, or logout.
- **Resilience**: Zero exam drops due to token expiry; transparent rotation ensures seamless student experience.
- **Performance**: High cache hit rate on `sid` lookups maintains low CPU footprint on t3.micro instances.
