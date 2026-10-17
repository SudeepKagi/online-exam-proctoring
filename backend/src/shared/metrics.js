/**
 * Safe metrics stubs
 */
const noopCounter = { inc: () => {} }
const noopGauge = { set: () => {}, inc: () => {}, dec: () => {} }
const noopHistogram = { observe: () => {} }

module.exports = {
  register: { metrics: async () => '' },
  metricsMiddleware: (req, res, next) => next(),
  metricsHandler: (req, res) => res.type('text/plain').send(''),
  recordPrismaQueryDuration: () => {},
  updatePrismaPoolMetrics: () => {},
  httpRequestsTotal: noopCounter,
  httpRequestDurationSeconds: noopHistogram,
  eventLoopLagGauge: noopGauge,
  activeTransactionsGauge: noopGauge,
  bigintSerializedTotal: noopCounter
}
