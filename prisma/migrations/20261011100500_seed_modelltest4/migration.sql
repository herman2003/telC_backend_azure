-- Modelltest 4 normalized from seed source JSON.
-- Runtime-only mapping: extraction provenance/sourceTrack are intentionally omitted.
-- Re-running replaces only this Modelltest's child content, keeping the seed deterministic.
BEGIN;

DO $$
DECLARE
  mt_id UUID;
  seed_exercise_id UUID;
BEGIN
  INSERT INTO "modelltests" ("number", "title", "exam_only")
  VALUES (4, 'Modelltest 4', FALSE)
  ON CONFLICT ("number") DO UPDATE SET "title" = EXCLUDED."title"
  RETURNING "id" INTO mt_id;

  INSERT INTO "lesen_teil1_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-4-lesen-teil1-v1', 'Leseverstehen Teil 1', 'Lesen Sie die Überschriften a–j und die Texte 1–5. Finden Sie für jeden Text die passende Überschrift. Sie können jede Überschrift nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 1–5 auf dem Antwortbogen.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision",
    "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil1_texts" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil1_titles" ("exerciseId", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Immer mehr Menschen verzichten in der Stadt auf das eigene Auto', 0),
    (seed_exercise_id, 'Neue Wohnungen direkt am Hauptbahnhof geplant', 1),
    (seed_exercise_id, 'Stadtbibliothek erweitert ihr digitales Angebot', 2),
    (seed_exercise_id, 'Nachbarn verwandeln einen Parkplatz in einen Garten', 3),
    (seed_exercise_id, 'Kostenlose Busfahrten für alle Einwohner', 4),
    (seed_exercise_id, 'Carsharing wird besonders bei jungen Erwachsenen beliebter', 5),
    (seed_exercise_id, 'Stadtteilfest bietet Musik, Essen und Begegnungen', 6),
    (seed_exercise_id, 'Bibliotheken verlieren immer mehr Besucher', 7),
    (seed_exercise_id, 'Gemeinsam gärtnern mitten in der Stadt', 8),
    (seed_exercise_id, 'Neue Regeln machen das Fahrradfahren teurer', 9);
  INSERT INTO "lesen_teil1_texts"
    ("exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
    (seed_exercise_id, 1, NULL, NULL, 'Ein eigenes Auto ist für viele junge Stadtbewohner nicht mehr selbstverständlich. Eine aktuelle Umfrage zeigt, dass besonders Menschen zwischen 20 und 35 Jahren häufiger Bus, Bahn oder Fahrrad benutzen. Wenn sie doch einmal ein Auto benötigen, mieten sie für einige Stunden ein Fahrzeug über einen Carsharing-Anbieter. Viele Befragte nennen die hohen Kosten für Versicherung, Reparaturen und Parkplätze als Grund dafür.', 0, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5)),
    (seed_exercise_id, 2, NULL, NULL, 'Auf einer früheren Parkfläche im Stadtteil Nord wächst seit diesem Frühjahr Gemüse. Rund 30 Bewohnerinnen und Bewohner haben dort gemeinsam Beete angelegt. Tomaten, Salat, Kräuter und Erdbeeren werden von den Nachbarn zusammen gepflegt. Das Projekt soll nicht nur Lebensmittel liefern. Vor allem möchten die Organisatoren einen Ort schaffen, an dem sich Menschen aus dem Viertel kennenlernen können.', 1, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8)),
    (seed_exercise_id, 3, NULL, NULL, 'Wer Mitglied der Stadtbibliothek ist, kann ab sofort nicht nur Bücher und Zeitschriften ausleihen. Über die Internetseite der Bibliothek stehen jetzt auch E-Books, Hörbücher und mehrere Zeitungen zur Verfügung. Die Medien können rund um die Uhr heruntergeladen werden. Für ältere Nutzer bietet die Bibliothek jeden Mittwoch eine kostenlose Einführung an.', 2, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 2)),
    (seed_exercise_id, 4, NULL, NULL, 'Am kommenden Samstag findet auf dem Marktplatz das jährliche Fest des Stadtteils West statt. Ab 14 Uhr treten verschiedene Musikgruppen auf. Vereine aus dem Viertel informieren über ihre Arbeit und Restaurants bieten Spezialitäten aus unterschiedlichen Ländern an. Für Kinder gibt es Spiele und einen kleinen Flohmarkt. Der Eintritt ist frei.', 3, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 6)),
    (seed_exercise_id, 5, NULL, NULL, 'Die Stadtverwaltung möchte in den kommenden Jahren rund 180 neue Wohnungen bauen. Das neue Wohngebiet soll auf einem alten Firmengelände nur wenige Minuten vom Hauptbahnhof entfernt entstehen. Neben Wohnungen sind dort auch ein Kindergarten, kleinere Geschäfte und Grünflächen vorgesehen. Mit dem Bau soll im nächsten Frühjahr begonnen werden.', 4, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 1));

  INSERT INTO "lesen_teil2_exercises"
    ("contentRevision", "label", "instruction", "cautionNote", "topSender",
     "topReceiver", "topBody", "quotedThread", "modelltest_id")
  VALUES ('modelltest-4-lesen-teil2-v1', 'Leseverstehen Teil 2', 'Lesen Sie den Text und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.',
    '', '', '',
    'Ein neues Leben ohne eigenes Auto

Vor zwei Jahren verkaufte die Familie Berger ihr Auto. Damals waren Anna und Tobias Berger zunächst unsicher, ob das Leben ohne eigenen Wagen im Alltag wirklich funktionieren würde. Die Familie wohnt mit ihren beiden Kindern in einer mittelgroßen Stadt und hatte das Auto vorher fast täglich benutzt.

Der wichtigste Grund für die Entscheidung waren die Kosten. Neben Benzin und Versicherung mussten die Bergers regelmäßig für Reparaturen bezahlen. Außerdem wurde es in ihrem Wohnviertel immer schwieriger, einen kostenlosen Parkplatz zu finden.

Heute fährt Tobias mit dem Fahrrad zur Arbeit. Bei schlechtem Wetter nimmt er den Bus. Anna arbeitet drei Tage pro Woche von zu Hause aus. An den anderen Tagen fährt sie mit der Straßenbahn ins Büro. Die Kinder gehen zu Fuß zur Schule, weil sie nur etwa zehn Minuten entfernt liegt.

Ganz ohne Auto kommt die Familie allerdings nicht aus. Etwa zweimal im Monat benötigt sie eines, zum Beispiel für größere Einkäufe oder für einen Besuch bei den Großeltern auf dem Land. Dann reservieren die Bergers über eine App ein Carsharing-Fahrzeug. In ihrem Stadtteil gibt es inzwischen mehrere Stationen.

Am Anfang mussten alle ihre Gewohnheiten ändern. Besonders beim Einkaufen war mehr Planung notwendig. Inzwischen bestellt die Familie schwere Getränke häufig online und kauft Lebensmittel mehrmals pro Woche in kleineren Mengen.

Finanziell hat sich die Veränderung gelohnt. Nach Berechnungen der Familie gibt sie heute monatlich ungefähr 200 Euro weniger für Mobilität aus als früher. Anna Berger sieht aber noch einen weiteren Vorteil: ''Wir bewegen uns deutlich mehr. Früher sind wir selbst kurze Strecken mit dem Auto gefahren. Heute gehen wir zu Fuß oder nehmen das Fahrrad.''

Nur bei Ausflügen am Wochenende vermisst die Familie manchmal das eigene Auto. Trotzdem möchte sie im Moment keines mehr kaufen.', '', mt_id)
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
  VALUES (seed_exercise_id, 6, 'Warum hat die Familie Berger ihr Auto hauptsächlich verkauft?', 0)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Weil das Auto zu klein für die Familie war.', false, 0),
    (seed_exercise_id, 'Weil das Autofahren zu teuer geworden war.', true, 1),
    (seed_exercise_id, 'Weil Tobias nicht mehr Auto fahren wollte.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 7, 'Wie kommt Tobias normalerweise zur Arbeit?', 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Mit dem Fahrrad.', true, 0),
    (seed_exercise_id, 'Mit der Straßenbahn.', false, 1),
    (seed_exercise_id, 'Zu Fuß.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 8, 'Wann benutzt die Familie ein Carsharing-Auto?', 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Jeden Tag für den Weg zur Arbeit.', false, 0),
    (seed_exercise_id, 'Vor allem für besondere Fahrten und größere Einkäufe.', true, 1),
    (seed_exercise_id, 'Nur während der Schulferien.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 9, 'Was musste die Familie besonders verändern?', 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Die Arbeitszeiten.', false, 0),
    (seed_exercise_id, 'Die Schule der Kinder.', false, 1),
    (seed_exercise_id, 'Die Organisation ihrer Einkäufe.', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 10, 'Welchen zusätzlichen Vorteil sieht Anna?', 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Die Familie bewegt sich im Alltag mehr.', true, 0),
    (seed_exercise_id, 'Die Familie reist häufiger.', false, 1),
    (seed_exercise_id, 'Die Kinder haben mehr Freizeit.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "lesen_teil3_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-4-lesen-teil3-v1', 'Leseverstehen Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Finden Sie für jede Situation die passende Anzeige. Sie können jede Anzeige nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 11–20 auf dem Antwortbogen. Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein x.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil3_situations" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil3_announcements" ("exerciseId", "title", "content", "sortOrder") VALUES
    (seed_exercise_id, 'RADFIX – Fahrradservice', 'Reparaturen aller Fahrradtypen. Kleine Reparaturen oft noch am selben Tag. Montag bis Freitag 9–18 Uhr, Samstag 10–14 Uhr. Bahnhofstraße 18.', 0),
    (seed_exercise_id, 'Stadtbibliothek – Digitale Hilfe', 'Sie möchten E-Books herunterladen, wissen aber nicht wie? Jeden Mittwoch um 16 Uhr erklären wir die Nutzung unserer digitalen Bibliothek. Kostenlos für Mitglieder.', 1),
    (seed_exercise_id, 'Flohmarkt am Hafen', 'Sonntag von 8 bis 15 Uhr. Kleidung, Bücher, Haushaltswaren und vieles mehr. Private Verkäufer willkommen. Standgebühr 10 Euro.', 2),
    (seed_exercise_id, 'CityCar', 'Auto nur dann bezahlen, wenn Sie es brauchen. Fahrzeuge an über 25 Stationen in der Stadt. Buchung per App. Ab 4,50 Euro pro Stunde.', 3),
    (seed_exercise_id, 'Sprachcafé International', 'Deutsch sprechen und neue Menschen kennenlernen. Jeden Dienstag ab 18.30 Uhr im Kulturzentrum Nord. Teilnahme kostenlos. Keine Anmeldung erforderlich.', 4),
    (seed_exercise_id, 'Wohnung gesucht?', 'Zimmer und kleine Wohnungen für Studierende und Auszubildende. Beratung Montag und Donnerstag von 14 bis 18 Uhr. Studentenwerk, Universitätsstraße 12.', 5),
    (seed_exercise_id, 'Wochenmarkt Rathausplatz', 'Frisches Obst, Gemüse, Brot, Käse und regionale Produkte. Jeden Mittwoch und Samstag von 7 bis 13 Uhr.', 6),
    (seed_exercise_id, 'Stadtführung zu Fuß', 'Entdecken Sie die Altstadt mit einer erfahrenen Stadtführerin. Samstags um 11 Uhr. Dauer: 90 Minuten. Treffpunkt vor dem Rathaus. 8 Euro pro Person.', 7),
    (seed_exercise_id, 'Nachbarschaftshilfe', 'Sie benötigen Hilfe beim Einkaufen oder bei kleinen Arbeiten im Haushalt? Ehrenamtliche aus Ihrem Stadtteil unterstützen ältere und kranke Menschen.', 8),
    (seed_exercise_id, 'Musik im Park', 'Freitagabend ab 19 Uhr Live-Musik im Stadtpark. Eintritt frei. Bei starkem Regen fällt die Veranstaltung aus.', 9),
    (seed_exercise_id, 'Sportzentrum West', 'Fitness, Basketball, Volleyball und Gymnastik. Neue Kurse ab September. Monatsbeitrag ab 24 Euro.', 10),
    (seed_exercise_id, 'Kochkurs – Schnell und gesund', 'Sie haben nach der Arbeit wenig Zeit? Lernen Sie einfache Gerichte kennen, die in weniger als 30 Minuten fertig sind. Donnerstags 18–20 Uhr.', 11);
  INSERT INTO "lesen_teil3_situations"
    ("exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
    (seed_exercise_id, 11, 'Ihr Fahrrad ist kaputt und Sie möchten es möglichst schnell reparieren lassen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0), 0),
    (seed_exercise_id, 12, 'Sie sind neu in Deutschland und möchten regelmäßig Deutsch sprechen und dabei andere Leute kennenlernen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 4), 1),
    (seed_exercise_id, 13, 'Sie studieren und suchen eine günstige kleine Wohnung.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5), 2),
    (seed_exercise_id, 14, 'Sie möchten am Wochenende frisches Gemüse direkt von Händlern kaufen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 6), 3),
    (seed_exercise_id, 15, 'Freunde besuchen Sie am Samstag. Sie möchten ihnen die wichtigsten historischen Orte Ihrer Stadt zeigen lassen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 7), 4),
    (seed_exercise_id, 16, 'Sie brauchen nur für einige Stunden ein Auto, möchten aber kein eigenes kaufen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 3), 5),
    (seed_exercise_id, 17, 'Ihre ältere Nachbarin kann momentan nicht selbst einkaufen gehen und braucht Unterstützung.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8), 6),
    (seed_exercise_id, 18, 'Sie möchten am Freitagabend kostenlos Musik hören.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 9), 7),
    (seed_exercise_id, 19, 'Sie möchten lernen, wie man mit dem Smartphone Fahrkarten für Bus und Bahn kauft.', true, NULL, 8),
    (seed_exercise_id, 20, 'Sie möchten nach der Arbeit lernen, schnell gesunde Mahlzeiten zuzubereiten.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 11), 9);

  INSERT INTO "sprachbausteine_exercises"
    ("teil_number", "content_revision", "label", "instruction", "duration_minutes",
     "image_url", "body", "modelltest_id")
  VALUES (1, 'modelltest-4-sprachbausteine-teil1-v1', 'Sprachbausteine Teil 1',
    'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, '', 'Liebe Sophie,

seit drei Wochen wohne ich jetzt in meiner neuen Wohnung in Köln. Am Anfang war alles ein bisschen schwierig, _____ ich hier fast niemanden kannte. Inzwischen gefällt mir das Leben _____ der Stadt aber sehr gut.

Meine Wohnung liegt nicht weit vom Zentrum entfernt. Zur Arbeit _____ ich meistens mit der Straßenbahn, weil ich morgens keine Lust habe, im Stau zu stehen. Die Haltestelle ist nur fünf Minuten _____ meiner Wohnung entfernt.

Am Wochenende entdecke ich oft neue Orte. Letzten Samstag _____ ich auf einem großen Wochenmarkt. Dort konnte man nicht nur Lebensmittel kaufen, _____ auch Musik hören und verschiedene Gerichte probieren.

Meine Nachbarn sind ebenfalls sehr nett. Eine ältere Dame, _____ direkt neben mir wohnt, hat mich schon zum Kaffee eingeladen. Sie kennt das Viertel seit vielen Jahren und hat mir einige interessante Orte _____ .

Wenn du im November Zeit hast, musst du mich unbedingt besuchen. Dann _____ ich dir alles zeigen. Schreib mir bald, _____ du kommen kannst.

Liebe Grüße
Daniel', mt_id)
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
    (seed_exercise_id, 'weil', true, 0),
    (seed_exercise_id, 'obwohl', false, 1),
    (seed_exercise_id, 'damit', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '22', 22, 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'auf', false, 0),
    (seed_exercise_id, 'in', true, 1),
    (seed_exercise_id, 'an', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '23', 23, 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'fahre', true, 0),
    (seed_exercise_id, 'fuhr', false, 1),
    (seed_exercise_id, 'gefahren', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '24', 24, 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'von', true, 0),
    (seed_exercise_id, 'für', false, 1),
    (seed_exercise_id, 'gegen', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '25', 25, 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'war', true, 0),
    (seed_exercise_id, 'bin', false, 1),
    (seed_exercise_id, 'wäre', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '26', 26, 5)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'sondern', true, 0),
    (seed_exercise_id, 'oder', false, 1),
    (seed_exercise_id, 'denn', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '27', 27, 6)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'die', true, 0),
    (seed_exercise_id, 'der', false, 1),
    (seed_exercise_id, 'den', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '28', 28, 7)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'empfohlen', true, 0),
    (seed_exercise_id, 'empfehlen', false, 1),
    (seed_exercise_id, 'empfiehlt', false, 2);
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
    (seed_exercise_id, 'wann', true, 0),
    (seed_exercise_id, 'als', false, 1),
    (seed_exercise_id, 'obwohl', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "sprachbausteine_teil2_exercises"
    ("contentRevision", "label", "instruction", "durationMinutes", "image_url", "body", "modelltest_id")
  VALUES ('modelltest-4-sprachbausteine-teil2-v1', 'Sprachbausteine Teil 2', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, '', 'Sehr geehrte Damen und Herren,

ich habe auf Ihrer Internetseite von dem neuen Gemeinschaftsgarten im Stadtteil Süd gelesen und interessiere mich sehr _____ das Projekt.

Ich bin vor wenigen Monaten in den Stadtteil gezogen und würde _____ neue Menschen kennenlernen. Außerdem arbeite ich gern im Garten, _____ ich in meiner jetzigen Wohnung leider keinen eigenen Garten habe.

Ich möchte deshalb wissen, _____ es noch freie Beete gibt und wie man sich anmelden kann. Muss man bereits Erfahrung mit Gartenarbeit haben oder _____ auch Anfänger teilnehmen?

Auf Ihrer Internetseite steht, dass sich die Mitglieder regelmäßig treffen. Können Sie mir bitte mitteilen, _____ diese Treffen stattfinden? Mich würde auch interessieren, ob jeder sein eigenes Gemüse anbaut _____ ob die Gruppe alles gemeinsam pflegt.

Ich könnte hauptsächlich am Wochenende helfen, _____ ich unter der Woche bis 18 Uhr arbeite. Falls Sie noch Unterstützung brauchen, würde ich _____ bei Veranstaltungen oder bei der Organisation helfen.

Ich wäre Ihnen sehr _____, wenn Sie mir weitere Informationen schicken könnten.

Mit freundlichen Grüßen
Michael Weber', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "durationMinutes" = EXCLUDED."durationMinutes",
    "image_url" = EXCLUDED."image_url", "body" = EXCLUDED."body"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "sprachbausteine_teil2_gaps" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "sprachbausteine_teil2_words" ("exerciseId", "letter", "content", "sortOrder") VALUES
    (seed_exercise_id, 'a', 'ABER', 0),
    (seed_exercise_id, 'b', 'DANKBAR', 1),
    (seed_exercise_id, 'c', 'DA', 2),
    (seed_exercise_id, 'd', 'DASS', 3),
    (seed_exercise_id, 'e', 'FÜR', 4),
    (seed_exercise_id, 'f', 'GERNE', 5),
    (seed_exercise_id, 'g', 'KÖNNEN', 6),
    (seed_exercise_id, 'h', 'OB', 7),
    (seed_exercise_id, 'i', 'ODER', 8),
    (seed_exercise_id, 'j', 'TROTZDEM', 9),
    (seed_exercise_id, 'k', 'WANN', 10),
    (seed_exercise_id, 'l', 'WEIL', 11),
    (seed_exercise_id, 'm', 'WENN', 12),
    (seed_exercise_id, 'n', 'AUCH', 13),
    (seed_exercise_id, 'o', 'DESHALB', 14);
  INSERT INTO "sprachbausteine_teil2_gaps"
    ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
    (seed_exercise_id, '31', 31, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'e'), 0),
    (seed_exercise_id, '32', 32, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'f'), 1),
    (seed_exercise_id, '33', 33, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'c'), 2),
    (seed_exercise_id, '34', 34, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'h'), 3),
    (seed_exercise_id, '35', 35, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'g'), 4),
    (seed_exercise_id, '36', 36, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'k'), 5),
    (seed_exercise_id, '37', 37, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'i'), 6),
    (seed_exercise_id, '38', 38, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'l'), 7),
    (seed_exercise_id, '39', 39, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'n'), 8),
    (seed_exercise_id, '40', 40, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'b'), 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 41–45. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 41–45. Sie haben dazu 30 Sekunden Zeit.',
    'modelltest-4-hoeren-teil1-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-4-hoeren/modelltest-4-hoeren-teil1.mp3', '',
    '', 'Nummer 41.

Also, ich wohne ungefähr vier Kilometer von meinem Büro entfernt. Früher bin ich jeden Morgen mit dem Bus gefahren, aber der war oft sehr voll. Seit letztem Frühjahr fahre ich meistens mit dem Fahrrad zur Arbeit. Das dauert ungefähr zwanzig Minuten und ich bin morgens gleich ein bisschen an der frischen Luft. Nur wenn es stark regnet oder sehr kalt ist, nehme ich noch den Bus.

Nummer 42.

Ich habe seit vielen Jahren ein Auto und brauche es auch beruflich. Das Problem ist nur, dass es in unserem Viertel viel zu wenige Parkplätze gibt. Wenn ich abends nach Hause komme, suche ich manchmal zwanzig Minuten, bis ich einen freien Platz finde. Deshalb überlege ich inzwischen sogar, einen festen Stellplatz zu mieten, obwohl das ziemlich teuer ist.

Nummer 43.

Mittwochs und samstags ist bei uns auf dem Rathausplatz Wochenmarkt. Ich gehe fast immer samstags dorthin. Obst, Gemüse, Käse und Brot kaufe ich meistens dort, weil die Sachen frisch sind und ich viele Verkäufer inzwischen persönlich kenne. Nur Getränke und größere Haushaltsartikel kaufe ich normalerweise im Supermarkt.

Nummer 44.

Viele meiner Freunde sind aufs Land gezogen, weil es dort ruhiger ist. Für mich wäre das nichts. Ich wohne gern mitten in der Stadt. Mein Büro ist nur zwei U-Bahn-Stationen entfernt, und abends kann ich spontan ins Kino oder in ein Restaurant gehen. Klar, manchmal ist es laut, aber ich möchte im Moment auf keinen Fall außerhalb wohnen.

Nummer 45.

Als ich vor sechs Monaten in dieses Haus gezogen bin, kannte ich in der Stadt fast niemanden. Zum Glück haben mich meine Nachbarn gleich zu einem kleinen Fest im Innenhof eingeladen. Dort habe ich viele Leute aus dem Haus kennengelernt. Mit zwei Nachbarinnen treffe ich mich inzwischen regelmäßig zum Kaffee, und manchmal gehen wir zusammen spazieren.')
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
    (seed_exercise_id, 41, 'Die Sprecherin fährt normalerweise mit dem Fahrrad zur Arbeit.', '+', 0),
    (seed_exercise_id, 42, 'Der Sprecher findet in seinem Wohnviertel leicht einen Parkplatz.', '-', 1),
    (seed_exercise_id, 43, 'Die Sprecherin kauft ihre Lebensmittel meistens auf dem Wochenmarkt.', '+', 2),
    (seed_exercise_id, 44, 'Der Sprecher möchte lieber außerhalb der Stadt wohnen.', '-', 3),
    (seed_exercise_id, 45, 'Die Sprecherin hat durch ihre Nachbarn neue Leute kennengelernt.', '+', 4);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 46–55. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 46–55. Sie haben dazu eine Minute Zeit.',
    'modelltest-4-hoeren-teil2-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-4-hoeren/modelltest-4-hoeren-teil2.mp3', '',
    '', 'Moderator: Guten Tag und herzlich willkommen zu unserem Stadtmagazin. Heute geht es um ein neues Stadtteilzentrum im Süden unserer Stadt. Seit Anfang dieses Monats ist das Zentrum geöffnet. Bei mir im Studio ist Frau Keller, die dort als Projektleiterin arbeitet. Guten Tag, Frau Keller.

Frau Keller: Guten Tag.

Moderator: Frau Keller, warum hat man dieses neue Stadtteilzentrum überhaupt eingerichtet?

Frau Keller: In unserem Stadtteil wohnen sehr unterschiedliche Menschen: Familien, ältere Leute, Studierende und auch viele Menschen, die erst seit kurzer Zeit hier leben. Es gab zwar schon einzelne Vereine und Angebote, aber bisher keinen gemeinsamen Treffpunkt. Deshalb wollte die Stadt einen Ort schaffen, an dem sich die Bewohner kennenlernen und gemeinsam etwas machen können.

Moderator: Das Zentrum ist also vor allem ein Treffpunkt?

Frau Keller: Ja, aber nicht nur. Wir bieten auch verschiedene Kurse und Beratungen an. Es gibt zum Beispiel Deutschkurse, Computerkurse, einen offenen Treff für Eltern mit kleinen Kindern und zweimal pro Woche eine Hausaufgabenhilfe für Schülerinnen und Schüler.

Moderator: Und wer kann diese Angebote nutzen?

Frau Keller: Eigentlich alle Bewohner des Stadtteils. Für die meisten offenen Veranstaltungen muss man sich nicht anmelden. Bei Kursen mit begrenzter Teilnehmerzahl ist eine Anmeldung natürlich notwendig.

Moderator: Muss man für die Kurse bezahlen?

Frau Keller: Das ist unterschiedlich. Viele Angebote sind kostenlos, weil sie von der Stadt finanziert werden. Für einige Kurse, zum Beispiel den Kochkurs oder bestimmte Computerkurse, gibt es eine kleine Teilnahmegebühr. Diese liegt meistens zwischen fünf und fünfzehn Euro.

Moderator: Wie wird das Zentrum insgesamt finanziert?

Frau Keller: Der größte Teil der Kosten wird von der Stadt übernommen. Zusätzlich bekommen wir Geld von einigen sozialen Organisationen. Außerdem unterstützen uns lokale Unternehmen, zum Beispiel mit Material oder kleineren Spenden.

Moderator: Arbeiten im Zentrum nur fest angestellte Mitarbeiter?

Frau Keller: Nein. Wir haben sechs fest angestellte Mitarbeiterinnen und Mitarbeiter, aber ohne Ehrenamtliche könnten wir unser Programm gar nicht anbieten. Zurzeit helfen uns etwa 25 Menschen regelmäßig. Manche unterstützen bei Veranstaltungen, andere geben Hausaufgabenhilfe oder begleiten ältere Menschen bei digitalen Fragen.

Moderator: Sie haben gerade ältere Menschen erwähnt. Gibt es spezielle Angebote für sie?

Frau Keller: Ja. Jeden Mittwochvormittag gibt es einen offenen Treff für Seniorinnen und Senioren. Außerdem bieten wir einmal im Monat eine Smartphone-Sprechstunde an. Dort erklären Ehrenamtliche zum Beispiel, wie man Nachrichten verschickt, Fotos speichert oder eine Fahrkarte mit dem Handy kauft.

Moderator: Das klingt praktisch. Und wie sieht es mit Jugendlichen aus?

Frau Keller: Auch für Jugendliche gibt es einiges. Freitags am frühen Abend haben wir einen offenen Jugendtreff. Dort können sie Musik hören, Tischtennis spielen oder einfach miteinander reden. Ab nächsten Monat wollen wir außerdem einen kleinen Medienworkshop anbieten.

Moderator: Wie sind denn die Öffnungszeiten?

Frau Keller: Von Montag bis Freitag sind wir normalerweise von neun bis zwanzig Uhr geöffnet. Samstags öffnen wir von zehn bis sechzehn Uhr. Sonntags ist das Zentrum geschlossen, außer wenn eine besondere Veranstaltung stattfindet.

Moderator: Und wie haben die Menschen im Stadtteil bisher reagiert?

Frau Keller: Sehr positiv. In den ersten drei Wochen kamen schon über 600 Besucher. Besonders gut besucht waren das Eröffnungsfest und die Sprachcafés. Wir haben allerdings gemerkt, dass viele Bewohner noch gar nicht genau wissen, welche Angebote es gibt.

Moderator: Was wollen Sie dagegen tun?

Frau Keller: Wir möchten stärker informieren. Neben unserer Internetseite verteilen wir jetzt Flyer in Schulen, Arztpraxen und Geschäften. Außerdem wollen wir über soziale Medien mehr Menschen erreichen.

Moderator: Gibt es schon Pläne für die Zukunft?

Frau Keller: Ja. Wenn alles gut läuft, möchten wir im nächsten Frühjahr einen kleinen Gemeinschaftsgarten hinter dem Gebäude anlegen. Dort könnten Kinder und Erwachsene gemeinsam Gemüse und Kräuter anbauen.

Moderator: Frau Keller, vielen Dank für das Gespräch.

Frau Keller: Sehr gerne.')
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
    (seed_exercise_id, 46, 'Das Stadtteilzentrum wurde eingerichtet, weil es vorher keinen gemeinsamen Treffpunkt im Viertel gab.', '+', 0),
    (seed_exercise_id, 47, 'Das Zentrum bietet nur Freizeitaktivitäten an.', '-', 1),
    (seed_exercise_id, 48, 'Für alle Veranstaltungen muss man sich vorher anmelden.', '-', 2),
    (seed_exercise_id, 49, 'Einige Kurse kosten eine kleine Gebühr.', '+', 3),
    (seed_exercise_id, 50, 'Das Zentrum wird ausschließlich von privaten Unternehmen finanziert.', '-', 4),
    (seed_exercise_id, 51, 'Im Zentrum arbeiten auch viele ehrenamtliche Helfer.', '+', 5),
    (seed_exercise_id, 52, 'Für ältere Menschen gibt es Hilfe bei der Nutzung von Smartphones.', '+', 6),
    (seed_exercise_id, 53, 'Der Jugendtreff findet sonntags statt.', '-', 7),
    (seed_exercise_id, 54, 'Das Zentrum ist an normalen Sonntagen geschlossen.', '+', 8),
    (seed_exercise_id, 55, 'Hinter dem Gebäude gibt es bereits einen Gemeinschaftsgarten.', '-', 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind. Markieren Sie Ihre Lösungen für die Aufgaben 56–60 auf dem Antwortbogen. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch.',
    'modelltest-4-hoeren-teil3-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-4-hoeren/modelltest-4-hoeren-teil3.mp3', '',
    '', '56
Guten Tag. Hier ist die Stadtbibliothek Süd. Wegen einer internen Veranstaltung schließen wir heute bereits um 16 Uhr. Morgen sind wir wieder wie gewohnt von 9 bis 19 Uhr für Sie da. Bereits ausgeliehene Bücher können Sie auch nach der Schließung am Automaten vor dem Eingang zurückgeben.

57
Achtung, Fahrgäste der Straßenbahnlinie 3. Wegen Bauarbeiten fährt die Linie heute nicht bis zum Hauptbahnhof. Bitte steigen Sie an der Haltestelle Rathaus aus und benutzen Sie von dort den Ersatzbus. Die Fahrkarten der Straßenbahn gelten selbstverständlich auch im Bus.

58
Und nun der Wetterbericht für morgen. Am Vormittag bleibt es in der ganzen Region trocken. Gegen Mittag ziehen von Westen Wolken auf. Am Nachmittag muss besonders im Stadtgebiet mit kräftigem Regen gerechnet werden. Die Temperaturen erreichen höchstens 17 Grad.

59
Herzlich willkommen im Einkaufszentrum CityPoint. Heute findet in der ersten Etage unser Aktionstag statt. Zwischen 14 und 18 Uhr können Kinder dort kostenlos an einem Malworkshop teilnehmen. Die Eltern müssen ihre Kinder vorher am Informationsstand im Erdgeschoss anmelden.

60
Liebe Besucherinnen und Besucher des Stadtparks. Das für heute Abend geplante Konzert am See muss wegen des starken Windes leider ausfallen. Bereits gekaufte Eintrittskarten behalten ihre Gültigkeit für den Ersatztermin am kommenden Freitag. Weitere Informationen finden Sie auf unserer Internetseite.')
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
    (seed_exercise_id, 56, 'Die Stadtbibliothek schließt heute früher als normalerweise.', '+', 0),
    (seed_exercise_id, 57, 'Die Straßenbahnlinie 3 fährt heute bis zum Hauptbahnhof.', '-', 1),
    (seed_exercise_id, 58, 'Am Nachmittag bleibt es im Stadtgebiet trocken.', '-', 2),
    (seed_exercise_id, 59, 'Kinder können kostenlos an einem Malworkshop teilnehmen.', '+', 3),
    (seed_exercise_id, 60, 'Das Konzert im Stadtpark findet heute Abend statt.', '-', 4);

  INSERT INTO "writing_exercises"
    ("content_revision", "title", "subtitle", "task_type", "intro", "stimulus",
     "task_instructions", "bullet_points", "closing_reminder", "modelltest_id")
  VALUES ('modelltest-4-schreiben-v1', 'Schriftlicher Ausdruck', 'Sie haben von einem Freund folgende E-Mail erhalten:',
    'brief', 'Sie haben von einem Freund folgende E-Mail erhalten:', '{"heading":"Liebe/r __________,","subheading":null,"body":"wie du weißt, ziehe ich nächsten Monat in deine Stadt. Ich freue mich schon sehr darauf, aber ich kenne mich dort überhaupt nicht aus.\n\nBesonders wichtig ist für mich, dass ich schnell zur Arbeit komme und in meiner Freizeit etwas unternehmen kann. Außerdem muss ich noch einige Dinge für meine neue Wohnung kaufen.\n\nKannst du mir ein bisschen erzählen, wie das Leben bei euch ist und was ich am Anfang unbedingt wissen sollte?\n\nSchreib mir bald!","features":[],"contact":{"name":"Martin","lines":["Viele Grüße"]},"callToAction":null,"imageUrl":null}'::jsonb,
    'Antworten Sie auf die E-Mail. Schreiben Sie etwas zu allen vier Punkten:', ARRAY['wie man sich in Ihrer Stadt am besten fortbewegen kann', 'wo Martin günstig Dinge für seine Wohnung kaufen kann', 'welche Freizeitmöglichkeiten Sie empfehlen', 'was Martin in den ersten Tagen erledigen sollte'],
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
    'Unterhalten Sie sich mit Ihrer Partnerin bzw. Ihrem Partner über folgende Themen:', '["Name","Woher sie oder er kommt","Wie sie oder er wohnt","Familie","Wo sie oder er Deutsch gelernt hat","Was sie oder er macht","Sprachen","Zusätzliche Prüferfrage: was er oder sie gern in der Stadt macht","Zusätzliche Prüferfrage: welche Verkehrsmittel er oder sie normalerweise benutzt"]'::jsonb, 'Die Prüfenden können außerdem noch weitere Fragen stellen.', 10,
    300, '', NULL, 'modelltest-4-sprechen-teil-1-v1')
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
  VALUES (mt_id, 2, 'Teil 2 Über ein Thema sprechen', 'Teilnehmer/in A / Teilnehmer/in B', 'Leben in der Großstadt',
    'Sie haben in einer Zeitschrift etwas zum Thema „Leben in der Großstadt“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', '["Teilnehmer/in A — Nina Berger, 29 Jahre, Verkäuferin: „Ich lebe sehr gern in einer großen Stadt. Ich kann fast überall mit Bus oder Bahn hinfahren und brauche kein Auto. Außerdem gibt es viele Geschäfte, Restaurants, Kinos und Veranstaltungen. Mir gefällt besonders, dass immer etwas los ist und man viele unterschiedliche Menschen kennenlernen kann.“","Teilnehmer/in B — Markus Stein, 37 Jahre, Techniker: „Für mich ist das Leben in einer Großstadt oft anstrengend. Es gibt viel Verkehr, Lärm und zu viele Menschen. Die Wohnungen sind außerdem teuer. Ich würde lieber etwas außerhalb wohnen, wo es ruhiger ist und man mehr Platz hat. Wenn ich etwas unternehmen möchte, kann ich trotzdem in die Stadt fahren.“"]'::jsonb, 'Sie haben in einer Zeitschrift etwas zum Thema „Leben in der Großstadt“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', 15,
    300, '', NULL, 'modelltest-4-sprechen-teil-2-v1')
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
  VALUES (mt_id, 3, 'Teil 3 Gemeinsam etwas planen', 'Teilnehmer/in A und B', 'Ein Wochenende für einen Freund planen',
    'Ein Freund aus einer anderen Stadt besucht Sie am kommenden Wochenende. Er war noch nie in Ihrer Stadt. Sie möchten gemeinsam mit Ihrer Gesprächspartnerin bzw. Ihrem Gesprächspartner ein Programm für den Besuch planen. Überlegen Sie, was Sie gemeinsam unternehmen möchten und wer sich um welche Aufgabe kümmert.', '["Wann und wo treffen?","Sehenswürdigkeiten","Essen","Abendprogramm","Verkehrsmittel","Kosten","..."]'::jsonb, 'Entscheiden Sie zuerst, was Sie machen möchten und warum. Tragen Sie Ihrem Partner Ihre Ideen vor und begründen Sie sie. Reagieren Sie auf die Ideen Ihres Partners bzw. Ihrer Partnerin und die Begründungen. Einigen Sie sich auf einen gemeinsamen Programmvorschlag.', 5,
    300, '', NULL, 'modelltest-4-sprechen-teil-3-v1')
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
