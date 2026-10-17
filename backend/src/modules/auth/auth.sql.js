const { prisma } = require('../../infra/postgres/client')

function mapUserRecord(user) {
  if (!user) return null
  return {
    ...user,
    password: user.passwordHash,
    name: user.fullName,
    isActive: user.status === 'ACTIVE',
    referencePhotoS3Key: user.referencePhotoKey,
    usn: user.institutionId
  }
}

async function findUserByEmail(email) {
  if (!email) return null
  const cleanEmail = email.toLowerCase().trim()
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail }
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

async function createUser({ email, password, name, fullName, role, referencePhotoKey, referencePhotoS3Key, institutionId, usn }) {
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
      status: 'ACTIVE'
    }
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
  listUsersByRole
}
