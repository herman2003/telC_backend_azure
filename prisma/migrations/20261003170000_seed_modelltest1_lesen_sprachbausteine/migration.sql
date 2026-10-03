-- Modelltest 1: Lesen and Sprachbausteine content.
--
-- WHY THIS EXISTS. Every other piece of exam content is seeded by a migration —
-- Modelltest 1's Hoeren, Sprechen and Schreiben, and all of Modelltest 2. This
-- part never was. It lived in six SQL files at the repository root that nothing
-- ran automatically, applied by hand to each database, so a database rebuilt
-- from its own migration chain came up without the Lesen or Sprachbausteine of
-- Modelltest 1. Production had the content only because somebody had run those
-- files against it once.
--
-- The files were 002_seed_modelltest1.sql, 003/004/005 (Lesen Teil 2, 1 and 3),
-- 006 (Sprachbausteine Teil 2) and 007 (the parent row and the wiring). They are
-- deleted in the same commit as this migration: two pipelines for one piece of
-- content is how the drift happened.
--
-- IDEMPOTENT, WHICH IS THE WHOLE DIFFICULTY. Production and the test branch
-- already hold these rows, so this migration has to find them there and do
-- nothing. `ON CONFLICT DO NOTHING` carries that for the rows with fixed UUIDs;
-- the Sprachbausteine Teil 2 block generates its UUIDs in the database and is
-- guarded with NOT EXISTS instead, keyed on the content revision.
--
-- BEGIN/COMMIT from the original files are dropped: Prisma already runs a
-- migration inside one transaction, and a nested COMMIT would end it early.


-- ======================================================================
-- The parent row, first
--
-- It used to be last: the content went in with a null modelltest_id and a later
-- file filled it. That stopped being possible on 2026-08-21, when modelltest_id
-- was made NOT NULL — so replaying these files against today's schema fails on
-- the very first insert. Found by running this migration against the test
-- branch, which rolled it back.
-- ======================================================================

INSERT INTO modelltests (number, title)
VALUES (1, 'Modelltest 1')
ON CONFLICT (number) DO NOTHING;

-- ======================================================================
-- Sprachbausteine Teil 1  (was 002_seed_modelltest1.sql)
-- ======================================================================

-- ============================================================
-- SEED 001 — Sprachbausteine Teil 1, Modelltest 1
-- Source: Mit Erfolg zu telc Deutsch B1+ Beruf, Klett 2015
-- Answers verified from Lösungen page 81
--
-- Correct answers (from book):
--   21c  22c  23c  24a  25a  26b  27b  28b  29b  30b
-- ============================================================;


-- ── 1. Insert the exercise ──────────────────────────────────

INSERT INTO sprachbausteine_exercises
    (id, teil_number, content_revision, label, instruction, duration_minutes, image_url, body, modelltest_id)
VALUES (
    'aaaaaaaa-0001-0001-0001-000000000001',
    1,
    'modelltest-1-v1',
    'Sprachbausteine, Teil 1',
    'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.',
    18,
    'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/sprachbausteine-teil-1.png',
    -- The full text from Modelltest 1, Sprachbausteine Teil 1 (page 14)
    -- Gaps are encoded as -21- through -30- exactly where the blanks appear
    'Schroeder & Söhne, Aufzüge und Industrielifts

Mitteilung an alle Mitarbeiterinnen und Mitarbeiter mit Kundenkontakten

Sehr geehrte Damen und Herren,

-21- Sie wissen, wird die Konkurrenz in unserer Branche immer größer.
Mehrfach haben wir -22- darauf hingewiesen, dass es sehr wichtig ist, auf die guten Kontakte zu unseren Kunden zu achten. Diese garantieren -23- Existenz der Firma und Ihre Arbeitsplätze.

Leider mussten wir feststellen, -24- ein aufmerksamer Umgang mit Kunden oft nicht beachtet wird. Daher wiederholen wir heute noch einmal unsere Bitten:

• Lassen Sie Anrufer am Telefon nicht länger warten -25- unbedingt nötig.
• Beantworten Sie E-Mails und Briefe sofort – bestätigen Sie wenigstens -26- Empfang.
• Schicken Sie bitte das angeforderte Prospektmaterial sofort heraus.
• Versenden Sie E-Mails nie ohne eine höfliche Anrede und -27- Grußformel.

Noch einmal: Seien Sie zu unseren Geschäftspartnern bitte immer höflich. Wir können uns keinen verärgerten Kunden leisten. Nicht nur unsere Produkte müssen erstklassig sein – auch unser Umgang mit den Kunden -28- erstklassig sein.

Mit freundlichen -29-

-30- Geschäftsleitung',
    (SELECT id FROM modelltests WHERE number = 1)
)
ON CONFLICT DO NOTHING;


-- ── 2. Insert the 10 gaps ───────────────────────────────────

INSERT INTO sprachbausteine_gaps (id, exercise_id, gap_key, gap_number, sort_order)
VALUES
    ('bbbbbbbb-0021-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '21', 21, 0),
    ('bbbbbbbb-0022-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '22', 22, 1),
    ('bbbbbbbb-0023-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '23', 23, 2),
    ('bbbbbbbb-0024-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '24', 24, 3),
    ('bbbbbbbb-0025-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '25', 25, 4),
    ('bbbbbbbb-0026-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '26', 26, 5),
    ('bbbbbbbb-0027-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '27', 27, 6),
    ('bbbbbbbb-0028-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '28', 28, 7),
    ('bbbbbbbb-0029-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '29', 29, 8),
    ('bbbbbbbb-0030-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001', '30', 30, 9)
ON CONFLICT DO NOTHING;


-- ── 3. Insert the 3 options for each gap ───────────────────
-- sort_order: 0 = option a, 1 = option b, 2 = option c
-- is_correct: TRUE for the verified correct answer

-- Gap 21 → correct: c (wie)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0021-0001-0001-000000000001', 'ob',   FALSE, 0),
    ('bbbbbbbb-0021-0001-0001-000000000001', 'wenn', FALSE, 1),
    ('bbbbbbbb-0021-0001-0001-000000000001', 'wie',  TRUE,  2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 22 → correct: c (Sie)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0022-0001-0001-000000000001', 'ihr', FALSE, 0),
    ('bbbbbbbb-0022-0001-0001-000000000001', 'sie', FALSE, 1),
    ('bbbbbbbb-0022-0001-0001-000000000001', 'Sie', TRUE,  2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 23 → correct: c (die)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0023-0001-0001-000000000001', 'dem',    FALSE, 0),
    ('bbbbbbbb-0023-0001-0001-000000000001', 'dessen', FALSE, 1),
    ('bbbbbbbb-0023-0001-0001-000000000001', 'die',    TRUE,  2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 24 → correct: a (dass)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0024-0001-0001-000000000001', 'dass', TRUE,  0),
    ('bbbbbbbb-0024-0001-0001-000000000001', 'weil', FALSE, 1),
    ('bbbbbbbb-0024-0001-0001-000000000001', 'wenn', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 25 → correct: a (als)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0025-0001-0001-000000000001', 'als',  TRUE,  0),
    ('bbbbbbbb-0025-0001-0001-000000000001', 'durch',FALSE, 1),
    ('bbbbbbbb-0025-0001-0001-000000000001', 'wenn', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 26 → correct: b (den)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0026-0001-0001-000000000001', 'das', FALSE, 0),
    ('bbbbbbbb-0026-0001-0001-000000000001', 'den', TRUE,  1),
    ('bbbbbbbb-0026-0001-0001-000000000001', 'der', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 27 → correct: b (eine)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0027-0001-0001-000000000001', 'ein',   FALSE, 0),
    ('bbbbbbbb-0027-0001-0001-000000000001', 'eine',  TRUE,  1),
    ('bbbbbbbb-0027-0001-0001-000000000001', 'einer', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 28 → correct: b (muss)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0028-0001-0001-000000000001', 'müssen', FALSE, 0),
    ('bbbbbbbb-0028-0001-0001-000000000001', 'muss',   TRUE,  1),
    ('bbbbbbbb-0028-0001-0001-000000000001', 'musste', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 29 → correct: b (Grüßen)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0029-0001-0001-000000000001', 'Grüße',  FALSE, 0),
    ('bbbbbbbb-0029-0001-0001-000000000001', 'Grüßen', TRUE,  1),
    ('bbbbbbbb-0029-0001-0001-000000000001', 'Gruß',   FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);


-- Gap 30 → correct: b (Ihre)
INSERT INTO sprachbausteine_gap_options (gap_id, content, is_correct, sort_order)
SELECT v."gap_id"::uuid, v."content", v."is_correct", v."sort_order"
FROM (VALUES
    ('bbbbbbbb-0030-0001-0001-000000000001', 'Eure',   FALSE, 0),
    ('bbbbbbbb-0030-0001-0001-000000000001', 'Ihre',   TRUE,  1),
    ('bbbbbbbb-0030-0001-0001-000000000001', 'Unsere', FALSE, 2)
) AS v("gap_id", "content", "is_correct", "sort_order")
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_gap_options existing
   WHERE existing.gap_id = v."gap_id"::uuid
);

-- ======================================================================
-- Lesen Teil 2  (was 003_seed_lesen_teil2_modelltest1.sql)
-- ======================================================================

-- ============================================================
-- SEED 003 — Leseverstehen Teil 2, Modelltest 1
-- Source: Mit Erfolg zu telc Deutsch B1+ Beruf, Klett 2015, pp. 10–11
-- Answers verified from Lösungen page 81
--
-- Correct answers: 6c  7a  8a  9a  10c
-- ============================================================;


-- ── 1. Insert the exercise ──────────────────────────────────

INSERT INTO lesen_teil2_exercises
    (id, "contentRevision", label, instruction, "cautionNote",
     "topSender", "topReceiver", "topBody", "quotedThread", modelltest_id)
VALUES (
    'cccccccc-0002-0002-0002-000000000001',
    'modelltest-1-lesen-teil2-v1',
    'Leseverstehen, Teil 2',
    'Lesen Sie die E-Mail und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.',
    'Achtung! Die Aufgaben stehen nicht immer in der gleichen Reihenfolge wie die Informationen im Text.',
    'k.weisshaupt@web.de',
    'j.baric@freenet.com',
    'Sehr geehrter Herr Baric,
vielen Dank für Ihr Angebot, das ich annehme.
Bitte bestellen Sie die notwendigen Zusatzgeräte.
Mit freundlichen Grüßen
Karin Weisshaupt',
    'Johannes Baric schrieb:
> Sehr geehrte Frau Weisshaupt,
> vielen Dank für Ihre freundliche Mail.
> Dass Sie mit dem Wagen zufrieden sind, freut uns sehr.
> Zu Ihren Wünschen kann ich Ihnen mitteilen, dass wir die
> gewünschten Arbeiten gerne in unserer eigenen Werkstatt
> durchführen können. Die Arbeiten werden an einem Tag
> durchgeführt. Die Lieferung der Zusatzgeräte dauert ab
> Bestellung zwei Werktage.
> Zu den Kosten teile ich Ihnen mit, dass die Freisprechanlage
> € 450,00, die Diebstahlsicherung € 525,00 und der CD-Player
> € 610,00 kosten. Der gesamte Einbau kostet dann zusätzlich
> € 500,00, alle Preise jeweils zzgl. der gesetzlichen MwSt.
> Wenn Sie mit diesem Angebot einverstanden sind, können wir
> die Arbeiten am Dienstag in der kommenden Woche ausführen.
> Selbstverständlich stellen wir Ihnen für diesen Tag kostenlos
> einen Leihwagen zur Verfügung.
> Bitte teilen Sie uns mit, ob Sie unser Angebot annehmen möchten.
> Mit freundlichen Grüßen
> Johannes Baric
> Autohandel Baric GmbH

Karin Weisshaupt schrieb:
>> Sehr geehrter Herr Baric,
>> ich habe vor einem Monat bei Ihnen einen Neuwagen,
>> VW Passat, gekauft. Ich bin mit dem Wagen sehr zufrieden.
>> Während unseres Verkaufsgespräches haben Sie mir
>> freundlicherweise Prospektmaterial zur Verfügung gestellt,
>> in dem alle zusätzlichen Ausstattungsmöglichkeiten für den
>> Wagen angeboten werden.
>> Ich habe mich nun dafür entschieden, folgende Extras
>> einbauen zu lassen:
>> eine Freisprechanlage für mein Handy, da ich beruflich viel
>> mit dem Wagen unterwegs bin und auch beruflich telefonisch
>> erreichbar sein muss, eine Diebstahlsicherung und einen
>> sehr guten CD-Player.
>> Ich möchte die Einbauarbeiten gerne in Ihrer Werkstatt
>> durchführen lassen. Alle Arbeiten sollten an einem Tag
>> durchgeführt werden. Den Zeitpunkt dafür müssten wir vorab
>> genau besprechen, weil ich meine Termine dann besser
>> planen kann.
>> Bitte teilen Sie mir mit, ob dies so möglich ist und ob Sie
>> in den nächsten Tagen einen Termin freihaben.
>> Außerdem bitte ich um Ihr Angebot mit allen Informationen,
>> welche Kosten auf mich zukommen.
>> Ich danke Ihnen und verbleibe
>> mit freundlichen Grüßen
>> Karin Weisshaupt',
    (SELECT id FROM modelltests WHERE number = 1)
)
ON CONFLICT DO NOTHING;


-- ── 2. Insert the 5 questions ───────────────────────────────

INSERT INTO lesen_teil2_questions (id, "exerciseId", "questionNumber", prompt, "sortOrder")
VALUES
    ('dddddddd-0006-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 6,  'Die Arbeiten können in der Werkstatt durchgeführt werden, wenn', 0),
    ('dddddddd-0007-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 7,  'Frau Weisshaupt benötigt eine Freisprechanlage, weil sie', 1),
    ('dddddddd-0008-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 8,  'Die genannten zusätzlichen Kosten sind für', 2),
    ('dddddddd-0009-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 9,  'Die Werkstatt braucht für die Einbauarbeiten', 3),
    ('dddddddd-0010-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 10, 'Der Leihwagen kostet für Frau Weisshaupt', 4)
ON CONFLICT DO NOTHING;


-- ── 3. Insert the 3 options per question ────────────────────
-- "sortOrder": 0=a  1=b  2=c
-- "isCorrect": TRUE for the verified answer

-- Question 6 → correct: c
INSERT INTO lesen_teil2_options ("questionId", content, "isCorrect", "sortOrder")
SELECT v."questionId"::uuid, v."content", v."isCorrect", v."sortOrder"
FROM (VALUES
    ('dddddddd-0006-0002-0002-000000000001', 'der Termin nicht abgesprochen werden muss',              FALSE, 0),
    ('dddddddd-0006-0002-0002-000000000001', 'der Termin von der Werkstatt festgelegt werden kann',    FALSE, 1),
    ('dddddddd-0006-0002-0002-000000000001', 'der Termin vorher mit Frau Weisshaupt abgesprochen wird', TRUE, 2)
) AS v("questionId", "content", "isCorrect", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM lesen_teil2_options existing
   WHERE existing."questionId" = v."questionId"::uuid
);


-- Question 7 → correct: a
INSERT INTO lesen_teil2_options ("questionId", content, "isCorrect", "sortOrder")
SELECT v."questionId"::uuid, v."content", v."isCorrect", v."sortOrder"
FROM (VALUES
    ('dddddddd-0007-0002-0002-000000000001', 'den Wagen beruflich nutzt',                              TRUE,  0),
    ('dddddddd-0007-0002-0002-000000000001', 'gerne mit ihren Freundinnen telefonisch Kontakt hat',    FALSE, 1),
    ('dddddddd-0007-0002-0002-000000000001', 'jederzeit für ihre Familie erreichbar sein möchte',      FALSE, 2)
) AS v("questionId", "content", "isCorrect", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM lesen_teil2_options existing
   WHERE existing."questionId" = v."questionId"::uuid
);


-- Question 8 → correct: a
INSERT INTO lesen_teil2_options ("questionId", content, "isCorrect", "sortOrder")
SELECT v."questionId"::uuid, v."content", v."isCorrect", v."sortOrder"
FROM (VALUES
    ('dddddddd-0008-0002-0002-000000000001', 'alle Einbauarbeiten',    TRUE,  0),
    ('dddddddd-0008-0002-0002-000000000001', 'den CD-Player',          FALSE, 1),
    ('dddddddd-0008-0002-0002-000000000001', 'die Diebstahlsicherung', FALSE, 2)
) AS v("questionId", "content", "isCorrect", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM lesen_teil2_options existing
   WHERE existing."questionId" = v."questionId"::uuid
);


-- Question 9 → correct: a
INSERT INTO lesen_teil2_options ("questionId", content, "isCorrect", "sortOrder")
SELECT v."questionId"::uuid, v."content", v."isCorrect", v."sortOrder"
FROM (VALUES
    ('dddddddd-0009-0002-0002-000000000001', 'einen Tag',    TRUE,  0),
    ('dddddddd-0009-0002-0002-000000000001', 'fünf Stunden', FALSE, 1),
    ('dddddddd-0009-0002-0002-000000000001', 'zwei Tage',    FALSE, 2)
) AS v("questionId", "content", "isCorrect", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM lesen_teil2_options existing
   WHERE existing."questionId" = v."questionId"::uuid
);


-- Question 10 → correct: c
INSERT INTO lesen_teil2_options ("questionId", content, "isCorrect", "sortOrder")
SELECT v."questionId"::uuid, v."content", v."isCorrect", v."sortOrder"
FROM (VALUES
    ('dddddddd-0010-0002-0002-000000000001', '€ 450,00',   FALSE, 0),
    ('dddddddd-0010-0002-0002-000000000001', '€ 525,00',   FALSE, 1),
    ('dddddddd-0010-0002-0002-000000000001', 'gar nichts', TRUE,  2)
) AS v("questionId", "content", "isCorrect", "sortOrder")
WHERE NOT EXISTS (
  SELECT 1 FROM lesen_teil2_options existing
   WHERE existing."questionId" = v."questionId"::uuid
);

-- ======================================================================
-- Lesen Teil 1  (was 004_seed_lesen_teil1_modelltest1.sql)
-- ======================================================================

-- ============================================================
-- SEED 004 — Leseverstehen Teil 1, Modelltest 1
-- Source: Mit Erfolg zu telc Deutsch B1+ Beruf, Klett 2015, pp. 8–9
-- Answers verified from Lösungen page 81
--
-- Correct answers: 1g  2e  3c  4a  5h
-- Title UUID → letter mapping:
--   ffffffff-0001 = a  Anfrage
--   ffffffff-0002 = b  Lieferschein       (decoy)
--   ffffffff-0003 = c  Reklamation
--   ffffffff-0004 = d  Schadensmeldung    (decoy)
--   ffffffff-0005 = e  Schließregelung
--   ffffffff-0006 = f  Sommerfest         (decoy)
--   ffffffff-0007 = g  Terminabsage
--   ffffffff-0008 = h  Terminverschiebung
--   ffffffff-0009 = i  Terminzusage       (decoy)
--   ffffffff-0010 = j  Übernachtung       (decoy)
-- ============================================================;


-- ── 1. Exercise ─────────────────────────────────────────────

INSERT INTO lesen_teil1_exercises (id, "contentRevision", label, instruction, modelltest_id)
VALUES (
    'eeeeeeee-0001-0001-0001-000000000001',
    'modelltest-1-lesen-teil1-v1',
    'Leseverstehen, Teil 1',
    'Lesen Sie die folgenden fünf Texte. Es fehlt jeweils der Betreff. Entscheiden Sie, welcher Betreff (a–j) am besten zu welcher Betreffzeile (1–5) passt. Tragen Sie Ihre Lösungen für die Aufgaben 1–5 in den Antwortbogen ein.',
    (SELECT id FROM modelltests WHERE number = 1)
)
ON CONFLICT DO NOTHING;


-- ── 2. Titles (must be inserted before texts — FK on correctTitleId) ──

INSERT INTO lesen_teil1_titles (id, "exerciseId", content, "sortOrder") VALUES
    ('ffffffff-0001-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Anfrage',             0),
    ('ffffffff-0002-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Lieferschein',        1),
    ('ffffffff-0003-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Reklamation',         2),
    ('ffffffff-0004-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Schadensmeldung',     3),
    ('ffffffff-0005-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Schließregelung',     4),
    ('ffffffff-0006-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Sommerfest',          5),
    ('ffffffff-0007-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminabsage',        6),
    ('ffffffff-0008-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminverschiebung',  7),
    ('ffffffff-0009-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminzusage',        8),
    ('ffffffff-0010-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Übernachtung',        9)
ON CONFLICT DO NOTHING;


-- ── 3. Texts ────────────────────────────────────────────────

-- Email 1 — correct: g = Terminabsage (ffffffff-0007)
INSERT INTO lesen_teil1_texts
    (id, "exerciseId", "textNumber", von, an, body, "sortOrder", "correctTitleId")
VALUES (
    '44444444-0001-0001-0001-000000000001',
    'eeeeeeee-0001-0001-0001-000000000001',
    1,
    'r.fazli@grb.com',
    'v.gruedle@grb.com',
    'Hallo Frau Grüdle,
leider kann ich nicht an der Dienstbesprechung am nächsten
Donnerstag teilnehmen. Wie wir bereits vor Längerem besprochen
haben, habe ich mich zur Trainingsreihe „Personalführung"
angemeldet. Als ich mich anmelden wollte, kam ich nur auf die
Warteliste. Eben hat mich der Veranstalter angerufen, dass ein
Platz krankheitsbedingt frei geworden ist. Weil die nächste Reihe
erst in einem halben Jahr beginnt, möchte ich meine Teilnahme an
der Dienstbesprechung absagen.
Vielen Dank für Ihr Verständnis!
Herzlichen Gruß
Ramik Fazli',
    0,
    'ffffffff-0007-0001-0001-000000000001'
)
ON CONFLICT DO NOTHING;


-- Email 2 — correct: e = Schließregelung (ffffffff-0005) — von/an NULL (internal notice)
INSERT INTO lesen_teil1_texts
    (id, "exerciseId", "textNumber", von, an, body, "sortOrder", "correctTitleId")
VALUES (
    '44444444-0002-0001-0001-000000000001',
    'eeeeeeee-0001-0001-0001-000000000001',
    2,
    NULL,
    NULL,
    'Liebe Kolleginnen und Kollegen,
der Sicherheitsdienst hat mich informiert, dass die Eingangstüre
bei der Routinekontrolle am vergangenen Samstag nicht richtig
verschlossen war. Man konnte zwar nicht ins Gebäude gelangen,
dennoch stand auf dem Display nicht „Verschlossen". Wir hoffen,
dass nichts Schlimmes passiert ist, aber im Schadensfall würde die
Versicherung nichts bezahlen. Bitte achten Sie daher beim Verlassen
des Gebäudes freitags nach 16:00 Uhr darauf, dass das digitale
Display neben der Tür „Verschlossen" anzeigt.
Vielen Dank für Ihre Unterstützung!
gez. Postmann
Verwaltungsleitung',
    1,
    'ffffffff-0005-0001-0001-000000000001'
)
ON CONFLICT DO NOTHING;


-- Email 3 — correct: c = Reklamation (ffffffff-0003)
INSERT INTO lesen_teil1_texts
    (id, "exerciseId", "textNumber", von, an, body, "sortOrder", "correctTitleId")
VALUES (
    '44444444-0003-0001-0001-000000000001',
    'eeeeeeee-0001-0001-0001-000000000001',
    3,
    'rene.gallack@fa-rzw.de',
    'stephan.gerke@werbeagentur.net',
    'Sehr geehrter Herr Gerke,
vielen Dank für Ihre schnelle Lieferung. Wir haben 4.000 Stück
Werbebroschüren für unser neuestes Produkt bestellt. Allerdings
haben Sie 500 Stück weniger geliefert. Aber auf dem Lieferschein
steht die bestellte Menge.
Wir hoffen, dass es sich um ein Versehen handelt und erwarten in
Kürze Ihre Nachlieferung.
Mit freundlichen Grüßen
René Gallack',
    2,
    'ffffffff-0003-0001-0001-000000000001'
)
ON CONFLICT DO NOTHING;


-- Email 4 — correct: a = Anfrage (ffffffff-0001)
INSERT INTO lesen_teil1_texts
    (id, "exerciseId", "textNumber", von, an, body, "sortOrder", "correctTitleId")
VALUES (
    '44444444-0004-0001-0001-000000000001',
    'eeeeeeee-0001-0001-0001-000000000001',
    4,
    'i.villa@kompsit.net',
    'aurum@gaestehaus.com',
    'Sehr geehrte Damen und Herren,
unsere Firma plant für Anfang November eine zweitägige
internationale Tagung zum Thema „Technik und Innovation". Wir
suchen einen großen Konferenzsaal mit der modernsten technischen
Ausstattung. Da wir auch in Gruppen arbeiten werden, benötigen
wir zusätzlich vier kleinere Räume. Ist dies möglich? Natürlich
möchten wir für alle Teilnehmenden das Mittag- und Abendessen
buchen.
Wir erwarten ca. 80 Kunden aus dem In- und Ausland. Daher wäre
es praktisch, wenn diese am Tagungsort auch übernachten könnten.
Hätten Sie genug Einzelzimmer?
Bitte schicken Sie mir Ihre komplette Angebotsliste mit Preisen.
Mit freundlichen Grüßen
Ines Villa',
    3,
    'ffffffff-0001-0001-0001-000000000001'
)
ON CONFLICT DO NOTHING;


-- Email 5 — correct: h = Terminverschiebung (ffffffff-0008)
INSERT INTO lesen_teil1_texts
    (id, "exerciseId", "textNumber", von, an, body, "sortOrder", "correctTitleId")
VALUES (
    '44444444-0005-0001-0001-000000000001',
    'eeeeeeee-0001-0001-0001-000000000001',
    5,
    'michaela.rojka@rett-platt.de',
    'nella.weber@rett-platt.de',
    'Hallo Nella,
ich habe gerade in meinem Kalender unser Treffen morgen um 16 Uhr
entdeckt. Wir wollten doch den Aufbau des Seminars zum
interkulturellen Training „Fettnäpfchen in Russland vermeiden"
besprechen. Könnten wir uns auch direkt nach der Mittagspause um
13.30 Uhr zusammensetzen? Danach muss ich nämlich zum Elternabend
in Michas Kindergarten. Das Sommerfest steht an ...
Sag mir kurz Bescheid.
Michaela',
    4,
    'ffffffff-0008-0001-0001-000000000001'
)
ON CONFLICT DO NOTHING;

-- ======================================================================
-- Lesen Teil 3  (was 005_seed_lesen_teil3_modelltest1.sql)
-- ======================================================================

-- ============================================================
-- SEED 005 — Leseverstehen Teil 3, Modelltest 1
-- Source: Mit Erfolg zu telc Deutsch B1+ Beruf, Klett 2015, pp. 12–15
-- Answers verified from Lösungen page 81
--
-- Correct answers: 11j  12g  13d  14h  15X  16e  17k  18l  19b  20c
--
-- Announcement UUID → letter mapping:
--   dddddddd-0001 = a  Rechtsanwalt Mark Lutz
--   dddddddd-0002 = b  Grober Schmutz muss weg!
--   dddddddd-0003 = c  Anwälte Hilge, Neumann
--   dddddddd-0004 = d  Firma für Schutz
--   dddddddd-0005 = e  Wirtschaftsprüfungs- u. Steuerberatungsgesellschaft
--   dddddddd-0006 = f  Unsere Dienste zu Ihrer Verfügung!       (decoy)
--   dddddddd-0007 = g  Wegmeier — Beratungsgesellschaft mbH
--   dddddddd-0008 = h  Objektsicherheit
--   dddddddd-0009 = i  Zuverlässige Lohnbuchhalterin            (decoy)
--   dddddddd-0010 = j  Jana Potok & Partner GbR
--   dddddddd-0011 = k  Klarsicht Gebäudereinigung GmbH
--   dddddddd-0012 = l  Frische Raumpflege GmbH & Co KG
-- ============================================================;


-- ── 1. Exercise ─────────────────────────────────────────────

INSERT INTO lesen_teil3_exercises (id, "contentRevision", label, instruction, modelltest_id)
VALUES (
    'bbbbbbbb-0001-0003-0003-000000000001',
    'modelltest-1-lesen-teil3-v1',
    'Leseverstehen, Teil 3',
    'Lesen Sie die Situationen 11–20 und die Anzeigen a–l.
Finden Sie für jede Situation die passende Anzeige.
Sie können jede Anzeige nur einmal benutzen.
Markieren Sie Ihre Lösungen für die Aufgaben 11–20
auf dem Antwortbogen.
Wenn Sie zu einer Situation keine Anzeige finden,
markieren Sie ein X.',
    (SELECT id FROM modelltests WHERE number = 1)
)
ON CONFLICT DO NOTHING;


-- ── 2. Announcements (must be inserted before situations — FK on correctAnnouncementId) ──

INSERT INTO lesen_teil3_announcements (id, "exerciseId", title, content, "sortOrder") VALUES
    (
        'dddddddd-0001-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Rechtsanwalt Mark Lutz',
        'Fachanwalt f. Medizin- u. Sozialrecht. Seit 25 Jahren bieten wir unsere Dienste an. Remscheider Str. 216, 83012 Oberfeld. www.ra-lutz.de. (0762) 335 62',
        0
    ),
    (
        'dddddddd-0002-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Grober Schmutz muss weg!',
        'Ihr Spezialist in Sachen Reinigung Jasmin Lehr. Unterhaltsreinigung • Baureinigung • Winterdienst. Firma Grobe, Unter der Esche 8, 85689 Eickenpfahl. Heribert.Grobe@grobe.eu',
        1
    ),
    (
        'dddddddd-0003-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Anwälte Hilge, Neumann',
        'Fachanwälte für Patentrecht, zugelassen beim Europäischen Patentamt u. Gemeinschaftsmarkenamt. Unsere Kanzlei begleitet Sie über das Antragsverfahren bis zum Eintrag Ihrer Marke. Nussweg 9, 79876 Plauberg. info@hilgeneumann.de, 0345 2476',
        2
    ),
    (
        'dddddddd-0004-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Firma für Schutz',
        'Soforteinsatz mit Notdienst und 24-Stunden-Notrufzentrale. Baustellenbewachung, Unterstützung durch unsere speziell trainierten Vierbeiner, Wachhunde, Kassendienst. Kostenlose Rufnummer aus allen Mobilnetzen: 534209',
        3
    ),
    (
        'dddddddd-0005-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Wirtschaftsprüfungs- u. Steuerberatungsgesellschaft',
        'Ihr Ansprechpartner für ein erfolgreiches Unternehmen. Diplom-Betriebswirt Steuerberater Henrik Bott. info@henrik-bott.com',
        4
    ),
    (
        'dddddddd-0006-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Unsere Dienste zu Ihrer Verfügung!',
        'Kontroll- und Schließdienste, diskret und sicher. Wir führen regelmäßig Schließgänge durch, schalten Ihre Alarmanlage scharf und deaktivieren sie wieder. Bewachungs- und Sicherheitsdienst Plagemann. info@plagemann.de',
        5
    ),
    (
        'dddddddd-0007-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Wegmeier — Beratungsgesellschaft mbH',
        'GmbH-Beratung • Vereinssteuerrecht • Existenzgründungsberatung • Seminarangebot rund um Ihre Selbstständigkeit. 56498 Rippert, Wolframring 98–102. Tel.: 0987 9865',
        6
    ),
    (
        'dddddddd-0008-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Objektsicherheit',
        'Bären-Wache: Ein Einsatz für Kontroll-/Schließdienste! Wir kommen zu jeder Stunde, in jeder Jahreszeit — egal, ob es schneit oder die Sonne scheint. Wir vermitteln Ihnen auch kompetente Mitarbeiter für die Pforte oder den Empfang! An der Brücke 7, 23987 Erlenburg',
        7
    ),
    (
        'dddddddd-0009-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Zuverlässige Lohnbuchhalterin',
        'mit fundierten aktuellen Kenntnissen im Lohnsteuer-, Sozialversicherungs- und Tarifrecht sucht neue Herausforderung. PV 3445',
        8
    ),
    (
        'dddddddd-0010-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Jana Potok & Partner GbR',
        'Rechtsanwälte — Fachanwälte f. Arbeitsrecht. Wir beraten und vertreten Sie kompetent in allen Problemfällen rund um Ihre Arbeitsstelle. Ringstr. 11–14, 90187 Untermark. Buero-untermark@ra-potok-partner.de',
        9
    ),
    (
        'dddddddd-0011-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Klarsicht Gebäudereinigung GmbH',
        'Ihr Partner für alle Gebäudedienste. Fassadenreinigung • Glasreinigung • Desinfektion • Teppichreinigung. info@klarsicht.net. Rotbarschweg 9, 43651 Buchse',
        10
    ),
    (
        'dddddddd-0012-0003-0003-000000000001',
        'bbbbbbbb-0001-0003-0003-000000000001',
        'Frische Raumpflege GmbH & Co Gebäudereinigung & Service KG',
        'Sie werden staunen, was unsere Putzfeen vollbringen! E-mail: info@fr-born.de. www.frische-raumpflege-born.de',
        11
    )
ON CONFLICT DO NOTHING;


-- ── 3. Situations ────────────────────────────────────────────

-- Situation 11 — correct: j = Jana Potok (dddddddd-0010)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0011-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    11,
    'Ihr Arbeitgeber hat Ihnen zwei Monate lang keinen Lohn gezahlt.',
    false,
    'dddddddd-0010-0003-0003-000000000001',
    0
)
ON CONFLICT DO NOTHING;


-- Situation 12 — correct: g = Wegmeier (dddddddd-0007)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0012-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    12,
    'Sie wollen sich selbstständig machen und möchten sich noch besser informieren.',
    false,
    'dddddddd-0007-0003-0003-000000000001',
    1
)
ON CONFLICT DO NOTHING;


-- Situation 13 — correct: d = Firma für Schutz (dddddddd-0004)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0013-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    13,
    'Das Gelände Ihrer Firma soll in der Nacht mit Wachhunden geschützt werden.',
    false,
    'dddddddd-0004-0003-0003-000000000001',
    2
)
ON CONFLICT DO NOTHING;


-- Situation 14 — correct: h = Objektsicherheit (dddddddd-0008)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0014-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    14,
    'Sie suchen jemanden für den Empfang.',
    false,
    'dddddddd-0008-0003-0003-000000000001',
    3
)
ON CONFLICT DO NOTHING;


-- Situation 15 — correct: X (no match)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0015-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    15,
    'Zum 50-jährigen Firmenjubiläum erwarten Sie viele Gäste. Sie wollen für ihre Sicherheit sorgen.',
    true,
    NULL,
    4
)
ON CONFLICT DO NOTHING;


-- Situation 16 — correct: e = Wirtschaftsprüfungs- u. Steuerberatungsgesellschaft (dddddddd-0005)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0016-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    16,
    'Ihr Unternehmen benötigt Hilfe in Steuerfragen.',
    false,
    'dddddddd-0005-0003-0003-000000000001',
    5
)
ON CONFLICT DO NOTHING;


-- Situation 17 — correct: k = Klarsicht (dddddddd-0011)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0017-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    17,
    'Die Fenster Ihrer Firma müssen gereinigt werden.',
    false,
    'dddddddd-0011-0003-0003-000000000001',
    6
)
ON CONFLICT DO NOTHING;


-- Situation 18 — correct: l = Frische Raumpflege (dddddddd-0012)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0018-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    18,
    'Ihre Reinigungskraft im Großraumbüro arbeitet unzuverlässig und Sie suchen einen Ersatz.',
    false,
    'dddddddd-0012-0003-0003-000000000001',
    7
)
ON CONFLICT DO NOTHING;


-- Situation 19 — correct: b = Grober Schmutz muss weg! (dddddddd-0002)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0019-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    19,
    'Am Firmenort hatten Sie im letzten Jahr große Schwierigkeiten mit dem Schnee, der nicht geräumt wurde.',
    false,
    'dddddddd-0002-0003-0003-000000000001',
    8
)
ON CONFLICT DO NOTHING;


-- Situation 20 — correct: c = Anwälte Hilge, Neumann (dddddddd-0003)
INSERT INTO lesen_teil3_situations
    (id, "exerciseId", "situationNumber", content, "noMatch", "correctAnnouncementId", "sortOrder")
VALUES (
    'eeeeeeee-0020-0003-0003-000000000001',
    'bbbbbbbb-0001-0003-0003-000000000001',
    20,
    'Mitarbeiter Ihrer Firma wollen eine neue technische Erfindung anmelden und damit schützen.',
    false,
    'dddddddd-0003-0003-0003-000000000001',
    9
)
ON CONFLICT DO NOTHING;

-- ======================================================================
-- Sprachbausteine Teil 2  (was 006_seed_sprachbausteine_teil2_modelltest1.sql)
--
-- This block generates its UUIDs in the database rather than carrying them,
-- so there is no key for ON CONFLICT to catch. The guard is NOT EXISTS on the
-- content revision for the exercise, and on the exercise id for the rows that
-- hang off it.
-- ======================================================================

-- ============================================================
-- SEED 006 — Sprachbausteine Teil 2, Modelltest 1
-- Source: Mit Erfolg zu telc Deutsch B1+ Beruf, Klett 2015, p. 15
-- Answers verified from Lösungen page 81
--
-- Correct answers: 31a  32m  33d  34c  35o  36n  37g  38e  39h  40l
-- Decoys (no gap):  b(ARBEIT)  f(BESONDEREN)  i(KARRIERE)
--                   j(LESEN)   k(NAHM)
--
-- Strategy: DB generates all UUIDs. Gaps reference words via
-- (SELECT id … WHERE letter = 'x') subquery — a wrong letter
-- produces NULL which violates the NOT NULL constraint immediately.
-- ============================================================

BEGIN;


-- ── 1. Exercise ──────────────────────────────────────────────

INSERT INTO sprachbausteine_teil2_exercises
  ("contentRevision", label, instruction, "durationMinutes", image_url, body, modelltest_id)
SELECT
  'modelltest-1-sprachbausteine-teil2-v1',
  '',
  'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.',
  18,
  'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/sprachbausteine-teil-2.png',
  E'Olga Fedorow\nSichelstr. 11 b\n40625 Düsseldorf\n\nStädtisches Klinikum Solingen gemeinnützige GmbH\nPersonalmanagement\nGotenstraße 1\n42653 Solingen\n\nDüsseldorf, 26. 07. 2015\n\nBewerbung\n\nSehr geehrte Damen und Herren,\n\nin der WELT habe ich Ihre -31- gefunden, die mich sofort interessierte.\nUm die ausgeschriebene -32- der stellvertretenden Pflegedienstleitung -33- ich mich.\n\nIn Russland habe ich meine schulische und berufliche -34- erhalten und drei Jahre praktische\nErfahrungen im Krankenhaus sammeln können. Nach unserer Übersiedlung nach Österreich\nhabe ich meine Sprachkenntnisse -35- und fand im Allgemeinen Krankenhaus der Stadt Wien\neine Anstellung als Stationsschwester. Nach einem Jahr -36- ich die Pflegedienstleitung in der\nGynäkologischen Abteilung.\n\nJetzt hat mein Mann in Düsseldorf eine attraktive Stelle als IT-Systemkoordinator angeboten\nbekommen, und so sind wir kurzentschlossen hierher umgezogen.\nIch möchte diese Veränderung als -37- nutzen, um neue Erfahrungen in leitender Position eines\ngroßen Klinikums zu sammeln.\n\nEinzelheiten meiner Ausbildung und meines -38- Werdegangs können Sie meinem\nLebenslauf und den beigefügten Zeugnissen/Bescheinigungen -39- . Über die Möglichkeit eines\n-40- Gespräches würde ich mich freuen.\n\nMit freundlichen Grüßen\nOlga Fedorow\nAnlagen',
  (SELECT id FROM modelltests WHERE number = 1)
WHERE NOT EXISTS (
  SELECT 1 FROM sprachbausteine_teil2_exercises
   WHERE "contentRevision" = 'modelltest-1-sprachbausteine-teil2-v1'
);


-- ── 2. Words (15 items, UUIDs generated by DB) ───────────────

INSERT INTO sprachbausteine_teil2_words
  ("exerciseId", letter, content, "sortOrder")
SELECT
  e.id,
  w.letter,
  w.content,
  w.sort_order
FROM sprachbausteine_teil2_exercises e,
(VALUES
  ('a', 'ANZEIGE',      0),
  ('b', 'ARBEIT',       1),
  ('c', 'AUSBILDUNG',   2),
  ('d', 'BEWERBE',      3),
  ('e', 'BERUFLICHEN',  4),
  ('f', 'BESONDEREN',   5),
  ('g', 'CHANCE',       6),
  ('h', 'ENTNEHMEN',    7),
  ('i', 'KARRIERE',     8),
  ('j', 'LESEN',        9),
  ('k', 'NAHM',        10),
  ('l', 'PERSÖNLICHEN',11),
  ('m', 'STELLE',      12),
  ('n', 'ÜBERNAHM',    13),
  ('o', 'VERBESSERT',  14)
) AS w(letter, content, sort_order)
WHERE e."contentRevision" = 'modelltest-1-sprachbausteine-teil2-v1'
  AND NOT EXISTS (
    SELECT 1 FROM sprachbausteine_teil2_words w2 WHERE w2."exerciseId" = e.id
  );


-- ── 3. Gaps (10 items, linked by letter subquery) ────────────
-- Each (SELECT id …) either returns the word UUID or NULL.
-- NULL violates correctWordId NOT NULL → immediate insert failure.

INSERT INTO sprachbausteine_teil2_gaps
  ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder")
SELECT
  e.id,
  g.gap_key,
  g.gap_number::int,
  (SELECT w.id FROM sprachbausteine_teil2_words w
   WHERE w."exerciseId" = e.id AND w.letter = g.correct_letter),
  g.sort_order::int
FROM sprachbausteine_teil2_exercises e,
(VALUES
  ('31', 31, 'a', 0),
  ('32', 32, 'm', 1),
  ('33', 33, 'd', 2),
  ('34', 34, 'c', 3),
  ('35', 35, 'o', 4),
  ('36', 36, 'n', 5),
  ('37', 37, 'g', 6),
  ('38', 38, 'e', 7),
  ('39', 39, 'h', 8),
  ('40', 40, 'l', 9)
) AS g(gap_key, gap_number, correct_letter, sort_order)
WHERE e."contentRevision" = 'modelltest-1-sprachbausteine-teil2-v1'
  AND NOT EXISTS (
    SELECT 1 FROM sprachbausteine_teil2_gaps g2 WHERE g2."exerciseId" = e.id
  );
