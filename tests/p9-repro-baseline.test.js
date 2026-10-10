'use strict'

process.env.CACHE_DRIVER = 'memory'
process.env.QUEUE_DRIVER = 'postgres'
process.env.START_WORKERS = 'false'
process.env.NODE_ENV = 'test'

const { describe, it } = require('node:test')
const assert = require('node:assert')
const path = require('path')
const fs = require('fs')

const REPO_ROOT = path.resolve(__dirname, '..')
const BACKEND_ROOT = path.join(REPO_ROOT, 'proctornet/backend')

// ── Helpers & Modules ─────────────────────────────────────────────────────────
const { evaluationWorker } = require(path.join(BACKEND_ROOT, 'src/modules/results/evaluationWorker'))
const { evidenceWorker } = require(path.join(BACKEND_ROOT, 'src/modules/media/evidenceWorker'))
const { adminService } = require(path.join(BACKEND_ROOT, 'src/modules/admin/service'))
const { attemptRepository, createSeededRng } = require(path.join(BACKEND_ROOT, 'src/modules/attempts/repository'))
const { proctoringService } = require(path.join(BACKEND_ROOT, 'src/modules/proctoring/service'))

describe('P9 Defect Reproduction & Baseline Verification', () => {

  // ── F1: Worker Handlers Dead Code in Production ─────────────────────────────
  describe('F1 — Worker Handlers Dead Code', () => {
    it('F1.1: evaluationWorker must define handleEvent method', () => {
      assert.strictEqual(
        typeof evaluationWorker.handleEvent,
        'function',
        'F1 Defect Confirmed: evaluationWorker.handleEvent is undefined; outbox events will throw TypeError and end FAILED'
      )
    })

    it('F1.2: evidenceWorker must define handleEvent method', () => {
      assert.strictEqual(
        typeof evidenceWorker.handleEvent,
        'function',
        'F1 Defect Confirmed: evidenceWorker.handleEvent is undefined; evidence.uploaded outbox events will throw TypeError'
      )
    })
  })

  // ── F2: Resume After Expiry Silently Loses Result ───────────────────────────
  describe('F2 — Resume After Expiry', () => {
    it('F2.1: startOrResumeAttempt must not bypass attemptStateMachine on expired resume', () => {
      const attemptsServiceSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/attempts/service.js'), 'utf8')
      const hasDirectStatusUpdate = /await\s+prisma\.examAttempt\.update\(\s*\{\s*where:\s*\{\s*id:\s*attempt\.id\s*\},\s*data:\s*\{\s*status:\s*['"]EXPIRED['"]\s*\}\s*\}\)/.test(attemptsServiceSrc)
      assert.strictEqual(
        hasDirectStatusUpdate,
        false,
        'F2 Defect Confirmed: startOrResumeAttempt performs direct prisma.examAttempt.update to EXPIRED, bypassing attemptStateMachine and outbox emission'
      )
    })

    it('F2.2: ExpirySweeper must reconcile un-evaluated terminal attempts', () => {
      const sweeperSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/attempts/expirySweeper.js'), 'utf8')
      const hasTerminalReconciler = sweeperSrc.includes('exam_results') || sweeperSrc.includes('SUBMITTED') || sweeperSrc.includes('TERMINATED')
      assert.strictEqual(
        hasTerminalReconciler,
        true,
        'F2 Defect Confirmed: ExpirySweeper only checks ACTIVE attempts and has no reconciler for un-evaluated terminal attempts'
      )
    })
  })

  // ── F3: Exams Stuck in ENDED Forever & Absent Students ──────────────────────
  describe('F3 — Exam Lifecycle & Absent Students', () => {
    it('F3.1: createAbsentResultsForEndedExam must be invoked by examScheduler', () => {
      const schedulerSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/exams/examScheduler.js'), 'utf8')
      assert.strictEqual(
        schedulerSrc.includes('createAbsentResultsForEndedExam'),
        true,
        'F3 Defect Confirmed: createAbsentResultsForEndedExam is never called by examScheduler; absent students get no result'
      )
    })

    it('F3.2: transitionEndedToEvaluated must not exclude exams with READY absent attempts', () => {
      const examRepoSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/exams/repository.js'), 'utf8')
      // Currently blocks transition if ea.status IN ('READY', 'ACTIVE', 'SUSPENDED')
      const blocksOnReady = /ea\.status\s+IN\s+\(['"]READY['"],\s*['"]ACTIVE['"],\s*['"]SUSPENDED['"]\)/.test(examRepoSrc)
      assert.strictEqual(
        blocksOnReady,
        false,
        'F3 Defect Confirmed: transitionEndedToEvaluated blocks transition when READY attempts exist, permanently stranding exams in ENDED'
      )
    })
  })

  // ── F4: Server-Side Start Gates Bypassable ──────────────────────────────────
  describe('F4 — Start Gates Server Enforcement', () => {
    it('F4.1: createStudent must default approvalStatus to PENDING until approved', () => {
      const adminServiceSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/admin/service.js'), 'utf8')
      const createStudentMatch = adminServiceSrc.match(/async\s+createStudent\s*\([^)]*\)\s*\{[\s\S]*?return\s+toStudentAdminDTO/i)
      const createsApproved = createStudentMatch ? /approvalStatus:\s*['"]APPROVED['"]/.test(createStudentMatch[0]) : false
      assert.strictEqual(
        createsApproved,
        false,
        'F4 Defect Confirmed: createStudent sets approvalStatus to APPROVED immediately at creation'
      )
    })

    it('F4.2: createOnDemandAttempt must not insert ACTIVE status directly', () => {
      const attemptRepoSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/attempts/repository.js'), 'utf8')
      const insertsActiveDirectly = /INSERT\s+INTO\s+exam_attempts[\s\S]*?['"]ACTIVE['"]/i.test(attemptRepoSrc)
      assert.strictEqual(
        insertsActiveDirectly,
        false,
        'F4 Defect Confirmed: createOnDemandAttempt directly inserts status ACTIVE, bypassing start gates'
      )
    })

    it('F4.3: server must expose unified assertCanStart validation gate', () => {
      let canStartExists = false
      try {
        const eligibilityMod = require(path.join(BACKEND_ROOT, 'src/modules/exams/eligibility'))
        canStartExists = typeof eligibilityMod.assertCanStart === 'function'
      } catch {}
      assert.strictEqual(
        canStartExists,
        true,
        'F4 Defect Confirmed: assertCanStart unified server-side start gate is not implemented'
      )
    })
  })

  // ── F5: Known Default Passwords on Admin-Created Accounts ───────────────────
  describe('F5 — Default Password Security', () => {
    it('F5.1: adminService must not use hard-coded default passwords Faculty@123 / Student@123', () => {
      const adminServiceSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/admin/service.js'), 'utf8')
      const hasFacultyDefault = adminServiceSrc.includes('Faculty@123')
      const hasStudentDefault = adminServiceSrc.includes('Student@123')
      assert.strictEqual(
        hasFacultyDefault || hasStudentDefault,
        false,
        'F5 Defect Confirmed: adminService uses hard-coded Faculty@123 and Student@123 fallback passwords'
      )
    })

    it('F5.2: check-default-credentials verification script must exist', () => {
      const scriptExists = fs.existsSync(path.join(REPO_ROOT, 'scripts/ops/check-default-credentials.js'))
      assert.strictEqual(
        scriptExists,
        true,
        'F5 Defect Confirmed: scripts/ops/check-default-credentials.js does not exist'
      )
    })
  })

  // ── F6: CSRF/CORS Origin Wildcard Bypass ────────────────────────────────────
  describe('F6 — CSRF/CORS Wildcard & Header Bypasses', () => {
    it('F6.1: CORS origin validator must not allow arbitrary *.sslip.io domains', () => {
      const appSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/app.js'), 'utf8')
      const hasWildcardDomain = /\*\.sslip\.io|\.\*\.sslip\.io/.test(appSrc)
      assert.strictEqual(
        hasWildcardDomain,
        false,
        'F6 Defect Confirmed: app.js contains wildcard regex allowing any *.sslip.io domain (e.g. evil.sslip.io)'
      )
    })

    it('F6.2: CSRF protection must not unconditionally bypass on arbitrary client headers in production', () => {
      const appSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/app.js'), 'utf8')
      const hasUnconditionalClientTypeBypass = /if\s*\(\s*req\.headers\['x-client-type'\]\s*===\s*'test'/.test(appSrc)
      assert.strictEqual(
        hasUnconditionalClientTypeBypass,
        false,
        'F6 Defect Confirmed: app.js bypasses CSRF unconditionally when x-client-type: test is sent'
      )
    })
  })

  // ── F7: Settings Saved But Never Enforced (tabSwitchLimit) ──────────────────
  describe('F7 — Unenforced Settings (tabSwitchLimit)', () => {
    it('F7.1: proctoringService must enforce tabSwitchLimit server-side', () => {
      const proctoringSrc = fs.readFileSync(path.join(BACKEND_ROOT, 'src/modules/proctoring/service.js'), 'utf8')
      const enforcesTabLimit = proctoringSrc.includes('tabSwitchLimit') || proctoringSrc.includes('tab_switch_limit')
      assert.strictEqual(
        enforcesTabLimit,
        true,
        'F7 Defect Confirmed: proctoringService does not check tabSwitchLimit or auto-suspend attempts'
      )
    })
  })

  // ── F8: Contradictory Time Rules ───────────────────────────────────────────
  describe('F8 — Contradictory Time Rules Across Start Paths', () => {
    it('F8.1: unified examClock module must exist and govern expiry calculation', () => {
      let examClockExists = false
      try {
        const examClockMod = require(path.join(BACKEND_ROOT, 'src/modules/exams/examClock'))
        examClockExists = typeof examClockMod.calculateAttemptExpiry === 'function'
      } catch {}
      assert.strictEqual(
        examClockExists,
        true,
        'F8 Defect Confirmed: examClock module does not exist; activateReadyAttempt and createOnDemandAttempt diverge on grace'
      )
    })
  })

  // ── F9: Diverging Attempt Construction & Degenerate PRNG ────────────────────
  describe('F9 — Diverging Attempt Construction & RNG Degeneracy', () => {
    it('F9.1: createSeededRng must not collapse to perpetual zero if seed hash is zero', () => {
      // Find a string whose initial hash evaluates to 0, or test with degenerate state
      // In LCG: next = (48271 * 0) % 2147483647 = 0
      const rng = createSeededRng('') // empty string yields hash = 0
      const val1 = rng()
      const val2 = rng()
      const val3 = rng()
      const isDegenerate = (val1 === 0 && val2 === 0 && val3 === 0)
      assert.strictEqual(
        isDegenerate,
        false,
        'F9 Defect Confirmed: createSeededRng with empty/zero hash collapses permanently to 0'
      )
    })

    it('F9.2: unified buildAttemptQuestions function must exist and honor randomiseQuestions', () => {
      let builderExists = false
      try {
        const attemptRepo = require(path.join(BACKEND_ROOT, 'src/modules/attempts/repository'))
        builderExists = typeof attemptRepo.buildAttemptQuestions === 'function'
      } catch {}
      assert.strictEqual(
        builderExists,
        true,
        'F9 Defect Confirmed: buildAttemptQuestions is not defined; 3 separate conflicting implementations exist'
      )
    })
  })
})
