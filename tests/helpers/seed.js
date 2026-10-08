'use strict'

const crypto = require('crypto')
let bcrypt
try {
  bcrypt = require('bcryptjs')
} catch (e) {
  try {
    bcrypt = require('../../proctornet/backend/node_modules/bcryptjs')
  } catch (err) {
    bcrypt = require('bcrypt')
  }
}
const { prisma } = require('../../proctornet/backend/src/infra/postgres/client')
const { policyService } = require('../../proctornet/backend/src/modules/agent/policyService')

const TEST_RUN_ID = crypto.randomBytes(4).toString('hex')

/**
 * Deterministic Agent Release Hashes for Tests
 */
const DETERMINISTIC_RELEASES = [
  { version: '1.0.0', os: 'win', arch: 'x64', sha256: 'test-build-hash-a1' },
  { version: '1.0.0', os: 'win', arch: 'x64-report', sha256: 'test-build-hash-report' },
  { version: '1.0.0', os: 'win', arch: 'x64-lifecycle', sha256: 'test-build-lifecycle' },
  { version: '1.0.0', os: 'win', arch: 'x64-sweeper', sha256: 'test-build-sweeper' },
  { version: '1.0.0', os: 'linux', arch: 'x64', sha256: 'test-build-hash-linux-v1' },
  { version: '1.0.0', os: 'darwin', arch: 'arm64', sha256: 'test-build-hash-mac-v1' },
  { version: '1.0.0', os: 'all', arch: 'x64', sha256: 'official-agent-release-hash-v1.0.0' }
]

/**
 * Idempotently seed reference data (departments, settings, admin, agent rules & releases)
 * Guarantees zero data destruction (no deleteMany on reference tables).
 */
async function seedReference() {
  // 1. Seed Core & Canonical Departments
  const departments = [
    { code: 'CSE', name: 'Computer Science and Engineering' },
    { code: 'ISE', name: 'Information Science and Engineering' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
    { code: 'ME', name: 'Mechanical Engineering' },
    { code: 'CV', name: 'Civil Engineering' },
    { code: 'AIML', name: 'Artificial Intelligence and Machine Learning' },
    { code: 'TEST-DEPT', name: 'Test General Department' },
    { code: 'P4TEST', name: 'P4 Test Department' },
    { code: 'R2-TEST', name: 'R2 Test Department' },
    { code: 'R4-DEPT', name: 'R4 Test Department' }
  ]

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name }
    }).catch(() => {})
  }

  // 2. Seed Default Admin
  const adminPasswordHash = await bcrypt.hash('Admin@12345', 10)
  await prisma.admin.upsert({
    where: { email: 'admin@proctornet.com' },
    update: { password: adminPasswordHash },
    create: {
      id: crypto.randomUUID(),
      name: 'Platform Administrator',
      email: 'admin@proctornet.com',
      password: adminPasswordHash,
      mustChangePassword: false
    }
  }).catch(() => {})

  // 3. Seed Platform Settings
  const defaultSettings = [
    { key: 'auth_epoch', value: '1' },
    { key: 'registration_enabled', value: 'true' },
    { key: 'maintenance_mode', value: 'false' },
    { key: 'agent_enforcement_mode', value: 'warn' },
    { key: 'system_announcement', value: '' },
    { key: 'faceVerificationEnabled', value: 'true' },
    { key: 'faceMatchThreshold', value: '90' },
    { key: 'watermarkOpacity', value: '20' },
    { key: 'reverifyIntervalMins', value: '15' },
    { key: 'vmDetectionEnabled', value: 'true' },
    { key: 'face_match_threshold', value: '0.80' },
    { key: 'reverify_interval_mins', value: '10' },
    { key: 'face_absence_warning_secs', value: '10' },
    { key: 'face_absence_pause_secs', value: '20' },
    { key: 'collusion_threshold', value: '0.85' },
    { key: 'watermark_visible', value: 'true' },
    { key: 'face_verify_enabled', value: 'true' },
    { key: 'collusion_enabled', value: 'true' }
  ]

  for (const s of defaultSettings) {
    await prisma.platformSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: {
        id: crypto.randomUUID(),
        key: s.key,
        value: s.value,
        updatedBy: crypto.randomUUID()
      }
    }).catch(() => {})
  }

  // 4. Seed Agent Rules
  try {
    if (policyService?.seedRulesIfEmpty) {
      await policyService.seedRulesIfEmpty()
    }
  } catch (err) {
    // Ignore if already seeded
  }

  // 5. Seed Deterministic Agent Releases
  for (const rel of DETERMINISTIC_RELEASES) {
    await prisma.agentRelease.upsert({
      where: {
        version_os_arch: {
          version: rel.version,
          os: rel.os,
          arch: rel.arch
        }
      },
      update: {
        sha256: rel.sha256,
        revokedAt: null
      },
      create: {
        id: crypto.randomUUID(),
        version: rel.version,
        os: rel.os,
        arch: rel.arch,
        sha256: rel.sha256,
        sizeBytes: 15420000n,
        s3Key: `releases/proctornet-agent-${rel.version}-${rel.os}-${rel.arch}.zip`,
        signed: true,
        minSupported: true,
        revokedAt: null
      }
    }).catch(() => {})
  }
}

/**
 * Scoped Fixture Creator
 * Generates rows tagged with runId and returns a scoped cleanup handler.
 */
function createFixtureTracker() {
  const tracked = {
    examIds: new Set(),
    studentIds: new Set(),
    facultyIds: new Set(),
    adminIds: new Set(),
    attemptIds: new Set()
  }

  return {
    trackExam: (id) => tracked.examIds.add(id),
    trackStudent: (id) => tracked.studentIds.add(id),
    trackFaculty: (id) => tracked.facultyIds.add(id),
    trackAdmin: (id) => tracked.adminIds.add(id),
    trackAttempt: (id) => tracked.attemptIds.add(id),

    async cleanup() {
      const attemptIds = Array.from(tracked.attemptIds)
      const examIds = Array.from(tracked.examIds)
      const studentIds = Array.from(tracked.studentIds)
      const facultyIds = Array.from(tracked.facultyIds)
      const adminIds = Array.from(tracked.adminIds)

      if (attemptIds.length > 0) {
        await prisma.agentFinding.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.agentSession.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.agentPairing.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.deviceAgentWaiver.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.violationEvent.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.auditLog.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.answer.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.attemptQuestion.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.examResult.deleteMany({ where: { attemptId: { in: attemptIds } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { id: { in: attemptIds } } }).catch(() => {})
      }

      if (examIds.length > 0) {
        await prisma.questionOption.deleteMany({ where: { question: { examId: { in: examIds } } } }).catch(() => {})
        await prisma.question.deleteMany({ where: { examId: { in: examIds } } }).catch(() => {})
        await prisma.examAttempt.deleteMany({ where: { examId: { in: examIds } } }).catch(() => {})
        await prisma.exam.deleteMany({ where: { id: { in: examIds } } }).catch(() => {})
      }

      if (studentIds.length > 0) {
        await prisma.agentPairing.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => {})
        await prisma.authSession.deleteMany({ where: { userId: { in: studentIds } } }).catch(() => {})
        await prisma.student.deleteMany({ where: { id: { in: studentIds } } }).catch(() => {})
      }

      if (facultyIds.length > 0) {
        await prisma.authSession.deleteMany({ where: { userId: { in: facultyIds } } }).catch(() => {})
        await prisma.faculty.deleteMany({ where: { id: { in: facultyIds } } }).catch(() => {})
      }

      if (adminIds.length > 0) {
        await prisma.authSession.deleteMany({ where: { userId: { in: adminIds } } }).catch(() => {})
        await prisma.admin.deleteMany({ where: { id: { in: adminIds } } }).catch(() => {})
      }
    }
  }
}

module.exports = {
  TEST_RUN_ID,
  DETERMINISTIC_RELEASES,
  seedReference,
  createFixtureTracker
}
