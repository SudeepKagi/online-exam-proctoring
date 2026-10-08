const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  isStudentEligible,
  SQL_ELIGIBILITY_WHERE
} = require(path.join(__dirname, '../proctornet/backend/src/modules/exams/eligibility'))

describe('FLW-08: Unified Exam Eligibility Matrix', () => {
  const baseStudent = {
    id: 's-1',
    usn: '1RV21CS001',
    departmentCode: 'CSE',
    semester: 6,
    isSuspended: false,
    approvalStatus: 'APPROVED'
  }

  const baseExam = {
    id: 'e-1',
    allowedDepartments: ['CSE', 'ISE'],
    allowedSemesters: [6, 8]
  }

  describe('Department matching', () => {
    it('approves student with exact department code match', () => {
      assert.equal(isStudentEligible(baseExam, baseStudent), true)
    })

    it('approves student with case-insensitive department matching (cse vs CSE)', () => {
      const student = { ...baseStudent, departmentCode: 'cse' }
      assert.equal(isStudentEligible(baseExam, student), true)
    })

    it('approves any student department when allowedDepartments contains ALL', () => {
      const exam = { ...baseExam, allowedDepartments: ['ALL'] }
      const student = { ...baseStudent, departmentCode: 'MECH' }
      assert.equal(isStudentEligible(exam, student), true)
    })

    it('approves any student department when allowedDepartments is empty', () => {
      const exam = { ...baseExam, allowedDepartments: [] }
      const student = { ...baseStudent, departmentCode: 'CIVIL' }
      assert.equal(isStudentEligible(exam, student), true)
    })

    it('rejects student whose department is not in allowedDepartments', () => {
      const student = { ...baseStudent, departmentCode: 'ECE' }
      assert.equal(isStudentEligible(baseExam, student), false)
    })
  })

  describe('Semester matching', () => {
    it('approves student with matching semester integer', () => {
      assert.equal(isStudentEligible(baseExam, baseStudent), true)
    })

    it('approves student with string semester matching integer array', () => {
      const student = { ...baseStudent, semester: '6' }
      assert.equal(isStudentEligible(baseExam, student), true)
    })

    it('approves any semester when allowedSemesters contains 0', () => {
      const exam = { ...baseExam, allowedSemesters: [0] }
      const student = { ...baseStudent, semester: 2 }
      assert.equal(isStudentEligible(exam, student), true)
    })

    it('approves any semester when allowedSemesters is empty', () => {
      const exam = { ...baseExam, allowedSemesters: [] }
      const student = { ...baseStudent, semester: 4 }
      assert.equal(isStudentEligible(exam, student), true)
    })

    it('rejects student whose semester is not in allowedSemesters', () => {
      const student = { ...baseStudent, semester: 5 }
      assert.equal(isStudentEligible(baseExam, student), false)
    })
  })

  describe('Student state invariants', () => {
    it('strictly rejects suspended student regardless of department and semester', () => {
      const student = { ...baseStudent, isSuspended: true }
      assert.equal(isStudentEligible(baseExam, student), false)
    })

    it('strictly rejects non-approved students (PENDING, REJECTED, SUSPENDED)', () => {
      const pendingStudent = { ...baseStudent, approvalStatus: 'PENDING' }
      assert.equal(isStudentEligible(baseExam, pendingStudent), false)

      const rejectedStudent = { ...baseStudent, approvalStatus: 'REJECTED' }
      assert.equal(isStudentEligible(baseExam, rejectedStudent), false)

      const suspendedStudent = { ...baseStudent, approvalStatus: 'SUSPENDED' }
      assert.equal(isStudentEligible(baseExam, suspendedStudent), false)
    })

    it('returns false for null exam or student', () => {
      assert.equal(isStudentEligible(null, baseStudent), false)
      assert.equal(isStudentEligible(baseExam, null), false)
    })
  })

  describe('SQL WHERE clause integrity', () => {
    it('verifies SQL_ELIGIBILITY_WHERE covers suspension, approval, departments, and semesters', () => {
      assert.ok(SQL_ELIGIBILITY_WHERE.includes('s.is_suspended = false'))
      assert.ok(SQL_ELIGIBILITY_WHERE.includes("s.approval_status = 'APPROVED'"))
      assert.ok(SQL_ELIGIBILITY_WHERE.includes('allowed_departments'))
      assert.ok(SQL_ELIGIBILITY_WHERE.includes('allowed_semesters'))
    })
  })
})
