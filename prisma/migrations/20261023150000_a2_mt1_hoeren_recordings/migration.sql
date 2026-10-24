-- A2 Modelltest 1 (catalogue number 8): one official recording per Hören
-- Teil, uploaded to R2 as MP3. Replaces the single whole-block recording
-- placeholder (audioUrl null) set by 20261023120000_seed_a2_modelltest1.
-- Source of truth: content/a2-modelltest-1-source.json, format.hoerenDelivery.
DO $$
DECLARE updated integer;
BEGIN
  UPDATE "modelltests"
     SET "format" = jsonb_set(COALESCE("format", '{}'::jsonb), '{hoerenDelivery}', '{"deliveryMode":"PER_TEIL_RECORDINGS","playsAllowed":1,"pauseAllowed":false,"seekAllowed":false,"restartAllowed":false,"recordings":[{"teil":1,"audioAssetKey":"a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil1.mp3","audioUrl":"https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil1.mp3","durationSeconds":401},{"teil":2,"audioAssetKey":"a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil2.mp3","audioUrl":"https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil2.mp3","durationSeconds":304},{"teil":3,"audioAssetKey":"a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil3.mp3","audioUrl":"https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil3.mp3","durationSeconds":399}]}'::jsonb)
   WHERE "number" = 8 AND "level" = 'A2';
  GET DIAGNOSTICS updated = ROW_COUNT;
  IF updated <> 1 THEN
    RAISE EXCEPTION 'expected exactly one A2 Modelltest 8, updated %', updated;
  END IF;
END
$$;
