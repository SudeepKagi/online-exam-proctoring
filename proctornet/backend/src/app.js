require('dotenv').config()
const express    = require('express')
const http       = require('http')
const { createWebSocketServer } = require('./infra/websocket/socket.server')
const { rosterCoalescer } = require('./infra/websocket/rosterCoalescer')
const cors       = require('cors')
const helmet     = require('helmet')
const compression = require('compression')
const rateLimit   = require('express-rate-limit')
const { prisma }  = require('./infra/postgres/client')

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
const evidenceRoutes     = require('./routes/evidence.routes')

const path = require('path')

const app    = express()
const server = http.createServer(app)

const cookieParser = require('cookie-parser')
const { verifyToken } = require('./utils/jwt')
const { authenticate } = require('./middleware/auth.middleware')
const { extractTokenFromReq } = require('./utils/cookies')
const { requestContextMiddleware, logger } = require('./observability/logger')
const { metricsMiddleware, metricsHandler } = require('./observability/metrics')

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

// ── Make prisma globally available ──
global.prisma = prisma

// ── Socket.io WebSocket Plane (P6) ──
const io = createWebSocketServer(server)

// Make io available to routes via app locals
app.set('io', io)

// ── Middleware ──
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // frontend handles CSP
}))

app.use(compression())
app.use(requestContextMiddleware)
app.use(metricsMiddleware)
app.use(cookieParser())

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    if (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'cookie'],
}
app.use(cors(corsOptions))

// Controlled Payload Limits: 10MB standard API (D-6)
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── Internal LiveKit Webhook Endpoint (P7 Task 7.1) ──
app.post('/internal/livekit/webhook', async (req, res, next) => {
  try {
    const { mediaService } = require('./modules/media/media.service')
    const authHeader = req.headers.authorization
    const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))
    const result = await mediaService.handleWebhook(rawBody, authHeader)
    return res.status(200).json(result)
  } catch (err) {
    next(err)
  }
})

// ── CSRF Defense for Cookie-Authenticated State-Changing Requests ──
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next()
  }

  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null)
  if (origin) {
    const isAllowed = allowedOrigins.includes(origin) ||
      (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden origin: Cross-site request rejected.' })
    }
  }

  next()
}
app.use('/api', csrfProtection)

// ── Rate Limiting Strategy for Shared-NAT University Labs ──
const isLoadTest = process.env.LOADTEST_ALLOW === '1'
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isLoadTest ? 100000 : 600,
  skip: () => isLoadTest,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) {
      return `user_${req.user.id}`
    }
    const token = extractTokenFromReq(req)
    if (token) {
      try {
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
  max: isLoadTest ? 100000 : 30,
  skip: () => isLoadTest,
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

// ── Prometheus Metrics Endpoint ──
app.get('/metrics', metricsHandler)

// ── V1 Modular Monolith Routes (P4 Hot Paths) ──
const v1Routes = require('./routes/v1.routes')
const { requestIdMiddleware } = require('./middleware/requestId')
const { loadShed } = require('./middleware/loadShed')
const { errorHandler } = require('./middleware/errorHandler')
const { outboxPublisher } = require('./infra/rabbitmq/outboxPublisher')
const { evaluationWorker } = require('./modules/results/evaluationWorker')
const { evidenceWorker } = require('./modules/media/evidenceWorker')
const { verificationWorker } = require('./modules/media/biometricService')
const { expirySweeper } = require('./modules/attempts/expirySweeper')
const { violationMicroBatcher } = require('./modules/proctoring/violationMicroBatcher')
const { chatMicroBatcher } = require('./modules/proctoring/chatMicroBatcher')
const { redisClient } = require('./infra/redis/client')
const { rabbitmq } = require('./infra/rabbitmq/client')

app.use(requestIdMiddleware)
app.use(loadShed)
app.use('/api/v1', v1Routes)

// ── Legacy API Routes ──
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
app.use('/api/evidence',      evidenceRoutes)

// ── 404 handler ──
app.use((req, res) => {
  if (req.path.startsWith('/api/v1')) {
    return res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`
      },
      requestId: req.requestId || null
    })
  }
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
})

// ── Global error handler ──
app.use((err, req, res, next) => {
  if (req.path.startsWith('/api/v1') || err.statusCode) {
    return errorHandler(err, req, res, next)
  }

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

// ── Server Timeouts (Section 4.12: outlive ingress proxy) ──
server.requestTimeout = 15000
server.headersTimeout = 65000
server.keepAliveTimeout = 65000

// ── Graceful Shutdown Handler (Section 4.12) ──
async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated: draining requests and closing connections')

  // Notify connected sockets of server restarting
  if (io) {
    io.emit('server:restarting', { message: 'Server is restarting for maintenance', reconnectAfter: 3000 })
  }

  // Stop background worker loops
  expirySweeper.stop()
  outboxPublisher.stop()
  rosterCoalescer.stop()

  // Flush any pending micro-batchers before termination
  await Promise.allSettled([
    violationMicroBatcher.flush(),
    chatMicroBatcher.flush()
  ])

  // Stop accepting new HTTP requests
  server.close(async () => {
    logger.info('HTTP server closed')
    await Promise.allSettled([
      prisma.$disconnect(),
      redisClient.quit(),
      rabbitmq.close()
    ])
    logger.info('All connections drained and closed cleanly')
    process.exit(0)
  })

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, 10000).unref()
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

// ── Start server ──
const PORT = process.env.PORT || 5000
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  server.listen(PORT, async () => {
    console.log(`\n🚀 ProctorNet Backend running on port ${PORT}`)
    console.log(`📊 Health: http://localhost:${PORT}/health`)
    console.log(`🔌 Socket.io initialized`)
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`)

    // Start P4/P5 background workers
    outboxPublisher.start()
    evaluationWorker.start()
    evidenceWorker.start()
    verificationWorker.start()
    expirySweeper.start()

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
}

const { presenceManager } = require('./infra/websocket/presence')
module.exports = { app, server, io, prisma, rosterCoalescer, presenceManager }

