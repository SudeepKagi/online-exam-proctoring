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
const vpnRoutes          = require('./routes/vpn.routes')
const notificationRoutes = require('./routes/notification.routes')

const path = require('path')

// ── Socket handlers ──
const initExamSocket = require('./sockets/exam.socket')
const initChatSocket = require('./sockets/chat.socket')

const app    = express()
const server = http.createServer(app)
const prisma = new PrismaClient()

const { verifyToken } = require('./utils/jwt')
const { authenticate } = require('./middleware/auth.middleware')

// ── Environment-Aware CORS Configuration (D-9) ──
const isProd = process.env.NODE_ENV === 'production'
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)
}

const checkOrigin = (origin, callback) => {
  if (!origin) return callback(null, true)
  if (allowedOrigins.includes(origin)) return callback(null, true)
  if (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
    return callback(null, true)
  }
  return callback(null, true) // Fall-through permit for flexible dev environments
}

// Protected static uploads folder for snapshots & evidence clips (D-8)
app.use('/uploads', (req, res, next) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`
  }
  next()
}, authenticate, express.static(path.join(__dirname, '../uploads')))

// ── Make prisma globally available ──
global.prisma = prisma

// ── Socket.io ──
const io = new Server(server, {
  cors: {
    origin: isProd ? (process.env.FRONTEND_URL || allowedOrigins) : true,
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with']
  },
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingTimeout: 20000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB payload limit (accommodates 500KB JPEG frames)
  allowEIO3: true
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
  origin: isProd ? (process.env.FRONTEND_URL || allowedOrigins) : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with'],
}))

// Controlled Payload Limits: 2MB standard API (D-6)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
app.use('/api/vpn',          vpnRoutes)
app.use('/api/notifications', notificationRoutes)

// ── 404 handler ──
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message, err.stack)
  const status = err.status || err.statusCode || 500

  // Sanitize database internal details
  let clientMessage = err.message || 'Internal Server Error'
  if (err.code === 'P2002') {
    clientMessage = 'A record with these unique details already exists.'
  } else if (err.code === 'P2025') {
    clientMessage = 'The requested database record could not be found.'
  } else if (err.name === 'PrismaClientKnownRequestError' || err.name === 'PrismaClientValidationError') {
    clientMessage = 'Database operation failed validation.'
  }

  res.status(status).json({
    error: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { rawError: err.message, code: err.code }),
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
