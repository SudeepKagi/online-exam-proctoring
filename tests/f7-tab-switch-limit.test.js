const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'

const BACKEND_ROOT = path.resolve(__dirname, '../proctornet/backend')
const { proctoringService } = require(path.join(BACKEND_ROOT, 'src/modules/proctoring/service'))
const { proctoringRepository } = require(path.join(BACKEND_ROOT, 'src/modules/proctoring/repository'))
const { attemptService } = require(path.join(BACKEND_ROOT, 'src/modules/attempts/service'))

describe('F7 — Server-side tabSwitchLimit enforcement & settings audit', () => {
  it('F7.1: proctoringService records TAB_SWITCH with MEDIUM severity below limit', async () => {
    const fakeAttemptId = '11111111-1111-1111-1111-111111111111'
    const fakeStudentId = '22222222-2222-2222-2222-222222222222'
    const fakeExamId = '33333333-3333-3333-3333-333333333333'

    // Mock guard
    const origGuard = proctoringRepository.findAttemptForViolationGuard
    const origCount = proctoringRepository.countViolationsByType
    const origQueue = require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue
    const origBudget = require(path.join(BACKEND_ROOT, 'src/shared/evidencePolicy')).checkEvidenceBudget
    require(path.join(BACKEND_ROOT, 'src/shared/evidencePolicy')).checkEvidenceBudget = async () => ({ allowed: true, currentCount: 0, cap: 30, remaining: 30 })
    const origTickets = require(path.join(BACKEND_ROOT, 'src/modules/media/presignService')).presignService.generateEvidenceTickets

    require(path.join(BACKEND_ROOT, 'src/modules/media/presignService')).presignService.generateEvidenceTickets = async () => null

    let queuedItem = null
    require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue = async (item) => {
      queuedItem = item
      return { violationId: '999' }
    }

    proctoringRepository.findAttemptForViolationGuard = async () => ({
      id: fakeAttemptId,
      examId: fakeExamId,
      status: 'ACTIVE',
      tabSwitchLimit: 3
    })

    // 0 prior tab switches -> this is #1
    proctoringRepository.countViolationsByType = async () => 0

    try {
      const res = await proctoringService.recordViolation(
        fakeAttemptId,
        fakeStudentId,
        'TAB_SWITCH',
        { detail: 'First blur' }
      )

      assert.strictEqual(res.recorded, true)
      assert.strictEqual(res.severity, 'MEDIUM')
      assert.strictEqual(res.autoSuspended, false)
      assert.strictEqual(res.tabSwitchCount, 1)
      assert.strictEqual(res.tabSwitchLimit, 3)
      assert.strictEqual(queuedItem.severity, 'MEDIUM')
      assert.strictEqual(queuedItem.metadata.tabSwitchCount, 1)
    } finally {
      proctoringRepository.findAttemptForViolationGuard = origGuard
      proctoringRepository.countViolationsByType = origCount
      require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue = origQueue
    }
  })

  it('F7.2: proctoringService escalates to HIGH severity and auto-suspends when limit reached', async () => {
    const fakeAttemptId = '11111111-1111-1111-1111-222222222222'
    const fakeStudentId = '22222222-2222-2222-2222-222222222222'
    const fakeExamId = '33333333-3333-3333-3333-333333333333'

    const origGuard = proctoringRepository.findAttemptForViolationGuard
    const origCount = proctoringRepository.countViolationsByType
    const origQueue = require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue
    const origTransition = attemptService.transitionState
    const origTickets = require(path.join(BACKEND_ROOT, 'src/modules/media/presignService')).presignService.generateEvidenceTickets
    const origBudget = require(path.join(BACKEND_ROOT, 'src/shared/evidencePolicy')).checkEvidenceBudget

    require(path.join(BACKEND_ROOT, 'src/modules/media/presignService')).presignService.generateEvidenceTickets = async () => null
    require(path.join(BACKEND_ROOT, 'src/shared/evidencePolicy')).checkEvidenceBudget = async () => ({ allowed: true, currentCount: 0, cap: 30, remaining: 30 })

    let transitionedState = null
    let queuedItem = null
    const emittedEvents = []

    const mockIo = {
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvents.push({ room, event, payload })
        }
      })
    }

    require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue = async (item) => {
      queuedItem = item
      return { violationId: '1001' }
    }

    attemptService.transitionState = async (attemptId, status, options) => {
      transitionedState = { attemptId, status, options }
      return { id: attemptId, status, examId: fakeExamId }
    }

    proctoringRepository.findAttemptForViolationGuard = async () => ({
      id: fakeAttemptId,
      examId: fakeExamId,
      status: 'ACTIVE',
      tabSwitchLimit: 3
    })

    // 2 prior tab switches -> this is #3 (limit reached!)
    proctoringRepository.countViolationsByType = async () => 2

    try {
      const res = await proctoringService.recordViolation(
        fakeAttemptId,
        fakeStudentId,
        'TAB_SWITCH',
        { detail: 'Third blur' },
        null,
        mockIo
      )

      assert.strictEqual(res.recorded, true)
      assert.strictEqual(res.severity, 'HIGH', 'Severity must be escalated to HIGH upon exceeding tab switch limit')
      assert.strictEqual(res.autoSuspended, true, 'autoSuspended flag must be true')
      assert.strictEqual(res.tabSwitchCount, 3)
      assert.strictEqual(res.tabSwitchLimit, 3)

      assert.ok(transitionedState, 'transitionState must be invoked')
      assert.strictEqual(transitionedState.status, 'SUSPENDED')
      assert.strictEqual(transitionedState.options.actorRole, 'system')

      // Check socket alerts
      const studentStateEvent = emittedEvents.find(e => e.room === `attempt:${fakeAttemptId}` && e.event === 'attempt:state')
      assert.ok(studentStateEvent, 'Socket event attempt:state must be sent to student room')
      assert.strictEqual(studentStateEvent.payload.status, 'SUSPENDED')

      const invSuspendedEvent = emittedEvents.find(e => e.room === `inv:${fakeExamId}` && e.event === 'attempt:suspended')
      assert.ok(invSuspendedEvent, 'Socket event attempt:suspended must be sent to invigilator room')
    } finally {
      proctoringRepository.findAttemptForViolationGuard = origGuard
      proctoringRepository.countViolationsByType = origCount
      require(path.join(BACKEND_ROOT, 'src/modules/proctoring/violationMicroBatcher')).violationMicroBatcher.queue = origQueue
      attemptService.transitionState = origTransition
    }
  })

  it('F7.3: client useProctoringMonitors hook and ExamInterface reflect exam controls', () => {
    const monitorsSrc = fs.readFileSync(path.join(__dirname, '../proctornet/frontend/src/hooks/useProctoringMonitors.js'), 'utf8')
    const examInterfaceSrc = fs.readFileSync(path.join(__dirname, '../proctornet/frontend/src/pages/student/ExamInterface.jsx'), 'utf8')

    assert.ok(monitorsSrc.includes('allowTabSwitch'), 'Hook must support allowTabSwitch')
    assert.ok(monitorsSrc.includes('requireFullscreen'), 'Hook must support requireFullscreen')
    assert.ok(monitorsSrc.includes('aiReverifyInterval'), 'Hook must support configurable aiReverifyInterval')
    assert.ok(examInterfaceSrc.includes('allowTabSwitch: exam?.browserLock === false'), 'ExamInterface must plumb browserLock')
    assert.ok(examInterfaceSrc.includes('requireFullscreen: exam?.fullScreenMode !== false'), 'ExamInterface must plumb fullScreenMode')
  })
})
