'use strict'

const { Prisma } = require('@prisma/client')

/**
 * ProctorNet Schema Table Classification (§Prompt 7 T3)
 *
 * Every table derived from Prisma DMMF must be strictly classified into:
 * - KEEP_IDENTITY: preserved unmodified (admin accounts)
 * - KEEP_CONFIG: system configuration and migrations preserved unmodified
 * - RESET_LEASES: reference table where ephemeral leases/allocations are reset
 * - WIPE: candidate data, attempts, telemetry, audit logs, and ephemeral sessions to be truncated
 */

const KEEP_IDENTITY_TABLES = [
  'admins'
]

const KEEP_CONFIG_TABLES = [
  'platform_settings',
  'departments',
  'agent_rules',
  'agent_policy_versions',
  'agent_releases',
  '_prisma_migrations'
]

const RESET_LEASES_TABLES = [
  'vpn_ip_pool'
]

// Known system/internal tables that may exist in Postgres
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

  // Include system tables
  for (const sysTable of SYSTEM_TABLES) {
    allDbTables.add(sysTable)
  }

  const keepIdentitySet = new Set(KEEP_IDENTITY_TABLES)
  const keepConfigSet = new Set(KEEP_CONFIG_TABLES)
  const resetLeasesSet = new Set(RESET_LEASES_TABLES)

  const wipeTables = []
  const unclassified = []

  for (const tableName of allDbTables) {
    if (keepIdentitySet.has(tableName)) {
      continue
    }
    if (keepConfigSet.has(tableName)) {
      continue
    }
    if (resetLeasesSet.has(tableName)) {
      continue
    }

    // Must be classified as WIPE
    wipeTables.push(tableName)
  }

  // Sanity check: Ensure known critical tables are explicitly present in classifications
  const expectedWipeTables = [
    'auth_sessions',
    'faculties',
    'students',
    'exams',
    'questions',
    'question_options',
    'exam_attempts',
    'attempt_questions',
    'answers',
    'exam_results',
    'violation_events',
    'audit_logs',
    'chat_messages',
    'outbox_events',
    'idempotency_keys',
    'processed_events',
    'vpn_peers',
    'identity_verifications',
    'verification_audit_logs',
    'reverification_logs',
    'device_check_logs',
    'invigilator_sessions',
    'collusion_reports',
    'announcements',
    'biometric_override_logs',
    'agent_pairings',
    'agent_sessions',
    'agent_findings',
    'device_agent_waivers'
  ]

  for (const exp of expectedWipeTables) {
    if (!allDbTables.has(exp)) {
      unclassified.push(`Expected schema table "${exp}" missing from Prisma DMMF`)
    }
  }

  return {
    keepIdentity: Array.from(keepIdentitySet),
    keepConfig: Array.from(keepConfigSet),
    resetLeases: Array.from(resetLeasesSet),
    wipe: wipeTables,
    allTables: Array.from(allDbTables),
    tableToModel,
    unclassified
  }
}

function validateClassificationIntegrity() {
  const classification = getTableClassifications()
  if (classification.unclassified.length > 0) {
    throw new Error(
      `[SCHEMA CLASSIFICATION ERROR] Unclassified or missing tables detected: ${classification.unclassified.join(', ')}`
    )
  }
  return classification
}

module.exports = {
  KEEP_IDENTITY_TABLES,
  KEEP_CONFIG_TABLES,
  RESET_LEASES_TABLES,
  getTableClassifications,
  validateClassificationIntegrity
}
