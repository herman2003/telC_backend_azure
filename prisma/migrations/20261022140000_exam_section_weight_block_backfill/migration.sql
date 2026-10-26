-- exam_section_weights.block, backfilled from the literal BLOCK_SECTIONS map
-- in exam-scoring.service.ts (as of this migration): LESEN and
-- SPRACHBAUSTEINE sit LESEN_SPRACHBAUSTEINE together, HOEREN and SCHREIBEN
-- are their own blocks. True for every B1 and B2 WRITTEN row seeded so far.
--
-- ORAL (SPRECHEN) rows stay NULL: Sprechen is not part of any ExamBlock, so
-- there is nothing correct to backfill them to.

ALTER TABLE "exam_section_weights" ADD COLUMN "block" "ExamBlock";

UPDATE "exam_section_weights"
SET "block" = CASE
  WHEN "skill" IN ('LESEN', 'SPRACHBAUSTEINE') THEN 'LESEN_SPRACHBAUSTEINE'::"ExamBlock"
  WHEN "skill" = 'HOEREN' THEN 'HOEREN'::"ExamBlock"
  WHEN "skill" = 'SCHREIBEN' THEN 'SCHREIBEN'::"ExamBlock"
END
WHERE "part" = 'WRITTEN' AND "block" IS NULL;
