/**
 * Result Service
 * Handles calculation, retrieval, and CSV formatting of exam results and cheat analytics.
 */

async function listResultsForExam({ examId, facultyId }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found or access denied.')
    error.status = 404
    throw error
  }

  const results = await global.prisma.examResult.findMany({
    where: { examId },
    include: {
      studentExam: {
        include: {
          student: { select: { id: true, name: true, usn: true, email: true, department: true } },
          evidenceLogs: true,
          answers: {
            include: { question: true }
          }
        }
      }
    },
    orderBy: { totalScore: 'desc' }
  })

  return results
}

async function listAllResultsForFaculty(facultyId) {
  const results = await global.prisma.examResult.findMany({
    where: { exam: { facultyId } },
    include: {
      exam: { select: { id: true, title: true, subject: true, totalMarks: true } },
      studentExam: {
        include: {
          student: { select: { id: true, name: true, usn: true, email: true } }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  return results
}

async function getDetailedStudentResult({ examId, studentId, facultyId }) {
  const studentExam = await global.prisma.studentExam.findFirst({
    where: { examId, studentId, exam: { facultyId } },
    include: {
      student: true,
      exam: true,
      results: true,
      answers: {
        include: { question: true }
      },
      evidenceLogs: { orderBy: { timestamp: 'desc' } }
    }
  })

  if (!studentExam) {
    const error = new Error('Student exam result not found.')
    error.status = 404
    throw error
  }

  return studentExam
}

async function exportExamResultsToCSV({ examId, facultyId }) {
  const exam = await global.prisma.exam.findFirst({
    where: { id: examId, facultyId }
  })
  if (!exam) {
    const error = new Error('Exam not found.')
    error.status = 404
    throw error
  }

  const results = await global.prisma.examResult.findMany({
    where: { examId },
    include: {
      studentExam: {
        include: {
          student: { select: { name: true, usn: true, department: true } },
          evidenceLogs: { select: { severity: true, eventType: true } }
        }
      }
    },
    orderBy: { percentage: 'desc' }
  })

  let csv = 'Student Name,USN,Department,Score,Percentage,High Violations,Medium Violations,Low Violations,Proctor Status\n'

  results.forEach(r => {
    const student = r.studentExam?.student || {}
    const logs = r.studentExam?.evidenceLogs || []
    const highCount = logs.filter(l => l.severity === 'HIGH' || l.severity === 'CRITICAL').length
    const medCount = logs.filter(l => l.severity === 'MEDIUM').length
    const lowCount = logs.filter(l => l.severity === 'LOW').length

    let status = 'CLEAN'
    if (highCount > 2) status = 'HIGH_RISK_FLAGGED'
    else if (highCount > 0 || medCount > 3) status = 'SUSPICIOUS'

    const row = [
      `"${(student.name || 'Unknown').replace(/"/g, '""')}"`,
      `"${(student.usn || 'N/A').replace(/"/g, '""')}"`,
      `"${(student.department || 'N/A').replace(/"/g, '""')}"`,
      r.totalScore ?? r.score ?? 0,
      `${(r.percentage || 0).toFixed(1)}%`,
      highCount,
      medCount,
      lowCount,
      status
    ].join(',')

    csv += row + '\n'
  })

  return csv
}

module.exports = {
  listResultsForExam,
  listAllResultsForFaculty,
  getDetailedStudentResult,
  exportExamResultsToCSV
}
