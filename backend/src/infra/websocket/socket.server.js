'use strict'

const { Server } = require('socket.io')
const { createAdapter } = require('@socket.io/redis-adapter')
const { verifyToken } = require('../../utils/jwt')
const { extractTokenFromSocket } = require('../../utils/cookies')
const { redisClient } = require('../redis/client')
const { rosterCoalescer } = require('./rosterCoalescer')
const { normalizeRole } = require('../../shared/roles')
const { logger } = require('../../shared/logging')
const { registerSocketEvents } = require('./socketHandlers')

const latestScreenFrames = new Map()
let globalIO = null

function getIO() {
  return globalIO
}

function createWebSocketServer(httpServer, options = {}) {
  const envOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((u) => u.trim()).filter(Boolean)
    : []
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((u) => u.trim()).filter(Boolean)
    : []
  const allowedOrigins = [
    'https://proctornet.duckdns.org',
    'http://proctornet.duckdns.org',
    ...envOrigins,
    ...corsOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000'
  ]

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true)
        if (allowedOrigins.includes(origin)) return callback(null, true)
        if (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
          return callback(null, true)
        }
        return callback(null, false)
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'cookie']
    },
    transports: ['websocket'],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1024 * 1024,
    perMessageDeflate: false,
    ...options
  })

  globalIO = io

  // Multi-Process Scaling with Redis Adapter
  try {
    const config = require('../../shared/config')
    if (config.cacheDriver === 'memory') {
      logger.info('Socket.io: using default in-memory adapter (CACHE_DRIVER=memory)')
    } else {
      const Redis = require('ioredis')
      const pubClient = redisClient.client
        ? redisClient.client.duplicate()
        : new Redis(config.redisUrl, {
            keyPrefix: config.redisPrefix,
            lazyConnect: true,
            maxRetriesPerRequest: null,
            retryStrategy: (n) => Math.min(n * 200, 5000)
          })
      const subClient = pubClient.duplicate()

      pubClient.on('error', (err) => logger.warn({ error: err.message }, 'Socket.IO Redis adapter pubClient error'))
      subClient.on('error', (err) => logger.warn({ error: err.message }, 'Socket.IO Redis adapter subClient error'))

      const { onClose } = require('../../lifecycle')
      onClose('socket.io:redis-adapter', async () => {
        try { pubClient.disconnect(false) } catch (_) {}
        try { subClient.disconnect(false) } catch (_) {}
      })

      io.adapter(createAdapter(pubClient, subClient))

      Promise.all([
        pubClient.status === 'ready' ? Promise.resolve() : pubClient.connect().catch(() => {}),
        subClient.status === 'ready' ? Promise.resolve() : subClient.connect().catch(() => {})
      ]).then(() => {
        logger.info('Socket.IO Redis adapter enabled for multi-process scaling')
      }).catch((err) => {
        logger.warn({ error: err.message }, 'Socket.IO Redis adapter connection deferred, ioredis will retry')
      })
    }
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to configure Redis adapter for Socket.IO')
  }

  rosterCoalescer.setIO(io)

  // Fail-Closed Handshake Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null
      const token = socket.handshake.auth?.token || headerToken || extractTokenFromSocket(socket)

      if (!token) return next(new Error('AUTHENTICATION_FAILED: Missing authentication credentials'))

      let decoded
      try {
        decoded = verifyToken(token)
      } catch (err) {
        return next(new Error(`AUTHENTICATION_FAILED: ${err.message || 'Invalid or expired token'}`))
      }

      if (!decoded || !decoded.id) return next(new Error('AUTHENTICATION_FAILED: Malformed token payload'))

      const role = normalizeRole(decoded.role)
      if (!role) return next(new Error('AUTHENTICATION_FAILED: Invalid or unrecognized role in token'))

      socket.user = {
        id: decoded.id,
        role,
        sid: decoded.sid || null,
        familyId: decoded.familyId || null,
        epoch: decoded.epoch ?? null,
        exp: decoded.exp ?? null,
        examId: decoded.examId || null,
        name: decoded.name || null,
        usn: decoded.usn || null
      }

      socket.authorizedAttempts = new Set()
      socket.authorizedExams = new Set()
      socket.activeAttemptId = null
      socket.activeExamId = null

      next()
    } catch (err) {
      logger.warn({ error: err.message }, 'Socket handshake authentication rejected (failed closed)')
      return next(new Error(`AUTHENTICATION_FAILED: ${err.message}`))
    }
  })

  // Connection Handler
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id, userId: socket.user?.id, role: socket.user?.role }, 'Socket client connected')
    registerSocketEvents(io, socket, latestScreenFrames)
  })

  return io
}

module.exports = {
  createWebSocketServer,
  getIO,
  latestScreenFrames
}
