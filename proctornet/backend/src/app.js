require('dotenv').config()
const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')
const helmet     = require('helmet')
const compression = require('compression')
const rateLimit  = require('express-rate-limit')
const { PrismaClient } = require('@prisma/client')

// ── Route imports ──
const authRoutes         = require('./routes/auth.routes')
const adminRoutes        = require('./routes/admin.routes')
const facultyRoutes      = require('./routes/faculty.routes')
const studentRoutes      = require('./routes/student.routes')
const invigilatorRoutes  = require('./routes/invigilator.routes')
const examRoutes         = require('./routes/exam.routes')
const questionRoutes     = require('./routes/question.routes')
const answerRoutes       = require('./routes/answer.routes')
const resultRoutes       = require('./routes/result.routes')
const enrollmentRoutes   = require('./routes/enrollment.routes')
const deviceCheckRoutes  = require('./routes/deviceCheck.routes')

const path = require('path')

// ── Socket handlers ──
const initExamSocket = require('./sockets/exam.socket')
const initChatSocket = require('./sockets/chat.socket')

const app    = express()
const server = http.createServer(app)
const prisma = new PrismaClient()

// Static uploads folder for snapshots & evidence clips
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// ── Make prisma globally available ──
global.prisma = prisma

// ── Socket.io ──
const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})

// Make io available to routes via app locals
app.set('io', io)

// ── Middleware ──
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // frontend handles CSP
}))

app.use(compression())

app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
const { verifyToken } = require('./utils/jwt')

// ── Rate Limiting Strategy for Shared-NAT University Labs ──
// In a college exam lab, 100+ concurrent student machines share a single outbound NAT gateway IP.
// A global IP-based rate limiter causes the entire lab to share a single budget, leading to false 429 errors.
// Strategy:
// 1. Unauthenticated routes (/api/auth) use IP-based rate limiting (30 req / 15 min) to prevent brute-forcing.
// 2. Authenticated exam & student routes key rate limiting by student ID (from JWT) rather than raw IP.
// 3. The per-student budget is set to 600 req / 15 min (>6x normal 90-min exam requirements of ~85-100 req/15min).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user_${req.user.id}`
    }
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1]
        const decoded = verifyToken(token)
        if (decoded?.id) return `user_${decoded.id}`
      } catch {
        // Token verification fail, fall through to IP
      }
    }
    return req.ip
  },
  message: { error: 'Too many requests for this student session. Please try again shortly.' },
})
app.use('/api', apiLimiter)

// Stricter IP-based limiter for unauthenticated login/register routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP, please try again later.' },
})
app.use('/api/auth', authLimiter)

// ── Health check ──
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ProctorNet Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ── API Routes ──
app.use('/api/auth',         authRoutes)
app.use('/api/admin',        adminRoutes)
app.use('/api/faculty',      facultyRoutes)
app.use('/api/student',      studentRoutes)
app.use('/api/invigilator',  invigilatorRoutes)
app.use('/api/exam',         examRoutes)
app.use('/api/question',     questionRoutes)
app.use('/api/answer',       answerRoutes)
app.use('/api/result',       resultRoutes)
app.use('/api',              enrollmentRoutes)
app.use('/api',              deviceCheckRoutes)

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack)
  const status = err.status || err.statusCode || 500
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
})

// ── Initialize sockets ──
initExamSocket(io)
initChatSocket(io)

// ── Start server ──
const PORT = process.env.PORT || 5000
server.listen(PORT, async () => {
  console.log(`\n🚀 ProctorNet Backend running on port ${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/health`)
  console.log(`🔌 Socket.io initialized`)
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`)

  // Test DB connection
  try {
    await prisma.$connect()
    console.log('✅ Database connection successful')
    console.log('🗄️  Prisma connected to PostgreSQL')
  } catch (e) {
    console.error('❌ Database connection failed:', e.message)
    console.log('   → Make sure DATABASE_URL is set correctly in backend/.env')
    console.log('   → If using Supabase free tier, check that the project is not paused')
  }
})

module.exports = { app, server, io, prisma }
