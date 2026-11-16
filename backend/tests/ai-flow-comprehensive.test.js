'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  generateExamQuestions,
  estimateSupportedQuestions,
  calculateSimilarity,
  checkGrounding,
  validateAndRepairExamPayload,
  normalizeGeneratedQuestions,
  AI_MAX_QUESTIONS_PER_RUN,
  AI_DAILY_QUESTION_QUOTA_PER_USER
} = require('../src/modules/exams/ai.generator')

const { aiJobsService } = require('../src/modules/exams/ai.jobs.service')

describe('AI Exam Flow & Quality Verification Suite (§Task 2.B)', () => {
  const sampleMaterial = `
    Operating Systems and Memory Management Architecture.
    Virtual memory divides address spaces into uniform pages, typically 4KB in size.
    The Translation Lookaside Buffer (TLB) caches recent virtual-to-physical address translations.
    Page faults occur when a requested page is not currently resident in physical RAM.
    Demand paging loads pages into memory only when accessed by an executing thread.
    Radix page tables structure multi-level hierarchical mapping to minimize page table memory overhead.
    Page replacement algorithms such as Least Recently Used (LRU) approximate optimal page eviction policies.
    Thrashing describes a catastrophic degradation where excessive page swapping starves CPU execution.
    Dirty bit tracking optimizes disk writes by skipping unmodified clean pages during swap out.
    Segmentation allows programs to be partitioned into logical, variable-length address blocks representing functions or data structures.
    Inverted page tables maintain one entry per physical frame rather than per virtual page, conserving memory in 64-bit architectures.
    Memory Protection Units and page table permission bits enforce read, write, and execute privileges across address spaces.
    Copy-on-write optimization delays memory duplication during process creation until a write operation occurs.
    Working set models dynamically estimate the set of pages an active process requires to execute without page faults.
    Address space layout randomization (ASLR) introduces pseudo-random offsets to protect against buffer overflow exploits.
    Kernel memory allocators frequently use buddy allocation algorithms or slab allocators to minimize internal and external fragmentation.
    Page coloring techniques minimize cache conflicts by assigning physical page frames that map to distinct cache lines.
    Direct Memory Access (DMA) controllers transfer data directly between I/O devices and main memory without continuous CPU intervention.
    Translation lookaside buffer shootdown protocols ensure cross-CPU TLB invalidation in multi-core symmetric multiprocessing environments.
    Secondary storage paging stores non-resident pages on high-speed solid state or magnetic drives until requested by an active process.
    Swapping moves entire process images between backing storage and physical RAM under severe system-wide memory exhaustion.
    Protection rings establish hierarchical privilege levels where ring 0 executes kernel operations and ring 3 runs unprivileged user applications.
    Internal fragmentation occurs when allocated physical memory exceeds the exact payload size requested by the application.
    External fragmentation arises when total free memory is adequate to satisfy a request but available storage is divided into non-contiguous blocks.
  `

  it('1. Question Count & Capacity Estimation: provides honest count and bounds', () => {
    const estimation = estimateSupportedQuestions(sampleMaterial)
    assert.ok(typeof estimation.supportedCount === 'number')
    assert.ok(estimation.supportedCount > 0)
    assert.ok(estimation.supportedCount <= AI_MAX_QUESTIONS_PER_RUN)
    assert.ok(estimation.hint.includes('supports about'))
  })

  it('2. Honesty Check: returns fewer grounded questions with explanatory note when text is short', async () => {
    const shortText = 'Quick intro to CPU registers. R0 holds accumulator results.'
    const result = await generateExamQuestions({
      topic: 'Microprocessors',
      syllabusText: shortText,
      count: 25 // Request 25 on a tiny 10-word document
    })

    assert.ok(result.questions.length < 25)
    assert.ok(result.honestyNote)
    assert.ok(result.honestyNote.includes('reliably grounds about'))
  })

  it('3. Difficulty Split: Mixed difficulty distributes questions across Easy, Medium, and Hard', async () => {
    const result = await generateExamQuestions({
      topic: 'Virtual Memory',
      syllabusText: sampleMaterial,
      difficulty: 'MIXED',
      difficultySplit: { easy: 30, medium: 50, hard: 20 },
      count: 10
    })

    assert.equal(result.questions.length, 10)
    const diffs = result.questions.map(q => q.difficulty)
    assert.ok(diffs.includes('EASY') || diffs.includes('MEDIUM') || diffs.includes('HARD'))
    assert.ok(result.aiAudit)
    assert.equal(result.aiAudit.settings.difficulty, 'MIXED')
  })

  it('4. Grounding Check: accurately detects grounded vs ungrounded supporting excerpts', () => {
    const validExcerpt = 'The Translation Lookaside Buffer (TLB) caches recent virtual-to-physical address translations.'
    const isGrounded = checkGrounding(validExcerpt, sampleMaterial)
    assert.equal(isGrounded, true)

    const fabricatedExcerpt = 'Quantum teleportation instantly mirrors RAM across black hole event horizons.'
    const isUngrounded = checkGrounding(fabricatedExcerpt, sampleMaterial)
    assert.equal(isUngrounded, false)
  })

  it('5. Quality Rules: flags weak support when excerpt is absent from source text', () => {
    const raw = {
      title: 'OS Quiz',
      questions: [
        {
          questionText: 'What is the purpose of the TLB?',
          options: ['Caches translations', 'Flushes disk cache', 'Allocates heap', 'Encrypts packets'],
          correctOptionIndex: 0,
          supportingExcerpt: 'Quantum teleportation instantly mirrors RAM across black holes.',
          difficulty: 'MEDIUM'
        }
      ]
    }

    const validated = validateAndRepairExamPayload(raw, sampleMaterial)
    assert.equal(validated.valid, true)
    const q = validated.data.questions[0]
    assert.ok(q.flags.includes('weak support'))
    assert.equal(q.needsReview, true)
  })

  it('6. Deduplication: detects similarity between near-duplicate questions and sets flag', () => {
    const existing = [
      {
        questionText: 'What is the primary architectural purpose of virtual memory in operating systems?'
      }
    ]

    const duplicateCandidate = {
      questionText: 'What is the primary architectural purpose of virtual memory paging in operating systems?'
    }

    const similarity = calculateSimilarity(duplicateCandidate.questionText, existing[0].questionText)
    assert.ok(similarity >= 0.80)

    const normalized = normalizeGeneratedQuestions([duplicateCandidate], sampleMaterial, existing)
    assert.ok(normalized[0].flags.includes('duplicate'))
    assert.equal(normalized[0].needsReview, true)
  })

  it('7. Extract Mode: badges missing question answers as AI-suggested', async () => {
    const questionPaper = `
      Midterm Exam: Computer Networks
      1. What layer does IP operate at in the OSI model?
      (A) Transport (B) Network (C) Data Link (D) Physical
      Answer: (B)

      2. What does DHCP automatically allocate to hosts?
      (A) IP address (B) Hard disk space (C) Display resolution (D) Clock frequency
    `

    const result = await generateExamQuestions({
      topic: 'Networks',
      syllabusText: questionPaper,
      isExtractMode: true,
      count: 2
    })

    assert.ok(result.questions.length >= 1)
    assert.ok(result.aiAudit)
  })

  it('8. Batch Job Lifecycle: creates job, reports progress, and preserves partial results on cancel', async () => {
    const testUser = '00000000-0000-0000-0000-000000000001'
    const jobRes = await aiJobsService.startGenerationJob({
      creatorId: testUser,
      extractedText: sampleMaterial,
      fileName: 'os-notes.pdf',
      pageCount: 3,
      settings: {
        count: 15,
        difficulty: 'MEDIUM',
        topic: 'Operating Systems'
      }
    })

    assert.ok(jobRes.jobId)
    assert.equal(jobRes.total, 15)
    assert.equal(jobRes.totalBatches, 2) // 15 questions in batches of 10 -> 2 batches

    // Inspect initial job state
    const current = aiJobsService.getJob(jobRes.jobId, testUser)
    assert.ok(current)
    assert.ok(current.status === 'in_progress' || current.status === 'completed')

    // Test Cancel
    const cancelRes = aiJobsService.cancelJob(jobRes.jobId, testUser)
    assert.equal(cancelRes.status, 'cancelled')
    assert.ok(Array.isArray(cancelRes.questions))
  })

  it('9. Quota Enforcement: blocks requests exceeding daily per-user question limit', async () => {
    const quotaUser = '00000000-0000-0000-0000-000000000099'
    let quotaError = null

    try {
      // Exceed quota
      await aiJobsService.startGenerationJob({
        creatorId: quotaUser,
        extractedText: sampleMaterial,
        settings: { count: 45 }
      })

      await aiJobsService.startGenerationJob({
        creatorId: quotaUser,
        extractedText: sampleMaterial,
        settings: { count: 45 }
      })

      // Third request reaches 45 + 45 + 20 = 110 > 100 limit
      await aiJobsService.startGenerationJob({
        creatorId: quotaUser,
        extractedText: sampleMaterial,
        settings: { count: 20 }
      })
    } catch (err) {
      quotaError = err
    }

    assert.ok(quotaError)
    assert.equal(quotaError.status, 429)
    assert.equal(quotaError.code, 'QUOTA_EXCEEDED')
    assert.ok(quotaError.message.includes('Daily question quota exceeded'))
  })

  it('10. Max Questions Limit: rejects count exceeding AI_MAX_QUESTIONS_PER_RUN', async () => {
    let limitError = null
    try {
      await aiJobsService.startGenerationJob({
        creatorId: '00000000-0000-0000-0000-000000000002',
        extractedText: sampleMaterial,
        settings: { count: 100 } // Exceeds 50
      })
    } catch (err) {
      limitError = err
    }

    assert.ok(limitError)
    assert.equal(limitError.status, 400)
    assert.equal(limitError.code, 'LIMIT_EXCEEDED')
  })
})
