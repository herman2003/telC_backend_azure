-- CreateTable
CREATE TABLE "grammar_topic_modelltests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topic_id" UUID NOT NULL,
    "modelltest_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "grammar_topic_modelltests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lemma" TEXT NOT NULL,
    "article" TEXT NOT NULL DEFAULT '',
    "gender" TEXT,
    "plural" TEXT,
    "pos" TEXT NOT NULL,
    "cefr_level" TEXT,
    "source" TEXT NOT NULL,
    "frequency_rank" INTEGER,
    "dwds_frequency" INTEGER,
    "auxiliary" TEXT,
    "separable" BOOLEAN,
    "partizip_ii" TEXT,
    "comparative" TEXT,
    "superlative" TEXT,
    "governs_case" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocab_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_senses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "meaning_fr" TEXT NOT NULL,
    "meaning_en" TEXT,
    "example_de" TEXT NOT NULL,
    "example_fr" TEXT,
    "example_en" TEXT,
    "note_fr" TEXT,
    "note_en" TEXT,

    CONSTRAINT "vocab_senses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_verb_forms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entry_id" UUID NOT NULL,
    "tense" TEXT NOT NULL,
    "person" TEXT NOT NULL,
    "form_de" TEXT NOT NULL,

    CONSTRAINT "vocab_verb_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_occurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "vocab_entry_id" UUID NOT NULL,
    "modelltest_id" UUID NOT NULL,
    "skill" TEXT NOT NULL,
    "content_revision" TEXT NOT NULL DEFAULT '',
    "context_snippet" TEXT,
    "in_weekly_pack" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "vocab_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_id" TEXT NOT NULL,
    "vocab_entry_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocab_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocab_exercises" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modelltest_id" UUID NOT NULL,
    "vocab_entry_id" UUID,
    "kind" TEXT NOT NULL,
    "prompt_fr" TEXT NOT NULL,
    "prompt_en" TEXT,
    "prompt_de" TEXT,
    "options_json" JSONB,
    "answer" TEXT NOT NULL,
    "explanation_fr" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vocab_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grammar_topic_modelltests_modelltest_id_sort_order_idx" ON "grammar_topic_modelltests"("modelltest_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "grammar_topic_modelltests_topic_id_modelltest_id_key" ON "grammar_topic_modelltests"("topic_id", "modelltest_id");

-- CreateIndex
CREATE INDEX "vocab_entries_pos_source_idx" ON "vocab_entries"("pos", "source");

-- CreateIndex
CREATE UNIQUE INDEX "vocab_entries_lemma_article_pos_key" ON "vocab_entries"("lemma", "article", "pos");

-- CreateIndex
CREATE INDEX "vocab_senses_entry_id_sort_order_idx" ON "vocab_senses"("entry_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "vocab_verb_forms_entry_id_tense_person_key" ON "vocab_verb_forms"("entry_id", "tense", "person");

-- CreateIndex
CREATE INDEX "vocab_occurrences_modelltest_id_in_weekly_pack_idx" ON "vocab_occurrences"("modelltest_id", "in_weekly_pack");

-- CreateIndex
CREATE UNIQUE INDEX "vocab_occurrences_vocab_entry_id_modelltest_id_skill_conten_key" ON "vocab_occurrences"("vocab_entry_id", "modelltest_id", "skill", "content_revision");

-- CreateIndex
CREATE UNIQUE INDEX "vocab_progress_student_id_vocab_entry_id_key" ON "vocab_progress"("student_id", "vocab_entry_id");

-- CreateIndex
CREATE INDEX "vocab_exercises_modelltest_id_sort_order_idx" ON "vocab_exercises"("modelltest_id", "sort_order");

-- AddForeignKey
ALTER TABLE "grammar_topic_modelltests" ADD CONSTRAINT "grammar_topic_modelltests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "grammar_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grammar_topic_modelltests" ADD CONSTRAINT "grammar_topic_modelltests_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_senses" ADD CONSTRAINT "vocab_senses_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "vocab_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_verb_forms" ADD CONSTRAINT "vocab_verb_forms_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "vocab_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_occurrences" ADD CONSTRAINT "vocab_occurrences_vocab_entry_id_fkey" FOREIGN KEY ("vocab_entry_id") REFERENCES "vocab_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_occurrences" ADD CONSTRAINT "vocab_occurrences_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_progress" ADD CONSTRAINT "vocab_progress_vocab_entry_id_fkey" FOREIGN KEY ("vocab_entry_id") REFERENCES "vocab_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_exercises" ADD CONSTRAINT "vocab_exercises_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocab_exercises" ADD CONSTRAINT "vocab_exercises_vocab_entry_id_fkey" FOREIGN KEY ("vocab_entry_id") REFERENCES "vocab_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
