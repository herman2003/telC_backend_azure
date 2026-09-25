-- CreateEnum
CREATE TYPE "ExamPart" AS ENUM ('WRITTEN', 'ORAL');

-- AlterTable
ALTER TABLE "exam_attempts" ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "released_result" JSONB;

-- CreateTable
CREATE TABLE "exam_section_weights" (
    "id" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "max_points" INTEGER NOT NULL,
    "part" "ExamPart" NOT NULL,

    CONSTRAINT "exam_section_weights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_section_results" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "graded_by" TEXT NOT NULL,
    "graded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "exam_section_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_weights_level_skill_teil_key" ON "exam_section_weights"("level", "skill", "teil");

-- CreateIndex
CREATE INDEX "exam_section_results_attempt_id_idx" ON "exam_section_results"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_section_results_attempt_id_skill_teil_key" ON "exam_section_results"("attempt_id", "skill", "teil");

-- AddForeignKey
ALTER TABLE "exam_section_results" ADD CONSTRAINT "exam_section_results_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A mark outside the Teil's own scale is a typo, and a negative one is not a
-- mark at all. The per-Teil ceiling is checked in code against
-- exam_section_weights; this is the floor no code should need to.
ALTER TABLE "exam_section_results"
  ADD CONSTRAINT "exam_section_results_points_not_negative"
  CHECK ("points" >= 0);

ALTER TABLE "exam_section_weights"
  ADD CONSTRAINT "exam_section_weights_points_positive"
  CHECK ("max_points" > 0);

-- telc Deutsch B1, in telc's points. 225 written and 75 oral; a candidate
-- passes on 60% of each, separately.
--
-- Seeded in the migration rather than by a script, so a database that can
-- mark an exam can also decide whether it was passed.
INSERT INTO "exam_section_weights" ("id", "level", "skill", "teil", "max_points", "part")
VALUES
  (gen_random_uuid()::text, 'B1', 'LESEN',           1, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'LESEN',           2, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'LESEN',           3, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'SPRACHBAUSTEINE', 1, 15, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'SPRACHBAUSTEINE', 2, 15, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'HOEREN',          1, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'HOEREN',          2, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'HOEREN',          3, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'SCHREIBEN',       1, 45, 'WRITTEN'),
  (gen_random_uuid()::text, 'B1', 'SPRECHEN',        1, 75, 'ORAL');
