const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_question_single_correct 
    ON "QuestionOption" ("questionId") 
    WHERE "isCorrect" = true;
  `)
  console.log('Partial unique index idx_question_single_correct created successfully!')
  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Failed to create partial unique index:', err)
  process.exit(1)
})
