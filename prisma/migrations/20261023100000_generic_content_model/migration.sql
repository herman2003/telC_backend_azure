-- Generic content model for A1/A2 (Phase 3 Task 2 of
-- docs/architecture/multi-level.md). B1/B2 keep reading their own 18
-- tables; nothing here is referenced by them.

-- DropForeignKey
-- A2/A1 Hoeren has no listening_exercises row to point at. Plain column,
-- no FK -- same precedent as exam_audio_plays.audio_id.
ALTER TABLE "training_audio_plays" DROP CONSTRAINT "training_audio_plays_audio_id_fkey";

-- CreateEnum
CREATE TYPE "Aufgabentyp" AS ENUM (
  'EINZELAUSWAHL',
  'RICHTIG_FALSCH',
  'ZUORDNUNG',
  'KURZANTWORT',
  'FORMULAR_AUSFUELLEN',
  'LUECKENTEXT_EINZELAUSWAHL',
  'LUECKENTEXT_WORTBANK',
  'TEXT_SCHREIBEN',
  'SICH_VORSTELLEN',
  'FRAGEN_UND_ANTWORTEN',
  'BITTEN_UND_REAGIEREN',
  'ALLTAGSGESPRAECH',
  'ETWAS_AUSHANDELN',
  'UEBER_EIN_THEMA_SPRECHEN',
  'UEBER_ERFAHRUNGEN_SPRECHEN',
  'DISKUSSION',
  'GEMEINSAM_PLANEN'
);

-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM (
  'AUTO',
  'MANUAL',
  'MANUAL_WITH_AI_SUGGESTION',
  'NOT_SCORED'
);

-- CreateTable
CREATE TABLE "exam_sections" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "modelltest_id" UUID NOT NULL,
    "skill" "Skill" NOT NULL,
    "teil" INTEGER NOT NULL,
    "aufgabentyp" "Aufgabentyp" NOT NULL,
    "label" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "max_points" INTEGER NOT NULL,
    "scoring_mode" "ScoringMode" NOT NULL,
    "material" JSONB NOT NULL,
    "content_revision" TEXT NOT NULL,
    "choice_group_id" TEXT,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exam_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "section_id" TEXT NOT NULL,
    "item_number" INTEGER NOT NULL,
    "prompt" TEXT,
    "solution" JSONB,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exam_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_item_options" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "item_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "exam_item_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_sections_content_revision_key" ON "exam_sections"("content_revision");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sections_modelltest_id_skill_teil_key" ON "exam_sections"("modelltest_id", "skill", "teil");

-- CreateIndex
CREATE INDEX "exam_sections_modelltest_id_idx" ON "exam_sections"("modelltest_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_items_section_id_item_number_key" ON "exam_items"("section_id", "item_number");

-- CreateIndex
CREATE UNIQUE INDEX "exam_item_options_item_id_key_key" ON "exam_item_options"("item_id", "key");

-- AddForeignKey
ALTER TABLE "exam_sections" ADD CONSTRAINT "exam_sections_modelltest_id_fkey" FOREIGN KEY ("modelltest_id") REFERENCES "modelltests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_items" ADD CONSTRAINT "exam_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "exam_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_item_options" ADD CONSTRAINT "exam_item_options_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "exam_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
