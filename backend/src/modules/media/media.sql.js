const { prisma } = require('../../infra/postgres/client')

async function getUserReferencePhotoKey(userId) {
  if (!userId) return null
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referencePhotoKey: true }
  })
  return user?.referencePhotoKey || null
}

async function getStudentReferencePhotoByAttempt(attemptId) {
  if (!attemptId) return null
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      studentId: true,
      student: {
        select: {
          id: true,
          referencePhotoKey: true
        }
      }
    }
  })
  if (!attempt || !attempt.student) return null
  return {
    studentId: attempt.student.id,
    referencePhotoS3Key: attempt.student.referencePhotoKey,
    referencePhotoKey: attempt.student.referencePhotoKey
  }
}

module.exports = {
  getUserReferencePhotoKey,
  getStudentReferencePhotoByAttempt
}
