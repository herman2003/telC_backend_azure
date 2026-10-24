-- telc Deutsch B2 timings and weights, mirroring the B1 rows seeded in
-- 00000000000001_exam_content. Without them a B2 sitting can start but
-- cannot time or mark it -- EXAM_TIMINGS_MISSING / EXAM_WEIGHTS_MISSING.
--
-- B2 shares every point value with B1 and differs only in the Hoeren
-- duration (20 minutes vs 30). Sprechen is one row of 75, not three of 25:
-- telc marks the oral as one conversation against the M10 criteria, and B1
-- is stored the same way.

-- exam_block_durations: 3 rows
INSERT INTO "exam_block_durations" ("id", "level", "block", "minutes", "position")
VALUES
  (gen_random_uuid()::text, 'B2', 'LESEN_SPRACHBAUSTEINE', 90, 1),
  (gen_random_uuid()::text, 'B2', 'HOEREN',                20, 2),
  (gen_random_uuid()::text, 'B2', 'SCHREIBEN',             30, 3)
ON CONFLICT ("level", "block") DO NOTHING;

-- exam_section_weights: 10 rows
INSERT INTO "exam_section_weights" ("id", "level", "skill", "teil", "max_points", "part")
VALUES
  (gen_random_uuid()::text, 'B2', 'LESEN',           1, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'LESEN',           2, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'LESEN',           3, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'SPRACHBAUSTEINE', 1, 15, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'SPRACHBAUSTEINE', 2, 15, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'HOEREN',          1, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'HOEREN',          2, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'HOEREN',          3, 25, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'SCHREIBEN',       1, 45, 'WRITTEN'),
  (gen_random_uuid()::text, 'B2', 'SPRECHEN',        1, 75, 'ORAL')
ON CONFLICT ("level", "skill", "teil") DO NOTHING;
