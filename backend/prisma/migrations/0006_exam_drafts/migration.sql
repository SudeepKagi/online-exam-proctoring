-- Migration 0006: Add ExamDraft (one draft per creator; strictly additive)

CREATE TABLE IF NOT EXISTS "exam_drafts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creator_id" UUID NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_drafts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "exam_drafts_creator_id_key" UNIQUE ("creator_id"),
    CONSTRAINT "exam_drafts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "exam_drafts_creator_id_idx" ON "exam_drafts"("creator_id");
