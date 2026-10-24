-- A Modelltest may offer a choice of Schreiben tasks.
--
-- telc B1 asks for one letter, so `writing_exercises` was keyed by Modelltest
-- alone. telc B2 presents two tasks and the candidate answers exactly one,
-- which that key cannot express.
--
-- Widening, not a rewrite: `part` defaults to 1, so every existing row stays
-- valid and keeps its meaning, and the new key is a superset of the old one.
-- Nothing is deleted and no content moves.

ALTER TABLE "writing_exercises"
  ADD COLUMN "part" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "choice_group_id" TEXT;

-- The old key would reject the second task of a choice.
DROP INDEX IF EXISTS "writing_exercises_modelltest_id_key";

CREATE UNIQUE INDEX "writing_exercises_modelltest_id_part_key"
  ON "writing_exercises"("modelltest_id", "part");
