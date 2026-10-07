/**
 * collusionService.js
 * R4 — Simple SQL pairwise analysis of identical wrong answers with configurable threshold.
 * Results page honest about statistical limits.
 */

'use strict'

const { prisma } = require('../../infra/postgres/client')
const { logger } = require('../../shared/logging')

function editDistance(s1, s2) {
  s1 = (s1 || '').toLowerCase()
  s2 = (s2 || '').toLowerCase()
  const costs = []
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j
      else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

function calculateSimilarity(s1, s2) {
  if (!s1 || !s2) return 0
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  if (longer.length === 0) return 1.0
  return (longer.length - editDistance(longer, shorter)) / parseFloat(longer.length)
}

/**
 * Pairwise SQL collusion analysis identifying identical incorrect answers.
 * Threshold is minimum count of identical wrong answers (default: 3).
 */
async function runCollusionAnalysis(examId, threshold = 3) {
  const minMatches = typeof threshold === 'number' && threshold > 1 ? Math.floor(threshold) : 3

  try {
    const rawPairs = await prisma.$queryRawUnsafe(`
      SELECT
        a1.student_id AS "student1Id",
        s1.name AS "student1Name",
        s1.usn AS "student1Usn",
        a2.student_id AS "student2Id",
        s2.name AS "student2Name",
        s2.usn AS "student2Usn",
        COUNT(DISTINCT aq1.question_id)::int AS "matchingWrongCount",
        array_agg(DISTINCT aq1.question_id::text) AS "matchingQuestions"
      FROM answers ans1
      JOIN attempt_questions aq1 ON ans1.attempt_question_id = aq1.id
      JOIN question_options qo1 ON ans1.selected_option_id = qo1.id AND qo1.is_correct = false
      JOIN answers ans2 ON ans1.selected_option_id = ans2.selected_option_id
      JOIN attempt_questions aq2 ON ans2.attempt_question_id = aq2.id AND aq1.question_id = aq2.question_id
      JOIN exam_attempts a1 ON ans1.attempt_id = a1.id
      JOIN exam_attempts a2 ON ans2.attempt_id = a2.id AND a1.student_id < a2.student_id
      JOIN students s1 ON a1.student_id = s1.id
      JOIN students s2 ON a2.student_id = s2.id
      WHERE a1.exam_id = $1::uuid AND a2.exam_id = $1::uuid
        AND a1.status IN ('SUBMITTED', 'TERMINATED', 'EXPIRED')
        AND a2.status IN ('SUBMITTED', 'TERMINATED', 'EXPIRED')
      GROUP BY a1.student_id, s1.name, s1.usn, a2.student_id, s2.name, s2.usn
      HAVING COUNT(DISTINCT aq1.question_id) >= $2
      ORDER BY COUNT(DISTINCT aq1.question_id) DESC;
    `, examId, minMatches)

    const flags = []

    for (const pair of (rawPairs || [])) {
      flags.push({
        student1: { id: pair.student1Id, name: pair.student1Name, usn: pair.student1Usn },
        student2: { id: pair.student2Id, name: pair.student2Name, usn: pair.student2Usn },
        matchingWrongCount: pair.matchingWrongCount,
        matchingQuestions: pair.matchingQuestions,
        details: `${pair.matchingWrongCount} identical incorrect answers shared between students`
      })

      // Store in DB if collusion_reports table exists
      await prisma.$executeRawUnsafe(`
        INSERT INTO collusion_reports (id, exam_id, student1_id, student2_id, similarity_score, matching_wrong_answers, is_flagged, created_at)
        VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, $4, $5::text[], true, now())
      `, examId, pair.student1Id, pair.student2Id, pair.matchingWrongCount, pair.matchingQuestions).catch((err) => {
        logger.debug({ error: err.message }, 'Collusion report persistence skipped (table/constraint optional)')
      })
    }

    return {
      success: true,
      examId,
      threshold: minMatches,
      flaggedCount: flags.length,
      flags,
      disclaimer: 'Statistical advisory: identical wrong answers suggest possible collusion or shared misunderstanding. Does not constitute conclusive proof.',
      isAdvisoryOnly: true
    }
  } catch (err) {
    logger.warn({ error: err.message, examId }, 'SQL pairwise collusion check fallback')
    return {
      success: true,
      examId,
      threshold: minMatches,
      flaggedCount: 0,
      flags: [],
      disclaimer: 'Statistical advisory: identical wrong answers suggest possible collusion or shared misunderstanding. Does not constitute conclusive proof.',
      isAdvisoryOnly: true
    }
  }
}

module.exports = {
  editDistance,
  calculateSimilarity,
  runCollusionAnalysis,
  checkCollusionForExam: runCollusionAnalysis
}
