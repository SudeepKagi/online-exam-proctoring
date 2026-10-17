'use strict'

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { assertNonProduction } = require('../../src/infra/postgres/assertNonProduction')
assertNonProduction('prisma/seed/admin.js')
const { prisma } = require('../../src/infra/postgres/client')

async function seed() {
  console.log('\n🌱 Running ProctorNet Consolidated 7-Table Seed Baseline...\n')

  try {
    const passwordHash = await bcrypt.hash('Password@12345', 10)
    const adminHash = await bcrypt.hash('Admin@12345', 10)

    const usersToSeed = [
      {
        email: 'admin@proctornet.com',
        fullName: 'System Administrator',
        role: 'ADMIN',
        status: 'ACTIVE',
        institutionId: 'ADMIN-001',
        passwordHash: adminHash
      },
      {
        email: 'faculty@proctornet.com',
        fullName: 'Prof. Alan Turing',
        role: 'FACULTY',
        status: 'ACTIVE',
        institutionId: 'FACULTY-001',
        passwordHash: passwordHash
      },
      {
        email: 'invigilator@proctornet.com',
        fullName: 'Chief Invigilator Grace',
        role: 'INVIGILATOR',
        status: 'ACTIVE',
        institutionId: 'INV-001',
        passwordHash: passwordHash
      },
      {
        email: 'student1@proctornet.com',
        fullName: 'Alice Johnson',
        role: 'STUDENT',
        status: 'ACTIVE',
        institutionId: 'USN-001',
        passwordHash: passwordHash
      },
      {
        email: 'student2@proctornet.com',
        fullName: 'Bob Smith',
        role: 'STUDENT',
        status: 'ACTIVE',
        institutionId: 'USN-002',
        passwordHash: passwordHash
      }
    ]

    for (const u of usersToSeed) {
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          fullName: u.fullName,
          passwordHash: u.passwordHash,
          role: u.role,
          status: u.status,
          institutionId: u.institutionId
        },
        create: u
      })
      console.log(`✅ Seeded user [${user.role}]: ${user.email} (${user.fullName})`)
    }

    console.log('\n✨ Database seeding completed successfully!\n')
  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

module.exports = { seedAdmin: seed, seed }
