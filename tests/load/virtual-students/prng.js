/**
 * prng.js - Deterministic Seeded PRNG for ProctorNet Virtual Students
 *
 * Provides mathematically accurate random distributions:
 * - Gaussian (Box-Muller transform) for synchronized start spikes
 * - Log-normal for candidate question think times and lobby arrivals
 * - Exponential / Poisson intervals for violations and network drops
 * - Uniform and discrete sampling
 */

const path = require('path')
module.paths.push(path.resolve(__dirname, '../../../proctornet/backend/node_modules'))
const seedrandom = require('seedrandom')

class DeterministicPRNG {
  /**
   * @param {string|number} seed - Deterministic run seed
   */
  constructor(seed = 'proctornet-default-seed-42') {
    this.seed = String(seed)
    this.rng = seedrandom(this.seed)
  }

  /**
   * Derive a deterministic child PRNG for a specific agent/student
   * @param {string|number} subKey 
   * @returns {DeterministicPRNG}
   */
  fork(subKey) {
    return new DeterministicPRNG(`${this.seed}:${subKey}`)
  }

  /**
   * Uniform random float [0, 1)
   */
  random() {
    return this.rng()
  }

  /**
   * Uniform random float [min, max)
   */
  uniform(min, max) {
    return min + this.random() * (max - min)
  }

  /**
   * Uniform random integer [min, max]
   */
  int(min, max) {
    return Math.floor(this.uniform(min, max + 1))
  }

  /**
   * Boolean chance with given probability [0, 1]
   */
  chance(probability) {
    return this.random() < probability
  }

  /**
   * Pick random element from array
   */
  choice(array) {
    if (!array || array.length === 0) return null
    return array[this.int(0, array.length - 1)]
  }

  /**
   * Gaussian (Normal) distribution via Box-Muller transform
   * @param {number} mean - Center of distribution
   * @param {number} stdDev - Standard deviation (sigma)
   * @returns {number}
   */
  gaussian(mean = 0, stdDev = 1) {
    let u1 = this.random()
    let u2 = this.random()
    // Avoid log(0)
    while (u1 === 0) u1 = this.random()
    while (u2 === 0) u2 = this.random()

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return mean + z0 * stdDev
  }

  /**
   * Log-Normal distribution
   * @param {number} median - Median of distribution (exp(mu))
   * @param {number} sigmaLog - Standard deviation of the log-transformed variable
   * @returns {number}
   */
  logNormal(median = 40, sigmaLog = 0.5) {
    const mu = Math.log(median)
    const normalVal = this.gaussian(mu, sigmaLog)
    return Math.exp(normalVal)
  }

  /**
   * Poisson inter-arrival time (Exponential distribution)
   * Given lambda in events/minute, returns seconds until next event
   * @param {number} lambdaPerMin - Average events per minute
   * @returns {number} Delay in seconds
   */
  poissonIntervalSeconds(lambdaPerMin = 0.4) {
    if (lambdaPerMin <= 0) return Infinity
    const lambdaPerSec = lambdaPerMin / 60
    let u = this.random()
    while (u === 0) u = this.random()
    return -Math.log(u) / lambdaPerSec
  }
}

module.exports = { DeterministicPRNG }
