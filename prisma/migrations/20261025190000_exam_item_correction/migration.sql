-- Training Corrigé packages on A1/A2 generic exam_items.
-- Contract: docs/contracts/training-correction-package.md

ALTER TABLE "exam_items" ADD COLUMN IF NOT EXISTS "correction" JSONB;
