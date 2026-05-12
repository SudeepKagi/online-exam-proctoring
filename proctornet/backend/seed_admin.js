const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = 'admin@proctornet.com'
  const password = 'Admin@2026'
  const hashed = await bcrypt.hash(password, 12)

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { password: hashed },
    create: { name: 'ProctorNet Admin', email, password: hashed },
  })

  console.log(`\n✅ Admin account ready:`)
  console.log(`   Email   : ${email}`)
  console.log(`   Password: ${password}`)
  console.log(`   ID      : ${admin.id}\n`)
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
