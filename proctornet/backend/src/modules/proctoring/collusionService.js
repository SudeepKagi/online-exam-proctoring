/**
 * Collusion Detection Service (Ported to modular architecture)
 * Calculates textual similarity, edit distance, and cross-student answer collusion
 */
const { prisma } = require('../../infra/postgres/client')

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

async function runCollusionAnalysis(examId, threshold = 0.85) {
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      status: { in: ['SUBMITTED', 'TERMINATED', 'EXPIRED'] }
    },
    include: {
      student: { select: { id: true, name: true, usn: true } },
      answers: true
    }
  })

  if (attempts.length < 2) {
    return {
      message: 'Not enough submissions to check collusion.',
      flags: []
    }
  }

  const flags = []

  for (let i = 0; i < attempts.length; i++) {
    for (let j = i + 1; j < attempts.length; j++) {
      const a1 = attempts[i]
      const a2 = attempts[j]

      let matches = 0
      const total = a1.answers.length

      if (total === 0) continue

      a1.answers.forEach(ans1 => {
        const ans2 = a2.answers.find(x => x.questionId === ans1.questionId)
        if (!ans2) return

        if (ans1.selectedOption && ans2.selectedOption && ans1.selectedOption === ans2.selectedOption) {
          matches++
        }
      })

      const similarityIndex = matches / total
      if (similarityIndex >= threshold) {
        flags.push({
          student1: a1.student,
          student2: a2.student,
          similarity: Math.round(similarityIndex * 100),
          commonQuestionsCount: matches,
          totalQuestionsCount: total,
          details: `High similarity detected across ${matches}/${total} questions.`
        })

        // Save report to DB if table exists
        await prisma.collusionReport.create({
          data: {
            examId,
            student1Id: a1.studentId,
            student2Id: a2.studentId,
            similarityScore: similarityIndex,
            commonQuestions: a1.answers.map(a => a.questionId),
            matchingWrongAnswers: [],
            isFlagged: true
          }
        }).catch(() => {})
      }
    }
  }

  return { flags }
}

module.exports = {
  editDistance,
  calculateSimilarity,
  runCollusionAnalysis,
  checkCollusionForExam: runCollusionAnalysis
}
