# 🛡️ ProctorNet: Forensic-Grade Online Exam Proctoring

ProctorNet is a secure, network-level online examination proctoring system designed for college lab and classroom environments. It combines real-time biometric monitoring, network isolation, and forensic-grade anti-cheat logic.

---

## 🏗️ Technical Architecture

### 1. Frontend (React + Vite)
- **Design**: Premium "Industrial-Brutalist" UI with Tailwind CSS.
- **Biometrics**: `face-api.js` for real-time browser-side face detection.
- **Communication**: Socket.io-client for live violation streaming.
- **Security**: Monaco Editor (Code) and Canvas-based forensic watermarking.

### 2. Main Backend (Node.js + Express)
- **Database**: Prisma ORM with Supabase (PostgreSQL).
- **Auth**: JWT-based stateless authentication with role-level enforcement.
- **Real-time**: Socket.io engine for student-invigilator synchronization.
- **VPN Engine**: WireGuard key management for network-level isolation.

### 3. AI Microservice (Python + Flask)
- **Face Matching**: `face_recognition` (dlib) for ID-to-Live biometric matching.
- **OCR Engine**: Tesseract OCR for automated Student ID parsing.
- **Communication**: RESTful bridge via Axios from the Node.js backend.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Tesseract OCR (installed on system)
- PostgreSQL (or Supabase URL)

### Installation

#### 1. Clone & Core Setup
```bash
# Frontend setup
cd proctornet/frontend
npm install
npm run dev

# Backend setup
cd proctornet/backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

#### 2. AI Service Setup
```bash
cd proctornet/python-service
pip install -r requirements.txt
python app.py
```

---

## 🔐 Administrative Access
- **Portal**: `/admin/login`
- **Default Credentials**: Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend `.env` file before running the seed script.
- **First Step**: Log in as admin and approve faculty registrations to enable exam creation.

---

## 🛡️ Anti-Cheat Protocols
- **Biometric Presence**: Continuous face detection via `face-api.js`.
- **Environment Locking**: Automated tab-switch detection and full-screen enforcement.
- **Forensic Watermarking**: Unique session-based invisible watermarks to trace photo leaks.
- **Collusion Detection**: Real-time code and MCQ similarity analysis.

---

## 🛠️ Built for Production
Automatically implements SEO best practices, secure HTTP headers (Helmet), and rate-limiting to protect against DDoS and brute-force attacks.
