# 🛡️ ProctorNet: Online Exam Proctoring & Lab Security System

ProctorNet is a real-time online examination proctoring system engineered for college laboratory and classroom environments. Combining **browser-side face detection**, **dual-stream Socket.io + WebRTC synchronization**, **DeepFace (ArcFace) biometric verification**, **Tesseract OCR parsing**, and **WireGuard network isolation**, ProctorNet provides continuous multi-role invigilator awareness.

---

## 🏗️ Technical Architecture

### 1. Frontend (React 19 + Vite)
- **UI Framework**: React 19 SPA with Tailwind CSS 4 & Lucide icons.
- **Browser Biometrics**: `face-api.js` (TinyFaceDetector) for continuous real-time presence detection (no face / multiple faces).
- **Live Feeds**: Socket.io-client emitting compressed base64 JPEG frames + WebRTC P2P stream upgrade.
- **Student Console**: Monaco Editor for programming questions, reactive fullscreen lock, and tab-switch telemetry.

### 2. Main Backend (Node.js + Express + Socket.io)
- **Database Layer**: Prisma ORM 5 connected to Supabase (PostgreSQL).
- **Auth & Security**: Role-based JWT authentication, rate limiting, and Helmet headers.
- **Real-Time Broker**: Socket.io engine relaying student stream frames, chat, flags, and WebRTC signaling.
- **VPN Engine**: WireGuard key pair allocation and automated cron-based key revocation.

### 3. AI Microservice (Python + Flask)
- **Biometric Matching**: DeepFace engine using ArcFace (with FaceNet fallback) for Euclidean face distance computation.
- **OCR Engine**: PyTesseract parsing physical student ID cards for USN extraction (`[1-4][A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}`).
- **REST Bridge**: Axios HTTP communication with the main Node.js backend.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (v3.9+)
- **Tesseract OCR Engine** ([Install Guide](https://github.com/tesseract-ocr/tesseract))

### Installation & Execution

```bash
# 1. Start Backend
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev

# 2. Start AI Microservice (in new terminal)
cd ../python-service
python -m venv venv
source venv/bin/activate # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py

# 3. Start Frontend (in new terminal)
cd ../frontend
npm install
npm run dev
```

---

## 🔐 Administrative Access & Roles
- **Admin Portal**: `/admin/login` (approves Faculty signups & monitors audit logs)
- **Faculty Portal**: `/faculty/login` (creates question banks, schedules exams, evaluates results)
- **Invigilator HUD**: `/invigilator/login` (monitors live grid tiles, receives real-time flags, opens evidence lightboxes)
- **Student Lobby**: `/student/login` (completes security check, takes locked fullscreen exam)

---

## 🛡️ Anti-Cheat Protocols
- **Continuous Face Detection**: `face-api.js` TinyFaceDetector flags `NO_FACE` (HIGH severity) or `MULTIPLE_FACES` (CRITICAL severity).
- **Viewport Lockdown**: Strict fullscreen lock enforcement and tab-switch (`blur` & `visibilitychange`) logging.
- **Dual Snapshot Evidence**: Captures simultaneous webcam and screen frames when a violation occurs.
- **Session Watermark**: Unique per-session seed generated in database for forensic tracking.
