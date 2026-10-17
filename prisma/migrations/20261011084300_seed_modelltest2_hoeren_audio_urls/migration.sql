-- Backfill Modelltest 2 Hören audio URLs (R2: modelltest-2-hoeren/).
UPDATE "listening_exercises"
SET "audio_url" = 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-2-hoeren/modelltest-2-hoeren-teil1.mp3'
WHERE "id" = '6406b5ef-7e51-4a47-826b-5252706bf414'
  AND "content_revision" = 'modelltest-2-hoeren-teil1-v1';

UPDATE "listening_exercises"
SET "audio_url" = 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-2-hoeren/modelltest-2-hoeren-teil2.mp3'
WHERE "id" = '06cbc490-dc63-4ea1-b491-c1a569d88489'
  AND "content_revision" = 'modelltest-2-hoeren-teil2-v1';

UPDATE "listening_exercises"
SET "audio_url" = 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-2-hoeren/modelltest-2-hoeren-teil3.mp3'
WHERE "id" = 'f63e694e-e9d3-493b-961a-2db42eb5c345'
  AND "content_revision" = 'modelltest-2-hoeren-teil3-v1';
