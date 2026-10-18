'use strict'

const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const { verifyToken } = require('../utils/jwt')
const { extractTokenFromReq } = require('../utils/cookies')
const { ROLES } = require('../shared/roles')

const isProd = process.env.NODE_ENV === 'production'
const allowedOrigins = []

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(',').forEach((u) => {
    const trimmed = u.trim()
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed)
  })
}
if (process.env.CORS_ORIGIN) {
  process.env.CORS_ORIGIN.split(',').forEach((u) => {
    const trimmed = u.trim()
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed)
  })
}
if (process.env.PUBLIC_ORIGIN) {
  process.env.PUBLIC_ORIGIN.split(',').forEach((u) => {
    const trimmed = u.trim()
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed)
  })
}
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((u) => {
    const trimmed = u.trim()
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed)
  })
}

;['https://proctornet.duckdns.org', 'http://proctornet.duckdns.org'].forEach((o) => {
  if (!allowedOrigins.includes(o)) allowedOrigins.push(o)
})

if (!isProd) {
  const localDevOrigins = [
    'http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:5174', 'http://127.0.0.1:5174',
    'http://localhost:5175', 'http://127.0.0.1:5175',
    'http://localhost:3000', 'http://127.0.0.1:3000'
  ]
  localDevOrigins.forEach((o) => {
    if (!allowedOrigins.includes(o)) allowedOrigins.push(o)
  })
}

const derivedWsOrigins = allowedOrigins.map((orig) => {
  try {
    const u = new URL(orig)
    return (u.protocol === 'https:' ? 'wss://' : 'ws://') + u.host
  } catch {
    return null
  }
}).filter(Boolean)

const s3Bucket = process.env.S3_BUCKET || process.env.S3_BUCKET_NAME || 'proctornet-storage'
const awsRegion = process.env.AWS_REGION || 'ap-south-1'
const s3Hosts = isProd
  ? [`https://${s3Bucket}.s3.${awsRegion}.amazonaws.com`, `https://${s3Bucket}.s3.amazonaws.com`, 'https://*.amazonaws.com']
  : ['http://localhost:9000', 'http://127.0.0.1:9000']

const dynamicImgSrc = ["'self'", 'data:', 'blob:', ...s3Hosts]
if (process.env.S3_ENDPOINT) dynamicImgSrc.push(process.env.S3_ENDPOINT)

const dynamicConnectSrc = ["'self'", ...derivedWsOrigins, ...s3Hosts, ...(isProd ? [] : ['ws://localhost:5000', 'ws://127.0.0.1:5000'])]
if (process.env.S3_ENDPOINT) dynamicConnectSrc.push(process.env.S3_ENDPOINT)

const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: dynamicImgSrc,
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: dynamicConnectSrc,
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
})

const corsMiddleware = cors({
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-requested-with', 'cookie', 'x-agent-session', 'x-agent-seq', 'x-agent-ts', 'x-agent-nonce', 'x-agent-signature', 'x-request-id']
})

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const hasCookieAuth = Boolean(
    req.cookies?.pn_at || req.cookies?.proctornet_auth ||
    (req.headers.cookie && (req.headers.cookie.includes('pn_at=') || req.headers.cookie.includes('proctornet_auth=')))
  )
  if (!isProd && (req.headers['x-client-type'] === 'test' || req.headers['x-client-type'] === 'cli')) return next()
  const isAgentRoute = req.originalUrl?.startsWith('/api/v1/agent') || req.path?.startsWith('/api/v1/agent') || req.baseUrl?.startsWith('/api/v1/agent')
  if (!hasCookieAuth && isAgentRoute && (req.headers['x-agent-signature'] || req.headers['x-agent-session'])) return next()

  const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null)
  if (origin) {
    try {
      const originObj = new URL(origin)
      const originHost = originObj.host.toLowerCase()
      const reqHost = (req.headers.host || '').toLowerCase()
      const extraOrigins = process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',').map(s => s.trim().toLowerCase()) : []
      const isSameOrigin = originHost === reqHost
      const isExplicitAllowed = allowedOrigins.includes(origin) || allowedOrigins.includes(originObj.origin) || extraOrigins.includes(origin.toLowerCase()) || extraOrigins.includes(originHost)
      const isLocalDev = !isProd && (originHost.startsWith('localhost') || originHost.startsWith('127.0.0.1'))
      if (!isSameOrigin && !isExplicitAllowed && !isLocalDev) {
        return res.status(403).json({ error: 'Forbidden origin: Cross-site request rejected.' })
      }
    } catch {
      return res.status(403).json({ error: 'Forbidden origin: Malformed origin header' })
    }
  }
  next()
}

const isLoadTest = !isProd && (process.env.LOADTEST_ALLOW === '1' || process.env.DISABLE_RATE_LIMIT === '1')
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => {
    if (isLoadTest) return 100000
    let role = req.user?.role?.toLowerCase()
    if (!role) {
      const token = extractTokenFromReq(req)
      if (token) {
        try {
          const decoded = verifyToken(token)
          if (decoded?.role) role = decoded.role.toLowerCase()
        } catch (_) {}
      }
    }
    if (role === ROLES.INVIGILATOR) return 6000
    if (role === ROLES.ADMIN || role === ROLES.FACULTY) return 3000
    if (role === ROLES.STUDENT) return 1200
    return 600
  },
  skip: () => isLoadTest,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user?.id) return `user_${req.user.id}`
    const token = extractTokenFromReq(req)
    if (token) {
      try {
        const decoded = verifyToken(token)
        if (decoded?.id) return `user_${decoded.id}`
      } catch (_) {}
    }
    return req.ip
  },
  message: { error: 'Too many requests for this session. Please try again shortly.' }
})

module.exports = {
  allowedOrigins,
  helmetMiddleware,
  corsMiddleware,
  csrfProtection,
  apiLimiter
}
