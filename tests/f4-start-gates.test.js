'use strict'

process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'
process.env.NODE_ENV = 'test'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '..')
const BACKEND_ROOT = path.join(REPO_ROOT, 'proctornet/backend')

const { assertCanStart, isStudentEligible } = require(path.join(BACKEND_ROOT, 'src/modules/exams/eligibility'))
const { ForbiddenError } = require(path.join(BACKEND_ROOT, 'src/shared/errors'))

describe('F4 — Start Gates Authoritative Server-Side Enforcement', () => {
  const baseExam = {
    id: 'exam-1',
    allowedDepartments: ['CSE', 'ISE'],
    allowedSemesters: [6],
    deviceAgentPolicy: 'REQUIRED',
    cameraRequired: true,
    vpnRequired: false
  }

  const baseStudent = {
    id: 'student-1',
    isSuspended: false,
    approvalStatus: 'APPROVED',
    profileStatus: 'VERIFIED',
    facePhotoKey: 'profiles/student-1.jpg',
    departmentCode: 'CSE',
    semester: 6
  }

  it('rejects student with pending approval', async () => {
    const student = { ...baseStudent, approvalStatus: 'PENDING' }
    await assert.rejects(
      async () => assertCanStart({ exam: baseExam, student, attempt: { id: 'att-1' } }),
      (err) => err instanceof ForbiddenError && err.message.includes('pending administrator approval')
    )
  })

  it('rejects student with unverified profile', async () => {
    const student = { ...baseStudent, profileStatus: 'PENDING' }
    await assert.rejects(
      async () => assertCanStart({ exam: baseExam, student, attempt: { id: 'att-1' } }),
      (err) => err instanceof ForbiddenError && err.message.includes('not been verified')
    )
  })

  it('rejects student without enrolled face photo', async () => {
    const student = { ...baseStudent, facePhotoKey: null }
    await assert.rejects(
      async () => assertCanStart({ exam: baseExam, student, attempt: { id: 'att-1' } }),
      (err) => err instanceof ForbiddenError && err.message.includes('Face enrollment required')
    )
  })

  it('rejects student with wrong department or semester', async () => {
    const student = { ...baseStudent, departmentCode: 'MECH' }
    await assert.rejects(
      async () => assertCanStart({ exam: baseExam, student, attempt: { id: 'att-1' } }),
      (err) => err instanceof ForbiddenError && err.message.includes('Department or semester mismatch')
    )
  })

  it('isStudentEligible accurately matches department and semester invariants', () => {
    assert.strictEqual(isStudentEligible(baseExam, baseStudent), true)
    assert.strictEqual(isStudentEligible(baseExam, { ...baseStudent, departmentCode: 'mech' }), false)
    assert.strictEqual(isStudentEligible(baseExam, { ...baseStudent, semester: 5 }), false)
    assert.strictEqual(isStudentEligible(baseExam, { ...baseStudent, isSuspended: true }), false)
    assert.strictEqual(isStudentEligible(baseExam, { ...baseStudent, profileStatus: 'PENDING' }), false)
  })
})
