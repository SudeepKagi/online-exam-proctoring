/**
 * Collusion Service
 * Detection of cross-candidate answer similarity and collusion patterns
 */

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

async function checkCollusionForExam(examId, threshold = 0.85) {
  const studentExams = await global.prisma.studentExam.findMany({
    where: {
      examId,
      status: { in: ['SUBMITTED', 'TERMINATED'] }
    },
    include: {
      student: true,
      answers: {
        include: {
          question: true
        }
      }
    }
  })

  if (studentExams.length < 2) {
    return {
      message: 'Not enough submissions to check collusion.',
      flags: []
    }
  }

  const flags = []

  for (let i = 0; i < studentExams.length; i++) {
    for (let j = i + 1; j < studentExams.length; j++) {
      const r1 = studentExams[i]
      const r2 = studentExams[j]

      let matches = 0
      const total = r1.answers.length

      if (total === 0) continue

      r1.answers.forEach(a1 => {
        const a2 = r2.answers.find(x => x.questionId === a1.questionId)
        if (!a2) return

        if (a1.question?.type === 'MCQ') {
          if (a1.selectedOption && a2.selectedOption && a1.selectedOption === a2.selectedOption) {
            matches++
          }
        } else {
          const ans1 = a1.codeAnswer || a1.writtenText || ''
          const ans2 = a2.codeAnswer || a2.writtenText || ''
          if (ans1.trim() && ans2.trim()) {
            const sim = calculateSimilarity(ans1, ans2)
            if (sim > threshold) matches++
          }
        }
      })

      const similarityIndex = matches / total
      if (similarityIndex > threshold) {
        flags.push({
          student1: r1.student,
          student2: r2.student,
          similarity: similarityIndex * 100,
          details: `High similarity detected across ${matches}/${total} questions.`
        })
      }
    }
  }

  return { flags }
}

module.exports = {
  editDistance,
  calculateSimilarity,
  checkCollusionForExam
}
