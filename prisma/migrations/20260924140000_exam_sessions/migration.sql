-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SEATS', 'EXAM_SLOTS');

-- CreateEnum
CREATE TYPE "ExamGradingTier" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "ExamBlock" AS ENUM ('LESEN_SPRACHBAUSTEINE', 'HOEREN', 'SCHREIBEN');

-- AlterTable
ALTER TABLE "centers" ADD COLUMN     "exam_slots_remaining" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'SEATS';

-- AlterTable
ALTER TABLE "modelltests" ADD COLUMN     "exam_only" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "exam_block_durations" (
    "id" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "block" "ExamBlock" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "exam_block_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "CefrLevel" NOT NULL,
    "modelltest_id" UUID NOT NULL,
    "grading_tier" "ExamGradingTier" NOT NULL DEFAULT 'MANUAL',
    "opens_at" TIMESTAMP(3) NOT NULL,
    "closes_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "force_closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_session_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_block_durations_level_block_key" ON "exam_block_durations"("level", "block");

-- CreateIndex
CREATE INDEX "exam_sessions_center_id_opens_at_idx" ON "exam_sessions"("center_id", "opens_at");

-- CreateIndex
CREATE INDEX "exam_session_participants_student_id_idx" ON "exam_session_participants"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_session_participants_session_id_student_id_key" ON "exam_session_participants"("session_id", "student_id");

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_session_participants" ADD CONSTRAINT "exam_session_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "exam_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_session_participants" ADD CONSTRAINT "exam_session_participants_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A slot balance below zero would mean a sitting was published without being
-- paid for. The transaction that spends them refuses first; this is the
-- backstop for the case the transaction is wrong.
ALTER TABLE "centers"
  ADD CONSTRAINT "centers_exam_slots_non_negative"
  CHECK ("exam_slots_remaining" >= 0);

-- A window that closes before it opens is a sitting nobody can ever sit.
ALTER TABLE "exam_sessions"
  ADD CONSTRAINT "exam_sessions_window_ordered"
  CHECK ("closes_at" > "opens_at");

-- A block of zero minutes is not a block.
ALTER TABLE "exam_block_durations"
  ADD CONSTRAINT "exam_block_durations_minutes_positive"
  CHECK ("minutes" > 0);

-- telc Deutsch B1, as telc runs it: Lesen and Sprachbausteine share one
-- 90-minute block with free navigation across their five Teile, then Hören,
-- then Schreiben. Sprechen is absent because it happens in the center.
--
-- Seeded here rather than in a script so that a database which has the tables
-- always has the durations: a sitting cannot be timed without them.
INSERT INTO "exam_block_durations" ("id", "level", "block", "minutes", "position")
VALUES
  (gen_random_uuid()::text, 'B1', 'LESEN_SPRACHBAUSTEINE', 90, 1),
  (gen_random_uuid()::text, 'B1', 'HOEREN',                30, 2),
  (gen_random_uuid()::text, 'B1', 'SCHREIBEN',             30, 3);
