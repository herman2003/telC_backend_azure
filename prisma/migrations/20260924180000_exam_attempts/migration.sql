-- AlterTable
ALTER TABLE "writing_attempts" ADD COLUMN     "exam_attempt_id" TEXT;

-- AlterTable
ALTER TABLE "listening_attempts" ADD COLUMN     "exam_attempt_id" TEXT;

-- AlterTable
ALTER TABLE "sprachbausteine_attempts" ADD COLUMN     "exam_attempt_id" TEXT;

-- AlterTable
ALTER TABLE "lesen_attempts" ADD COLUMN     "exam_attempt_id" TEXT;

-- CreateTable
CREATE TABLE "exam_attempts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "exam_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_attempt_blocks" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "block" "ExamBlock" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "exam_attempt_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_audio_plays" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "audio_id" UUID NOT NULL,
    "plays_used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "exam_audio_plays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exam_attempts_student_id_idx" ON "exam_attempts"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempts_session_id_student_id_key" ON "exam_attempts"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_attempt_blocks_attempt_id_block_key" ON "exam_attempt_blocks"("attempt_id", "block");

-- CreateIndex
CREATE UNIQUE INDEX "exam_audio_plays_attempt_id_audio_id_key" ON "exam_audio_plays"("attempt_id", "audio_id");

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_attempt_blocks" ADD CONSTRAINT "exam_attempt_blocks_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_audio_plays" ADD CONSTRAINT "exam_audio_plays_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "exam_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A block that closes before it opens is a block nobody can sit.
ALTER TABLE "exam_attempt_blocks"
  ADD CONSTRAINT "exam_attempt_blocks_deadline_after_start"
  CHECK ("deadline_at" > "started_at");

-- A negative play count would mean a recording was un-played.
ALTER TABLE "exam_audio_plays"
  ADD CONSTRAINT "exam_audio_plays_not_negative"
  CHECK ("plays_used" >= 0);

-- Every training read filters on `exam_attempt_id IS NULL`, and a student's
-- history is read far more often than an exam is sat. Partial indexes, so the
-- exam rows cost nothing to skip.
CREATE INDEX "lesen_attempts_training_idx"
  ON "lesen_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "listening_attempts_training_idx"
  ON "listening_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "sprachbausteine_attempts_training_idx"
  ON "sprachbausteine_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
CREATE INDEX "writing_attempts_training_idx"
  ON "writing_attempts" ("student_id") WHERE "exam_attempt_id" IS NULL;
