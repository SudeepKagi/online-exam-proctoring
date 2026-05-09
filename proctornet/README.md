# ProctorNet

> **Secure, Network-Level Online Examination Proctoring System**  
> Built for college lab/classroom environments.

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite, Tailwind CSS, Socket.io-client, face-api.js, Monaco Editor, Recharts |
| Backend | Node.js, Express, Socket.io, Prisma ORM, JWT, bcrypt, Multer, pdf-lib |
| AI Service | Python Flask, face_recognition, pytesseract, OpenCV |
| Database | PostgreSQL (Supabase) |
| Security | WireGuard VPN, Unbound DNS, iptables |
| Hosting | Vercel (frontend) · Railway (backends) · Supabase (DB) |

---

## 👥 User Roles

| Role | Access | Account Type |
|------|--------|-------------|
| **Admin** | Full platform control, approvals, analytics | Seeded (single account) |
| **Faculty** | Create exams, question pools, view results | Registered + Admin approved |
| **Invigilator** | Monitor live exam, chat, warn/terminate | Temporary JWT per exam |
| **Student** | Take exams with full security enforcement | Registered + AI face verified |

---

## 🗂️ Project Structure

```
proctornet/
├── frontend/          # React + Vite (deployed → Vercel)
├── backend/           # Node.js + Express (deployed → Railway)
├── python-service/    # Flask AI microservice (deployed → Railway)
└── vpn-server/        # WireGuard setup scripts (deployed → VPS)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- Python >= 3.9
- PostgreSQL (or Supabase account)
- Tesseract OCR installed

### 1. Clone the repo
```bash
git clone https://github.com/SudeepKagi/online-exam-proctoring.git
cd online-exam-proctoring
```

### 2. Setup Backend
```bash
cd backend
cp .env.example .env        # Fill in your values
npm install
npx prisma migrate dev
node prisma/seed/admin.js   # Seed admin account
npm run dev                 # Starts on port 5000
```

### 3. Setup Python Microservice
```bash
cd python-service
cp .env.example .env
pip install -r requirements.txt
python app.py               # Starts on port 5001
```

### 4. Setup Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev                 # Starts on port 5173
```

---

## 🔐 Environment Variables

See `.env.example` files in each service directory.

---

## 🏗️ Build Steps

This project is built in 90 steps across 16 weeks.  
See [implementation_plan.md](./implementation_plan.md) for full details.

---

## 📄 License

MIT — Sudeep Kagi, 2024
