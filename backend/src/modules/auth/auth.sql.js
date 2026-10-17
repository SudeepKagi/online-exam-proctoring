const { prisma } = require('../../infra/postgres/client')

async function findUserByEmail(email) {
  if (!email) return null
  const cleanEmail = email.toLowerCase().trim()
  const result = await prisma.$queryRaw`
    SELECT id, email, password, name, role, 
           reference_photo_s3_key AS "referencePhotoS3Key", 
           is_active AS "isActive", 
           created_at AS "createdAt", 
           updated_at AS "updatedAt"
    FROM users
    WHERE LOWER(email) = ${cleanEmail}
    LIMIT 1;
  `
  return result[0] || null
}

async function findUserById(id) {
  if (!id) return null
  const result = await prisma.$queryRaw`
    SELECT id, email, password, name, role, 
           reference_photo_s3_key AS "referencePhotoS3Key", 
           is_active AS "isActive", 
           created_at AS "createdAt", 
           updated_at AS "updatedAt"
    FROM users
    WHERE id = ${id}::uuid
    LIMIT 1;
  `
  return result[0] || null
}

async function createUser({ email, password, name, role, referencePhotoS3Key = null }) {
  const cleanEmail = email.toLowerCase().trim()
  const cleanName = name.trim()
  const result = await prisma.$queryRaw`
    INSERT INTO users (email, password, name, role, reference_photo_s3_key, is_active, created_at, updated_at)
    VALUES (${cleanEmail}, ${password}, ${cleanName}, ${role}::"Role", ${referencePhotoS3Key}, true, NOW(), NOW())
    RETURNING id, email, name, role, 
              reference_photo_s3_key AS "referencePhotoS3Key", 
              is_active AS "isActive", 
              created_at AS "createdAt", 
              updated_at AS "updatedAt";
  `
  return result[0]
}

async function listUsersByRole(role) {
  return prisma.$queryRaw`
    SELECT id, email, name, role, 
           reference_photo_s3_key AS "referencePhotoS3Key", 
           is_active AS "isActive", 
           created_at AS "createdAt"
    FROM users
    WHERE role = ${role}::"Role"
    ORDER BY created_at DESC;
  `
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  listUsersByRole
}
