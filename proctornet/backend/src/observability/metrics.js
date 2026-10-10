const client = require('prom-client')
const { monitorEventLoopDelay } = require('perf_hooks')
const { prisma } = require('../infra/postgres/client')
const { logger } = require('../shared/logging')

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

    // Update outbox failed count gauge (§P9 F1)
    try {
      const failedRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM outbox_events WHERE status = 'FAILED';`)
      if (failedRows && failedRows[0]) {
        outboxFailedGauge.set(failedRows[0].count)
      }
    } catch {}

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

// ── Outbox Failed Events Counter (Q4 Task 3 & P9 F1) ──
const outboxFailedCounter = new client.Counter({
  name: 'pn_outbox_failed_total',
  help: 'Total number of permanently failed outbox events',
  labelNames: ['event_type'],
  registers: [register],
})

const unhandledOutboxEventCounter = new client.Counter({
  name: 'pn_outbox_unhandled_events_total',
  help: 'Total number of unhandled outbox events encountered',
  labelNames: ['event_type'],
  registers: [register],
})

const outboxFailedGauge = new client.Gauge({
  name: 'pn_outbox_failed_rows',
  help: 'Count of outbox_events currently in status FAILED',
  registers: [register],
})

// ── Exam Device Companion Agent Metrics (Prompt 4 / A1) ──
const agentPairingsTotal = new client.Counter({
  name: 'agent_pairings_total',
  help: 'Total number of device agent pairing attempts',
  labelNames: ['scope', 'result'],
  registers: [register],
})

const agentDownloadsTotal = new client.Counter({
  name: 'agent_downloads_total',
  help: 'Total number of device agent binary downloads',
  labelNames: ['os'],
  registers: [register],
})

const agentReportsTotal = new client.Counter({
  name: 'agent_reports_total',
  help: 'Total number of agent reports received',
  labelNames: ['result'],
  registers: [register],
})

const agentSessionsGauge = new client.Gauge({
  name: 'agent_sessions',
  help: 'Current count of device agent sessions by state',
  labelNames: ['state'],
  registers: [register],
})

const agentRejectionsTotal = new client.Counter({
  name: 'agent_rejections_total',
  help: 'Total number of agent reports rejected with reasons',
  labelNames: ['reason'],
  registers: [register],
})

const agentFindingsOpenGauge = new client.Gauge({
  name: 'agent_findings_open',
  help: 'Number of currently open agent findings by rule category',
  labelNames: ['category'],
  registers: [register],
})

// ── Autosave Metrics (Prompt 7 / T1) ──
const autosaveItemsTotal = new client.Counter({
  name: 'autosave_items_total',
  help: 'Total number of autosave item attempts by result status',
  labelNames: ['result'],
  registers: [register],
})

const autosaveConflictsTotal = new client.Counter({
  name: 'autosave_conflicts_total',
  help: 'Total number of optimistic concurrency conflicts on autosave',
  registers: [register],
})

// ── BigInt Serialization Safety Net Metric (Prompt 8 / U2) ──
const bigintSerializedTotal = new client.Counter({
  name: 'bigint_serialized_total',
  help: 'Total number of BigInt values serialized via global prototype fallback',
  registers: [register],
})

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  socketioConnectedGauge,
  eventLoopLagGauge,
  outboxFailedCounter,
  unhandledOutboxEventCounter,
  outboxFailedGauge,
  agentPairingsTotal,
  agentDownloadsTotal,
  agentReportsTotal,
  agentSessionsGauge,
  agentRejectionsTotal,
  agentFindingsOpenGauge,
  autosaveItemsTotal,
  autosaveConflictsTotal,
  bigintSerializedTotal,
}

