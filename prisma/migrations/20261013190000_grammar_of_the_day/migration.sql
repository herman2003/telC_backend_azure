-- Grammar of-the-day catalogue + student progress

CREATE TABLE "grammar_topics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title_de" TEXT NOT NULL,
    "title_fr" TEXT NOT NULL,
    "title_en" TEXT,
    "cefr_levels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rule_de" TEXT NOT NULL,
    "rule_fr" TEXT NOT NULL,
    "rule_en" TEXT,
    "notes_fr" TEXT,
    "external_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grammar_topics_slug_key" ON "grammar_topics"("slug");
CREATE UNIQUE INDEX "grammar_topics_external_id_key" ON "grammar_topics"("external_id");
CREATE INDEX "grammar_topics_published_sort_order_idx" ON "grammar_topics"("published", "sort_order");

CREATE TABLE "grammar_examples" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "de" TEXT NOT NULL,
    "fr" TEXT,
    "en" TEXT,

    CONSTRAINT "grammar_examples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grammar_examples_topic_id_idx" ON "grammar_examples"("topic_id");

ALTER TABLE "grammar_examples"
  ADD CONSTRAINT "grammar_examples_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "grammar_topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "grammar_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "prompt_de" TEXT,
    "prompt_fr" TEXT NOT NULL,
    "options_json" JSONB,
    "answer" TEXT NOT NULL,
    "explanation_fr" TEXT,

    CONSTRAINT "grammar_exercises_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grammar_exercises_topic_id_difficulty_sort_order_idx"
  ON "grammar_exercises"("topic_id", "difficulty", "sort_order");

ALTER TABLE "grammar_exercises"
  ADD CONSTRAINT "grammar_exercises_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "grammar_topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "grammar_topic_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" TEXT NOT NULL,
    "topic_id" UUID NOT NULL,
    "lesson_completed" BOOLEAN NOT NULL DEFAULT false,
    "next_exercise_index" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_topic_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grammar_topic_progress_student_id_topic_id_key"
  ON "grammar_topic_progress"("student_id", "topic_id");

ALTER TABLE "grammar_topic_progress"
  ADD CONSTRAINT "grammar_topic_progress_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grammar_topic_progress"
  ADD CONSTRAINT "grammar_topic_progress_topic_id_fkey"
  FOREIGN KEY ("topic_id") REFERENCES "grammar_topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "grammar_exercise_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" TEXT NOT NULL,
    "exercise_id" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grammar_exercise_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "grammar_exercise_attempts_student_id_exercise_id_idx"
  ON "grammar_exercise_attempts"("student_id", "exercise_id");

ALTER TABLE "grammar_exercise_attempts"
  ADD CONSTRAINT "grammar_exercise_attempts_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "students"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grammar_exercise_attempts"
  ADD CONSTRAINT "grammar_exercise_attempts_exercise_id_fkey"
  FOREIGN KEY ("exercise_id") REFERENCES "grammar_exercises"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
