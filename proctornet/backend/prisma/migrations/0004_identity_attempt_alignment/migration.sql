-- AlterTable
ALTER TABLE "agent_rules" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "agent_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "status_reason" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "identity_verifications_attempt_id_key";

-- AlterTable
ALTER TABLE "identity_verifications" 
    ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'PRE_EXAM',
    ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'rekognition',
    ADD COLUMN IF NOT EXISTS "request_id" TEXT,
    ADD COLUMN IF NOT EXISTS "similarity" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "decision" TEXT NOT NULL DEFAULT 'PASS',
    ADD COLUMN IF NOT EXISTS "thresholds_used" JSONB,
    ADD COLUMN IF NOT EXISTS "model_version" TEXT,
    ADD COLUMN IF NOT EXISTS "evidence_keys" JSONB,
    ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "live_face_match_score" DROP NOT NULL,
    ALTER COLUMN "id_card_match_result" DROP NOT NULL,
    ALTER COLUMN "id_card_match_result" SET DEFAULT true,
    ALTER COLUMN "face_with_id_key" DROP NOT NULL,
    ALTER COLUMN "verified_at" DROP NOT NULL,
    ALTER COLUMN "status" DROP NOT NULL,
    ALTER COLUMN "status" SET DEFAULT 'VERIFIED';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_identity_verifications_attempt_id" ON "identity_verifications"("attempt_id");
