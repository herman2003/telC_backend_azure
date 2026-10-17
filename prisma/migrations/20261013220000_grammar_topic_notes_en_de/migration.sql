-- Localized lesson notes for EN and DE course UI
ALTER TABLE "grammar_topics" ADD COLUMN IF NOT EXISTS "notes_en" TEXT;
ALTER TABLE "grammar_topics" ADD COLUMN IF NOT EXISTS "notes_de" TEXT;
