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

function isStudentEligible(exam, student) {
  if (!exam || !student) return false
  if (student.isSuspended) return false
  if (student.approvalStatus && student.approvalStatus !== 'APPROVED') return false

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
 * Used in checkStudentEligibility and prewarmJob
 */
const SQL_ELIGIBILITY_WHERE = `
  s.is_suspended = false
  AND s.approval_status = 'APPROVED'
  AND (
    e.allowed_departments IS NULL
    OR cardinality(e.allowed_departments) = 0
    OR 'ALL' ILIKE ANY(e.allowed_departments)
    OR s.department_code ILIKE ANY(e.allowed_departments)
  )
  AND (
    e.allowed_semesters IS NULL
    OR cardinality(e.allowed_semesters) = 0
    OR 0 = ANY(e.allowed_semesters)
    OR s.semester = ANY(e.allowed_semesters)
  )
`

module.exports = {
  isStudentEligible,
  SQL_ELIGIBILITY_WHERE
}
