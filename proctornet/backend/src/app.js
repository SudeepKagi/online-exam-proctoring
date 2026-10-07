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

const app    = express()
const server = http.createServer(app)

const cookieParser = require('cookie-parser')
const { verifyToken } = require('./utils/jwt')
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
  process.env.FRONTEND_URL.split(',').forEach((u) => {
    const trimmed = u.trim()
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed)
    }
  })
}

// ── Socket.io WebSocket Plane (P6) ──
const io = createWebSocketServer(server)

// Make io available to routes via app locals
app.set('io', io)

// ── Reverse Proxy & Trust Headers ──
app.disable('x-powered-by')
app.set('trust proxy', 1)

// ── Middleware ──
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.amazonaws.com', ...(isProd ? [] : ['http://localhost:9000', 'http://127.0.0.1:9000'])],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'ws:', 'wss:', ...(isProd ? ['https://*.amazonaws.com'] : ['http://localhost:9000', 'http://127.0.0.1:9000'])],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}))

const { requestIdMiddleware } = require('./middleware/requestId')

app.use(compression())
app.use(requestIdMiddleware)
app.use(requestContextMiddleware)
app.use(metricsMiddleware)
app.use(cookieParser())

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    if (origin.match(/^https?:\/\/(43\.204\.45\.86|.*\.sslip\.io|.*\.nip\.io)(:\d+)?$/)) {
      return callback(null, true)
    }
    if (!isProd && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'cookie', 'x-agent-session', 'x-agent-seq', 'x-agent-ts', 'x-agent-nonce', 'x-agent-signature'],
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

const isLoadTest = process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1'
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


// ── Liveness and Readiness Probes (P9 Task 7 / §4.5.5) ──
app.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'ProctorNet Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ProctorNet Backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// ── Dedicated Internal-Only App & Listener (127.0.0.1:9100) for /metrics & /readyz (Defect D-06 Fix) ──
const internalApp = express()
const internalServer = http.createServer(internalApp)

internalApp.get('/readyz', async (req, res) => {
  const timeoutMs = 1500
  const withTimeout = (promise, name) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${name} health check timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ])

  const checks = {
    postgres: 'pending',
    redis: 'pending',
    rabbitmq: 'pending'
  }

  const { redisClient: _rc } = require('./infra/redis/client')
  const { rabbitmq: _rmq } = require('./infra/rabbitmq/client')
  const cfg = require('./shared/config')

  await Promise.allSettled([
    withTimeout(prisma.$queryRawUnsafe('SELECT 1'), 'PostgreSQL')
      .then(() => { checks.postgres = 'ok' })
      .catch((err) => { checks.postgres = `failed: ${err.message}` }),
    // Redis: skip check when CACHE_DRIVER=memory
    cfg.cacheDriver === 'memory'
      ? Promise.resolve().then(() => { checks.redis = 'skipped (memory driver)' })
      : withTimeout(_rc.ping(), 'Redis')
          .then((ok) => { checks.redis = ok ? 'ok' : 'failed: ping returned false' })
          .catch((err) => { checks.redis = `failed: ${err.message}` }),
    // RabbitMQ: skip check when QUEUE_DRIVER=postgres
    cfg.queueDriver === 'postgres'
      ? Promise.resolve().then(() => { checks.rabbitmq = 'skipped (postgres queue driver)' })
      : withTimeout(_rmq.checkHealth(), 'RabbitMQ')
          .then((ok) => { checks.rabbitmq = ok ? 'ok' : 'failed: exchange check failed' })
          .catch((err) => { checks.rabbitmq = `failed: ${err.message}` })
  ])

  // Ready if postgres is ok AND optional services are either ok or skipped
  const isReady = checks.postgres === 'ok' &&
    (checks.redis === 'ok' || checks.redis?.startsWith('skipped')) &&
    (checks.rabbitmq === 'ok' || checks.rabbitmq?.startsWith('skipped'))
  const statusCode = isReady ? 200 : 503

  return res.status(statusCode).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'ProctorNet Backend Internal Probes',
    timestamp: new Date().toISOString(),
    checks
  })
})

internalApp.get('/metrics', metricsHandler)

// ── Canonical Modular Monolith Routes (/api/v1) ──
const v1Router = require('./modules/router')
const { loadShed } = require('./middleware/loadShed')
const { errorHandler } = require('./middleware/errorHandler')
const { getQueueDriver, registerQueueHandler } = require('./infra/queueDriver')
const config = require('./shared/config')
const { evaluationWorker } = require('./modules/results/evaluationWorker')
const { evidenceWorker } = require('./modules/media/evidenceWorker')
const { verificationWorker } = require('./modules/media/biometricService')
const { expirySweeper } = require('./modules/attempts/expirySweeper')
const { examScheduler } = require('./modules/exams/examScheduler')
const { retentionWorker } = require('./modules/media/retentionWorker')
const { vpnWorker } = require('./modules/vpn/vpnWorker')
const { vpnReconciler } = require('./modules/vpn/vpnReconciler')
const { violationMicroBatcher } = require('./modules/proctoring/violationMicroBatcher')
const { chatMicroBatcher } = require('./modules/proctoring/chatMicroBatcher')
const { redisClient } = require('./infra/redis/client')
const { rabbitmq } = require('./infra/rabbitmq/client')

app.use(loadShed)

// Seamless URL compatibility rewrite: /api/* or un-prefixed -> /api/v1/*
app.use((req, res, next) => {
  if (
    !req.url.startsWith('/api/v1') &&
    !req.url.startsWith('/health') &&
    !req.url.startsWith('/readyz') &&
    !req.url.startsWith('/metrics') &&
    !req.url.startsWith('/socket.io')
  ) {
    if (req.url.startsWith('/api/')) {
      req.url = req.url.replace('/api/', '/api/v1/')
    } else {
      req.url = '/api/v1' + (req.url.startsWith('/') ? req.url : '/' + req.url)
    }
  }
  next()
})

app.use('/api/v1', v1Router)

// ── 404 handler (Unified Error Envelope) ──
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`
    },
    requestId: req.requestId || null
  })
})

// ── Global error handler (Unified Error Envelope) ──
app.use(errorHandler)

// ── Server Timeouts (Section 4.12: outlive ingress proxy) ──
server.requestTimeout = 15000
server.headersTimeout = 65000
server.keepAliveTimeout = 65000

// ── Graceful Shutdown Handler (Section 4.12 / C-10) ──
// Shutdown order: stop intake -> stop consumers -> drain batchers -> close io -> close pools; second signal forces exit
let isShuttingDown = false

async function gracefulShutdown(signal) {
  logger.info({ signal }, 'Graceful shutdown initiated (C-10): draining requests and closing connections')

  // 1. Stop Intake: stop accepting new HTTP connections
  const serverClosePromise = new Promise((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed: intake stopped')
      resolve()
    })
  })

  // 2. Stop Consumers: stop background polling loops and consumers
  try {
    expirySweeper.stop()
    examScheduler.stop()
    retentionWorker.stop()
    const _qd = getQueueDriver()
    if (_qd && typeof _qd.stop === 'function') _qd.stop()
    rosterCoalescer.stop()
    if (process.env.VPN_ENABLED === 'true') {
      vpnReconciler.stop()
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Error stopping consumer loops')
  }

  // 3. Drain Batchers: flush micro-batchers to database
  try {
    await Promise.allSettled([
      violationMicroBatcher.flush(),
      chatMicroBatcher.flush()
    ])
    logger.info('Micro-batchers drained successfully')
  } catch (err) {
    logger.warn({ error: err.message }, 'Error draining micro-batchers')
  }

  // 4. Close Socket.IO
  if (io) {
    try {
      io.emit('server:restarting', { message: 'Server is restarting for maintenance', reconnectAfter: 3000 })
      await new Promise((resolve) => io.close(() => resolve()))
      logger.info('Socket.io server closed')
    } catch (err) {
      logger.warn({ error: err.message }, 'Error closing socket server')
    }
  }

  const internalClosePromise = new Promise((resolve) => {
    if (internalServer && internalServer.listening) {
      internalServer.close((err) => {
        if (err) logger.warn({ error: err.message }, 'Error closing internal HTTP server')
        else logger.info('Internal metrics HTTP server closed cleanly')
        resolve()
      })
    } else {
      resolve()
    }
  })

  // Wait for intake HTTP servers to finish ongoing requests
  await Promise.all([serverClosePromise, internalClosePromise])

  // 5. Close Pools: disconnect database, redis, and connections
  try {
    const shutdownTasks = [prisma.$disconnect()]
    if (config.cacheDriver !== 'memory') shutdownTasks.push(redisClient.quit())
    if (config.queueDriver !== 'postgres') shutdownTasks.push(rabbitmq.close())
    await Promise.allSettled(shutdownTasks)
    logger.info('All connection pools closed cleanly')
  } catch (err) {
    logger.warn({ error: err.message }, 'Error closing connection pools')
  }

  process.exit(0)
}

function handleSignal(signal) {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Second termination signal received; forcing immediate exit (C-10)')
    process.exit(1)
  }
  isShuttingDown = true

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded, forcing exit')
    process.exit(1)
  }, 10000).unref()

  gracefulShutdown(signal)
}

process.on('SIGTERM', () => handleSignal('SIGTERM'))
process.on('SIGINT', () => handleSignal('SIGINT'))

// ── Start server ──
const PORT = process.env.PORT || 5000
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  server.listen(PORT, async () => {
    console.log(`\n🚀 ProctorNet Backend running on port ${PORT}`)
    console.log(`📊 Health: http://localhost:${PORT}/health`)
    console.log(`🔌 Socket.io initialized`)
    console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}\n`)

    const INTERNAL_PORT = parseInt(process.env.INTERNAL_METRICS_PORT || '9100', 10)
    const INTERNAL_HOST = process.env.INTERNAL_METRICS_HOST || '127.0.0.1'
    internalServer.listen(INTERNAL_PORT, INTERNAL_HOST, () => {
      console.log(`🔒 Internal listener: http://${INTERNAL_HOST}:${INTERNAL_PORT} (/metrics, /readyz)`)
    })

    // Register in-process handlers when using postgres queue driver
    if (config.queueDriver === 'postgres') {
      registerQueueHandler('attempt.submitted', (p, m) => evaluationWorker.handleEvent({ type: 'attempt.submitted', payload: p, ...m }))
      registerQueueHandler('attempt.expired', (p, m) => evaluationWorker.handleEvent({ type: 'attempt.expired', payload: p, ...m }))
      registerQueueHandler('attempt.terminated', (p, m) => evaluationWorker.handleEvent({ type: 'attempt.terminated', payload: p, ...m }))
      registerQueueHandler('evidence.uploaded', (p, m) => evidenceWorker.handleEvent({ type: 'evidence.uploaded', payload: p, ...m }))
    }

    // Start background workers: default false for API processes (C-10)
    if (process.env.START_WORKERS === 'true') {
      const queueDispatcher = getQueueDriver()
      queueDispatcher.start()
      evaluationWorker.start()
      evidenceWorker.start()
      verificationWorker.start()
      expirySweeper.start()
      examScheduler.start()
      retentionWorker.start()

      // Start WireGuard VPN background workers (flag-gated)
      if (process.env.VPN_ENABLED === 'true') {
        vpnWorker.start()
        vpnReconciler.start()
        console.log('🛡️  WireGuard VPN Worker & Reconciler started')
      }
      console.log(`⚡ Workers started (QUEUE_DRIVER=${config.queueDriver}, CACHE_DRIVER=${config.cacheDriver})`)
    } else {
      console.log('⚡ START_WORKERS=false (default): Background workers delegated to dedicated worker container')
    }

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
module.exports = { app, internalApp, server, internalServer, io, prisma, rosterCoalescer, presenceManager, vpnWorker, vpnReconciler }

