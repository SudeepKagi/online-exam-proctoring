const fs = require('fs')
const path = require('path')

const schemaPath = path.resolve(__dirname, '../../proctornet/backend/prisma/schema.prisma')
let content = fs.readFileSync(schemaPath, 'utf8')

// 1. Remove TIMED_OUT from AttemptStatus enum
content = content.replace(
  /enum AttemptStatus\s*\{[\s\S]*?\}/,
  `enum AttemptStatus {
  READY
  ACTIVE
  SUBMITTED
  SUSPENDED
  TERMINATED
  EXPIRED
}`
)

// 2. Replace all DateTime with DateTime @db.Timestamptz(3) if not already
// Note: handle DateTime? and DateTime
const lines = content.split('\n')
const updatedLines = lines.map(line => {
  // If line defines a field with DateTime
  if (line.match(/\bDateTime(\?)?\b/) && !line.includes('@db.Timestamptz')) {
    // Append @db.Timestamptz(3) after DateTime or DateTime?
    return line.replace(/(\bDateTime\??)/, '$1 @db.Timestamptz(3)')
  }
  return line
})
content = updatedLines.join('\n')

// 3. Replace @default(uuid()) with @default(dbgenerated("gen_random_uuid()")) on UUID PKs
content = content.replace(/@default\(uuid\(\)\)\s*@db\.Uuid/g, '@default(dbgenerated("gen_random_uuid()")) @db.Uuid')

// 4. Ensure AttemptQuestion has @@unique([attemptId, id])
if (!content.includes('@@unique([attemptId, id]')) {
  content = content.replace(
    /@@unique\(\[attemptId, questionId\]\)/,
    `@@unique([attemptId, questionId])\n  @@unique([attemptId, id], map: "idx_attempt_questions_attempt_id_id")`
  )
}

// 5. Ensure Answer ties attemptId and attemptQuestionId via composite relation, and has index on attemptId
if (!content.includes('@@index([attemptId], map: "idx_answers_attempt_id")')) {
  content = content.replace(
    /attemptQuestion\s+AttemptQuestion\s+@relation\(fields:\s*\[attemptQuestionId\],\s*references:\s*\[id\],\s*onDelete:\s*Cascade\)/,
    `attemptQuestion   AttemptQuestion @relation(fields: [attemptId, attemptQuestionId], references: [attemptId, id], onDelete: Cascade)`
  )
  content = content.replace(
    /@@map\("answers"\)/,
    `@@unique([attemptId, attemptQuestionId])\n  @@index([attemptId], map: "idx_answers_attempt_id")\n  @@map("answers")`
  )
}

// 6. Update IdempotencyKey to composite scoped PK
content = content.replace(
  /model IdempotencyKey\s*\{[\s\S]*?@@map\("idempotency_keys"\)\s*\}/,
  `model IdempotencyKey {
  scope          String   @default("global") @db.VarChar(64)
  key            String
  requestHash    String   @map("request_hash")
  responseStatus Int      @map("response_status")
  responseBody   Json     @map("response_body")
  expiresAt      DateTime @map("expires_at") @db.Timestamptz(3)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  @@id([scope, key])
  @@map("idempotency_keys")
}`
)

fs.writeFileSync(schemaPath, content, 'utf8')
console.log('Successfully updated schema.prisma for Q1 invariants!')
