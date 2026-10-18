-- AlterTable
ALTER TABLE "modelltests" ADD COLUMN "level" "CefrLevel" NOT NULL DEFAULT 'B1';

-- CreateIndex
CREATE INDEX "modelltests_level_exam_only_idx" ON "modelltests"("level", "exam_only");
