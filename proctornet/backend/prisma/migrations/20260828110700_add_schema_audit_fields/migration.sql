-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "resultsReleased" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sampleInput" TEXT,
ADD COLUMN     "sampleOutput" TEXT;

-- AlterTable
ALTER TABLE "StudentExam" ADD COLUMN     "acknowledgedAt" TIMESTAMP(3);
