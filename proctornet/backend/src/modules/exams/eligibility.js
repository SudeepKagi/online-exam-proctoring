'use strict'

/**
 * Standard Exam Eligibility Predicate (FLW-08)
 *
 * Rules:
 * 1. Allowed Departments:
 *    - Case-normalized uppercase matching.
 *    - If allowedDepartments is empty OR contains 'ALL', ANY student department is eligible.
 *    - Otherwise, student's departmentCode (uppercase) must be included in allowedDepartments.
 *
 * 2. Allowed Semesters:
 *    - Integer array matching.
 *    - If allowedSemesters is empty OR contains 0, ANY student semester is eligible.
 *    - Otherwise, student's semester must be included in allowedSemesters.
 *
 * 3. Student Invariants:
 *    - Student must not be suspended (is_suspended = false).
 *    - Student must be approved (approval_status = 'APPROVED').
 */

const { ForbiddenError } = require('../../shared/errors')
const { prisma } = require('../../infra/postgres/client')

function isStudentEligible(exam, student) {
  if (!exam || !student) return false
  if (student.isSuspended) return false
  if (student.approvalStatus !== 'APPROVED') return false
  if (student.profileStatus !== 'VERIFIED') return false
  const facePhoto = student.facePhotoKey || student.face_photo_key
  if (!facePhoto) return false

  // 1. Department Check
  const rawDepts = exam.allowedDepartments || []
  const normDepts = rawDepts.map(d => String(d).trim().toUpperCase())
  const studentDept = String(student.departmentCode || '').trim().toUpperCase()

  const deptEligible =
    normDepts.length === 0 ||
    normDepts.includes('ALL') ||
    normDepts.includes(studentDept)

  // 2. Semester Check
  const rawSems = exam.allowedSemesters || []
  const normSems = rawSems.map(s => Number(s))
  const studentSem = Number(student.semester)

  const semEligible =
    normSems.length === 0 ||
    normSems.includes(0) ||
    normSems.includes(studentSem)

  return Boolean(deptEligible && semEligible)
}

/**
 * Standard PostgreSQL SQL WHERE fragment for eligibility matching
 * GIN-indexed exact uppercase matching without wildcard ILIKE (§P9 F4)
 */
const SQL_ELIGIBILITY_WHERE = `
  s.is_suspended = false
  AND s.approval_status = 'APPROVED'
  AND s.profile_status = 'VERIFIED'
  AND s.face_photo_key IS NOT NULL
  AND (
    e.allowed_departments IS NULL
    OR cardinality(e.allowed_departments) = 0
    OR 'ALL' = ANY(e.allowed_departments)
    OR UPPER(s.department_code) = ANY(e.allowed_departments)
  )
  AND (
    e.allowed_semesters IS NULL
    OR cardinality(e.allowed_semesters) = 0
    OR 0 = ANY(e.allowed_semesters)
    OR s.semester = ANY(e.allowed_semesters)
  )
`

/**
 * Authoritative server-side start gate verification (§P9 F4)
 * Enforces all 4 prerequisites: eligibility, device agent, identity, and VPN.
 */
async function assertCanStart({ exam, student, attempt }) {
  if (!exam || !student) {
    throw new ForbiddenError('Eligibility check failed: Missing exam or student context')
  }

  // 1. Eligibility: approved, not suspended, profile verified, face photo present, branch/semester match
  if (student.isSuspended) {
    throw new ForbiddenError('Account suspended: You are not permitted to start this exam')
  }
  if (student.approvalStatus !== 'APPROVED') {
    throw new ForbiddenError('Enrollment approval required: Your student account is pending administrator approval')
  }
  if (student.profileStatus !== 'VERIFIED') {
    throw new ForbiddenError('Profile verification required: Your identity profile has not been verified by an administrator')
  }
  const facePhoto = student.facePhotoKey || student.face_photo_key
  if (!facePhoto) {
    throw new ForbiddenError('Face enrollment required: You must have an enrolled reference face photo to take this exam')
  }
  if (!isStudentEligible(exam, student)) {
    throw new ForbiddenError('Department or semester mismatch: You are not eligible for this exam')
  }

  // 2. Device Agent: policy enforcement
  if (exam.deviceAgentPolicy === 'REQUIRED') {
    if (!attempt) {
      throw new ForbiddenError('Device companion check required: Valid attempt is required')
    }
    const waiver = await prisma.deviceAgentWaiver.findUnique({
      where: { attemptId: attempt.id }
    })
    if (!waiver) {
      const freshCutoff = new Date(Date.now() - 60000)
      const healthySession = await prisma.agentSession.findFirst({
        where: {
          attemptId: attempt.id,
          state: 'HEALTHY',
          lastSeenAt: { gte: freshCutoff }
        }
      })
      if (!healthySession) {
        throw new ForbiddenError('Device companion check required: An active healthy agent session with fresh heartbeat (or a staff waiver) is required to start this exam')
      }

      const blockingFinding = await prisma.agentFinding.findFirst({
        where: {
          sessionId: healthySession.id,
          clearedAt: null
        }
      })
      if (blockingFinding) {
        const rule = await prisma.agentRule.findUnique({
          where: { id: blockingFinding.ruleId }
        })
        if (rule && rule.action === 'BLOCK_START') {
          throw new ForbiddenError('Device companion check required: An active healthy agent session with fresh heartbeat (or a staff waiver) is required to start this exam')
        }
      }
    }
  }

  // 3. Identity Verification: latest PASS (or staff-approved REVIEW) when cameraRequired
  if (exam.cameraRequired) {
    if (!attempt) {
      throw new ForbiddenError('Identity verification required: Valid attempt is required')
    }
    const latestVerification = await prisma.identityVerification.findFirst({
      where: { attemptId: attempt.id },
      orderBy: { createdAt: 'desc' }
    })

    if (!latestVerification || latestVerification.decision !== 'PASS') {
      throw new ForbiddenError('Identity verification required: Candidate identity must be verified (PASS) before starting the exam')
    }
  }

  // 4. VPN Lease: when vpnRequired and enforcement is on
  if (process.env.VPN_ENABLED === 'true' && exam.vpnRequired) {
    if (!attempt) {
      throw new ForbiddenError('VPN connection required: Valid attempt is required')
    }
    const activePeer = await prisma.vpnPeer.findFirst({
      where: { attemptId: attempt.id, isActive: true }
    })
    if (!activePeer) {
      throw new ForbiddenError('VPN connection required: Active WireGuard VPN tunnel required to start this exam')
    }
  }

  return true
}

module.exports = {
  isStudentEligible,
  SQL_ELIGIBILITY_WHERE,
  assertCanStart
}
