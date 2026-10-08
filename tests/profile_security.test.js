const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const studentService = require(path.join(__dirname, '../proctornet/backend/src/modules/student/service'))
const studentRepository = require(path.join(__dirname, '../proctornet/backend/src/modules/student/repository'))
const { ForbiddenError } = require(path.join(__dirname, '../proctornet/backend/src/shared/errors'))

describe('BUG-B06: Student Profile Guard Security', () => {
  it('blocks updating USN with ForbiddenError', async () => {
    const origGet = studentRepository.getStudentById
    try {
      studentRepository.getStudentById = async (id) => ({
        id,
        name: 'Bob',
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        profileStatus: 'VERIFIED'
      })

      await assert.rejects(
        async () => {
          await studentService.updateProfile('s1', { usn: '1RV21CS999' })
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError)
          assert.match(err.message, /Modifying USN is strictly prohibited/i)
          return true
        }
      )
    } finally {
      studentRepository.getStudentById = origGet
    }
  })

  it('blocks updating institutional email with ForbiddenError', async () => {
    const origGet = studentRepository.getStudentById
    try {
      studentRepository.getStudentById = async (id) => ({
        id,
        name: 'Bob',
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        profileStatus: 'VERIFIED'
      })

      await assert.rejects(
        async () => {
          await studentService.updateProfile('s1', { email: 'hacker@gmail.com' })
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError)
          assert.match(err.message, /Modifying institutional email is strictly prohibited/i)
          return true
        }
      )
    } finally {
      studentRepository.getStudentById = origGet
    }
  })

  it('blocks modifying verification or approval status directly', async () => {
    const origGet = studentRepository.getStudentById
    try {
      studentRepository.getStudentById = async (id) => ({
        id,
        name: 'Bob',
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        profileStatus: 'SUBMITTED',
        approvalStatus: 'PENDING'
      })

      await assert.rejects(
        async () => {
          await studentService.updateProfile('s1', { approvalStatus: 'APPROVED' })
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError)
          assert.match(err.message, /Modifying verification or approval status/i)
          return true
        }
      )
    } finally {
      studentRepository.getStudentById = origGet
    }
  })

  it('rejects updates when profile is LOCKED', async () => {
    const origGet = studentRepository.getStudentById
    try {
      studentRepository.getStudentById = async (id) => ({
        id,
        name: 'Bob',
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        profileStatus: 'LOCKED'
      })

      await assert.rejects(
        async () => {
          await studentService.updateProfile('s1', { name: 'New Name' })
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError)
          assert.match(err.message, /Profile is locked/i)
          return true
        }
      )
    } finally {
      studentRepository.getStudentById = origGet
    }
  })

  it('permits safe updates to name and phone', async () => {
    const origGet = studentRepository.getStudentById
    const origUpdate = studentRepository.updateStudent
    try {
      studentRepository.getStudentById = async (id) => ({
        id,
        name: 'Bob',
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        phone: '1234567890',
        departmentCode: 'CSE',
        profileStatus: 'VERIFIED'
      })

      studentRepository.updateStudent = async (id, data) => ({
        id,
        name: data.name,
        phone: data.phone,
        usn: '1RV21CS100',
        email: 'bob@rvce.edu.in',
        departmentCode: 'CSE',
        profileStatus: 'VERIFIED'
      })

      const updated = await studentService.updateProfile('s1', { name: 'Robert', phone: '9876543210' })
      assert.equal(updated.name, 'Robert')
      assert.equal(updated.phone, '9876543210')
    } finally {
      studentRepository.getStudentById = origGet
      studentRepository.updateStudent = origUpdate
    }
  })

  after(async () => {
    try {
      const { redis } = require('../proctornet/backend/src/infra/redis/client')
      if (redis && redis.disconnect) redis.disconnect()
    } catch {}
    setTimeout(() => process.exit(0), 50).unref()
  })
})
