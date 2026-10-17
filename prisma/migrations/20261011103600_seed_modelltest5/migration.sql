-- Modelltest 5 normalized from seed source JSON.
-- Runtime-only mapping: extraction provenance/sourceTrack are intentionally omitted.
-- Re-running replaces only this Modelltest's child content, keeping the seed deterministic.
BEGIN;

DO $$
DECLARE
  mt_id UUID;
  seed_exercise_id UUID;
BEGIN
  INSERT INTO "modelltests" ("number", "title", "exam_only")
  VALUES (5, 'Modelltest 5', FALSE)
  ON CONFLICT ("number") DO UPDATE SET "title" = EXCLUDED."title"
  RETURNING "id" INTO mt_id;

  INSERT INTO "lesen_teil1_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-5-lesen-teil1-v1', 'Leseverstehen Teil 1', 'Lesen Sie die Überschriften a–j und die Texte 1–5. Finden Sie für jeden Text die passende Überschrift. Sie können jede Überschrift nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 1–5 auf dem Antwortbogen.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision",
    "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil1_texts" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil1_titles" ("exerciseId", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Immer mehr Beschäftigte arbeiten teilweise von zu Hause', 0),
    (seed_exercise_id, 'Neue Ausbildung mit besonders hohen Gehältern', 1),
    (seed_exercise_id, 'Ein Praktikum kann den Einstieg in den Beruf erleichtern', 2),
    (seed_exercise_id, 'Viele Arbeitnehmer wünschen sich kürzere Arbeitszeiten', 3),
    (seed_exercise_id, 'Unternehmen suchen dringend neue Mitarbeiter', 4),
    (seed_exercise_id, 'Gute Kollegen sind vielen wichtiger als ein hohes Gehalt', 5),
    (seed_exercise_id, 'Neue Regeln für Bewerbungen im Internet', 6),
    (seed_exercise_id, 'Weiterbildung wird für Berufstätige immer wichtiger', 7),
    (seed_exercise_id, 'Mehr Urlaub für alle Beschäftigten geplant', 8),
    (seed_exercise_id, 'Berufseinsteiger wechseln heute häufiger den Arbeitsplatz', 9);
  INSERT INTO "lesen_teil1_texts"
    ("exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
    (seed_exercise_id, 1, NULL, NULL, 'Viele Unternehmen bieten ihren Beschäftigten inzwischen die Möglichkeit, an einigen Tagen pro Woche von zu Hause zu arbeiten. Besonders beliebt ist dieses Modell bei Menschen, die einen langen Arbeitsweg haben. Eine aktuelle Umfrage zeigt, dass viele Beschäftigte zwei oder drei Tage im Büro und den Rest der Woche zu Hause arbeiten möchten.', 0, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0)),
    (seed_exercise_id, 2, NULL, NULL, 'Für viele junge Menschen ist ein Praktikum die erste Möglichkeit, einen Beruf genauer kennenzulernen. Sie können dabei praktische Erfahrungen sammeln, Kontakte zu Unternehmen knüpfen und herausfinden, ob der Beruf wirklich zu ihnen passt. Manche Firmen übernehmen gute Praktikanten später sogar als Auszubildende oder feste Mitarbeiter.', 1, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 2)),
    (seed_exercise_id, 3, NULL, NULL, 'In einer Befragung von mehr als 2.000 Arbeitnehmerinnen und Arbeitnehmern gaben viele an, dass ein gutes Verhältnis zu den Kollegen für sie besonders wichtig ist. Ein angenehmes Arbeitsklima und gegenseitige Unterstützung wurden häufiger genannt als zusätzliche finanzielle Vorteile.', 2, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5)),
    (seed_exercise_id, 4, NULL, NULL, 'Neue Computerprogramme, künstliche Intelligenz und digitale Arbeitsprozesse verändern viele Berufe. Deshalb investieren immer mehr Firmen in Schulungen für ihre Mitarbeiter. Auch viele Berufstätige besuchen freiwillig Kurse, um ihre Kenntnisse zu verbessern und beruflich flexibel zu bleiben.', 3, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 7)),
    (seed_exercise_id, 5, NULL, NULL, 'Junge Erwachsene bleiben heute oft nicht mehr viele Jahre beim ersten Arbeitgeber. Eine Studie zeigt, dass besonders Beschäftigte unter 30 häufiger die Firma wechseln als ältere Arbeitnehmer. Als Gründe nennen sie bessere Entwicklungsmöglichkeiten, ein höheres Gehalt oder interessantere Aufgaben.', 4, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 9));

  INSERT INTO "lesen_teil2_exercises"
    ("contentRevision", "label", "instruction", "cautionNote", "topSender",
     "topReceiver", "topBody", "quotedThread", "modelltest_id")
  VALUES ('modelltest-5-lesen-teil2-v1', 'Leseverstehen Teil 2', 'Lesen Sie den Text und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.',
    '', '', '',
    'Vier Tage arbeiten, fünf Tage bezahlt werden

Die Firma Heller Technik beschäftigt rund 80 Mitarbeiterinnen und Mitarbeiter. Seit sechs Monaten arbeitet ein Teil der Belegschaft nur noch vier Tage pro Woche. Das Besondere dabei: Das monatliche Gehalt wurde nicht reduziert.

Die Idee kam von der Geschäftsführung. In den Jahren zuvor hatte das Unternehmen immer größere Schwierigkeiten, neue Fachkräfte zu finden. Gleichzeitig berichteten viele Beschäftigte, dass sie sich mehr Zeit für Familie und Freizeit wünschten.

Bevor das neue Modell eingeführt wurde, testete die Firma es zunächst drei Monate lang in zwei Abteilungen. Die Beschäftigten arbeiteten montags bis donnerstags jeweils etwas länger als vorher. Freitags hatten sie frei. Wichtig war allerdings, dass Kunden trotzdem an fünf Tagen pro Woche jemanden erreichen konnten. Deshalb arbeiten einige Teams mit unterschiedlichen freien Tagen.

Nach der Testphase war die Geschäftsführung überrascht. Obwohl die Beschäftigten insgesamt weniger Stunden arbeiteten, wurden die meisten Aufgaben genauso schnell erledigt wie vorher. Die Zahl der Krankmeldungen ging sogar leicht zurück.

Für Projektleiterin Sarah Neumann hat sich besonders ihr privater Alltag verbessert. Sie nutzt den freien Tag häufig für Termine, Einkäufe und Sport. Dadurch habe sie am Wochenende mehr Zeit für ihre Familie.

Nicht alle Beschäftigten sind jedoch begeistert. Einige Mitarbeiter in der Produktion können ihre Arbeitszeit weniger flexibel organisieren. Außerdem sind die Arbeitstage von Montag bis Donnerstag länger geworden. Für Eltern kleiner Kinder kann das manchmal schwierig sein.

Trotzdem will die Firma das Modell weiterführen und im kommenden Jahr auf weitere Abteilungen ausweiten. Eine Rückkehr zur alten Fünf-Tage-Woche ist derzeit nicht geplant.', '', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "cautionNote" = EXCLUDED."cautionNote",
    "topSender" = EXCLUDED."topSender", "topReceiver" = EXCLUDED."topReceiver",
    "topBody" = EXCLUDED."topBody", "quotedThread" = EXCLUDED."quotedThread"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil2_options" WHERE "questionId" IN
    (SELECT "id" FROM "lesen_teil2_questions" WHERE "exerciseId" = seed_exercise_id);
  DELETE FROM "lesen_teil2_questions" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 6, 'Warum hat die Firma das neue Arbeitsmodell eingeführt?', 0)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Sie wollte leichter neue Fachkräfte gewinnen und Wünsche der Beschäftigten berücksichtigen.', true, 0),
    (seed_exercise_id, 'Sie wollte die Gehälter der Beschäftigten reduzieren.', false, 1),
    (seed_exercise_id, 'Sie wollte freitags keine Kunden mehr bedienen.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 7, 'Was geschah vor der endgültigen Einführung?', 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Alle Mitarbeiter arbeiteten sofort nur noch vier Tage.', false, 0),
    (seed_exercise_id, 'Das Modell wurde zuerst in zwei Abteilungen ausprobiert.', true, 1),
    (seed_exercise_id, 'Die Firma schloss freitags vollständig.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 8, 'Was zeigte sich während der Testphase?', 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Die meisten Aufgaben wurden weiterhin ähnlich schnell erledigt.', true, 0),
    (seed_exercise_id, 'Die Zahl der Krankmeldungen stieg stark.', false, 1),
    (seed_exercise_id, 'Die Kunden beschwerten sich über schlechtere Qualität.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 9, 'Welchen Vorteil sieht Sarah Neumann?', 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Sie verdient jetzt deutlich mehr.', false, 0),
    (seed_exercise_id, 'Sie muss weniger Verantwortung übernehmen.', false, 1),
    (seed_exercise_id, 'Sie kann private Aufgaben an ihrem freien Tag erledigen.', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 10, 'Warum finden einige Beschäftigte das Modell schwierig?', 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Sie haben jetzt überhaupt keinen freien Tag.', false, 0),
    (seed_exercise_id, 'Die Arbeitstage sind teilweise länger geworden.', true, 1),
    (seed_exercise_id, 'Sie müssen jeden Freitag im Homeoffice arbeiten.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "lesen_teil3_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-5-lesen-teil3-v1', 'Leseverstehen Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Finden Sie für jede Situation die passende Anzeige. Sie können jede Anzeige nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 11–20 auf dem Antwortbogen. Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein x.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil3_situations" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil3_announcements" ("exerciseId", "title", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Bewerbungscheck', 'Sie möchten sich bewerben, sind aber unsicher bei Lebenslauf und Anschreiben? Wir prüfen Ihre Unterlagen und geben persönliche Tipps. Jeden Dienstag von 15 bis 18 Uhr. Anmeldung erforderlich.', 0),
    (seed_exercise_id, 'Excel für den Beruf', 'Grundkurs für Berufstätige. Tabellen erstellen, Berechnungen durchführen und Daten übersichtlich darstellen. Vier Abende, jeweils Montag und Mittwoch von 18 bis 20 Uhr.', 1),
    (seed_exercise_id, 'Aushilfe im Café gesucht', 'Wir suchen freundliche Unterstützung am Samstag und Sonntag zwischen 10 und 18 Uhr. Erfahrung ist nicht erforderlich. Ideal für Studierende.', 2),
    (seed_exercise_id, 'Deutsch am Arbeitsplatz', 'Berufsbezogener Deutschkurs für Erwachsene ab Niveau B1. Telefonieren, E-Mails schreiben, Besprechungen und Gespräche mit Kunden. Dienstag und Donnerstag 18.30–20.30 Uhr.', 3),
    (seed_exercise_id, 'Karrieretag Technik', 'Mehr als 30 Unternehmen stellen sich vor. Informieren Sie sich über Stellen, Praktika und Ausbildungsplätze. Samstag von 10 bis 16 Uhr. Eintritt frei.', 4),
    (seed_exercise_id, 'Kinderbetreuung für Berufstätige', 'Betreuung montags bis freitags von 7 bis 18 Uhr für Kinder zwischen zwei und sechs Jahren. Flexible Buchung einzelner Wochentage möglich.', 5),
    (seed_exercise_id, 'Online-Seminar: Erfolgreich im Vorstellungsgespräch', 'Wie beantworte ich schwierige Fragen? Wie stelle ich meine Stärken vor? Kostenloses Online-Seminar am Donnerstag um 19 Uhr.', 6),
    (seed_exercise_id, 'Coworking am Hauptbahnhof', 'Ruhige Arbeitsplätze, schnelles WLAN und Besprechungsräume. Tageskarte 15 Euro. Montag bis Samstag von 8 bis 20 Uhr.', 7),
    (seed_exercise_id, 'Praktikumsbörse', 'Unternehmen aus der Region bieten Praktika in Büro, Technik, Handel und Pflege an. Angebote für Schülerinnen, Schüler und Studierende.', 8),
    (seed_exercise_id, 'Weiterbildung Projektmanagement', 'Berufsbegleitender Kurs über Planung, Organisation und Teamarbeit. Zwölf Wochen, immer freitagabends und samstags.', 9),
    (seed_exercise_id, 'Fahrradkurier gesucht', 'Flexible Arbeitszeiten von Montag bis Freitag. Eigenes Fahrrad erforderlich. Bezahlung pro Stunde plus Bonus.', 10),
    (seed_exercise_id, 'Berufsberatung für Erwachsene', 'Sie möchten Ihren Beruf wechseln oder wissen nicht, welche Weiterbildung zu Ihnen passt? Persönliche Beratung nach Terminvereinbarung.', 11);
  INSERT INTO "lesen_teil3_situations"
    ("exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
    (seed_exercise_id, 11, 'Sie möchten Ihren Lebenslauf verbessern, bevor Sie sich bei einer Firma bewerben.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0), 0),
    (seed_exercise_id, 12, 'Sie arbeiten im Büro und müssen lernen, besser mit Tabellen zu arbeiten.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 1), 1),
    (seed_exercise_id, 13, 'Sie studieren und möchten nur am Wochenende etwas Geld verdienen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 2), 2),
    (seed_exercise_id, 14, 'Sie sprechen schon Deutsch auf B1-Niveau und möchten besser mit Kollegen und Kunden kommunizieren.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 3), 3),
    (seed_exercise_id, 15, 'Sie suchen eine technische Arbeitsstelle und möchten mehrere Firmen an einem Tag kennenlernen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 4), 4),
    (seed_exercise_id, 16, 'Sie haben bald ein Bewerbungsgespräch und möchten sich darauf vorbereiten, aber nicht zu einem Kurs fahren.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 6), 5),
    (seed_exercise_id, 17, 'Sie arbeiten normalerweise von zu Hause, brauchen aber morgen einen ruhigen Arbeitsplatz mit Internet.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 7), 6),
    (seed_exercise_id, 18, 'Sie studieren und möchten praktische Berufserfahrung in einem Unternehmen sammeln.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8), 7),
    (seed_exercise_id, 19, 'Sie möchten einen neuen Beruf lernen und suchen einen kostenlosen Kurs, der jeden Vormittag stattfindet.', true, NULL, 8),
    (seed_exercise_id, 20, 'Sie denken über einen Berufswechsel nach und möchten zuerst mit jemandem darüber sprechen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 11), 9);

  INSERT INTO "sprachbausteine_exercises"
    ("teil_number", "content_revision", "label", "instruction", "duration_minutes",
     "image_url", "body", "modelltest_id")
  VALUES (1, 'modelltest-5-sprachbausteine-teil1-v1', 'Sprachbausteine Teil 1',
    'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, '', 'Liebe Julia,

ich muss dir unbedingt von meinem neuen Job erzählen. Seit zwei Wochen arbeite ich bei einer kleinen Firma, _____ Software für Hotels entwickelt.

Am ersten Tag war ich natürlich ziemlich nervös, _____ meine neuen Kollegen haben mich sehr freundlich begrüßt. Zuerst _____ mir meine Teamleiterin das Büro gezeigt und mich allen vorgestellt.

Ich arbeite normalerweise von neun bis siebzehn Uhr. Zweimal pro Woche darf ich aber auch _____ zu Hause arbeiten. Das finde ich besonders praktisch, weil mein Arbeitsweg fast eine Stunde _____ .

Die Aufgaben sind interessant, aber ich muss noch viel lernen. Zum Glück kann ich meine Kollegen immer fragen, wenn ich etwas nicht _____ .

Nächsten Monat nehme ich außerdem _____ einer Schulung teil. Dort lernen wir ein neues Programm kennen, das wir später bei der Arbeit benutzen werden.

Was mir bisher am besten gefällt, _____ die Atmosphäre im Team. Mittags essen wir oft zusammen und freitags trinken wir nach der Arbeit manchmal noch etwas.

Ich hoffe, dass du mich bald besuchen kannst. Dann _____ ich dir auch mein neues Büro zeigen.

Schreib mir, _____ du am nächsten Wochenende Zeit hast.

Liebe Grüße
Anna', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "teil_number" = EXCLUDED."teil_number", "content_revision" = EXCLUDED."content_revision",
    "label" = EXCLUDED."label", "instruction" = EXCLUDED."instruction",
    "duration_minutes" = EXCLUDED."duration_minutes", "image_url" = EXCLUDED."image_url",
    "body" = EXCLUDED."body"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "sprachbausteine_gap_options" WHERE "gap_id" IN
    (SELECT "id" FROM "sprachbausteine_gaps" WHERE "exercise_id" = seed_exercise_id);
  DELETE FROM "sprachbausteine_gaps" WHERE "exercise_id" = seed_exercise_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '21', 21, 0)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'die', true, 0),
    (seed_exercise_id, 'der', false, 1),
    (seed_exercise_id, 'den', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '22', 22, 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'aber', true, 0),
    (seed_exercise_id, 'denn', false, 1),
    (seed_exercise_id, 'sondern', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '23', 23, 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'hat', true, 0),
    (seed_exercise_id, 'ist', false, 1),
    (seed_exercise_id, 'wird', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '24', 24, 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'von', false, 0),
    (seed_exercise_id, 'bei', false, 1),
    (seed_exercise_id, 'zu', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '25', 25, 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'dauert', true, 0),
    (seed_exercise_id, 'braucht', false, 1),
    (seed_exercise_id, 'geht', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '26', 26, 5)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'verstehe', true, 0),
    (seed_exercise_id, 'verstanden', false, 1),
    (seed_exercise_id, 'verstand', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '27', 27, 6)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'an', true, 0),
    (seed_exercise_id, 'auf', false, 1),
    (seed_exercise_id, 'für', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '28', 28, 7)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'sind', false, 0),
    (seed_exercise_id, 'ist', true, 1),
    (seed_exercise_id, 'war', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '29', 29, 8)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'kann', false, 0),
    (seed_exercise_id, 'werde', true, 1),
    (seed_exercise_id, 'würde', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '30', 30, 9)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'ob', true, 0),
    (seed_exercise_id, 'als', false, 1),
    (seed_exercise_id, 'damit', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "sprachbausteine_teil2_exercises"
    ("contentRevision", "label", "instruction", "durationMinutes", "image_url", "body", "modelltest_id")
  VALUES ('modelltest-5-sprachbausteine-teil2-v1', 'Sprachbausteine Teil 2', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, '', 'Sehr geehrte Damen und Herren,

auf Ihrer Internetseite habe ich gelesen, dass Sie im November einen Kurs zum Thema Projektmanagement anbieten. Ich interessiere mich sehr _____ diesen Kurs und hätte _____ einige Fragen.

Ich arbeite seit zwei Jahren in einem kleinen Unternehmen und soll in Zukunft mehr Verantwortung für Projekte übernehmen. _____ habe ich bisher noch keine Weiterbildung in diesem Bereich gemacht.

Könnten Sie mir bitte mitteilen, _____ Vorkenntnisse für die Teilnahme notwendig sind? Außerdem würde ich gern wissen, _____ der Unterricht hauptsächlich theoretisch ist oder ob man auch praktische Aufgaben bearbeitet.

Da ich von Montag bis Freitag arbeite, wäre es für mich wichtig zu wissen, _____ genau die Unterrichtszeiten sind. Auf Ihrer Internetseite steht nur, dass der Kurs berufsbegleitend stattfindet.

Mich interessiert _____, ob die Kursgebühr alle Lernmaterialien enthält. Falls zusätzliche Kosten entstehen, könnten Sie mir bitte sagen, wie hoch diese ungefähr sind?

Ich würde mich _____ anmelden, wenn noch ein Platz frei ist. Bitte schicken Sie mir auch Informationen darüber, _____ ich mich anmelden kann.

Ich wäre Ihnen sehr _____, wenn Sie mir bald antworten könnten.

Mit freundlichen Grüßen
Thomas Wagner', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "durationMinutes" = EXCLUDED."durationMinutes",
    "image_url" = EXCLUDED."image_url", "body" = EXCLUDED."body"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "sprachbausteine_teil2_gaps" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "sprachbausteine_teil2_words" ("exerciseId", "letter", "content", "sortOrder") VALUES
    (seed_exercise_id, 'a', 'ABER', 0),
    (seed_exercise_id, 'b', 'AUCH', 1),
    (seed_exercise_id, 'c', 'DANKBAR', 2),
    (seed_exercise_id, 'd', 'DESHALB', 3),
    (seed_exercise_id, 'e', 'FÜR', 4),
    (seed_exercise_id, 'f', 'GERNE', 5),
    (seed_exercise_id, 'g', 'NOCH', 6),
    (seed_exercise_id, 'h', 'OB', 7),
    (seed_exercise_id, 'i', 'WANN', 8),
    (seed_exercise_id, 'j', 'WIE', 9),
    (seed_exercise_id, 'k', 'WENN', 10),
    (seed_exercise_id, 'l', 'WELCHE', 11),
    (seed_exercise_id, 'm', 'TROTZDEM', 12),
    (seed_exercise_id, 'n', 'DAMIT', 13),
    (seed_exercise_id, 'o', 'WEGEN', 14);
  INSERT INTO "sprachbausteine_teil2_gaps"
    ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
    (seed_exercise_id, '31', 31, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'e'), 0),
    (seed_exercise_id, '32', 32, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'g'), 1),
    (seed_exercise_id, '33', 33, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'a'), 2),
    (seed_exercise_id, '34', 34, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'l'), 3),
    (seed_exercise_id, '35', 35, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'h'), 4),
    (seed_exercise_id, '36', 36, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'i'), 5),
    (seed_exercise_id, '37', 37, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'b'), 6),
    (seed_exercise_id, '38', 38, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'f'), 7),
    (seed_exercise_id, '39', 39, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'j'), 8),
    (seed_exercise_id, '40', 40, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'c'), 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 41–45. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 41–45. Sie haben dazu 30 Sekunden Zeit.',
    'modelltest-5-hoeren-teil1-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-5-hoeren/modelltest-5-hoeren-teil1.mp3', '',
    '', '41
Ich arbeite seit einem Jahr in einem kleinen Reisebüro. Eigentlich gefällt mir die Arbeit sehr gut, besonders der Kontakt mit den Kunden. Nur mein Arbeitsweg ist ziemlich lang. Mit Bus und Bahn brauche ich morgens fast eine Stunde. Deshalb darf ich inzwischen jeden Mittwoch von zu Hause arbeiten. Das finde ich sehr angenehm.

42
Ich habe vor drei Monaten meine Ausbildung angefangen. Am Anfang dachte ich, dass ich hauptsächlich zuschauen würde. Aber schon nach wenigen Wochen durfte ich viele Aufgaben selbst erledigen. Natürlich macht man dabei manchmal Fehler, aber meine Kollegen erklären mir dann, wie es richtig geht. Dadurch lerne ich sehr viel.

43
Früher habe ich oft bis spät am Abend gearbeitet. Irgendwann habe ich gemerkt, dass ich kaum noch Zeit für meine Familie und meine Freunde hatte. Seit Januar arbeite ich deshalb nur noch 30 Stunden pro Woche. Ich verdiene jetzt etwas weniger, aber für mich war das die richtige Entscheidung.

44
In meinem neuen Team arbeiten zwölf Personen. Wir verstehen uns eigentlich sehr gut. Mittags essen wir oft gemeinsam. Nur am Freitag arbeite ich meistens allein im Büro, weil viele meiner Kollegen an diesem Tag im Homeoffice sind.

45
Ich suche gerade eine neue Stelle. Früher habe ich Bewerbungen einfach an viele Unternehmen geschickt. Diesmal informiere ich mich vorher genau über jede Firma und passe mein Anschreiben an die jeweilige Stelle an. Das dauert länger, aber ich hoffe, dass meine Chancen dadurch besser sind.')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "instruction" = EXCLUDED."instruction", "content_revision" = EXCLUDED."content_revision",
    "duration_minutes" = EXCLUDED."duration_minutes", "audio_url" = EXCLUDED."audio_url",
    "bundled_audio_asset" = EXCLUDED."bundled_audio_asset", "image_url" = EXCLUDED."image_url",
    "transcript" = EXCLUDED."transcript"
  RETURNING "id" INTO seed_exercise_id;
  DELETE FROM "listening_questions" WHERE "exercise_id" = seed_exercise_id;
  INSERT INTO "listening_questions"
    ("exercise_id", "question_number", "prompt", "correct_answer", "sort_order") VALUES
    (seed_exercise_id, 41, 'Die Sprecherin arbeitet einmal pro Woche von zu Hause.', '+', 0),
    (seed_exercise_id, 42, 'Der Sprecher darf während seiner Ausbildung noch keine Aufgaben selbst erledigen.', '-', 1),
    (seed_exercise_id, 43, 'Die Sprecherin arbeitet jetzt weniger Stunden als früher.', '+', 2),
    (seed_exercise_id, 44, 'Freitags sind normalerweise alle Kollegen gemeinsam im Büro.', '-', 3),
    (seed_exercise_id, 45, 'Der Sprecher schreibt für jede Bewerbung ein passendes Anschreiben.', '+', 4);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 46–55. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 46–55. Sie haben dazu eine Minute Zeit.',
    'modelltest-5-hoeren-teil2-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-5-hoeren/modelltest-5-hoeren-teil2.mp3', '',
    '', 'Moderator: Willkommen zu unserer Sendung Beruf und Alltag. Heute sprechen wir über die Vier-Tage-Woche. Bei mir ist Frau Lena Hoffmann. Sie arbeitet seit acht Jahren bei der Firma Bergmann Design. Guten Tag, Frau Hoffmann.

Frau Hoffmann: Guten Tag.

Moderator: Ihre Firma testet seit fast einem Jahr eine Vier-Tage-Woche. Wie kam es dazu?

Frau Hoffmann: Die Idee kam tatsächlich von unserer Geschäftsleitung. Wir hatten Schwierigkeiten, neue Mitarbeiter zu finden, und gleichzeitig haben viele Kollegen bei einer internen Befragung gesagt, dass sie sich flexiblere Arbeitszeiten wünschen.

Moderator: Arbeiten jetzt alle Beschäftigten nur noch vier Tage?

Frau Hoffmann: Nein, nicht alle. Wir haben ungefähr 120 Mitarbeiter. Rund 70 nehmen momentan an dem Modell teil. In einigen Abteilungen, zum Beispiel im Kundendienst, ist es schwieriger, weil unsere Kunden von Montag bis Freitag jemanden erreichen müssen.

Moderator: Haben denn alle Teilnehmer am Freitag frei?

Frau Hoffmann: Nein. Das wäre organisatorisch nicht möglich. Die Teams sprechen sich ab. Einige haben freitags frei, andere montags oder mittwochs. Wichtig ist, dass immer genügend Personen erreichbar sind.

Moderator: Und arbeiten Sie an den anderen Tagen länger?

Frau Hoffmann: Etwas länger, ja. Früher habe ich ungefähr acht Stunden pro Tag gearbeitet. Jetzt sind es von Montag bis Donnerstag meistens etwa neun Stunden. Trotzdem arbeite ich insgesamt weniger als vorher.

Moderator: Hat sich Ihr Gehalt dadurch verändert?

Frau Hoffmann: Nein. Während des Testprojekts bekommen wir weiterhin unser normales Gehalt. Das war natürlich ein wichtiger Punkt für viele Kollegen.

Moderator: Wie wirkt sich das Modell auf die Arbeit aus?

Frau Hoffmann: Erstaunlich gut. Wir haben viele Besprechungen kürzer gemacht und versuchen, Aufgaben besser zu planen. Früher gab es manchmal Meetings, bei denen nicht wirklich jeder dabei sein musste. Heute überlegen wir genauer, wer gebraucht wird.

Moderator: Und schaffen Sie tatsächlich genauso viel Arbeit?

Frau Hoffmann: In unserem Team ja. In manchen Monaten waren wir sogar etwas schneller. Natürlich funktioniert das nicht automatisch. Man muss sehr gut planen und darf wichtige Aufgaben nicht einfach auf den nächsten Tag verschieben.

Moderator: Wie verbringen Sie persönlich Ihren freien Tag?

Frau Hoffmann: Ganz unterschiedlich. Ich erledige oft Arzttermine oder Einkäufe. Manchmal besuche ich meine Eltern. Besonders schön finde ich, dass am Wochenende weniger Dinge übrig bleiben, die ich noch erledigen muss.

Moderator: Gibt es auch Nachteile?

Frau Hoffmann: Ja. Die längeren Arbeitstage können anstrengend sein. Besonders Kolleginnen und Kollegen mit kleinen Kindern müssen ihre Betreuung gut organisieren. Manche haben deshalb entschieden, lieber bei der normalen Fünf-Tage-Woche zu bleiben.

Moderator: Was sagen die Kunden zu dem Modell?

Frau Hoffmann: Die meisten merken gar keinen Unterschied. Wir achten darauf, dass jeden Werktag jemand erreichbar ist. Beschwerden wegen der Vier-Tage-Woche hatten wir bisher jedenfalls keine.

Moderator: Und wie geht es nach dem Test weiter?

Frau Hoffmann: Das wird im Dezember entschieden. Die Geschäftsleitung wertet gerade Zahlen und Rückmeldungen aus. Viele von uns hoffen natürlich, dass das Modell dauerhaft angeboten wird.

Moderator: Frau Hoffmann, vielen Dank für das Gespräch.

Frau Hoffmann: Sehr gerne.')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "instruction" = EXCLUDED."instruction", "content_revision" = EXCLUDED."content_revision",
    "duration_minutes" = EXCLUDED."duration_minutes", "audio_url" = EXCLUDED."audio_url",
    "bundled_audio_asset" = EXCLUDED."bundled_audio_asset", "image_url" = EXCLUDED."image_url",
    "transcript" = EXCLUDED."transcript"
  RETURNING "id" INTO seed_exercise_id;
  DELETE FROM "listening_questions" WHERE "exercise_id" = seed_exercise_id;
  INSERT INTO "listening_questions"
    ("exercise_id", "question_number", "prompt", "correct_answer", "sort_order") VALUES
    (seed_exercise_id, 46, 'Die Idee für die Vier-Tage-Woche kam von der Geschäftsleitung.', '+', 0),
    (seed_exercise_id, 47, 'Alle 120 Mitarbeiter nehmen an dem neuen Arbeitsmodell teil.', '-', 1),
    (seed_exercise_id, 48, 'Alle Beschäftigten im Modell haben freitags frei.', '-', 2),
    (seed_exercise_id, 49, 'Frau Hoffmann arbeitet an ihren Arbeitstagen länger als früher.', '+', 3),
    (seed_exercise_id, 50, 'Die Teilnehmer erhalten während des Tests weniger Gehalt.', '-', 4),
    (seed_exercise_id, 51, 'Die Firma hat unter anderem Besprechungen kürzer gemacht.', '+', 5),
    (seed_exercise_id, 52, 'Das Team von Frau Hoffmann erledigt jetzt deutlich weniger Arbeit.', '-', 6),
    (seed_exercise_id, 53, 'Frau Hoffmann nutzt ihren freien Tag auch für private Termine.', '+', 7),
    (seed_exercise_id, 54, 'Für Beschäftigte mit kleinen Kindern können die längeren Arbeitstage schwierig sein.', '+', 8),
    (seed_exercise_id, 55, 'Es steht bereits fest, dass die Vier-Tage-Woche dauerhaft bleibt.', '-', 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind. Markieren Sie Ihre Lösungen für die Aufgaben 56–60 auf dem Antwortbogen. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch.',
    'modelltest-5-hoeren-teil3-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-5-hoeren/modelltest-5-hoeren-teil3.mp3', '',
    '', '56
Guten Morgen, liebe Kolleginnen und Kollegen. Wegen technischer Arbeiten steht unser internes Computersystem heute zwischen 13 und 15 Uhr nicht zur Verfügung. Bitte speichern Sie wichtige Dokumente vorher auf Ihrem Computer. E-Mails können während dieser Zeit weiterhin gesendet und empfangen werden.

57
Hier ist die Sprachschule ProJob. Der für morgen geplante Kurs Deutsch am Arbeitsplatz beginnt nicht wie angekündigt um 18 Uhr, sondern bereits um 17 Uhr 30. Der Unterricht findet weiterhin in Raum 204 statt. Bei Fragen erreichen Sie unser Büro bis 16 Uhr.

58
Achtung, Fahrgäste. Der Regionalexpress 5 nach Köln fällt heute wegen einer technischen Störung aus. Reisende nach Köln benutzen bitte den Regionalexpress 1 um 8 Uhr 42 von Gleis 6. Ihre vorhandenen Fahrkarten bleiben gültig.

59
Willkommen zum Karrieretag im Messezentrum. Die Vorträge zu Ausbildung und Studium finden im ersten Stock statt. Persönliche Bewerbungsgespräche mit den teilnehmenden Unternehmen gibt es dagegen in Halle 3. Bitte bringen Sie dafür mehrere Kopien Ihres Lebenslaufs mit.

60
Hallo Frau Peters, hier ist Daniel Sommer von der Firma Nordbau. Es geht um Ihr Vorstellungsgespräch am Donnerstag. Der Termin um 10 Uhr muss leider verschoben werden. Könnten Sie stattdessen am selben Tag um 14 Uhr kommen? Bitte rufen Sie mich kurz zurück. Vielen Dank.')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "instruction" = EXCLUDED."instruction", "content_revision" = EXCLUDED."content_revision",
    "duration_minutes" = EXCLUDED."duration_minutes", "audio_url" = EXCLUDED."audio_url",
    "bundled_audio_asset" = EXCLUDED."bundled_audio_asset", "image_url" = EXCLUDED."image_url",
    "transcript" = EXCLUDED."transcript"
  RETURNING "id" INTO seed_exercise_id;
  DELETE FROM "listening_questions" WHERE "exercise_id" = seed_exercise_id;
  INSERT INTO "listening_questions"
    ("exercise_id", "question_number", "prompt", "correct_answer", "sort_order") VALUES
    (seed_exercise_id, 56, 'Während der technischen Arbeiten funktioniert auch die E-Mail nicht.', '-', 0),
    (seed_exercise_id, 57, 'Der Sprachkurs beginnt morgen früher als ursprünglich geplant.', '+', 1),
    (seed_exercise_id, 58, 'Der Regionalexpress 5 fährt heute nach Köln.', '-', 2),
    (seed_exercise_id, 59, 'Für Bewerbungsgespräche sollen die Besucher Lebensläufe mitbringen.', '+', 3),
    (seed_exercise_id, 60, 'Das Vorstellungsgespräch soll am Donnerstag um 14 Uhr stattfinden.', '+', 4);

  INSERT INTO "writing_exercises"
    ("content_revision", "title", "subtitle", "task_type", "intro", "stimulus",
     "task_instructions", "bullet_points", "closing_reminder", "modelltest_id")
  VALUES ('modelltest-5-schreiben-v1', 'Schriftlicher Ausdruck', 'Sie haben von einer Freundin folgende E-Mail erhalten:',
    'brief', 'Sie haben von einer Freundin folgende E-Mail erhalten:', '{"heading":"Liebe/r __________,","subheading":null,"body":"endlich habe ich einen neuen Job gefunden! Nächsten Monat fange ich in einer großen Firma an. Einerseits freue ich mich sehr, andererseits bin ich ziemlich nervös, weil ich dort niemanden kenne.\n\nDu arbeitest doch schon länger in einem Unternehmen. Hast du vielleicht ein paar Tipps für meinen ersten Arbeitstag? Ich weiß zum Beispiel nicht, was ich anziehen soll und wie ich mich am besten auf die ersten Tage vorbereiten kann.\n\nAußerdem würde mich interessieren, wie du mit deinen Kolleginnen und Kollegen zurechtkommst.\n\nSchreib mir bald!","features":[],"contact":{"name":"Laura","lines":["Liebe Grüße"]},"callToAction":null,"imageUrl":null}'::jsonb,
    'Antworten Sie auf die E-Mail. Schreiben Sie etwas zu allen vier Punkten:', ARRAY['was Laura am ersten Arbeitstag beachten sollte', 'welche Kleidung Sie empfehlen', 'wie man gute Kontakte zu Kolleginnen und Kollegen aufbauen kann', 'wie Ihre eigenen ersten Tage in einem neuen Job waren'],
    'Überlegen Sie sich vor dem Schreiben eine passende Reihenfolge der Punkte, einen passenden Betreff, eine passende Anrede, Einleitung und einen passenden Schluss.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "content_revision" = EXCLUDED."content_revision", "title" = EXCLUDED."title",
    "subtitle" = EXCLUDED."subtitle", "task_type" = EXCLUDED."task_type",
    "intro" = EXCLUDED."intro", "stimulus" = EXCLUDED."stimulus",
    "task_instructions" = EXCLUDED."task_instructions",
    "bullet_points" = EXCLUDED."bullet_points", "closing_reminder" = EXCLUDED."closing_reminder";

  INSERT INTO "speaking_exercises"
    ("modelltest_id", "part", "title", "subtitle", "topic_title", "topic_description",
     "topic_points", "instructions", "duration_minutes", "prep_duration_seconds",
     "image_url", "exam_image_url", "content_revision")
  VALUES (mt_id, 1, 'Teil 1 Einander kennenlernen', 'Teilnehmer/in A und B', 'Einander kennenlernen',
    'Unterhalten Sie sich mit Ihrer Partnerin bzw. Ihrem Partner über folgende Themen:', '["Name","Woher sie oder er kommt","Wie sie oder er wohnt","Familie","Wo sie oder er Deutsch gelernt hat","Was sie oder er macht (Schule, Studium, Beruf …)","Sprachen (welche? wie lange? warum?)","Zusätzliche Prüferfrage: welchen Beruf er oder sie interessant findet","Zusätzliche Prüferfrage: was ihm oder ihr bei der Arbeit wichtig ist"]'::jsonb, 'Die Prüfenden können außerdem noch weitere Fragen stellen.', 10,
    300, '', NULL, 'modelltest-5-sprechen-teil-1-v1')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "topic_title" = EXCLUDED."topic_title", "topic_description" = EXCLUDED."topic_description",
    "topic_points" = EXCLUDED."topic_points", "instructions" = EXCLUDED."instructions",
    "duration_minutes" = EXCLUDED."duration_minutes",
    "prep_duration_seconds" = EXCLUDED."prep_duration_seconds",
    "image_url" = EXCLUDED."image_url", "exam_image_url" = EXCLUDED."exam_image_url",
    "content_revision" = EXCLUDED."content_revision";

  INSERT INTO "speaking_exercises"
    ("modelltest_id", "part", "title", "subtitle", "topic_title", "topic_description",
     "topic_points", "instructions", "duration_minutes", "prep_duration_seconds",
     "image_url", "exam_image_url", "content_revision")
  VALUES (mt_id, 2, 'Teil 2 Über ein Thema sprechen', 'Teilnehmer/in A / Teilnehmer/in B', 'Homeoffice oder Büro?',
    'Sie haben in einer Zeitschrift etwas zum Thema „Homeoffice oder Büro?“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', '["Teilnehmer/in A — Nadine Scholz, 31 Jahre, Grafikdesignerin: „Ich arbeite sehr gerne von zu Hause. Ich spare jeden Tag fast eine Stunde Fahrtzeit und kann mich dort oft besser konzentrieren. Außerdem kann ich meine Arbeitszeit leichter mit meinem Privatleben organisieren. Zwei Tage pro Woche im Büro reichen mir völlig.“","Teilnehmer/in B — Martin Köhler, 42 Jahre, Kundenberater: „Ich gehe lieber ins Büro. Dort kann ich schnell mit meinen Kollegen sprechen, wenn es ein Problem gibt. Zu Hause fehlt mir außerdem der Kontakt zu anderen Menschen. Für mich gehören gemeinsame Pausen und Gespräche mit Kollegen zu einem guten Arbeitstag dazu.“"]'::jsonb, 'Sie haben in einer Zeitschrift etwas zum Thema „Homeoffice oder Büro?“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', 15,
    300, '', NULL, 'modelltest-5-sprechen-teil-2-v1')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "topic_title" = EXCLUDED."topic_title", "topic_description" = EXCLUDED."topic_description",
    "topic_points" = EXCLUDED."topic_points", "instructions" = EXCLUDED."instructions",
    "duration_minutes" = EXCLUDED."duration_minutes",
    "prep_duration_seconds" = EXCLUDED."prep_duration_seconds",
    "image_url" = EXCLUDED."image_url", "exam_image_url" = EXCLUDED."exam_image_url",
    "content_revision" = EXCLUDED."content_revision";

  INSERT INTO "speaking_exercises"
    ("modelltest_id", "part", "title", "subtitle", "topic_title", "topic_description",
     "topic_points", "instructions", "duration_minutes", "prep_duration_seconds",
     "image_url", "exam_image_url", "content_revision")
  VALUES (mt_id, 3, 'Teil 3 Gemeinsam etwas planen', 'Teilnehmer/in A und B', 'Willkommenstag für neue Kolleginnen und Kollegen',
    'In Ihrer Firma beginnen nächste Woche mehrere neue Mitarbeiterinnen und Mitarbeiter. Ihr Team möchte einen kleinen Willkommenstag organisieren. Sie und Ihre Gesprächspartnerin bzw. Ihr Gesprächspartner sollen gemeinsam planen, wie dieser Tag aussehen soll. Überlegen Sie, was organisiert werden muss und wer welche Aufgaben übernimmt.', '["Wann?","Wo?","Vorstellung der Firma","Essen und Getränke","Aktivitäten zum Kennenlernen","Wer organisiert was?","Kosten","..."]'::jsonb, 'Entscheiden Sie zuerst, was Sie machen möchten und warum. Tragen Sie Ihrem Partner Ihre Ideen vor und begründen Sie sie. Reagieren Sie auf die Ideen Ihres Partners bzw. Ihrer Partnerin und die Begründungen. Einigen Sie sich auf einen gemeinsamen Programmvorschlag.', 5,
    300, '', NULL, 'modelltest-5-sprechen-teil-3-v1')
  ON CONFLICT ("modelltest_id", "part") DO UPDATE SET
    "title" = EXCLUDED."title", "subtitle" = EXCLUDED."subtitle",
    "topic_title" = EXCLUDED."topic_title", "topic_description" = EXCLUDED."topic_description",
    "topic_points" = EXCLUDED."topic_points", "instructions" = EXCLUDED."instructions",
    "duration_minutes" = EXCLUDED."duration_minutes",
    "prep_duration_seconds" = EXCLUDED."prep_duration_seconds",
    "image_url" = EXCLUDED."image_url", "exam_image_url" = EXCLUDED."exam_image_url",
    "content_revision" = EXCLUDED."content_revision";

END $$;

COMMIT;
