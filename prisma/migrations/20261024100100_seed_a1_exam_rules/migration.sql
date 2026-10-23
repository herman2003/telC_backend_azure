-- telc Deutsch A1 (Start Deutsch 1) timings and weights. Without them,
-- weightsFor('A1') throws EXAM_WEIGHTS_MISSING and an A1 Exam Day cannot be
-- scored, marked or completed.
--
-- From the Testformat page of telc Start Deutsch 1, Übungstest 1: Hören
-- ca. 20 minutes, Lesen und Schreiben 45 minutes, 15 points each for Hören,
-- Lesen, Schreiben and Sprechen (60 in all). Per-Teil points follow the item
-- counts (Hören 6/4/5, one point per item) and the Bewertungsbogen M10
-- (Sprechen 3/6/6). Checked against content/a1-modelltest-1-source.json by
-- test/a1-modelltest-1-content.spec.ts.
--
-- Same block layout as A2: Lesen and Schreiben share LESEN_SCHREIBEN;
-- Sprechen (ORAL) has no block. The A1 pass rule (TOTAL_PERCENT 60) was
-- seeded in 20261022120000_exam_pass_rules.

INSERT INTO "exam_block_durations" ("id", "level", "block", "minutes", "position")
VALUES
  (gen_random_uuid()::text, 'A1', 'HOEREN',          20, 1),
  (gen_random_uuid()::text, 'A1', 'LESEN_SCHREIBEN', 45, 2)
ON CONFLICT ("level", "block") DO NOTHING;

INSERT INTO "exam_section_weights" ("id", "level", "skill", "teil", "max_points", "part", "block")
VALUES
  (gen_random_uuid()::text, 'A1', 'HOEREN',    1, 6,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A1', 'HOEREN',    2, 4,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A1', 'HOEREN',    3, 5,  'WRITTEN', 'HOEREN'),
  (gen_random_uuid()::text, 'A1', 'LESEN',     1, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A1', 'LESEN',     2, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A1', 'LESEN',     3, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A1', 'SCHREIBEN', 1, 5,  'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A1', 'SCHREIBEN', 2, 10, 'WRITTEN', 'LESEN_SCHREIBEN'),
  (gen_random_uuid()::text, 'A1', 'SPRECHEN',  1, 3,  'ORAL',    NULL),
  (gen_random_uuid()::text, 'A1', 'SPRECHEN',  2, 6,  'ORAL',    NULL),
  (gen_random_uuid()::text, 'A1', 'SPRECHEN',  3, 6,  'ORAL',    NULL)
ON CONFLICT ("level", "skill", "teil") DO NOTHING;
