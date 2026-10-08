const { describe, it, after } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const facultyService = require(path.join(__dirname, '../proctornet/backend/src/modules/faculty/service'))
const facultyRepository = require(path.join(__dirname, '../proctornet/backend/src/modules/faculty/repository'))
const { ForbiddenError, NotFoundError } = require(path.join(__dirname, '../proctornet/backend/src/shared/errors'))

describe('BUG-B05: Faculty Department Approval Authorization', () => {
  it('approves student when faculty and student belong to the same department', async () => {
    const origFindFaculty = facultyRepository.findFacultyById
    const origFindStudent = facultyRepository.findStudentById
    const origApprove = facultyRepository.approveStudent

    try {
      facultyRepository.findFacultyById = async (id) => ({
        id,
        name: 'Dr. Alan Turing',
        departmentCode: 'CSE'
      })

      facultyRepository.findStudentById = async (id) => ({
        id,
        name: 'Alice Smith',
        usn: '1RV21CS001',
        departmentCode: 'CSE',
        approvalStatus: 'PENDING'
      })

      facultyRepository.approveStudent = async (studentId, facultyId) => ({
        id: studentId,
        approvalStatus: 'APPROVED',
        approvedBy: facultyId,
        approvedAt: new Date()
      })

      const res = await facultyService.approveStudent('student-1', 'faculty-1')
      assert.equal(res.approvalStatus, 'APPROVED')
      assert.equal(res.approvedBy, 'faculty-1')
    } finally {
      facultyRepository.findFacultyById = origFindFaculty
      facultyRepository.findStudentById = origFindStudent
      facultyRepository.approveStudent = origApprove
    }
  })

  it('rejects approval with ForbiddenError if faculty department differs from student department', async () => {
    const origFindFaculty = facultyRepository.findFacultyById
    const origFindStudent = facultyRepository.findStudentById
    const origApprove = facultyRepository.approveStudent

    try {
      facultyRepository.findFacultyById = async (id) => ({
        id,
        name: 'Dr. Claude Shannon',
        departmentCode: 'ECE'
      })

      facultyRepository.findStudentById = async (id) => ({
        id,
        name: 'Bob Jones',
        usn: '1RV21CS002',
        departmentCode: 'CSE',
        approvalStatus: 'PENDING'
      })

      await assert.rejects(
        async () => {
          await facultyService.approveStudent('student-2', 'faculty-2')
        },
        (err) => {
          assert.ok(err instanceof ForbiddenError, 'Should be instance of ForbiddenError')
          assert.match(err.message, /only approve students from their own department/i)
          return true
        }
      )
    } finally {
      facultyRepository.findFacultyById = origFindFaculty
      facultyRepository.findStudentById = origFindStudent
      facultyRepository.approveStudent = origApprove
    }
  })

  it('throws NotFoundError if student or faculty does not exist', async () => {
    const origFindFaculty = facultyRepository.findFacultyById
    const origFindStudent = facultyRepository.findStudentById

    try {
      facultyRepository.findFacultyById = async () => null
      facultyRepository.findStudentById = async () => ({ id: 's1', departmentCode: 'CSE' })

      await assert.rejects(
        async () => {
          await facultyService.approveStudent('s1', 'nonexistent-faculty')
        },
        (err) => err instanceof NotFoundError
      )

      facultyRepository.findFacultyById = async () => ({ id: 'f1', departmentCode: 'CSE' })
      facultyRepository.findStudentById = async () => null

      await assert.rejects(
        async () => {
          await facultyService.approveStudent('nonexistent-student', 'f1')
        },
        (err) => err instanceof NotFoundError
      )
    } finally {
      facultyRepository.findFacultyById = origFindFaculty
      facultyRepository.findStudentById = origFindStudent
    }
  })

  after(async () => {
    try {
      const { closeAll } = require('../proctornet/backend/src/lifecycle')
      await closeAll()
    } catch {}
  })
})

