-- Migration 0007: Additive Proctoring Redesign fields (Strictly Additive)

-- Add additive columns to exam_attempts
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "face_photo_key" TEXT;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "face_status" TEXT NOT NULL DEFAULT 'NOT_VERIFIED';
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "similarity_bucket" TEXT;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "face_verified_at" TIMESTAMPTZ(3);
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "invigilator_approved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "invigilator_approved_by_id" UUID;
ALTER TABLE "exam_attempts" ADD COLUMN IF NOT EXISTS "invigilator_approved_at" TIMESTAMPTZ(3);

-- Add Foreign Key for invigilator_approved_by_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_attempts_invigilator_approved_by_id_fkey'
  ) THEN
    ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_invigilator_approved_by_id_fkey"
      FOREIGN KEY ("invigilator_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add index on face_status
CREATE INDEX IF NOT EXISTS "exam_attempts_face_status_idx" ON "exam_attempts"("face_status");
