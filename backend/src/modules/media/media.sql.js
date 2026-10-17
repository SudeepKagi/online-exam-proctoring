const { prisma } = require('../../infra/postgres/client')

async function getUserReferencePhotoKey(userId) {
  const result = await prisma.$queryRaw`
    SELECT id::text, reference_photo_s3_key AS "referencePhotoS3Key"
    FROM users
    WHERE id = ${userId}::uuid
    LIMIT 1;
  `
  return result[0]?.referencePhotoS3Key || null
}

async function getStudentReferencePhotoByAttempt(attemptId) {
  const result = await prisma.$queryRaw`
    SELECT u.id::text AS "studentId", u.reference_photo_s3_key AS "referencePhotoS3Key"
    FROM exam_attempts ea
    JOIN users u ON ea.student_id = u.id
    WHERE ea.id = ${attemptId}::uuid
    LIMIT 1;
  `
  return result[0] || null
}

module.exports = {
  getUserReferencePhotoKey,
  getStudentReferencePhotoByAttempt
}
