const {
  register,
  metricsMiddleware,
  metricsHandler,
  recordPrismaQueryDuration,
  updatePrismaPoolMetrics,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  eventLoopLagGauge,
  activeTransactionsGauge
} = require('../observability/metrics')

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  recordPrismaQueryDuration,
  updatePrismaPoolMetrics,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  eventLoopLagGauge,
  activeTransactionsGauge
}
