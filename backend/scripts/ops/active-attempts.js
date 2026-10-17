#!/usr/bin/env node
'use strict'

// Load environment from backend .env if not already loaded
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') })

const { prisma } = require('../../src/infra/postgres/client')

async function main() {
  try {
    const activeCount = await prisma.examAttempt.count({
      where: {
        status: 'ACTIVE'
      }
    })
    console.log(activeCount)
    process.exit(0)
  } catch (err) {
    console.error(`[active-attempts] Failed to query exam attempts: ${err.message}`)
    process.exit(1)
  } finally {
    try {
      await prisma.$disconnect()
    } catch {
      // ignore
    }
  }
}

if (require.main === module) {
  main()
}

module.exports = { main }
