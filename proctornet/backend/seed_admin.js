require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('\n❌ ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in your .env file to seed the administrative user securely.')
    console.error('Please configure your .env file before seeding the database.\n')
    throw new Error('Missing ADMIN_EMAIL and ADMIN_PASSWORD environment variables.')
  }

  const hashed = await bcrypt.hash(password, 12)

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { password: hashed },
    create: { name: 'ProctorNet Admin', email, password: hashed },
  })

  console.log(`\n✅ Admin account ready:`)
  console.log(`   Email   : ${email}`)
  console.log(`   Password: (As configured in your .env file)`)
  console.log(`   ID      : ${admin.id}\n`)
}

main()
  .catch(e => { console.error('❌ Seed failed:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
