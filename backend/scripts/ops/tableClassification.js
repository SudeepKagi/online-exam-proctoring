'use strict'

const { Prisma } = require('@prisma/client')

/**
 * ProctorNet Schema Table Classification
 * Strictly aligned with the 7 core tables:
 * users, exams, questions, exam_assignments, exam_attempts, attempt_answers, proctoring_logs
 */

const KEEP_IDENTITY_TABLES = [
  'users'
]

const KEEP_CONFIG_TABLES = [
  '_prisma_migrations'
]

const RESET_LEASES_TABLES = []

const SYSTEM_TABLES = [
  '_prisma_migrations'
]

function getTableClassifications() {
  const models = Prisma.dmmf.datamodel.models || []
  const tableToModel = new Map()
  const allDbTables = new Set()

  for (const model of models) {
    const tableName = model.dbName || model.name
    tableToModel.set(tableName, model.name)
    allDbTables.add(tableName)
  }

  for (const sysTable of SYSTEM_TABLES) {
    allDbTables.add(sysTable)
  }

  const keepIdentitySet = new Set(KEEP_IDENTITY_TABLES)
  const keepConfigSet = new Set(KEEP_CONFIG_TABLES)
  const resetLeasesSet = new Set(RESET_LEASES_TABLES)

  const wipeTables = []
  const unclassified = []

  for (const tableName of allDbTables) {
    if (keepIdentitySet.has(tableName)) continue
    if (keepConfigSet.has(tableName)) continue
    if (resetLeasesSet.has(tableName)) continue
    wipeTables.push(tableName)
  }

  return {
    allTables: Array.from(allDbTables),
    keepIdentityTables: KEEP_IDENTITY_TABLES,
    keepConfigTables: KEEP_CONFIG_TABLES,
    resetLeasesTables: RESET_LEASES_TABLES,
    wipeTables,
    unclassified,
    tableToModel
  }
}

module.exports = {
  getTableClassifications,
  KEEP_IDENTITY_TABLES,
  KEEP_CONFIG_TABLES,
  RESET_LEASES_TABLES,
  SYSTEM_TABLES
}
