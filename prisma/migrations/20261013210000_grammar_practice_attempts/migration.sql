-- Free-practice grammar QCM sessions (outside of-the-day locks)

CREATE TABLE "grammar_practice_attempts" (
    "attempt_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "score" INTEGER NOT NULL,
    "correct_count" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "difficulty" TEXT,
    "duration_seconds" INTEGER,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "grammar_practice_attempts_pkey" PRIMARY KEY ("attempt_id")
);

CREATE INDEX "grammar_practice_attempts_student_id_created_at_idx"
  ON "grammar_practice_attempts"("student_id", "created_at");

ALTER TABLE "grammar_practice_attempts"
  ADD CONSTRAINT "grammar_practice_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
