try {
  const path = require('path')
  // Inject backend node_modules to search paths so that dependencies are resolved correctly when run from root
  module.paths.push(path.resolve(__dirname, 'backend/node_modules'))
  module.paths.push(path.resolve(__dirname, 'node_modules'))
  require('dotenv').config({ path: path.resolve(__dirname, 'backend/.env') })
} catch (e) {
  console.warn("⚠️ Warning: dotenv module initialization failed. Environment variables must be set manually.")
}
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function resetAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error('\n❌ ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in your .env file to reset the administrative user securely.')
    console.error('Please configure your .env file before running this reset script.\n')
    throw new Error('Missing ADMIN_EMAIL and ADMIN_PASSWORD environment variables.')
  }

  const hashed = await bcrypt.hash(password, 12)
  
  await prisma.admin.upsert({
    where: { email },
    update: { password: hashed },
    create: { name: 'ProctorNet Admin', email, password: hashed }
  })
  
  console.log(`Admin ${email} updated dynamically via .env configuration.`)
  await prisma.$disconnect()
}

resetAdmin()
