const { monitorEventLoopDelay } = require('perf_hooks')
const config = require('../shared/config')
const { ServiceUnavailableError } = require('../shared/errors')
const { logger } = require('../shared/logging')

// Event loop histogram resolution 10ms
const loopMonitor = monitorEventLoopDelay({ resolution: 10 })
loopMonitor.enable()

let inFlightCount = 0

// Critical routes that must never be shed first under load
const CRITICAL_PATH_PATTERNS = [
  /\/api\/v1\/attempts\/[^/]+\/answers/,
  /\/api\/v1\/attempts\/[^/]+\/submission/,
  /\/api\/v1\/attempts\/[^/]+\/violations/
]

function isCriticalRoute(path) {
  return CRITICAL_PATH_PATTERNS.some(pattern => pattern.test(path))
}

function loadShed(req, res, next) {
  // Convert nanoseconds to milliseconds (p99)
  const p99LagMs = (loopMonitor.percentile(99) || 0) / 1e6
  const isCritical = isCriticalRoute(req.path)

  // Shed load if system is choking on non-critical endpoints
  if (!isCritical) {
    if (inFlightCount >= config.maxInflightRequests || p99LagMs > config.maxEventLoopDelayMs) {
      logger.warn({
        inFlightCount,
        p99LagMs,
        path: req.path
      }, 'Load shedding active: rejecting non-critical request with 503')
      res.setHeader('Retry-After', '5')
      return next(new ServiceUnavailableError('System overloaded, shedding load. Please retry in 5s', 5))
    }
  }

  inFlightCount++

  const cleanup = () => {
    inFlightCount = Math.max(0, inFlightCount - 1)
  }

  res.on('finish', cleanup)
  res.on('close', cleanup)

  next()
}

module.exports = {
  loadShed,
  isCriticalRoute
}
