'use strict'

require('dotenv').config()
const { validateConfig } = require('./shared/validateConfig')
validateConfig()

const express = require('express')
const http = require('http')
const cookieParser = require('cookie-parser')
const compression = require('compression')

const { createWebSocketServer } = require('./infra/websocket/socket.server')
const { rosterCoalescer } = require('./infra/websocket/rosterCoalescer')
const { presenceManager } = require('./infra/websocket/presence')
const { prisma } = require('./infra/postgres/client')
const { redisClient } = require('./infra/redis/client')
const config = require('./shared/config')
const { requestContextMiddleware, logger } = require('./shared/logging')
const { metricsMiddleware, metricsHandler, bigintSerializedTotal } = require('./shared/metrics')
const { proctoringService } = require('./modules/proctoring/proctoring.service')
const { helmetMiddleware, corsMiddleware, csrfProtection, apiLimiter } = require('./middleware/security')
const { errorHandler } = require('./middleware/errorHandler')
const { setupGracefulShutdown } = require('./infra/shutdown')
const v1Router = require('./modules/router')

// Global BigInt Serialization Safety Net
if (!BigInt.prototype.toJSON) {
  BigInt.prototype.toJSON = function () {
    try { bigintSerializedTotal.inc() } catch (_) {}
    return this.toString()
  }
}

const app = express()
const server = http.createServer(app)
const io = createWebSocketServer(server)
app.set('io', io)
proctoringService.setIO(io)

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(helmetMiddleware)
if (process.env.NODE_ENV !== 'production') app.use(compression())

app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || require('crypto').randomUUID()
  next()
})
app.use(requestContextMiddleware)
app.use(metricsMiddleware)
app.use(cookieParser())
app.use(corsMiddleware)

app.use(express.json({
  limit: '25mb',
  verify: (req, _res, buf) => {
    if (req.path.startsWith('/api/v1/agent') || req.path.startsWith('/internal/livekit')) {
      req.rawBody = buf
    }
  }
}))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))

// Internal LiveKit Webhook Endpoint
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

app.use('/api', csrfProtection)
app.use('/api', apiLimiter)

// Health probes
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'ProctorNet Backend', timestamp: new Date().toISOString(), uptime: process.uptime() })
})
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ProctorNet Backend', timestamp: new Date().toISOString(), uptime: process.uptime() })
})

// Dedicated Internal Listener (9100)
const internalApp = express()
const internalServer = http.createServer(internalApp)

internalApp.get('/readyz', async (_req, res) => {
  const timeoutMs = 1500
  const withTimeout = (promise, name) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} health check timed out after ${timeoutMs}ms`)), timeoutMs))
  ])

  const checks = { postgres: 'pending', redis: 'pending' }
  await Promise.allSettled([
    withTimeout(prisma.$queryRawUnsafe('SELECT 1'), 'PostgreSQL')
      .then(() => { checks.postgres = 'ok' })
      .catch((err) => { checks.postgres = `failed: ${err.message}` }),
    config.cacheDriver === 'memory'
      ? Promise.resolve().then(() => { checks.redis = 'skipped (memory driver)' })
      : withTimeout(redisClient.ping(), 'Redis')
          .then((ok) => { checks.redis = ok ? 'ok' : 'failed: ping returned false' })
          .catch((err) => { checks.redis = `failed: ${err.message}` })
  ])

  const isReady = checks.postgres === 'ok' && (checks.redis === 'ok' || checks.redis?.startsWith('skipped'))
  return res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'ProctorNet Backend Internal Probes',
    timestamp: new Date().toISOString(),
    checks
  })
})
internalApp.get('/metrics', metricsHandler)

// API Routing
app.use('/api/v1', v1Router)
app.use('/api', (req, res, next) => {
  if (req.url.startsWith('/v1')) return next()
  return v1Router(req, res, next)
})

// Production Static Bundle Serving & SPA Fallback
const path = require('path')
const fs = require('fs')
const frontendDist = path.resolve(__dirname, '../../frontend/dist')
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/internal') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return next()
    }
    return res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    requestId: req.requestId || null
  })
})
app.use(errorHandler)

server.requestTimeout = 15000
server.headersTimeout = 65000
server.keepAliveTimeout = 65000

setupGracefulShutdown({
  server, internalServer, io, rosterCoalescer,
  proctoringService, prisma, redisClient, config, logger
})

const PORT = process.env.PORT || 5000
if ((require.main === module || process.env.NODE_ENV !== 'test') && !process.env.JEST_WORKER_ID) {
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

    try {
      await prisma.$connect()
      console.log('✅ Database connection successful')
    } catch (e) {
      console.error('❌ Database connection failed:', e.message)
    }
  })
}

module.exports = { app, internalApp, server, internalServer, io, prisma, rosterCoalescer, presenceManager }
