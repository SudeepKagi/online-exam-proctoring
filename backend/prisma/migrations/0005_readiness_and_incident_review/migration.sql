-- Migration 0005: Add Student Readiness Reports, Attempt Incident Review, and Student Consents (Strictly Additive)

-- 1. Create ReviewStatus Enum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED', 'CONFIRMED');

-- 2. Add Review Columns to exam_attempts
ALTER TABLE "exam_attempts" ADD COLUMN "review_status" "ReviewStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "exam_attempts" ADD COLUMN "review_notes" TEXT;
ALTER TABLE "exam_attempts" ADD COLUMN "reviewed_by_id" UUID;
ALTER TABLE "exam_attempts" ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);
ALTER TABLE "exam_attempts" ADD COLUMN "is_flagged" BOOLEAN NOT NULL DEFAULT false;

-- Add Foreign Key for reviewed_by_id
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_reviewed_by_id_fkey" 
  FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add Indexes on exam_attempts
CREATE INDEX "exam_attempts_review_status_idx" ON "exam_attempts"("review_status");
CREATE INDEX "exam_attempts_is_flagged_idx" ON "exam_attempts"("is_flagged");

-- 3. Create student_readiness_reports Table
CREATE TABLE "student_readiness_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "exam_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "os_family" TEXT NOT NULL,
    "browser_family" TEXT NOT NULL,
    "camera_ok" BOOLEAN NOT NULL DEFAULT false,
    "latency_bucket" TEXT NOT NULL DEFAULT 'good',
    "seb_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_ready" BOOLEAN NOT NULL DEFAULT false,
    "reasons" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "reported_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_readiness_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_readiness_reports_exam_id_student_id_key" UNIQUE ("exam_id", "student_id"),
    CONSTRAINT "student_readiness_reports_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_readiness_reports_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add Indexes on student_readiness_reports
CREATE INDEX "student_readiness_reports_exam_id_idx" ON "student_readiness_reports"("exam_id");
CREATE INDEX "student_readiness_reports_student_id_idx" ON "student_readiness_reports"("student_id");

-- 4. Create student_consents Table
CREATE TABLE "student_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" UUID NOT NULL,
    "exam_id" UUID NOT NULL,
    "consent_version" TEXT NOT NULL,
    "consent_text" TEXT NOT NULL,
    "agreed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_consents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "student_consents_student_id_exam_id_key" UNIQUE ("student_id", "exam_id"),
    CONSTRAINT "student_consents_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_consents_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add Indexes on student_consents
CREATE INDEX "student_consents_student_id_idx" ON "student_consents"("student_id");
CREATE INDEX "student_consents_exam_id_idx" ON "student_consents"("exam_id");
