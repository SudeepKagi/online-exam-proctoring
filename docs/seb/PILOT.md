# Safe Exam Browser (SEB) Pilot Deployment Guide

This document outlines the step-by-step procedures for faculty, administrators, and engineers conducting pilot examinations with Safe Exam Browser (SEB) in ProctorNet.

---

## 1. Quick Start: Local Pilot Environment

The local pilot environment runs on dedicated test infrastructure with its own isolated database (`proctornet_pilot`), ensuring zero interference with production or development databases.

### A. Prerequisites
Ensure Docker Desktop is running with the test PostgreSQL (port 5434) and Redis (port 6380) containers:
```bash
docker --context desktop-linux ps
# proctornet-test-postgres (127.0.0.1:5434->5432)
# proctornet-test-redis    (127.0.0.1:6380->6379)
```

### B. Starting the Pilot in Two Commands
Open two separate terminal windows from the repository root:

* **Terminal 1: Start Backend (Port 5000)**
  ```bash
  npm run pilot:backend
  ```
  Loads `.env.pilot` without touching `.env`. Connects to `proctornet_pilot` on port 5434 and Redis on port 6380. Runs in `SEB_MODE=log` with `PUBLIC_ORIGIN=http://localhost:5173`.

* **Terminal 2: Start Frontend (Port 5173)**
  ```bash
  npm run pilot:frontend
  ```
  Starts the Vite dev server at `http://localhost:5173` with reverse proxy routes `/api` and `/socket.io` pointing to backend port 5000.

### C. Seeding a Pilot Exam
In a third terminal, seed a ready-to-test exam with Safe Exam Browser enabled:
```bash
node scripts/pilot/seed-pilot-exam.js
```
This script creates a 30-minute exam with 3 MCQs, scheduled from `now + 2 minutes` to `now + 3 hours`, owned by `faculty@proctornet.com`, with `proctoringConfig: { sebRequired: true }`, and publishes it through the service layer.

---

## 2. Why `PUBLIC_ORIGIN=http://localhost:5173` Matters

A primary source of SEB hash mismatches is origin divergence between the client browser and the server reverse proxy.

1. **Client Perspective (SEB):**
   - Candidate opens `http://localhost:5173`.
   - The frontend Axios client (`apiClient.js`) issues relative requests: `POST /api/v1/attempts/exams/:id/start`.
   - The browser engine inside SEB resolves this relative URL against the page origin: `http://localhost:5173/api/v1/attempts/exams/:id/start`.
   - SEB computes: `X-SafeExamBrowser-ConfigKeyHash = sha256("http://localhost:5173/api/v1/attempts/exams/:id/start" + configKey)`.

2. **Server Perspective (Backend on Port 5000):**
   - Vite proxies the request from port 5173 to port 5000 (`changeOrigin: true`).
   - The Express application receives the request on port 5000, where `req.originalUrl` is `/api/v1/attempts/exams/:id/start`.
   - Express reconstructs the client URL: `fullUrl = config.publicOrigin + req.originalUrl`.
   - If `PUBLIC_ORIGIN` was set to `http://localhost:5000`, the server would hash `http://localhost:5000/...`, resulting in a guaranteed hash mismatch against SEB's `http://localhost:5173/...`.
   - By setting `PUBLIC_ORIGIN=http://localhost:5173` in `.env.pilot`, the server reconstructs the exact URL seen by SEB.

---

## 3. Monitoring Log Mode: Reading Telemetry Logs

In `SEB_MODE=log`, ProctorNet evaluates the SEB Config Key hash without blocking students. This allows administrators to observe live telemetry and verify header formulas before enabling `enforce` mode.

### Log Line Example
When a candidate requests an SEB-gated endpoint, backend logs an event in JSON format (via `pino`):

```json
{
  "level": "info",
  "time": 1794116000000,
  "msg": "SEB request verification check (log mode)",
  "examId": "58f57227-cbc4-4278-968b-f8b83384cfee",
  "matched": false,
  "receivedPrefix8": null,
  "expectedPrefix8": "e0708176",
  "urlHashed": "http://localhost:5173/api/v1/attempts/exams/58f57227-cbc4-4278-968b-f8b83384cfee/start"
}
```

### Log Fields Decoded:
- `msg`: `"SEB request verification check (log mode)"` confirms the request passed through the SEB middleware in non-blocking observation mode.
- `matched`: 
  - `true`: The candidate's `X-SafeExamBrowser-ConfigKeyHash` header matched the server's computed hash.
  - `false`: Header was missing, invalid hex, or did not match the expected hash.
- `receivedPrefix8`: First 8 characters of the client's `X-SafeExamBrowser-ConfigKeyHash` header (`null` if no header was sent, e.g. from standard Chrome/curl).
- `expectedPrefix8`: First 8 characters of the server's computed SHA-256 hash.
- `urlHashed`: The canonical URL string hashed by the server (`PUBLIC_ORIGIN + originalUrl`). Compare this with SEB's URL in SEB client logs if diagnosing mismatches.
- `expectedHash` / `receivedHash`: Full 64-hex hashes attached only when `SEB_DEBUG_LOG_HASHES=true` in non-production environments with a test/pilot database.

---

## 4. Setting Up an Exam in the SEB Config Tool

When configuring a `.seb` settings profile using the official Safe Exam Browser Config Tool:

### A. General Tab
- **Start URL:**
  - Local Pilot: `http://localhost:5173/login?redirect=/student/exams/<examId>/lobby`
  - Production: `https://proctornet.duckdns.org/login?redirect=/student/exams/<examId>/lobby`
- **Quit URL:**
  - Local Pilot: `http://localhost:5173/student/exams/<examId>/result`
  - Production: `https://proctornet.duckdns.org/student/exams/<examId>/result`

### B. Exam Tab
- **Use Browser & Config Keys:** Check **"Use Browser & Config Keys (send in HTTP header)"** (`sendBrowserExamKey = true`). If unchecked, SEB will not transmit the hash header.
- **Confirm Quitting:** Set **"Confirm quitting"** to `false` so students can exit cleanly upon clicking the post-submission exit link.

### C. User Interface / Media Tab
- **Allow Video Capture:** Ensure **"Allow video capture"** (`allowVideoCapture = true`) is enabled for continuous face presence monitoring.
- **Audio Capture:** Optional, per institutional proctoring requirements.

### D. Network Tab / URL Filter Allowlist
Configure URL Filter default rule to `Block` and add:
- `http://localhost:5173/*` (Local frontend and proxied API)
- `ws://localhost:5173/*` and `ws://localhost:5000/*` (WebSocket real-time channels)

---

## 5. Verification CLI Utility: `scripts/seb/verify-formula.js`

To verify observed headers or generate expected headers for curl tests:

### Compare Observed Header:
```bash
node scripts/seb/verify-formula.js <url> <configKey> <observedHeader>
```
Output:
- `MATCH: Variant A (sha256_hex(url + key))` (exit code 0)
- `MATCH: Variant B (sha256_hex(url + sha256_hex(key)))` (exit code 0)
- `MISMATCH: Neither variant matched observed header.` (exit code 1)

### Generate Header for Testing:
```bash
node scripts/seb/verify-formula.js --make <url> <configKey>
```
Prints both Variant A and Variant B hashes and formatted `X-SafeExamBrowser-ConfigKeyHash` header ready for curl testing.
