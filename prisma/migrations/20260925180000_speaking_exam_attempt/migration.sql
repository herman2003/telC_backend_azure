-- AlterTable
ALTER TABLE "speaking_attempts" ADD COLUMN     "exam_attempt_id" TEXT;


-- As for the other four attempt tables: training reads far outnumber exams,
-- so they skip the exam rows for free.
CREATE INDEX "speaking_attempts_training_idx"
  ON "speaking_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
