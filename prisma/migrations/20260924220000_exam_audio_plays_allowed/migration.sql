-- AlterTable
ALTER TABLE "listening_exercises" ADD COLUMN     "exam_plays_allowed" INTEGER NOT NULL DEFAULT 1;


-- A recording that may play zero times is a Teil nobody can answer.
ALTER TABLE "listening_exercises"
  ADD CONSTRAINT "listening_exercises_exam_plays_positive"
  CHECK ("exam_plays_allowed" >= 1);
