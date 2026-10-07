const client = require('prom-client')
const { monitorEventLoopDelay } = require('perf_hooks')
const { prisma } = require('../infra/postgres/client')

// Global Registry
const register = new client.Registry()

// Enable Default Process Metrics (CPU, Memory, File Descriptors, GC)
client.collectDefaultMetrics({ register, prefix: 'proctornet_' })

// ── Event Loop Delay Monitoring (Critical for Concurrency Bounds) ──
const histogram = monitorEventLoopDelay({ resolution: 20 })
histogram.enable()

const eventLoopLagGauge = new client.Gauge({
  name: 'nodejs_eventloop_delay_seconds',
  help: 'Node.js event loop delay in seconds (lag indicates main thread saturation)',
  labelNames: ['quantile'],
  registers: [register],
})

setInterval(() => {
  eventLoopLagGauge.set({ quantile: '0.50' }, histogram.percentile(50) / 1e9)
  eventLoopLagGauge.set({ quantile: '0.90' }, histogram.percentile(90) / 1e9)
  eventLoopLagGauge.set({ quantile: '0.99' }, histogram.percentile(99) / 1e9)
  eventLoopLagGauge.set({ quantile: 'max' }, histogram.max / 1e9)
  histogram.reset()
}, 5000).unref()

// ── HTTP Request Latency & Count Histogram ──
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
})

// ── Active Socket.IO Connections Gauge ──
const socketioConnectedGauge = new client.Gauge({
  name: 'socketio_connected_clients',
  help: 'Number of active Socket.IO connections by role',
  labelNames: ['role'],
  registers: [register],
})

// ── HTTP Middleware for Route Duration ──
function metricsMiddleware(req, res, next) {
  const start = process.hrtime()

  res.on('finish', () => {
    // Normalize route to avoid high cardinality
    const route = req.route?.path || req.baseUrl || (req.path.startsWith('/api') ? req.path.split('?')[0] : 'other')
    const diff = process.hrtime(start)
    const durationInSeconds = diff[0] + diff[1] / 1e9
    httpRequestDuration.observe(
      {
        method: req.method,
        route,
        status_code: res.statusCode,
      },
      durationInSeconds
    )
  })

  next()
}

// ── Metrics Route Handler ──
async function metricsHandler(req, res) {
  try {
    let output = await register.metrics()

    // Append Prisma native metrics if enabled
    if (prisma?.$metrics) {
      try {
        const prismaMetrics = await prisma.$metrics.prometheus()
        output += `\n${prismaMetrics}`
      } catch (prismaErr) {
        logger.debug({ error: prismaErr.message }, 'Prisma metrics preview not available')
      }
    }

    res.setHeader('Content-Type', register.contentType)
    res.end(output)
  } catch (err) {
    res.status(500).end(err.message)
  }
}

// ── Outbox Failed Events Counter (Q4 Task 3) ──
const outboxFailedCounter = new client.Counter({
  name: 'pn_outbox_failed_total',
  help: 'Total number of permanently failed outbox events',
  labelNames: ['event_type'],
  registers: [register],
})

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  socketioConnectedGauge,
  eventLoopLagGauge,
  outboxFailedCounter,
}
