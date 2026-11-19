'use strict'

/**
 * scripts/ops/ai-smoke.js
 * Manual smoke test for grounded AI generation against an invented protocol fixture.
 * Usage:
 *   node scripts/ops/ai-smoke.js [--real-key]
 */

const {
  generateExamQuestions,
  verifyVerbatimCitation,
  getAiProviderInfo
} = require('../../backend/src/modules/exams/ai.generator')

const INVENTED_FACTS = [
  '433.92 MHz',
  '128-bit quantum-resistant key rotation',
  'secondary parity rings',
  '15 milliseconds',
  'Omega-9',
  '2.45 and 2.48 microhenries'
]

const FIXTURE_PAGES = [
  {
    pageNumber: 1,
    text: 'The Zephyr-77B telemetry protocol operates at an exact carrier frequency of 433.92 MHz with 128-bit quantum-resistant key rotation every 450 seconds. Any frequency deviation outside 0.05% triggers immediate transmitter lockout.',
    wordCount: 30,
    isReadable: true
  },
  {
    pageNumber: 2,
    text: 'Buffer depletion triggers an immediate fallback to secondary parity rings within 15 milliseconds, guaranteeing zero dropped frames under 85% packet saturation.',
    wordCount: 22,
    isReadable: true
  },
  {
    pageNumber: 3,
    text: 'Calibration coefficient Omega-9 must remain strictly between 2.45 and 2.48 microhenries during thermal stabilization cycles.',
    wordCount: 16,
    isReadable: true
  }
]

async function runAiSmoke() {
  console.log('=== ProctorNet AI Grounded Generation Smoke Test ===\n')

  const providerInfo = getAiProviderInfo()
  console.log(`Active Provider: ${providerInfo.provider}`)
  console.log(`Active Model:    ${providerInfo.model}`)
  console.log(`Configured:      ${providerInfo.configured}`)
  console.log(`Is Production:   ${providerInfo.isProduction}\n`)

  const combinedText = FIXTURE_PAGES.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join('\n\n')

  console.log('Executing question generation with citation verification...')
  const result = await generateExamQuestions({
    topic: 'Zephyr-77B Telemetry Protocol',
    syllabusText: combinedText,
    pages: FIXTURE_PAGES,
    count: 3,
    difficulty: 'MEDIUM'
  })

  console.log(`\nGenerated ${result.questions.length} questions (source: ${result.source})`)
  if (result.honestyNote) {
    console.log(`Honesty Note: ${result.honestyNote}`)
  }

  let verifiedFactsFound = 0
  for (let i = 0; i < result.questions.length; i++) {
    const q = result.questions[i]
    console.log(`\n[Question ${i + 1}] (Page ${q.sourcePage})`)
    console.log(`Stem:    ${q.questionText}`)
    console.log(`Answer:  ${q.options[q.correctOptionIndex]}`)
    console.log(`Excerpt: "${q.supportingExcerpt}"`)

    const citationCheck = verifyVerbatimCitation(q, FIXTURE_PAGES)
    console.log(`Citation Valid: ${citationCheck.valid} ${citationCheck.valid ? '✓' : `(Reason: ${citationCheck.reason})`}`)

    const fullQuestionStr = `${q.questionText} ${q.options.join(' ')} ${q.supportingExcerpt}`
    const matchedFacts = INVENTED_FACTS.filter(fact => fullQuestionStr.includes(fact))
    if (matchedFacts.length > 0) {
      verifiedFactsFound++
      console.log(`Matched Invented Facts: ${matchedFacts.join(', ')} ✓`)
    }
  }

  console.log(`\n=== Smoke Summary ===`)
  console.log(`Total Accepted Questions: ${result.questions.length}`)
  console.log(`Questions with Invented Protocol Facts: ${verifiedFactsFound}/${result.questions.length}`)

  if (result.questions.length > 0 && verifiedFactsFound > 0) {
    console.log('\n✅ AI Grounded Generation Smoke Test PASSED')
    process.exit(0)
  } else {
    console.error('\n❌ Smoke test failed: No questions with grounded protocol facts were produced.')
    process.exit(1)
  }
}

runAiSmoke().catch(err => {
  console.error('\n❌ Fatal error in AI smoke test:', err.message)
  process.exit(1)
})
