-- How a level's exam pass/fail verdict is computed. B1/B2 require 60% written
-- AND 60% oral, scored independently. A1/A2 require 60% of the combined
-- total. See docs/architecture/multi-level.md Part 4.

CREATE TYPE "PassRuleType" AS ENUM ('TOTAL_PERCENT', 'PART_PERCENT');

CREATE TABLE "exam_pass_rules" (
    "level" "CefrLevel" NOT NULL,
    "type" "PassRuleType" NOT NULL,
    "minimum_percent" INTEGER,
    "written_percent" INTEGER,
    "oral_percent" INTEGER,

    CONSTRAINT "exam_pass_rules_pkey" PRIMARY KEY ("level")
);

INSERT INTO "exam_pass_rules" ("level", "type", "minimum_percent", "written_percent", "oral_percent")
VALUES
  ('A1', 'TOTAL_PERCENT', 60, NULL, NULL),
  ('A2', 'TOTAL_PERCENT', 60, NULL, NULL),
  ('B1', 'PART_PERCENT',  NULL, 60, 60),
  ('B2', 'PART_PERCENT',  NULL, 60, 60)
ON CONFLICT ("level") DO NOTHING;
