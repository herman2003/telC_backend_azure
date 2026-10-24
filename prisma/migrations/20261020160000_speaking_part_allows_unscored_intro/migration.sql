-- Allow an unscored opening part in the oral exam.
--
-- `speaking_exercises.part` was checked BETWEEN 1 AND 3, which is every part
-- telc awards points for at B1. The telc B2 oral opens with `Einander
-- kennenlernen`, explicitly not marked, and the content carries it as part 0.
--
-- The same task is B1's scored Teil 1. Numbering it 1 at B2 would make two
-- different things share a number and invite exactly the confusion the rating
-- code now refuses; 0 says "before the scored parts" and sorts that way.
--
-- Widening, not loosening: 1 to 3 stays valid and nothing already stored
-- becomes invalid. The constraint still rejects the garbage it was added for.
--
-- Not visible in schema.prisma: this constraint was added by hand-written SQL
-- in the baseline, as several on these tables were, so the Prisma model shows
-- `part Int` with no hint of a range.

ALTER TABLE "speaking_exercises"
  DROP CONSTRAINT IF EXISTS "speaking_exercises_part_check";

ALTER TABLE "speaking_exercises"
  ADD CONSTRAINT "speaking_exercises_part_check" CHECK ("part" BETWEEN 0 AND 3);
