require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    await prisma.$connect()
    console.log('Connected to PostgreSQL database.')

    // Fetch all public tables
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `

    console.log(`Found ${tables.length} tables in public schema:`, tables.map(t => t.tablename))

    for (const { tablename } of tables) {
      console.log(`Enabling RLS on "${tablename}"...`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "${tablename}" ENABLE ROW LEVEL SECURITY;`)
    }

    console.log('✅ Successfully enabled Row Level Security (RLS) on all public tables!')
  } catch (err) {
    console.error('❌ Error enabling RLS:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
