-- Start Sprechen free quota: track Teil + whether the row consumes the free monthly allowance.
ALTER TABLE "ai_usage" ADD COLUMN "teil_number" INTEGER;
ALTER TABLE "ai_usage" ADD COLUMN "counts_toward_free" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ai_usage_student_id_operation_teil_number_created_at_idx"
  ON "ai_usage"("student_id", "operation", "teil_number", "created_at");