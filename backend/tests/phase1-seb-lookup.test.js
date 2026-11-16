'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')

const { app, server: appServer } = require('../src/app')
const { signToken } = require('../src/utils/jwt')
const { prisma } = require('../src/infra/postgres/client')
const { settingsService } = require('../src/modules/admin/settings.service')
const { getStorageAdapter } = require('../src/infra/s3/s3.client')
const { examService } = require('../src/modules/exams/exams.service')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')
const { getInstitutionSebState, invalidateInstitutionSebState } = require('../src/modules/seb/seb.service')

const VALID_KEY = '43965229eadb84a369bd9fcb1be48b89de376538ce6e4dc0798244deb1cd1f8c'
let port = 0
let facultyToken = ''
let adminToken = ''
let studentToken = ''
let facultyUser = null
let adminUser = null
let studentUser = null

function httpRequest(options, postBody = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let json = null
        try {
          json = JSON.parse(body)
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        })
      })
    })

    req.on('error', reject)

    if (postBody) {
      if (typeof postBody === 'object' && !Buffer.isBuffer(postBody)) {
        req.write(JSON.stringify(postBody))
      } else {
        req.write(postBody)
      }
    }
    req.end()
  })
}

describe('Phase 1: SEB Institution Lookup, Staff Status & Honest Enforcement', () => {
  before(async () => {
    delete process.env.SEB_CONFIG_KEY

    // Setup real users in Postgres
    adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } })
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: `admin-p1-${Date.now()}@proctornet.edu`,
          fullName: 'Phase 1 Admin',
          role: 'ADMIN',
          status: 'ACTIVE',
          passwordHash: '$2a$10$mockpasswordhashforevaltests'
        }
      })
    }

    facultyUser = await prisma.user.findFirst({ where: { role: 'FACULTY' } })
    if (!facultyUser) {
      facultyUser = await prisma.user.create({
        data: {
          email: `faculty-p1-${Date.now()}@proctornet.edu`,
          fullName: 'Phase 1 Faculty',
          role: 'FACULTY',
          status: 'ACTIVE',
          passwordHash: '$2a$10$mockpasswordhashforevaltests'
        }
      })
    }

    studentUser = await prisma.user.findFirst({ where: { role: 'STUDENT' } })
    if (!studentUser) {
      studentUser = await prisma.user.create({
        data: {
          email: `student-p1-${Date.now()}@proctornet.edu`,
          fullName: 'Phase 1 Student',
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash: '$2a$10$mockpasswordhashforevaltests'
        }
      })
    }

    facultyToken = signToken({ id: facultyUser.id, email: facultyUser.email, role: 'FACULTY', status: 'ACTIVE' })
    adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: 'ADMIN', status: 'ACTIVE' })
    studentToken = signToken({ id: studentUser.id, email: studentUser.email, role: 'STUDENT', status: 'ACTIVE' })

    await new Promise((resolve) => {
      const server = app.listen(0, () => {
        port = server.address().port
        resolve()
      })
    })
  })

  after(async () => {
    invalidateInstitutionSebState()
    await settingsService.deleteSebConfig().catch(() => {})
  })

  beforeEach(async () => {
    delete process.env.SEB_CONFIG_KEY
    invalidateInstitutionSebState()
  })

  it('1. getInstitutionSebState reflects configured: true only when both DB key and S3 file exist', async () => {
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-content'), 'application/seb')
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: null
    })
    invalidateInstitutionSebState()

    const state = await getInstitutionSebState()
    assert.strictEqual(state.configured, true)
    assert.strictEqual(state.keyPresent, true)
    assert.strictEqual(state.filePresent, true)
    assert.strictEqual(state.keyLast4, VALID_KEY.slice(-4))
    assert.strictEqual(state.effectiveMode, 'off')
  })

  it('2. When institution config is in DB and no env key, faculty publishes through BOTH paths successfully', async () => {
    try {
      const storage = getStorageAdapter()
      await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-content'), 'application/seb')
      await settingsService.saveSebConfig({
        fileKey: 'seb/institution-config.seb',
        configKey: VALID_KEY,
        uploadedAt: new Date().toISOString(),
        lastVerifiedAt: null
      })
      invalidateInstitutionSebState()

      // Path A: Wizard publish
      const wizardPayload = {
        title: 'Faculty SEB Wizard Exam',
        subjectCode: 'CS502',
        startTimeUtc: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 60,
        lateEntryMinutes: 15,
        department: 'Computer Science and Engineering',
        semester: 'Sem 6',
        sebRequired: true,
        questions: [
          {
            questionText: 'Which protocol secures HTTP?',
            options: ['HTTPS/TLS', 'FTP', 'Telnet', 'SMTP'],
            correctOptionIndex: 0,
            marks: 2
          }
        ]
      }

      const wizardResult = await examWizardService.publishWizard(facultyUser.id, wizardPayload, 'FACULTY')
      assert.ok(wizardResult.exam?.id)
      assert.strictEqual(wizardResult.exam?.status, 'PUBLISHED')

      // Path B: Standard publishExam
      const createdExam = await prisma.exam.create({
        data: {
          title: 'Faculty Standard SEB Exam',
          courseCode: 'CS503',
          startTime: new Date(Date.now() + 86400000),
          endTime: new Date(Date.now() + 90000000),
          durationMinutes: 60,
          status: 'DRAFT',
          creator: { connect: { id: facultyUser.id } },
          proctoringConfig: { sebRequired: true },
          questions: {
            create: [
              {
                questionText: 'Standard Q1',
                options: ['A', 'B'],
                correctOptionIndex: 0,
                marks: 1
              }
            ]
          }
        }
      })

      const pubResult = await examService.publishExam(createdExam.id, 'FACULTY')
      assert.strictEqual(pubResult.status, 'PUBLISHED')
    } catch (err) {
      console.error('TEST_2_FULL_ERROR:', err)
      throw err
    }
  })

  it('3. When SEB is not configured, publish returns friendly role-specific messages', async () => {
    await settingsService.deleteSebConfig()
    const storage = getStorageAdapter()
    await storage.deleteObject('seb/institution-config.seb').catch(() => {})
    invalidateInstitutionSebState()

    const payload = {
      title: 'Unconfigured SEB Test Exam',
      subjectCode: 'CS504',
      startTimeUtc: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 60,
      lateEntryMinutes: 15,
      department: 'Computer Science and Engineering',
      semester: 'Sem 6',
      sebRequired: true,
      questions: [{ questionText: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, marks: 1 }]
    }

    // Faculty error message
    await assert.rejects(
      async () => {
        await examWizardService.publishWizard(facultyUser.id, payload, 'FACULTY')
      },
      (err) => {
        assert.strictEqual(err.status, 400)
        assert.strictEqual(err.code, 'SEB_KEY_REQUIRED')
        assert.ok(err.message.includes('Ask your administrator to finish Secure Browser setup'), `Got: ${err.message}`)
        return true
      }
    )

    // Admin error message
    await assert.rejects(
      async () => {
        await examWizardService.publishWizard(adminUser.id, payload, 'ADMIN')
      },
      (err) => {
        assert.strictEqual(err.status, 400)
        assert.strictEqual(err.code, 'SEB_KEY_REQUIRED')
        assert.ok(err.message.includes('Admin → Secure Browser'), `Got: ${err.message}`)
        return true
      }
    )
  })

  it('4. Faculty can read institution status endpoint, and students never see the key', async () => {
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-content'), 'application/seb')
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: null
    })
    invalidateInstitutionSebState()

    // Faculty reads status
    const facRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: '/api/v1/exams/seb-status',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${facultyToken}`
      }
    })

    assert.strictEqual(facRes.statusCode, 200)
    assert.strictEqual(facRes.json.configured, true)
    assert.strictEqual(facRes.json.keyPresent, true)
    assert.strictEqual(facRes.json.filePresent, true)
    assert.strictEqual(facRes.json.configKey, undefined)
    assert.strictEqual(facRes.json.keyLast4, undefined)
    assert.ok(facRes.json.publicOrigin)

    // Student reads attempt seb-status: never sees the key
    const stuRes = await httpRequest({
      hostname: '127.0.0.1',
      port,
      path: `/api/v1/attempts/exams/${adminUser.id}/seb-status`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${studentToken}`
      }
    })

    if (stuRes.json) {
      assert.strictEqual(stuRes.json.configKey, undefined)
      assert.strictEqual(stuRes.json.sebConfigKey, undefined)
    }
  })

  it('5. Enforce mode is degraded to audit unless lastVerifiedAt is within 7 days', async () => {
    const storage = getStorageAdapter()
    await storage.putObject('seb/institution-config.seb', Buffer.from('mock-seb-content'), 'application/seb')
    
    // Case A: never verified
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: null,
      requestedMode: 'enforce'
    })
    invalidateInstitutionSebState()

    let state = await getInstitutionSebState()
    assert.strictEqual(state.requestedMode, 'enforce')
    assert.strictEqual(state.effectiveMode, 'audit')
    assert.ok(state.enforcementReason.includes('Complete "Test my setup" in Admin'))

    // Case B: verified 10 days ago (expired)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: tenDaysAgo,
      requestedMode: 'enforce'
    })
    invalidateInstitutionSebState()

    state = await getInstitutionSebState()
    assert.strictEqual(state.requestedMode, 'enforce')
    assert.strictEqual(state.effectiveMode, 'audit')
    assert.ok(state.enforcementReason.includes('over 7 days ago'))

    // Case C: verified 1 day ago (fresh)
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    await settingsService.saveSebConfig({
      fileKey: 'seb/institution-config.seb',
      configKey: VALID_KEY,
      uploadedAt: new Date().toISOString(),
      lastVerifiedAt: oneDayAgo,
      requestedMode: 'enforce'
    })
    invalidateInstitutionSebState()

    state = await getInstitutionSebState()
    assert.strictEqual(state.requestedMode, 'enforce')
    assert.strictEqual(state.effectiveMode, 'enforce')
  })
})
