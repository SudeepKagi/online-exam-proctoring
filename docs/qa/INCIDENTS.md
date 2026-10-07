# Production Incidents & Defect Mapping (INCIDENTS.md)
**Recorded Date:** 2026-10-07T18:25:00Z  
**Context:** Production stabilization and audit tracking (Prompt 5 Phase S0)

---

## 1. User-Reported Symptoms & Mappings

| Incident ID | User-Reported Symptom | Root Cause | Defect Register ID | Status / Phase |
|---|---|---|---|---|
| **INC-01** | Student account creation returned `500 Internal Server Error` | Null constraint violation on `students.id`; `prisma.student.create` omitted `id` generation; unmapped department strings sent by frontend | `FLW-06`, `SES-01` | Fixed in `release-v1.0.3` |
| **INC-02** | Frontend ErrorBoundary crash: `Minified React error #31: Objects are not valid as a React child (found: object with keys {code, message})` | Error handler in `CreateStudentAccount.jsx` and `CreateFacultyAccount.jsx` passed structured error response `{ error: { code, message } }` directly to JSX `<span>{singleError}</span>` | `FLW-06`, `SES-03` | Fixed in `release-v1.0.3` |
| **INC-03** | Browser blocked camera & screen share; console warning: *"The file at 'blob:http://43.204.45.86/...' was loaded over an insecure connection. This file should be served over HTTPS."* | Site served over plain HTTP (`:80`); WebRTC `getUserMedia`/`getDisplayMedia` and secure cookies require HTTPS origin | `SES-07`, `EDGE-01` | Mitigated via `43.204.45.86.sslip.io` automated TLS. Formal domain binding in **S1**. |
| **INC-04** | Admin login 401 error initially observed; session dropped on refresh | Insecure HTTP connection conflicted with cookie `Secure` flag under RFC 6265bis; dual token storage in localStorage vs cookie | `SES-01`, `SES-02`, `SES-03` | In-progress. Full overhaul in **S2**. |
| **INC-05** | Public `/readyz` exposes internal service state | Caddyfile reverse-proxies `/readyz` to `127.0.0.1:9100` without authentication | `EDGE-01` | Scheduled for **S1**. |
| **INC-06** | JWT secret in production matches repository example secret | `JWT_SECRET` in `/opt/proctornet/shared/.env` matches `proctornet_super_secret_jwt_key_change_in_production` | `SES-01` | Scheduled for rotation in **S2**. |
| **INC-07** | Data reset script `scripts/ops/reset-keep-admin.js` targets obsolete schema table names (`admin`, `platformsetting`) | Stale script would truncate `admins` and fail schema classification | `DATA-01` | Scheduled for complete rewrite in **S4**. |
| **INC-08** | Untested code pushed directly to production via `.github/workflows/deploy-aws.yml` | Deployment workflow triggers on every push to `main` without requiring `ci.yml` gates or environment approval | `CI-01`, `CI-02` | Scheduled for overhaul in **S5**. |

---

## 2. Production Health Baseline
- Live API Health (`/healthz`): **200 OK**
- Live HTTPS Certificate: **Valid (Let's Encrypt TLS)**
- Database State: **Healthy (38 tables, 1,218 rows backed up to S3)**
- Active Release: **`release-v1.0.3`**
