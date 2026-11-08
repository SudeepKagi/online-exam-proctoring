#!/usr/bin/env node
'use strict'

/**
 * verify-formula.js
 * CLI utility to test Safe Exam Browser (SEB) Config Key hash formula variants.
 * 
 * Usage:
 *   node scripts/seb/verify-formula.js <url> <configKey> <observedHeader>
 *   node scripts/seb/verify-formula.js --make <url> <configKey>
 * 
 * Formula Variants:
 *   A = sha256_hex(url + key)
 *   B = sha256_hex(url + sha256_hex(key))
 */

const crypto = require('crypto')

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str).digest('hex').toLowerCase()
}

function calculateVariantA(url, configKey) {
  return sha256Hex(url + configKey)
}

function calculateVariantB(url, configKey) {
  return sha256Hex(url + sha256Hex(configKey))
}

function printUsage() {
  console.log(`
Usage:
  node scripts/seb/verify-formula.js <url> <configKey> <observedHeader>
  node scripts/seb/verify-formula.js --make <url> <configKey>

Parameters:
  <url>             Canonical request URL (without fragment, e.g. http://localhost:5000/api/v1/attempts/start)
  <configKey>       64-character hex SEB Config Key
  <observedHeader>  Value of X-SafeExamBrowser-ConfigKeyHash observed on the incoming request

Flags:
  --make            Calculate and print expected headers for curl / test requests

Exit Codes:
  0 = Header matches Variant A or Variant B (or --make succeeded)
  1 = Mismatch between observed header and both variants, or invalid arguments
`)
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage()
    process.exit(args.length === 0 ? 1 : 0)
  }

  if (args[0] === '--make') {
    if (args.length < 3) {
      console.error('Error: --make requires <url> and <configKey> arguments.')
      printUsage()
      process.exit(1)
    }

    const url = args[1].trim()
    const configKey = args[2].trim().toLowerCase()

    if (!/^[0-9a-f]{64}$/.test(configKey)) {
      console.error(`Warning: Config key "${configKey}" is not a 64-character hex string.`)
    }

    const hashA = calculateVariantA(url, configKey)
    const hashB = calculateVariantB(url, configKey)

    console.log(`URL:        ${url}`)
    console.log(`Config Key: ${configKey}`)
    console.log(`Variant A:  ${hashA}  (sha256_hex(url + key))`)
    console.log(`Variant B:  ${hashB}  (sha256_hex(url + sha256_hex(key)))`)
    console.log(`\nDefault Header for curl test:`)
    console.log(`X-SafeExamBrowser-ConfigKeyHash: ${hashA}`)
    process.exit(0)
  }

  if (args.length < 3) {
    console.error('Error: Missing required arguments.')
    printUsage()
    process.exit(1)
  }

  const url = args[0].trim()
  const configKey = args[1].trim().toLowerCase()
  const observedHeader = args[2].trim().toLowerCase()

  const hashA = calculateVariantA(url, configKey)
  const hashB = calculateVariantB(url, configKey)

  const matchA = observedHeader === hashA
  const matchB = observedHeader === hashB

  if (matchA && matchB) {
    console.log('MATCH: Both Variant A and Variant B matched (identical hashes)')
    process.exit(0)
  } else if (matchA) {
    console.log('MATCH: Variant A (sha256_hex(url + key))')
    process.exit(0)
  } else if (matchB) {
    console.log('MATCH: Variant B (sha256_hex(url + sha256_hex(key)))')
    process.exit(0)
  } else {
    console.error('MISMATCH: Neither variant matched observed header.')
    console.error(`  URL:             ${url}`)
    console.error(`  Observed Header: ${observedHeader}`)
    console.error(`  Variant A:       ${hashA}`)
    console.error(`  Variant B:       ${hashB}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  calculateVariantA,
  calculateVariantB,
  sha256Hex
}
