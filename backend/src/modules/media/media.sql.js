const { prisma } = require('../../infra/postgres/client')

async function getUserReferencePhotoKey(userId) {
  if (!userId) return null
  return prisma.user.findUnique({
    where: { id: userId },
    select: { referencePhotoKey: true, profileMetadata: true }
  })
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
          referencePhotoKey: true,
          profileMetadata: true
        }
      }
    }
  })
  if (!attempt || !attempt.student) return null
  return {
    studentId: attempt.student.id,
    referencePhotoKey: attempt.student.referencePhotoKey,
    referencePhotoS3Key: attempt.student.referencePhotoKey,
    profileMetadata: attempt.student.profileMetadata
  }
}

module.exports = {
  getUserReferencePhotoKey,
  getStudentReferencePhotoByAttempt
}
