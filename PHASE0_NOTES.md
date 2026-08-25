# Phase 0 Notes — ProctorNet Technical Scope Confirmation

## 1. VPN References & Removal Inventory
We performed a full repository grep for `vpn`/`VPN` across `backend/src` and `frontend/src`. Here is the complete inventory for Phase 1 removal:

### Backend Files to Remove:
- `backend/src/services/vpn.service.js` (WireGuard peer management, key generation, and status checks)
- `backend/src/routes/vpn.routes.js` (Endpoints for `/api/vpn/connect/:examId`, `/api/vpn/status`, `/api/vpn/revoke`)
- `backend/src/jobs/vpnRevoke.job.js` (Background cron job for expiring VPN leases)

### Backend Files to Clean Up:
- `backend/src/app.js` (Remove `vpnRoutes` import & mount, remove `vpnService` import & `vpnService.startAutoRevoke()` invocation)
- `backend/prisma/seed/admin.js` (Remove `vpn_enabled` default platform setting)
- `backend/prisma/schema.prisma` (Note: `StudentExam.vpnKey`, `vpnPrivateKey`, `vpnPeerIp`, `vpnKeyExpiry` fields exist solely for VPN; we will keep Prisma schema backward compatible or clean them up with approval)

### Frontend Files to Remove:
- `frontend/src/components/VPNSetup.jsx` (Student VPN configuration download & setup guide)
- `frontend/src/components/admin/VPNStatus.jsx` (Admin VPN server metrics & peer monitor)

### Frontend Files to Clean Up:
- `frontend/src/pages/admin/Settings.jsx` (Remove the "VPN & Routing" tab and `vpnEnforced` platform setting)
- `frontend/src/pages/student/Dashboard.jsx` (Remove `VPNStatusAlert` component and `/vpn/status` API call)
- `frontend/src/pages/LandingPage.jsx` (Remove "Network-Level Security / VPN" feature card and "encrypted network connections" from hero)
- `frontend/index.html` (Update SEO metadata tags mentioning WireGuard VPN)
- `README.md` (Add note explaining VPN network isolation is planned for a future phase)

---

## 2. Rate Limiting Confirmation & Analysis
- **Current State in `backend/src/app.js`**:
  ```javascript
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: { error: 'Too many requests, please try again later.' },
  })
  app.use('/api', limiter)
  ```
- **The Problem**: This limiter uses the default key generator (`req.ip`). In a university computer lab, 100+ student machines share a single outbound NAT gateway IP.
- **Consequence**: All 100 students share a single global budget of 200 requests per 15 minutes. A single student taking an exam with YOLO polling (8s) generates ~112 requests in 15 minutes by themselves. With 100 students, the NAT IP blows the budget in seconds, causing `429 Too Many Requests` errors across the entire lab room.

---

## 3. Proctoring Monitors & Python Service Disconnect Confirmation
- **Exam ID Missing**: In `frontend/src/hooks/useProctoringMonitors.js` (Line 193):
  ```javascript
  const res = await api.post('/student/exams/active/yolo-check', { frame: frameBase64 }, { timeout: 3000 })
  ```
  The string `"active"` is hardcoded instead of the actual dynamic `examId`.
- **Proximity Alert Ignored**: In `python-service/services/yolo_service.py`, the service computes:
  - `proximity_alert` (Center-zone intrusion / leaning over screen — HIGH violation)
  - `background_persons` (Ignored lab mates in the background)
  - `phone_detected`, `book_detected`, `laptop_detected`
  However, `useProctoringMonitors.js` only parses `phone_detected`, `book_detected`, and `laptop_detected`, completely ignoring `res.data.proximity_alert`.

---

## 4. Rate Limit Calculations for 100-Student Shared NAT
For a 90-minute exam per authenticated student:
- **YOLO Checks**:
  - Baseline (15s polling): ~60 requests / 15 min (~360 total)
  - Elevated Alert Mode (5s polling for 60s upon flag): +12 requests per alert
- **Auto-save (Debounced)**: ~10–20 requests / 15 min (~60–120 total)
- **Face / Audio Checks & Status**: ~15 requests / 15 min
- **Total Expected per Student**: ~85–120 requests per 15-minute window.

**Solution Architecture**:
1. **Unauthenticated Endpoints** (`/api/auth/*`): Keep IP-based rate limiting (e.g. 30 req / 15 min) to prevent brute-force attacks.
2. **Authenticated Student Exam Endpoints**: Key rate limiting by `req.user.id` (or JWT subject) with a generous budget of **600 requests per 15 minutes per student** (~5x normal requirement, preventing false 429s while stopping infinite spam loops).
