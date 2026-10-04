/**
 * metrics.js - Streaming Quantile Metric Collector for ProctorNet Load Testing
 *
 * Computes exact percentiles (p50, p90, p95, p99), rates, and error percentages
 * across all operational endpoints:
 * - login
 * - start
 * - answer_save (batch and individual)
 * - submit
 * - roster_page
 * - ws_delta
 * - violations
 */

class LatencyHistogram {
  constructor(name) {
    this.name = name
    this.values = []
    this.totalCount = 0
    this.sumMs = 0
    this.minMs = Infinity
    this.maxMs = 0
  }

  record(durationMs) {
    if (typeof durationMs !== 'number' || isNaN(durationMs)) return
    this.totalCount++
    this.sumMs += durationMs
    if (durationMs < this.minMs) this.minMs = durationMs
    if (durationMs > this.maxMs) this.maxMs = durationMs
    this.values.push(durationMs)
  }

  getQuantiles() {
    if (this.values.length === 0) {
      return { count: 0, min: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 }
    }

    // Sort values for exact percentiles
    this.values.sort((a, b) => a - b)
    const len = this.values.length

    const getP = (p) => {
      const idx = Math.min(Math.floor(len * p), len - 1)
      return Math.round(this.values[idx] * 100) / 100
    }

    return {
      count: this.totalCount,
      min: Math.round(this.minMs * 100) / 100,
      avg: Math.round((this.sumMs / this.totalCount) * 100) / 100,
      p50: getP(0.50),
      p90: getP(0.90),
      p95: getP(0.95),
      p99: getP(0.99),
      max: Math.round(this.maxMs * 100) / 100
    }
  }
}

class MetricsCollector {
  constructor() {
    this.startTime = Date.now()
    this.endTime = null

    // Latency histograms
    this.histograms = {
      login: new LatencyHistogram('login'),
      start: new LatencyHistogram('start'),
      answer_save_batch: new LatencyHistogram('answer_save_batch'),
      answer_save_single: new LatencyHistogram('answer_save_single'),
      answer_save_all: new LatencyHistogram('answer_save_all'),
      submit: new LatencyHistogram('submit'),
      roster_page: new LatencyHistogram('roster_page'),
      ws_heartbeat_ack: new LatencyHistogram('ws_heartbeat_ack'),
      ws_delta_delivery: new LatencyHistogram('ws_delta_delivery'),
      violation_record: new LatencyHistogram('violation_record'),
      chat_message: new LatencyHistogram('chat_message')
    }

    // Counters
    this.counts = {
      totalRequests: 0,
      totalSuccess: 0,
      totalErrors: 0,
      intentionalConflicts: 0, // 409 / 429
      networkDisconnects: 0,
      networkReconnects: 0,
      browserRefreshes: 0,
      answersAcked: 0,
      submissionsCompleted: 0,
      violationsDispatched: 0
    }
  }

  recordTiming(metricName, durationMs) {
    if (this.histograms[metricName]) {
      this.histograms[metricName].record(durationMs)
    }
    if (metricName.startsWith('answer_save_')) {
      this.histograms.answer_save_all.record(durationMs)
    }
  }

  recordRequest(status, isIntentional = false) {
    this.counts.totalRequests++
    if (status >= 200 && status < 400) {
      this.counts.totalSuccess++
    } else if (isIntentional || status === 409 || status === 429) {
      this.counts.intentionalConflicts++
    } else {
      this.counts.totalErrors++
    }
  }

  increment(counterName, amount = 1) {
    if (this.counts[counterName] !== undefined) {
      this.counts[counterName] += amount
    }
  }

  getSummary(sloTargetTier = 'A') {
    const elapsedSec = ((this.endTime || Date.now()) - this.startTime) / 1000
    const nonIntentionalReqs = this.counts.totalRequests - this.counts.intentionalConflicts
    const errorRate = nonIntentionalReqs > 0 ? (this.counts.totalErrors / nonIntentionalReqs) * 100 : 0

    const quantiles = {}
    for (const [key, hist] of Object.entries(this.histograms)) {
      quantiles[key] = hist.getQuantiles()
    }

    // Evaluate Section 10.2 SLOs
    const saveP95 = quantiles.answer_save_all.p95
    const saveP99 = quantiles.answer_save_all.p99
    const startP95 = quantiles.start.p95
    const submitP95 = quantiles.submit.p95
    const loginP95 = quantiles.login.p95
    const rosterP95 = quantiles.roster_page.p95

    const slos = {
      answerSaveP95: { actual: saveP95, target: 150, passed: saveP95 <= 150 },
      answerSaveP99: { actual: saveP99, target: 400, passed: saveP99 <= 400 },
      startSpikeP95: { actual: startP95, target: 800, passed: startP95 <= 800 },
      submitP95: { actual: submitP95, target: 500, passed: submitP95 <= 500 },
      loginP95: { actual: loginP95, target: 400, passed: loginP95 <= 400 },
      rosterPageP95: { actual: rosterP95, target: 300, passed: rosterP95 <= 300 },
      errorRate: { actual: Math.round(errorRate * 1000) / 1000, target: 0.1, passed: errorRate < 0.1 }
    }

    const allPassed = Object.values(slos).every(s => s.passed)

    return {
      durationSeconds: Math.round(elapsedSec * 10) / 10,
      throughputRps: Math.round((this.counts.totalRequests / elapsedSec) * 10) / 10,
      counts: this.counts,
      quantiles,
      slos,
      allSlosPassed: allPassed
    }
  }

  printReport(sloTargetTier = 'A') {
    const summary = this.getSummary(sloTargetTier)
    console.log(`\n================================================================================`)
    console.log(`📊 ProctorNet Concurrency & Performance Summary (Duration: ${summary.durationSeconds}s, RPS: ${summary.throughputRps})`)
    console.log(`================================================================================`)
    console.log(`Total Requests:      ${summary.counts.totalRequests}`)
    console.log(`Successes:           ${summary.counts.totalSuccess}`)
    console.log(`Errors (Unintended): ${summary.counts.totalErrors} (${summary.slos.errorRate.actual}%)`)
    console.log(`Intentional (409):   ${summary.counts.intentionalConflicts}`)
    console.log(`Answers Acked:       ${summary.counts.answersAcked}`)
    console.log(`Submits Completed:   ${summary.counts.submissionsCompleted}`)
    console.log(`--------------------------------------------------------------------------------`)
    console.log(`LATENCY METRICS (ms):`)
    for (const [name, q] of Object.entries(summary.quantiles)) {
      if (q.count > 0) {
        console.log(`  ${name.padEnd(20)} | count: ${String(q.count).padStart(5)} | p50: ${String(q.p50).padStart(5)}ms | p90: ${String(q.p90).padStart(5)}ms | p95: ${String(q.p95).padStart(5)}ms | p99: ${String(q.p99).padStart(5)}ms | max: ${String(q.max).padStart(6)}ms`)
      }
    }
    console.log(`--------------------------------------------------------------------------------`)
    console.log(`SLO EVALUATION (Section 10.2 Criteria):`)
    for (const [key, evalResult] of Object.entries(summary.slos)) {
      const statusIcon = evalResult.passed ? '✅ PASS' : '❌ FAIL'
      const unit = key === 'errorRate' ? '%' : 'ms'
      console.log(`  ${key.padEnd(18)} : Actual = ${String(evalResult.actual).padStart(6)}${unit} (Target: < ${evalResult.target}${unit}) -> ${statusIcon}`)
    }
    console.log(`================================================================================\n`)
  }
}

module.exports = { MetricsCollector }
