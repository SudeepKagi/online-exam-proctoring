const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'faculty@proctornet.com'
  const password = 'Faculty@2026'
  const hashed = await bcrypt.hash(password, 12)

  // Check if exists
  const existing = await prisma.faculty.findUnique({ where: { email } })

  if (existing) {
    // Just update password and ensure approved
    await prisma.faculty.update({
      where: { email },
      data: { password: hashed, isApproved: true, isSuspended: false }
    })
    console.log('\n✅ Faculty account updated:')
  } else {
    // Create new
    await prisma.faculty.create({
      data: {
        name: 'Demo Faculty',
        email,
        password: hashed,
        department: 'Computer Science',
        employeeId: 'EMP001',
        isApproved: true,
        isSuspended: false,
      }
    })
    console.log('\n✅ Faculty account created:')
  }

  console.log(`   Email      : ${email}`)
  console.log(`   Password   : ${password}`)
  console.log(`   Department : Computer Science`)
  console.log(`   Employee ID: EMP001`)
  console.log(`   Status     : Approved\n`)
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
