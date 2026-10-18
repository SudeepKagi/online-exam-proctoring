const { prisma } = require('../../infra/postgres/client')

function mapUserRecord(user) {
  if (!user) return null
  return {
    ...user,
    password: user.passwordHash,
    name: user.fullName,
    isActive: user.status === 'ACTIVE',
    referencePhotoS3Key: user.referencePhotoKey,
    usn: user.institutionId,
    idCardPhotoKey: user.idCardPhotoKey,
    profileMetadata: user.profileMetadata || {}
  }
}

async function findUserByEmail(identifier) {
  if (!identifier) return null
  const clean = identifier.toLowerCase().trim()
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: clean },
        { institutionId: identifier.trim() },
        { institutionId: { equals: identifier.trim(), mode: 'insensitive' } }
      ]
    }
  })
  return mapUserRecord(user)
}

async function findUserById(id) {
  if (!id) return null
  const user = await prisma.user.findUnique({
    where: { id }
  })
  return mapUserRecord(user)
}

async function createUser({ email, password, name, fullName, role, referencePhotoKey, referencePhotoS3Key, institutionId, usn, status = 'ACTIVE' }) {
  const cleanEmail = email.toLowerCase().trim()
  const cleanName = (fullName || name || '').trim()
  const user = await prisma.user.create({
    data: {
      email: cleanEmail,
      passwordHash: password,
      fullName: cleanName,
      role: String(role).toUpperCase(),
      referencePhotoKey: referencePhotoKey || referencePhotoS3Key || null,
      institutionId: institutionId || usn || null,
      status: status || 'ACTIVE'
    }
  })
  return mapUserRecord(user)
}

async function updateUserProfile(id, data) {
  const updateData = {}
  if (data.passwordHash) updateData.passwordHash = data.passwordHash
  if (data.status) updateData.status = data.status
  if (data.referencePhotoKey !== undefined) updateData.referencePhotoKey = data.referencePhotoKey
  if (data.idCardPhotoKey !== undefined) updateData.idCardPhotoKey = data.idCardPhotoKey
  if (data.profileMetadata !== undefined) updateData.profileMetadata = data.profileMetadata
  if (data.fullName) updateData.fullName = data.fullName
  if (data.institutionId) updateData.institutionId = data.institutionId

  const user = await prisma.user.update({
    where: { id },
    data: updateData
  })
  return mapUserRecord(user)
}

async function listUsersByRole(role) {
  const users = await prisma.user.findMany({
    where: { role: String(role).toUpperCase() },
    orderBy: { createdAt: 'desc' }
  })
  return users.map(mapUserRecord)
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateUserProfile,
  listUsersByRole
}
