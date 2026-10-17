const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fc = require('fast-check')
const { prisma } = require('../src/infra/postgres/client')

/**
 * Reference JS Grader implementation
 */
function referenceGrade(questions, answers, exam) {
  let correctCount = 0
  let wrongCount = 0
  let unansweredCount = 0
  let rawScore = 0
  let totalMarks = 0

  for (const q of questions) {
    totalMarks += q.marks
    const selected = answers[q.id]

    if (!selected) {
      unansweredCount++
    } else if (selected === q.correctOptionId) {
      correctCount++
      rawScore += q.marks
    } else {
      wrongCount++
      if (exam.negativeMarking) {
        const neg = q.negativeMarks > 0 ? q.negativeMarks : (exam.negativeValue || 0)
        rawScore -= neg
      }
    }
  }

  const score = Math.max(0, rawScore)
  const percentage = totalMarks > 0 ? Math.round(((score / totalMarks) * 100) * 100) / 100 : 0

  return {
    score,
    totalMarks,
    correctCount,
    wrongCount,
    unansweredCount,
    percentage
  }
}

describe('P4 Task 9 — Property-Based Grading Test (fast-check)', () => {
  it('SQL set-based grading logic matches reference JS grader across arbitrary answer profiles', async () => {
    // Run property-based check across 50 randomly generated exams and answer sets
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          negativeMarking: fc.boolean(),
          negativeValue: fc.integer({ min: 0, max: 2 }),
          questions: fc.array(
            fc.record({
              id: fc.uuid(),
              marks: fc.integer({ min: 1, max: 10 }),
              negativeMarks: fc.integer({ min: 0, max: 2 }),
              correctOptionId: fc.uuid(),
              wrongOptionId: fc.uuid(),
              studentChoice: fc.constantFrom('CORRECT', 'WRONG', 'UNANSWERED')
            }),
            { minLength: 1, maxLength: 10 }
          )
        }),
        async (scenario) => {
          const exam = {
            negativeMarking: scenario.negativeMarking,
            negativeValue: scenario.negativeValue
          }

          const answerMap = {}
          const questionRows = []
          const answerRows = []

          for (const q of scenario.questions) {
            let selected = null
            if (q.studentChoice === 'CORRECT') {
              selected = q.correctOptionId
            } else if (q.studentChoice === 'WRONG') {
              selected = q.wrongOptionId
            }
            answerMap[q.id] = selected

            questionRows.push({
              id: q.id,
              marks: q.marks,
              negativeMarks: q.negativeMarks,
              correctOptionId: q.correctOptionId
            })

            answerRows.push({
              questionId: q.id,
              selectedOptionId: selected,
              isCorrect: selected === q.correctOptionId
            })
          }

          const jsResult = referenceGrade(scenario.questions, answerMap, exam)

          // Execute equivalent SQL query in PostgreSQL to test mathematical invariance
          const sql = `
            SELECT
              GREATEST(0, s.calculated_score) AS score,
              s.total_marks,
              s.correct_count,
              s.wrong_count,
              s.unanswered_count,
              CASE
                WHEN s.total_marks > 0 THEN ROUND((GREATEST(0, s.calculated_score)::numeric / s.total_marks::numeric) * 100, 2)::float
                ELSE 0
              END AS percentage
            FROM (
              SELECT
                $1::boolean AS negative_marking,
                COALESCE(SUM(u.marks), 0) AS total_marks,
                COUNT(u.id) FILTER (WHERE a.is_correct = true)::int AS correct_count,
                COUNT(u.id) FILTER (WHERE sel.selected_option_id IS NOT NULL AND a.is_correct = false)::int AS wrong_count,
                COUNT(u.id) FILTER (WHERE sel.selected_option_id IS NULL)::int AS unanswered_count,
                SUM(CASE
                  WHEN a.is_correct = true THEN u.marks
                  WHEN sel.selected_option_id IS NOT NULL AND a.is_correct = false AND $1::boolean = true
                    THEN -COALESCE(NULLIF(u.negative_marks, 0), $2::float, 0)
                  ELSE 0
                END) AS calculated_score
              FROM unnest(
                $3::text[],
                $4::float[],
                $5::float[]
              ) AS u(id, marks, negative_marks)
              LEFT JOIN unnest(
                $6::text[],
                $7::text[],
                $8::boolean[]
              ) AS a(question_id, raw_selected_id, is_correct) ON a.question_id = u.id
              CROSS JOIN LATERAL (SELECT NULLIF(a.raw_selected_id, '') AS selected_option_id) sel
            ) s;
          `

          const qIds = questionRows.map(q => q.id)
          const marks = questionRows.map(q => q.marks)
          const negMarks = questionRows.map(q => q.negativeMarks)
          const ansQIds = answerRows.map(a => a.questionId)
          const ansSel = answerRows.map(a => a.selectedOptionId ? String(a.selectedOptionId) : '')
          const ansIsCorrect = answerRows.map(a => Boolean(a.isCorrect))

          const rows = await prisma.$queryRawUnsafe(
            sql,
            exam.negativeMarking,
            exam.negativeValue,
            qIds,
            marks,
            negMarks,
            ansQIds,
            ansSel,
            ansIsCorrect
          )

          const sqlResult = rows[0]

          assert.equal(Number(sqlResult.correct_count), jsResult.correctCount, 'correct count mismatch')
          assert.equal(Number(sqlResult.wrong_count), jsResult.wrongCount, 'wrong count mismatch')
          assert.equal(Number(sqlResult.unanswered_count), jsResult.unansweredCount, 'unanswered count mismatch')
          assert.equal(Number(sqlResult.total_marks), jsResult.totalMarks, 'total marks mismatch')
          assert.equal(Number(sqlResult.score), jsResult.score, 'score mismatch')
          assert.equal(Number(sqlResult.percentage), jsResult.percentage, 'percentage mismatch')
        }
      ),
      { numRuns: 50 }
    )
  })
})
