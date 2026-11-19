'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { PDFDocument, StandardFonts } = require('pdf-lib')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')
const { examDraftService } = require('../src/modules/exams/exam.draft.service')

async function createSubstantiveTestPdf() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([600, 900])
  
  const textParagraphs = [
    'The architecture of computer operating systems relies heavily on memory management subsystems to provide isolation and efficient resource sharing across concurrent processes.',
    'Virtual memory mechanisms map logical process addresses into physical random access memory frames using multi-level hierarchical page tables and translation caches.',
    'Hardware translation lookaside buffers cache the most recent address translations to dramatically reduce memory latency on modern high throughput microprocessors.',
    'When an active process attempts to access a virtual memory address that is not currently mapped into physical storage, the processor triggers a page fault exception.',
    'The kernel interrupt handler intercepts this fault and resolves the missing reference by scheduling an asynchronous input output transfer from secondary solid state storage.',
    'Process scheduling algorithms allocate central processing unit execution time slices among competing computational threads based on priority, fairness, and state metrics.',
    'System protection rings strictly isolate unprivileged user space applications from supervisor mode kernel execution environments to ensure platform security and stability.',
    'Direct memory access controllers offload high throughput data transfers between peripheral hardware interfaces and main memory without continuous processor intervention.',
    'Inter-process communication protocols enable distributed or local software components to exchange synchronized telemetry, event notifications, and operational messages.',
    'Deadlock avoidance mechanisms continuously analyze resource allocation graphs to prevent circular wait conditions from starving active computational pipelines.',
    'Symmetric multiprocessing architectures maintain cache coherence across independent processor cores using bus snooping or directory based protocols under heavy loads.',
    'Non-volatile storage file systems organize persistent disk blocks into indexed structures with transactional journaling to guarantee crash recovery integrity.',
    'Device drivers operate as modular kernel extensions that translate high level abstract input output requests into device specific hardware register commands.',
    'Dynamic memory allocators employ buddy systems and slab caches to mitigate both internal and external fragmentation during rapid heap allocations.',
    'Cryptographic security primitives protect sensitive credential tokens and authentication hashes across untrusted communication networks and storage volumes.',
    'Distributed consensus protocols establish fault tolerant state replication across distributed database clusters in high availability production architectures.'
  ]

  let y = 820
  for (const para of textParagraphs) {
    page.drawText(para, { x: 50, y, size: 10, font, maxWidth: 500 })
    y -= 50
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes).toString('base64')
}

describe('Wizard Scheduling, Timezone & Rate Limiting Regression Suite', () => {
  it('1. Rejects exam start within 2 minutes of now with 400 START_TOO_SOON', async () => {
    const now = Date.now()
    const tooSoonUtc = new Date(now + 60 * 1000).toISOString() // 1 minute from now

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Immediate Exam',
          courseCode: 'CS101',
          startTimeUtc: tooSoonUtc,
          durationMinutes: 60,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'START_TOO_SOON')
        assert.match(err.message, /at least 2 minutes/i)
        return true
      }
    )
  })

  it('2. Rejects exam start in the past with 400 START_IN_PAST', async () => {
    const pastUtc = new Date(Date.now() - 3600000).toISOString() // 1 hour ago

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Past Exam',
          courseCode: 'CS101',
          startTimeUtc: pastUtc,
          durationMinutes: 60,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'START_IN_PAST')
        assert.match(err.message, /past/i)
        return true
      }
    )
  })

  it('3. Rejects exam duration <= 0 with 400 INVALID_DURATION', async () => {
    const validFuture = new Date(Date.now() + 600000).toISOString() // 10 minutes from now

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Zero Duration Exam',
          courseCode: 'CS101',
          startTimeUtc: validFuture,
          durationMinutes: 0,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'INVALID_DURATION')
        return true
      }
    )
  })

  it('4. Rejects late entry window greater than or equal to exam duration', async () => {
    const validFuture = new Date(Date.now() + 600000).toISOString()

    await assert.rejects(
      async () => {
        await examWizardService.publishWizard('test-faculty-id', {
          title: 'Late Entry Overflow',
          courseCode: 'CS101',
          startTimeUtc: validFuture,
          durationMinutes: 10,
          lateEntryMinutes: 10,
          questions: [
            { questionText: 'Sample?', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 0 }
          ]
        })
      },
      (err) => {
        assert.equal(err.status, 400)
        assert.equal(err.code, 'LATE_ENTRY_EXCEEDS_DURATION')
        return true
      }
    )
  })

  it('5. Enforces AI generation rate limit of 5 requests per hour per faculty', async () => {
    const mockFacultyId = `faculty_ratelimit_${Date.now()}`
    const fakePdf = await createSubstantiveTestPdf()

    // Requests 1 to 5 should succeed (falling back to deterministic fallback)
    for (let i = 0; i < 5; i++) {
      const res = await examWizardService.generateFromPdf({
        pdfBase64: fakePdf,
        fileName: 'test.pdf',
        count: 2,
        creatorId: mockFacultyId
      })
      assert.equal(res.status, 'success')
    }

    // 6th request within the same hour MUST fail with 429 RATE_LIMIT_EXCEEDED
    await assert.rejects(
      async () => {
        await examWizardService.generateFromPdf({
          pdfBase64: fakePdf,
          fileName: 'test.pdf',
          count: 2,
          creatorId: mockFacultyId
        })
      },
      (err) => {
        assert.equal(err.status, 429)
        assert.equal(err.code, 'RATE_LIMIT_EXCEEDED')
        assert.match(err.message, /rate limit reached/i)
        return true
      }
    )
  })

  it('6. Allows faculty to read institution SEB status via controller', async () => {
    const examsOpsController = require('../src/modules/exams/exams.ops.controller')
    const req = { user: { id: 'faculty-1', role: 'FACULTY' } }
    let resStatus = 0
    let resJson = null
    const res = {
      status(code) {
        resStatus = code
        return this
      },
      json(payload) {
        resJson = payload
        return this
      }
    }
    await examsOpsController.getInstitutionSebStatus(req, res, (err) => {
      if (err) throw err
    })
    assert.equal(resStatus, 200)
    assert.ok(typeof resJson.configured === 'boolean')
  })
})

