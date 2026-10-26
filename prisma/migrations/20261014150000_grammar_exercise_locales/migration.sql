-- Localized exercise prompts / explanations (EN + DE explanations; EN prompt)
ALTER TABLE "grammar_exercises" ADD COLUMN IF NOT EXISTS "prompt_en" TEXT;
ALTER TABLE "grammar_exercises" ADD COLUMN IF NOT EXISTS "explanation_en" TEXT;
ALTER TABLE "grammar_exercises" ADD COLUMN IF NOT EXISTS "explanation_de" TEXT;
