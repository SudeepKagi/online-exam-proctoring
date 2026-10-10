/**
 * tests/u1-profile-identity-security.test.js
 * Phase U1: Profile & Identity Regression Security Hotfix Test Suite
 *
 * Verifies:
 * 1. Student cannot change departmentCode (403 FIELD_NOT_ALLOWED)
 * 2. Student cannot change semester (403 FIELD_NOT_ALLOWED)
 * 3. Student cannot change email (403 FIELD_NOT_ALLOWED)
 * 4. Student cannot change facePhotoKey directly via updateProfile (403 FIELD_NOT_ALLOWED)
 * 5. Student cannot change idCardPhotoKey directly via updateProfile (403 FIELD_NOT_ALLOWED)
 * 6. Unknown fields rejected by strict schema (400)
 * 7. Verified student cannot swap reference photo
 * 8. Staff-approved re-enrollment works (state RE_ENROLL_PENDING, audit-logged)
 * 9. Legitimate presentation updates (name, phone) succeed
 * 10. Exam eligibility unchanged after attempted tampering
 */

const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

process.env.NODE_ENV = 'test'
process.env.START_WORKERS = 'false'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.STORAGE_DRIVER = 'memory'

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const crypto = require('crypto')

const { app, server: appServer } = require('../src/app')
const { prisma } = require('../src/infra/postgres/client')
const { signToken } = require('../src/utils/jwt')
const { ROLES } = require('../src/shared/roles')

let server
let baseUrl

let testDeptECE
let testDeptCSE
let testStudent
let testStudentToken
let verifiedStudent
let verifiedStudentToken
let cseOnlyExam

async function apiRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl)
    const payload = body ? JSON.stringify(body) : null

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload)
    }

    const req = http.request(url, { method, headers }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        let parsed = null
        try {
          parsed = data ? JSON.parse(data) : null
        } catch {
          parsed = data
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed
        })
      })
    })

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

describe('Phase U1: Profile & Identity Regression Security Hotfix (§U1)', () => {
  before(async () => {
    server = http.createServer(app)
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    baseUrl = `http://127.0.0.1:${addr.port}`

    const uid = crypto.randomUUID().slice(0, 8)

    // Ensure departments
    testDeptECE = await prisma.department.upsert({
      where: { code: `ECE_${uid}` },
      update: {},
      create: { code: `ECE_${uid}`, name: `Electronics_${uid}` }
    })

    testDeptCSE = await prisma.department.upsert({
      where: { code: `CSE_${uid}` },
      update: {},
      create: { code: `CSE_${uid}`, name: `Computer_Science_${uid}` }
    })

    // Create student in ECE
    testStudent = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Student Tamper Test',
        email: `student_${uid}@institution.edu`,
        password: '$2b$10$hashedtestpasswordforstudent1234567890',
        usn: `1TEST${uid}`,
        departmentCode: testDeptECE.code,
        semester: 6,
        phone: '+91 9876543210',
        profileStatus: 'SUBMITTED',
        approvalStatus: 'PENDING'
      }
    })
    testStudentToken = signToken({
      id: testStudent.id,
      role: ROLES.STUDENT,
      email: testStudent.email,
      usn: testStudent.usn
    })

    // Create verified student
    verifiedStudent = await prisma.student.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Verified Student Test',
        email: `verified_${uid}@institution.edu`,
        password: '$2b$10$hashedtestpasswordforstudent1234567890',
        usn: `1VERI${uid}`,
        departmentCode: testDeptECE.code,
        semester: 6,
        facePhotoKey: `identity/${testStudent.id}/original_face.jpg`,
        idCardPhotoKey: `identity/${testStudent.id}/original_id.jpg`,
        profileStatus: 'VERIFIED',
        approvalStatus: 'APPROVED'
      }
    })
    verifiedStudentToken = signToken({
      id: verifiedStudent.id,
      role: ROLES.STUDENT,
      email: verifiedStudent.email,
      usn: verifiedStudent.usn
    })

    // Create faculty + CSE-only exam
    const faculty = await prisma.faculty.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Faculty Test',
        email: `faculty_${uid}@institution.edu`,
        employeeId: `EMP_${uid}`,
        password: '$2b$10$hashedtestpasswordforfaculty1234567890',
        departmentCode: testDeptCSE.code
      }
    })

    cseOnlyExam = await prisma.exam.create({
      data: {
        id: crypto.randomUUID(),
        title: `CSE Exclusive Exam ${uid}`,
        description: 'Exam only for CSE students',
        subject: 'Computer Science',
        facultyId: faculty.id,
        duration: 60,
        totalMarks: 100,
        invId: `INV_${uid}`,
        invPasswordHash: 'hash',
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
        allowedDepartments: [testDeptCSE.code],
        allowedSemesters: [6],
        deviceAgentPolicy: 'OFF'
      }
    })
  })

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve))
    }
  })

  it('1. Student cannot change departmentCode (403 FIELD_NOT_ALLOWED)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      departmentCode: testDeptCSE.code
    })
    assert.strictEqual(res.status, 403, 'Should reject department change with 403')
    assert.strictEqual(res.body?.error?.code, 'FIELD_NOT_ALLOWED', 'Error code must be FIELD_NOT_ALLOWED')

    // Confirm DB value unchanged
    const studentDb = await prisma.student.findUnique({ where: { id: testStudent.id } })
    assert.strictEqual(studentDb.departmentCode, testDeptECE.code, 'DB departmentCode must remain unchanged')
  })

  it('2. Student cannot change semester (403 FIELD_NOT_ALLOWED)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      semester: 8
    })
    assert.strictEqual(res.status, 403, 'Should reject semester change with 403')
    assert.strictEqual(res.body?.error?.code, 'FIELD_NOT_ALLOWED', 'Error code must be FIELD_NOT_ALLOWED')

    const studentDb = await prisma.student.findUnique({ where: { id: testStudent.id } })
    assert.strictEqual(studentDb.semester, 6, 'DB semester must remain unchanged')
  })

  it('3. Student cannot change email (403 FIELD_NOT_ALLOWED)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      email: 'hacked_email@fake.edu'
    })
    assert.strictEqual(res.status, 403, 'Should reject email change with 403')
    assert.strictEqual(res.body?.error?.code, 'FIELD_NOT_ALLOWED', 'Error code must be FIELD_NOT_ALLOWED')

    const studentDb = await prisma.student.findUnique({ where: { id: testStudent.id } })
    assert.strictEqual(studentDb.email, testStudent.email, 'DB email must remain unchanged')
  })

  it('4. Student cannot change facePhotoKey directly via updateProfile (403 FIELD_NOT_ALLOWED)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      facePhotoKey: 'uploads/impostor_substitute_face.jpg'
    })
    assert.strictEqual(res.status, 403, 'Should reject direct facePhotoKey injection with 403')
    assert.strictEqual(res.body?.error?.code, 'FIELD_NOT_ALLOWED', 'Error code must be FIELD_NOT_ALLOWED')
  })

  it('5. Student cannot change idCardPhotoKey directly via updateProfile (403 FIELD_NOT_ALLOWED)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      idCardPhotoKey: 'uploads/fake_id.jpg'
    })
    assert.strictEqual(res.status, 403, 'Should reject direct idCardPhotoKey injection with 403')
    assert.strictEqual(res.body?.error?.code, 'FIELD_NOT_ALLOWED', 'Error code must be FIELD_NOT_ALLOWED')
  })

  it('6. Unknown fields are rejected by strict validation schema (400)', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      maliciousField: 'exploit_value'
    })
    assert.strictEqual(res.status, 400, 'Should reject unknown fields with 400 validation error')
  })

  it('7. Verified student cannot swap reference photo via enrollment endpoint without approval', async () => {
    const res = await apiRequest('POST', '/api/v1/student/enrollment/face', verifiedStudentToken, {
      facePhotoKey: 'identity/verified/new_face.jpg'
    })
    // Must be 403/400 because student is already VERIFIED and requires staff-approved re-enrollment flow
    assert.ok(res.status === 403 || res.status === 400, `Expected 403 or 400, got ${res.status}`)

    const studentDb = await prisma.student.findUnique({ where: { id: verifiedStudent.id } })
    assert.strictEqual(studentDb.facePhotoKey, `identity/${testStudent.id}/original_face.jpg`, 'Reference photo key must remain unchanged')
  })

  it('8. Staff-approved re-enrollment flow transitions to RE_ENROLL_PENDING and preserves old photo', async () => {
    const res = await apiRequest('POST', '/api/v1/student/re-enrollment-request', verifiedStudentToken, {
      reason: 'Biometric update due to physical appearance change'
    })
    assert.strictEqual(res.status, 200, 'Re-enrollment request should succeed')
    assert.strictEqual(res.body?.student?.profileStatus, 'RE_ENROLL_PENDING')

    // Old photo remains authoritative until approval
    const studentDb = await prisma.student.findUnique({ where: { id: verifiedStudent.id } })
    assert.strictEqual(studentDb.profileStatus, 'RE_ENROLL_PENDING')
    assert.strictEqual(studentDb.facePhotoKey, `identity/${testStudent.id}/original_face.jpg`, 'Old photo remains authoritative')

    // Audit log should record the re-enrollment request
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        studentId: verifiedStudent.id,
        action: 'RE_ENROLLMENT_REQUESTED'
      }
    })
    assert.ok(auditLogs.length > 0, 'Audit log must record RE_ENROLLMENT_REQUESTED')
  })

  it('9. Legitimate presentation fields (name, phone) update successfully', async () => {
    const res = await apiRequest('PUT', '/api/v1/student/profile', testStudentToken, {
      name: 'Legit Updated Student Name',
      phone: '+91 9123456789'
    })
    assert.strictEqual(res.status, 200, 'Legitimate profile update should succeed with 200')
    assert.strictEqual(res.body?.student?.name, 'Legit Updated Student Name')
    assert.strictEqual(res.body?.student?.phone, '+91 9123456789')
  })

  it('10. Exam eligibility list remains strictly unchanged after tampering attempt', async () => {
    // Student in ECE attempts to get CSE exam details / lobby
    const lobbyRes = await apiRequest('GET', `/api/v1/student/exams/${cseOnlyExam.id}/lobby`, testStudentToken)
    assert.strictEqual(lobbyRes.status, 200)
    assert.strictEqual(lobbyRes.body?.isEligible, false, 'Student must NOT be eligible for CSE exam')
  })
})
