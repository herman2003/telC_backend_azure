-- telc Deutsch A2 timings and weights. Without them, exam_section_weights
-- has zero A2 rows: progress.service.ts's weightsFor('A2') throws
-- EXAM_WEIGHTS_MISSING for every real A2 student, and exam-grading.service.ts
-- cannot mark an A2 Teil at all. Blocking, found while scoping Task 6 of
-- docs/plans/active/multi-level-phase-3-generic-model.md.
--
-- Per-Teil points verified against the real telc A2 PDF import (Task 5,
-- content/a2-modelltest-1-source.json) -- not guessed. A1 is deliberately
-- NOT seeded here: its per-Teil point structure differs from A2's (6/4/5 vs
-- 5/5/5 for Hören) and there is no verified A1 content yet to confirm it.
--
-- Lesen and Schreiben share one timed block (LESEN_SCHREIBEN), unlike
-- B1/B2 where Lesen sits with Sprachbausteine and Schreiben is its own
-- block -- A2 has no Sprachbausteine. Sprechen (ORAL) has no block, same
-- precedent as B1/B2.

-- exam_block_durations: 2 rows (A2 has no Sprachbausteine block)
INSERT INTO "exam_block_durations" ("id", "level", "block", "minutes", "position")
VALUES
  (gen_random_uuid()::text, 'A2', 'HOEREN',          20, 1),
  (gen_random_uuid()::text, 'A2', 'LESEN_SCHREIBEN', 50, 2)
ON CONFLICT ("level", "block") DO NOTHING;

-- exam_section_weights: 11 rows
INSERT INTO "exam_section_weights" ("id", "level", "skill", "teil", "max_points", "part", "block")
VALUES
  (gen_random_uuid()::text, 'A2', 'HOEREN',    1, 5,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A2', 'HOEREN',    2, 5,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A2', 'HOEREN',    3, 5,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A2', 'LESEN',     1, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A2', 'LESEN',     2, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A2', 'LESEN',     3, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A2', 'SCHREIBEN', 1, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A2', 'SCHREIBEN', 2, 10, 'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A2', 'SPRECHEN',  1, 3,  'ORAL',    NULL),
  (gen_random_uuid()::text, 'A2', 'SPRECHEN',  2, 6,  'ORAL',    NULL),
  (gen_random_uuid()::text, 'A2', 'SPRECHEN',  3, 6,  'ORAL',    NULL)
ON CONFLICT ("level", "skill", "teil") DO NOTHING;
