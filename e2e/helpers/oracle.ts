'use strict'

export interface QuestionData {
  id: string
  marks: number
  negativeMarks: number
  options: { id: string; isCorrect: boolean }[]
}

export interface StudentAnswer {
  questionId: string
  selectedOptionId: string | null
}

export interface OracleExpectedResult {
  score: number
  totalMarks: number
  percentage: number
  correctCount: number
  wrongCount: number
  unansweredCount: number
}

/**
 * Computes exact mathematical expected results from question bank and student selections (§4.4)
 */
export function computeExpectedResult(
  questions: QuestionData[],
  answers: StudentAnswer[]
): OracleExpectedResult {
  const answerMap = new Map(answers.map(a => [a.questionId, a.selectedOptionId]))
  let score = 0
  let totalMarks = 0
  let correctCount = 0
  let wrongCount = 0
  let unansweredCount = 0

  for (const q of questions) {
    totalMarks += q.marks
    const selectedOptionId = answerMap.get(q.id)

    if (!selectedOptionId) {
      unansweredCount++
      continue
    }

    const correctOption = q.options.find(o => o.isCorrect)
    if (correctOption && correctOption.id === selectedOptionId) {
      correctCount++
      score += q.marks
    } else {
      wrongCount++
      score -= (q.negativeMarks || 0)
    }
  }

  // Score cannot be negative
  score = Math.max(0, score)
  const percentage = totalMarks > 0 ? parseFloat(((score / totalMarks) * 100).toFixed(2)) : 0

  return {
    score,
    totalMarks,
    percentage,
    correctCount,
    wrongCount,
    unansweredCount
  }
}

/**
 * Computes dense ranks across candidate scores
 */
export function computeExpectedRanks(scores: { studentId: string; score: number }[]): Map<string, number> {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  const rankMap = new Map<string, number>()
  let currentRank = 1

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].score < sorted[i - 1].score) {
      currentRank = i + 1
    }
    rankMap.set(sorted[i].studentId, currentRank)
  }

  return rankMap
}
