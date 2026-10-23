-- A1/A2 Hören moved from one whole-block recording to one recording per Teil,
-- counted in exam_audio_plays like B1/B2. This column only ever served the
-- whole-block model and has never held a real play.
ALTER TABLE "exam_attempt_blocks" DROP COLUMN "hoeren_played_at";
