const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function resetAdmin() {
  const email = 'admin@proctornet.com'
  const password = 'Admin@123'
  const hashed = await bcrypt.hash(password, 12)
  
  await prisma.admin.upsert({
    where: { email },
    update: { password: hashed },
    create: { name: 'ProctorNet Admin', email, password: hashed }
  })
  
  console.log(`Admin ${email} updated with password ${password}`)
  await prisma.$disconnect()
}

resetAdmin()
