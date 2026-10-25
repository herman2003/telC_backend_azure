-- Training Corrigé packages on Lesen + Sprachbausteine item rows.
-- Contract: docs/contracts/training-correction-package.md

ALTER TABLE "lesen_teil1_texts" ADD COLUMN IF NOT EXISTS "correction" JSONB;
ALTER TABLE "lesen_teil2_questions" ADD COLUMN IF NOT EXISTS "correction" JSONB;
ALTER TABLE "lesen_teil3_situations" ADD COLUMN IF NOT EXISTS "correction" JSONB;
ALTER TABLE "sprachbausteine_gaps" ADD COLUMN IF NOT EXISTS "correction" JSONB;
ALTER TABLE "sprachbausteine_teil2_gaps" ADD COLUMN IF NOT EXISTS "correction" JSONB;
