require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function seedAdmin() {
  console.log('\n🌱 Seeding ProctorNet Admin account...\n')

  const email    = process.env.ADMIN_EMAIL    || 'admin@proctornet.com'
  const password = process.env.ADMIN_PASSWORD || 'Admin@123'
  const name     = process.env.ADMIN_NAME     || 'ProctorNet Admin'

  try {
    // Hash password
    const hashed = await bcrypt.hash(password, 12)

    // Upsert admin
    const admin = await prisma.admin.upsert({
      where: { email },
      update: { password: hashed },
      create: { name, email, password: hashed },
    })

    // Seed default platform settings
    const defaultSettings = [
      { key: 'face_match_threshold',      value: '0.80' },
      { key: 'reverify_interval_mins',    value: '10'   },
      { key: 'face_absence_warning_secs', value: '10'   },
      { key: 'face_absence_pause_secs',   value: '20'   },
      { key: 'collusion_threshold',       value: '0.85' },
      { key: 'vpn_enabled',               value: 'true' },
      { key: 'watermark_visible',         value: 'true' },
      { key: 'face_verify_enabled',       value: 'true' },
      { key: 'collusion_enabled',         value: 'true' },
    ]

    for (const setting of defaultSettings) {
      await prisma.platformSetting.upsert({
        where:  { key: setting.key },
        update: { value: setting.value },
        create: { key: setting.key, value: setting.value, updatedBy: admin.id },
      })
    }

    console.log('╔══════════════════════════════════════════╗')
    console.log('║   ✅  Admin Account Created Successfully  ║')
    console.log('╠══════════════════════════════════════════╣')
    console.log(`║  Name    : ${name.padEnd(30)} ║`)
    console.log(`║  Email   : ${email.padEnd(30)} ║`)
    console.log(`║  Password: ${password.padEnd(30)} ║`)
    console.log('╠══════════════════════════════════════════╣')
    console.log('║  ⚙️  Default platform settings seeded     ║')
    console.log('║  Login at: /admin/login                  ║')
    console.log('╚══════════════════════════════════════════╝')
    console.log('\n⚠️  Change the admin password after first login!\n')

  } catch (error) {
    console.error('❌ Seed failed:', error.message)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedAdmin()
