/**
 * generate-violation-types.js
 * Generates backend (CJS) and frontend (ESM) constants from shared/violationTypes.json
 */

const fs = require('fs')
const path = require('path')

const rootDir = path.resolve(__dirname, '..')
const catalogPath = path.join(rootDir, 'shared', 'violationTypes.json')

if (!fs.existsSync(catalogPath)) {
  console.error(`Catalogue not found at: ${catalogPath}`)
  process.exit(1)
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

const { canonicalTypes, clientEventMap, severities, cooldowns } = catalog

// Backend CJS template
const backendContent = `/**
 * AUTO-GENERATED from shared/violationTypes.json - DO NOT EDIT MANUALLY.
 * Run "node scripts/generate-violation-types.js" to regenerate.
 */

const VIOLATION_TYPES = Object.freeze(${JSON.stringify(
  canonicalTypes.reduce((acc, t) => { acc[t] = t; return acc }, {}),
  null,
  2
)})

const CLIENT_VIOLATION_MAP = Object.freeze(${JSON.stringify(clientEventMap, null, 2)})

const CANONICAL_SEVERITY = Object.freeze(${JSON.stringify(severities, null, 2)})

const FLAG_COOLDOWNS = Object.freeze(${JSON.stringify(cooldowns, null, 2)})

function normalizeViolationType(clientType) {
  if (!clientType || typeof clientType !== 'string') return null
  const mapped = CLIENT_VIOLATION_MAP[clientType] || CLIENT_VIOLATION_MAP[clientType.toUpperCase()]
  return mapped || null
}

function isValidViolationType(type) {
  return Boolean(type && VIOLATION_TYPES[type])
}

module.exports = {
  VIOLATION_TYPES,
  CLIENT_VIOLATION_MAP,
  CANONICAL_SEVERITY,
  FLAG_COOLDOWNS,
  normalizeViolationType,
  isValidViolationType
}
`

// Frontend ESM template
const frontendContent = `/**
 * AUTO-GENERATED from shared/violationTypes.json - DO NOT EDIT MANUALLY.
 * Run "node scripts/generate-violation-types.js" to regenerate.
 */

export const VIOLATION_TYPES = Object.freeze(${JSON.stringify(
  canonicalTypes.reduce((acc, t) => { acc[t] = t; return acc }, {}),
  null,
  2
)})

export const CLIENT_VIOLATION_MAP = Object.freeze(${JSON.stringify(clientEventMap, null, 2)})

export const CANONICAL_SEVERITY = Object.freeze(${JSON.stringify(severities, null, 2)})

export const FLAG_COOLDOWNS = Object.freeze(${JSON.stringify(cooldowns, null, 2)})

export function normalizeViolationType(clientType) {
  if (!clientType || typeof clientType !== 'string') return null
  const mapped = CLIENT_VIOLATION_MAP[clientType] || CLIENT_VIOLATION_MAP[clientType.toUpperCase()]
  return mapped || null
}

export function isValidViolationType(type) {
  return Boolean(type && VIOLATION_TYPES[type])
}
`

const backendTarget = path.join(rootDir, 'proctornet', 'backend', 'src', 'shared', 'violationTypes.js')
const frontendTarget = path.join(rootDir, 'proctornet', 'frontend', 'src', 'shared', 'violationTypes.js')

fs.mkdirSync(path.dirname(backendTarget), { recursive: true })
fs.writeFileSync(backendTarget, backendContent, 'utf8')

fs.mkdirSync(path.dirname(frontendTarget), { recursive: true })
fs.writeFileSync(frontendTarget, frontendContent, 'utf8')

console.log('✅ Generated violation types:')
console.log('  →', backendTarget)
console.log('  →', frontendTarget)
