const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const cwd = path.resolve(__dirname, '../../proctornet/backend')
const diff = execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', { cwd }).toString()

const header = `-- =============================================================
-- ProctorNet Canonical Migration Baseline (Q1)
-- =============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

`

const footer = `

-- =============================================================
-- P3 Custom Indexes (Partial, GIN, Composite)
-- =============================================================

-- Partial unique index: Single correct option per question
CREATE UNIQUE INDEX IF NOT EXISTS "idx_question_single_correct" ON "question_options" ("question_id") WHERE "is_correct" = true;

-- Partial index: Active attempt expiry sweeper
CREATE INDEX IF NOT EXISTS "idx_exam_attempts_active_expiry" ON "exam_attempts" ("status", "expires_at") WHERE "status" = 'ACTIVE';

-- Partial index: Pending violation evidence upload sweeper
CREATE INDEX IF NOT EXISTS "idx_violation_events_pending" ON "violation_events" ("evidence_status") WHERE "evidence_status" = 'PENDING';

-- Partial index: Pending outbox events queue
CREATE INDEX IF NOT EXISTS "idx_outbox_events_pending" ON "outbox_events" ("next_attempt_at", "id") WHERE "status" = 'PENDING';

-- =============================================================
-- Domain CHECK Constraints
-- =============================================================
ALTER TABLE "questions" ADD CONSTRAINT "chk_questions_marks_positive" CHECK ("marks" > 0);
ALTER TABLE "questions" ADD CONSTRAINT "chk_questions_negative_marks_bound" CHECK ("negative_marks" >= 0 AND "negative_marks" <= "marks");
ALTER TABLE "questions" ADD CONSTRAINT "chk_questions_text_length" CHECK (char_length("question_text") > 0 AND char_length("question_text") <= 5000);

ALTER TABLE "question_options" ADD CONSTRAINT "chk_question_options_text_length" CHECK (char_length("text") > 0 AND char_length("text") <= 500);

ALTER TABLE "exam_attempts" ADD CONSTRAINT "chk_attempt_expiry_after_start" CHECK ("expires_at" IS NULL OR "started_at" IS NULL OR "expires_at" >= "started_at");

-- =============================================================
-- Table Storage Parameters & Aggressive Autovacuum (HOT Updates)
-- =============================================================
ALTER TABLE "answers" SET (fillfactor = 80, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE "exam_attempts" SET (fillfactor = 80, autovacuum_vacuum_scale_factor = 0.02, autovacuum_analyze_scale_factor = 0.02);
`

const targetFile = path.resolve(cwd, 'prisma/migrations/0001_init/migration.sql')
const fullContent = header + diff + footer
fs.writeFileSync(targetFile, fullContent, 'utf8')
console.log('Successfully wrote canonical migration to:', targetFile, 'size:', fullContent.length)
