require('dotenv').config()
const bcrypt = require('bcryptjs')
const { assertNonProduction } = require('../../src/infra/postgres/assertNonProduction')
assertNonProduction('prisma/seed/admin.js')
const { prisma } = require('../../src/infra/postgres/client')

async function seedAdmin() {
  console.log('\n🌱 Running ProctorNet Consolidated Core Seed Baseline...\n')

  try {
    const email = process.env.ADMIN_EMAIL || 'admin@proctornet.com'
    const password = process.env.ADMIN_PASSWORD || 'Admin@12345'
    const fullName = process.env.ADMIN_NAME || 'System Administrator'
    const hashed = await bcrypt.hash(password, 12)

    const admin = await prisma.user.upsert({
      where: { email },
      update: { fullName, passwordHash: hashed, role: 'ADMIN', status: 'ACTIVE', institutionId: 'ADMIN-001' },
      create: { fullName, email, passwordHash: hashed, role: 'ADMIN', status: 'ACTIVE', institutionId: 'ADMIN-001' }
    })

    console.log(`✅ Admin user seeded idempotently: ${admin.email} (ID: ${admin.id})`)
  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { seedAdmin }
