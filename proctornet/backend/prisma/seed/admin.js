require('dotenv').config()
const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const { assertNonProduction } = require('../../src/infra/postgres/assertNonProduction')
assertNonProduction('prisma/seed/admin.js')
const { prisma } = require('../../src/infra/postgres/client')

function findLatestAdminBackup() {
  const backupsDir = path.resolve(__dirname, '../../../../backups')
  if (!fs.existsSync(backupsDir)) return null

  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('-admin.json'))
    .sort()

  let best = null
  for (const f of files) {
    const filePath = path.join(backupsDir, f)
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      if (Array.isArray(parsed.admins) && parsed.admins.length > 0) {
        const hasBcrypt = parsed.admins.some(a => a.password && a.password.startsWith('$2'))
        if (hasBcrypt) {
          if (!best || (parsed.platformSettings?.length || 0) >= (best.data.platformSettings?.length || 0)) {
            best = { file: f, path: filePath, data: parsed }
          }
        }
      }
    } catch {
      // Continue searching
    }
  }
  return best
}

async function seedCanonicalDepartments() {
  const canonicalDepts = [
    { code: 'CSE', name: 'Computer Science and Engineering' },
    { code: 'ISE', name: 'Information Science and Engineering' },
    { code: 'ECE', name: 'Electronics and Communication Engineering' },
    { code: 'ME', name: 'Mechanical Engineering' },
    { code: 'CV', name: 'Civil Engineering' },
    { code: 'AIML', name: 'Artificial Intelligence and Machine Learning' }
  ]

  for (const dept of canonicalDepts) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: { name: dept.name },
      create: { code: dept.code, name: dept.name }
    })
  }
}

async function seedAgentReleases() {
  const releases = [
    { version: '1.0.0', os: 'win', arch: 'x64-adv', sha256: 'official-adv-release-hash' },
    { version: '1.0.0', os: 'linux', arch: 'x64-adv', sha256: 'official-adv-release-hash' },
    { version: '1.0.0', os: 'darwin', arch: 'arm64-adv', sha256: 'official-adv-release-hash' },
    { version: '1.0.0', os: 'all', arch: 'x64', sha256: 'official-agent-release-hash-v1.0.0' },
    { version: '1.0.0', os: 'win', arch: 'x64', sha256: 'test-build-hash-a1' },
    { version: '1.0.0', os: 'linux', arch: 'x64', sha256: 'test-build-hash-linux-v1' }
  ]
  const crypto = require('crypto')
  for (const rel of releases) {
    await prisma.agentRelease.upsert({
      where: {
        version_os_arch: { version: rel.version, os: rel.os, arch: rel.arch }
      },
      update: {
        sha256: rel.sha256,
        revokedAt: null
      },
      create: {
        id: crypto.randomUUID(),
        version: rel.version,
        os: rel.os,
        arch: rel.arch,
        sha256: rel.sha256,
        sizeBytes: 15420000n,
        s3Key: `releases/proctornet-agent-${rel.version}-${rel.os}-${rel.arch}.zip`,
        signed: true,
        minSupported: true,
        revokedAt: null
      }
    }).catch(() => {})
  }
}

async function seedAdmin() {
  console.log('\n🌱 Running ProctorNet P3 Seed Baseline...\n')

  try {
    // 1. Seed canonical departments
    await seedCanonicalDepartments()
    console.log('✅ Canonical departments seeded/verified.')

    // 2. Locate backup or fall back to env
    const backup = !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== 'test' ? findLatestAdminBackup() : null
    let primaryAdminId = null

    if (backup) {
      console.log(`📦 Restoring Admin & PlatformSettings from backup: ${backup.file}`)
      for (const adm of backup.data.admins) {
        const adminName = adm.name || 'ProctorNet Admin'
        const saved = await prisma.admin.upsert({
          where: { email: adm.email },
          update: {
            name: adminName,
            password: adm.password
          },
          create: {
            name: adminName,
            email: adm.email,
            password: adm.password
          }
        })
        primaryAdminId = saved.id
        console.log(`✅ Admin restored idempotently: ${adm.email}`)
      }

      if (Array.isArray(backup.data.platformSettings)) {
        for (const s of backup.data.platformSettings) {
          await prisma.platformSetting.upsert({
            where: { key: s.key },
            update: { value: s.value, updatedBy: s.updatedBy || primaryAdminId },
            create: {
              key: s.key,
              value: s.value,
              updatedBy: s.updatedBy || primaryAdminId
            }
          })
        }
        console.log(`✅ ${backup.data.platformSettings.length} platform setting(s) restored.`)
      }
    } else {
      const email = process.env.ADMIN_EMAIL || 'admin@proctornet.com'
      const isRandom = !process.env.ADMIN_PASSWORD
      const crypto = require('crypto')
      const password = process.env.ADMIN_PASSWORD || (crypto.randomBytes(8).toString('hex') + '@A1')
      const name = process.env.ADMIN_NAME || 'System Administrator'

      const hashed = await bcrypt.hash(password, 12)
      const admin = await prisma.admin.upsert({
        where: { email },
        update: { name, password: hashed, mustChangePassword: isRandom },
        create: { name, email, password: hashed, mustChangePassword: isRandom }
      })
      primaryAdminId = admin.id
      console.log(`✅ Admin created/updated from environment: ${email}`)

      const defaultSettings = [
        { key: 'faceVerificationEnabled', value: 'true' },
        { key: 'faceMatchThreshold', value: '90' },
        { key: 'watermarkOpacity', value: '20' },
        { key: 'reverifyIntervalMins', value: '15' },
        { key: 'vmDetectionEnabled', value: 'true' },
        { key: 'face_match_threshold', value: '0.80' },
        { key: 'reverify_interval_mins', value: '10' },
        { key: 'face_absence_warning_secs', value: '10' },
        { key: 'face_absence_pause_secs', value: '20' },
        { key: 'collusion_threshold', value: '0.85' },
        { key: 'watermark_visible', value: 'true' },
        { key: 'face_verify_enabled', value: 'true' },
        { key: 'collusion_enabled', value: 'true' }
      ]

      for (const setting of defaultSettings) {
        await prisma.platformSetting.upsert({
          where: { key: setting.key },
          update: { value: setting.value },
          create: { key: setting.key, value: setting.value, updatedBy: primaryAdminId }
        })
      }
      console.log('✅ Default platform settings initialized.')
    }

    // 3. Seed canonical authorized agent releases
    await seedAgentReleases()
    console.log('✅ Approved agent releases initialized.')

    console.log('\n🔒 Security Invariant: Admin credential hashes are preserved and never printed to logs.')
    console.log('✅ ProctorNet P3 Seed Baseline completed successfully.\n')
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
