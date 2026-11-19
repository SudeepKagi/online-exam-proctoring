'use strict'

process.env.NODE_ENV = 'test'
process.env.CACHE_DRIVER = 'memory'
process.env.S3_MOCK = 'true'

const { describe, it, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { PDFDocument, StandardFonts } = require('pdf-lib')

const {
  generateExamQuestions,
  regenerateSingleQuestion,
  verifyVerbatimCitation,
  verifyAndFilterGroundedQuestions,
  buildPageAwareChunks,
  getAiProviderInfo,
  probeAiAvailability
} = require('../src/modules/exams/ai.generator')
const { examWizardService } = require('../src/modules/exams/exam.wizard.service')
const { preflightEnv } = require('../../scripts/ops/preflight-env')

// Helper to construct multi-page PDF buffer with substantive text using pdf-lib
async function createSubstantivePdf(pageLinesArray) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)

  for (let pIdx = 0; pIdx < pageLinesArray.length; pIdx++) {
    const lines = pageLinesArray[pIdx]
    const page = doc.addPage([600, 800])
    lines.forEach((line, lIdx) => {
      page.drawText(line, { x: 50, y: 750 - (lIdx * 18), size: 10, font })
    })
  }

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

describe('AI Grounded Generation & Citation Verification Invariants', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // -------------------------------------------------------------------------
  // 1. Production Safety Guards
  // -------------------------------------------------------------------------
  describe('1. Production Safety & Key Enforcement', () => {
    it('refuses generation in production when API keys are missing (503 AI_GENERATION_NOT_CONFIGURED)', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.GEMINI_API_KEY
      delete process.env.OPENAI_API_KEY

      await assert.rejects(
        async () => {
          await generateExamQuestions({
            topic: 'Operating Systems',
            syllabusText: 'Some syllabus text that has plenty of characters to attempt generation.',
            count: 5
          })
        },
        (err) => {
          assert.equal(err.status, 503)
          assert.equal(err.code, 'AI_GENERATION_NOT_CONFIGURED')
          return true
        }
      )
    })

    it('probeAiAvailability returns NOT_CONFIGURED in production without keys', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.GEMINI_API_KEY
      delete process.env.OPENAI_API_KEY

      const probe = await probeAiAvailability()
      assert.equal(probe.ok, false)
      assert.equal(probe.code, 'AI_GENERATION_NOT_CONFIGURED')
    })

    it('getAiProviderInfo reports configured: false in production without keys', () => {
      process.env.NODE_ENV = 'production'
      delete process.env.GEMINI_API_KEY
      delete process.env.OPENAI_API_KEY

      const info = getAiProviderInfo()
      assert.equal(info.configured, false)
      assert.equal(info.isProduction, true)
      assert.equal(info.provider, 'none')
    })
  })

  // -------------------------------------------------------------------------
  // 2. Extraction with Proof & 300-Word Threshold
  // -------------------------------------------------------------------------
  describe('2. PDF Extraction & 300-Word Substantive Threshold', () => {
    it('stops with 400 INSUFFICIENT_SOURCE_TEXT when PDF has fewer than 300 words', async () => {
      const shortPdf = await createSubstantivePdf([
        ['This page is very short and contains only a few words.'],
        ['Second page with minimal content.']
      ])

      await assert.rejects(
        async () => {
          await examWizardService.extractPdfText({ pdfBuffer: shortPdf })
        },
        (err) => {
          assert.equal(err.status, 400)
          assert.equal(err.code, 'INSUFFICIENT_SOURCE_TEXT')
          assert.equal(err.message, "We couldn't read text from this PDF. Upload a text-based PDF or paste the text")
          return true
        }
      )
    })

    it('extracts multi-page text and provides per-page statistics when >= 300 words', async () => {
      const sentences = [
        'The distributed consensus algorithm guarantees sequential consistency across redundant replicas.',
        'Heartbeat monitors transition affected leader nodes into safe fencing states within fifty milliseconds.',
        'Memory reclamation sweeps concurrently deallocate orphaned commit buffers without stalling requests.',
        'Fault tolerant logging preserves chronological transaction ordering across disk barriers for recovery.',
        'Protocol Zephyr 77B telemetry carrier operates at 433.92 MHz with 128 bit quantum resistant key rotation.',
        'Buffer depletion triggers immediate fallback to secondary parity rings within 15 milliseconds safely.',
        'Calibration coefficient Omega 9 must remain strictly between 2.45 and 2.48 microhenries stabilized.'
      ]

      const pageLines = [
        ['Page 1 Telemetry Architecture', ...sentences, ...sentences],
        ['Page 2 Secondary Parity Rings', ...sentences, ...sentences],
        ['Page 3 Thermal Stabilization Cycles', ...sentences, ...sentences]
      ]

      const substantivePdf = await createSubstantivePdf(pageLines)

      const extracted = await examWizardService.extractPdfText({ pdfBuffer: substantivePdf })
      assert.equal(extracted.totalPages, 3)
      assert.equal(extracted.readablePages, 3)
      assert.ok(extracted.totalWords >= 300)
      assert.equal(extracted.pages[0].pageNumber, 1)
      assert.equal(extracted.pages[0].isReadable, true)
      assert.ok(extracted.summary.includes('Read 3 of 3 pages'))
    })
  })

  // -------------------------------------------------------------------------
  // 3. Verbatim Citation & Semantic Grounding Verification
  // -------------------------------------------------------------------------
  describe('3. Verbatim Citation Verification', () => {
    const pages = [
      {
        pageNumber: 1,
        text: 'The Zephyr-77B telemetry protocol operates at an exact carrier frequency of 433.92 MHz with 128-bit quantum-resistant key rotation every 450 seconds.',
        wordCount: 22,
        isReadable: true
      },
      {
        pageNumber: 2,
        text: 'Buffer depletion triggers an immediate fallback to secondary parity rings within 15 milliseconds, guaranteeing zero dropped frames under 85% packet saturation.',
        wordCount: 23,
        isReadable: true
      }
    ]

    it('accepts question citing a verbatim excerpt present on the cited page', () => {
      const question = {
        questionText: 'What is the exact carrier frequency of the Zephyr-77B protocol?',
        options: ['433.92 MHz', '915.00 MHz', '2.40 GHz', '868.10 MHz'],
        correctOptionIndex: 0,
        sourcePage: 1,
        supportingExcerpt: 'operates at an exact carrier frequency of 433.92 MHz with 128-bit'
      }

      const check = verifyVerbatimCitation(question, pages)
      assert.equal(check.valid, true)
      assert.equal(check.matchedPage, 1)
    })

    it('rejects hallucinated question with excerpt not present in document', () => {
      const hallucinated = {
        questionText: 'What protocol speed is required by the fictional Alpha-99 specification?',
        options: ['10 Gbps', '40 Gbps', '100 Gbps', '1 Gbps'],
        correctOptionIndex: 0,
        sourcePage: 1,
        supportingExcerpt: 'Alpha-99 requires exactly forty gigabits per second throughput'
      }

      const check = verifyVerbatimCitation(hallucinated, pages)
      assert.equal(check.valid, false)
      assert.equal(check.reason, 'EXCERPT_NOT_IN_SOURCE')
    })

    it('rejects excerpt that is too short (< 15 characters)', () => {
      const shortExcerpt = {
        questionText: 'Which protocol is discussed?',
        options: ['Zephyr', 'Delta', 'Beta', 'Gamma'],
        correctOptionIndex: 0,
        sourcePage: 1,
        supportingExcerpt: 'Zephyr-77B'
      }

      const check = verifyVerbatimCitation(shortExcerpt, pages)
      assert.equal(check.valid, false)
      assert.equal(check.reason, 'EXCERPT_TOO_SHORT')
    })

    it('filters candidate questions and drops ungrounded candidates', () => {
      const candidates = [
        {
          questionText: 'What is the fallback mechanism upon buffer depletion?',
          options: ['Secondary parity rings within 15 milliseconds', 'Hard shutdown', 'Immediate restart', 'Data drop'],
          correctOptionIndex: 0,
          sourcePage: 2,
          supportingExcerpt: 'Buffer depletion triggers an immediate fallback to secondary parity rings within 15 milliseconds'
        },
        {
          questionText: 'What is the primary color of the chassis casing?',
          options: ['Bright Red', 'Dark Blue', 'Matte Black', 'Silver'],
          correctOptionIndex: 0,
          sourcePage: 1,
          supportingExcerpt: 'The chassis casing is painted with bright red industrial enamel'
        }
      ]

      const { acceptedQuestions, rejectedCount, rejectionReasons } = verifyAndFilterGroundedQuestions(
        candidates,
        pages,
        ''
      )

      assert.equal(acceptedQuestions.length, 1)
      assert.equal(acceptedQuestions[0].sourcePage, 2)
      assert.equal(acceptedQuestions[0].groundingStatus, 'VERIFIED')
      assert.equal(rejectedCount, 1)
      assert.equal(rejectionReasons['EXCERPT_NOT_IN_SOURCE'], 1)
    })
  })

  // -------------------------------------------------------------------------
  // 4. Page-Aware Chunking & Proportional Allocation
  // -------------------------------------------------------------------------
  describe('4. Page-Aware Chunking & Proportional Allocation', () => {
    it('allocates question count across chunks summing exactly to requested total', () => {
      const pages = [
        { pageNumber: 1, text: 'Page one text', wordCount: 500, isReadable: true },
        { pageNumber: 2, text: 'Page two text', wordCount: 500, isReadable: true },
        { pageNumber: 3, text: 'Page three text', wordCount: 500, isReadable: true },
        { pageNumber: 4, text: 'Page four text', wordCount: 500, isReadable: true },
        { pageNumber: 5, text: 'Page five text', wordCount: 500, isReadable: true },
        { pageNumber: 6, text: 'Page six text', wordCount: 500, isReadable: true }
      ]

      const totalWords = 3000
      const requestedCount = 15

      const chunks = buildPageAwareChunks(pages, totalWords, requestedCount)
      assert.ok(chunks.length > 1)

      const sumAllocated = chunks.reduce((acc, c) => acc + c.targetCount, 0)
      assert.equal(sumAllocated, requestedCount)
    })
  })

  // -------------------------------------------------------------------------
  // 5. Single Question Regeneration from Excerpt
  // -------------------------------------------------------------------------
  describe('5. Single Question Regeneration', () => {
    it('regenerates a question strictly from the supplied excerpt', async () => {
      const excerpt = 'Buffer depletion triggers an immediate fallback to secondary parity rings within 15 milliseconds'
      const regenerated = await regenerateSingleQuestion({
        topic: 'Telemetry Architecture',
        excerpt,
        sourcePage: 2,
        difficulty: 'HARD',
        optionsPerQuestion: 4
      })

      assert.ok(regenerated)
      assert.equal(regenerated.supportingExcerpt, excerpt)
      assert.equal(regenerated.sourcePage, 2)
      assert.equal(regenerated.options.length, 4)
      assert.equal(regenerated.difficulty, 'HARD')
    })
  })

  // -------------------------------------------------------------------------
  // 6. Preflight Environment Script Key Check
  // -------------------------------------------------------------------------
  describe('6. Preflight Environment Enforcement', () => {
    const tempEnvPath = path.resolve(__dirname, 'temp.test.env')

    afterEach(() => {
      if (fs.existsSync(tempEnvPath)) fs.unlinkSync(tempEnvPath)
    })

    it('preflightEnv fails when FEATURE_AI_GENERATION is enabled without GEMINI_API_KEY or OPENAI_API_KEY', () => {
      const envContent = `
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@db:5432/proctornet
DIRECT_URL=postgresql://user:pass@db:5432/proctornet
JWT_SECRET=supersecretlongjwtsecretkey32charactersminimum!
JWT_REFRESH_SECRET=supersecretlongrefreshsecretkey32charactersmin!
SEB_LINK_SECRET=supersecretlongseblinksecretkey32charactersmin!
PUBLIC_ORIGIN=https://proctornet.duckdns.org
SEB_MODE=enforce
S3_BUCKET=proctornet-test-bucket
AWS_REGION=ap-south-1
REDIS_URL=redis://localhost:6379
FEATURE_AI_GENERATION=true
`
      fs.writeFileSync(tempEnvPath, envContent.trim(), 'utf8')
      const result = preflightEnv(tempEnvPath, { isProduction: true })

      assert.equal(result.valid, false)
      const hasAiError = result.errors.some(e => e.includes('neither GEMINI_API_KEY nor OPENAI_API_KEY is configured'))
      assert.equal(hasAiError, true)
    })
  })
})
