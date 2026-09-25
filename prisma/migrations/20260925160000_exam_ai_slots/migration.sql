-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'EXAM_SLOTS_AI';

-- AlterTable
ALTER TABLE "centers" ADD COLUMN     "exam_ai_slots_remaining" INTEGER NOT NULL DEFAULT 0;


-- As for the other pool: below zero would mean an exam ran unpaid.
ALTER TABLE "centers"
  ADD CONSTRAINT "centers_exam_ai_slots_non_negative"
  CHECK ("exam_ai_slots_remaining" >= 0);
