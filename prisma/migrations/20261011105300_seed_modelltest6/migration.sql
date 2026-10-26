-- Modelltest 6 normalized from seed source JSON.
-- Runtime-only mapping: extraction provenance/sourceTrack are intentionally omitted.
-- Re-running replaces only this Modelltest's child content, keeping the seed deterministic.
BEGIN;

DO $$
DECLARE
  mt_id UUID;
  seed_exercise_id UUID;
BEGIN
  INSERT INTO "modelltests" ("number", "title", "exam_only")
  VALUES (6, 'Modelltest 6', FALSE)
  ON CONFLICT ("number") DO UPDATE SET "title" = EXCLUDED."title"
  RETURNING "id" INTO mt_id;

  INSERT INTO "lesen_teil1_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-6-lesen-teil1-v1', 'Leseverstehen Teil 1', 'Lesen Sie die Überschriften a–j und die Texte 1–5. Finden Sie für jeden Text die passende Überschrift. Sie können jede Überschrift nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 1–5 auf dem Antwortbogen.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision",
    "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil1_texts" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil1_titles" ("exerciseId", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Immer mehr Urlauber reisen mit dem Zug', 0),
    (seed_exercise_id, 'Hotels bieten Gästen kostenlose Fahrräder', 1),
    (seed_exercise_id, 'Urlaub zu Hause wird immer beliebter', 2),
    (seed_exercise_id, 'Junge Reisende buchen Unterkünfte besonders kurzfristig', 3),
    (seed_exercise_id, 'Flugreisen werden in Europa günstiger', 4),
    (seed_exercise_id, 'Immer mehr Menschen reisen allein', 5),
    (seed_exercise_id, 'Mit kleinen Kindern entspannt in den Urlaub', 6),
    (seed_exercise_id, 'Urlauber informieren sich vor Reisen stärker über Nachhaltigkeit', 7),
    (seed_exercise_id, 'Neue Regelungen für Gepäck im Flugzeug', 8),
    (seed_exercise_id, 'Campingplätze werden bei Familien immer beliebter', 9);
  INSERT INTO "lesen_teil1_texts"
    ("exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
    (seed_exercise_id, 1, NULL, NULL, 'Viele Reisende achten bei der Planung ihres Urlaubs inzwischen darauf, wie umweltfreundlich ihre Reise ist. Eine aktuelle Umfrage zeigt, dass sich besonders jüngere Menschen vor der Buchung über Zugverbindungen, regionale Angebote und nachhaltige Hotels informieren. Einige sind sogar bereit, dafür etwas mehr zu bezahlen.', 0, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 7)),
    (seed_exercise_id, 2, NULL, NULL, 'Immer mehr Menschen möchten im Urlaub unabhängig sein und reisen deshalb ohne Partner oder Freunde. Besonders Städtereisen und kurze Rundreisen werden häufig allein gebucht. Viele Reiseveranstalter reagieren darauf und bieten inzwischen spezielle Programme für Einzelreisende an.', 1, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5)),
    (seed_exercise_id, 3, NULL, NULL, 'Familien verbringen ihren Sommerurlaub immer häufiger auf Campingplätzen. Besonders gefragt sind Plätze mit Spielbereichen, Schwimmbädern und kleinen Ferienhäusern. Viele Eltern schätzen, dass Kinder dort schnell andere Kinder kennenlernen und sich viel draußen bewegen können.', 2, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 9)),
    (seed_exercise_id, 4, NULL, NULL, 'Statt mit dem Auto oder dem Flugzeug fahren immer mehr Reisende mit der Bahn in den Urlaub. Als Gründe nennen sie die Möglichkeit, während der Fahrt zu lesen oder zu arbeiten, sowie die bequemere Ankunft direkt im Stadtzentrum. Besonders bei Reisen innerhalb Deutschlands wächst die Nachfrage.', 3, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0)),
    (seed_exercise_id, 5, NULL, NULL, 'Eine Reise muss nicht immer weit weg führen. Viele Menschen entdecken während freier Tage ihre eigene Region neu. Sie besuchen Museen, Seen oder Wanderwege in der Nähe und übernachten manchmal sogar in einem Hotel in der eigenen Stadt. Besonders beliebt ist diese Form des Urlaubs bei Menschen, die wenig Zeit haben.', 4, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 2));

  INSERT INTO "lesen_teil2_exercises"
    ("contentRevision", "label", "instruction", "cautionNote", "topSender",
     "topReceiver", "topBody", "quotedThread", "modelltest_id")
  VALUES ('modelltest-6-lesen-teil2-v1', 'Leseverstehen Teil 2', 'Lesen Sie den Text und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.',
    '', '', '',
    'Ein Urlaub ohne Auto

Vor drei Jahren machte Familie Scholz zum ersten Mal Urlaub ohne eigenes Auto. Zunächst war besonders Vater Michael skeptisch. Er war gewohnt, für längere Reisen das Auto zu benutzen, weil er glaubte, damit unabhängiger zu sein.

Die Familie entschied sich trotzdem für eine Woche in einem kleinen Ort in den Bergen, der gut mit dem Zug erreichbar war. Vom Bahnhof wurden sie mit einem kostenlosen Bus zu ihrer Unterkunft gebracht. Während des Urlaubs konnten Gäste mit einer regionalen Gästekarte Busse und einige Bergbahnen kostenlos benutzen.

Am ersten Tag musste sich die Familie noch daran gewöhnen, Fahrpläne zu beachten. Schon nach kurzer Zeit fanden sie das aber weniger schwierig als erwartet. Die Kinder fanden besonders die Zugfahrten spannend und freuten sich darüber, dass beide Eltern während der Fahrt Zeit für sie hatten.

Für Ausflüge nutzte die Familie meistens öffentliche Verkehrsmittel. Einmal liehen sie sich für einen Tag Fahrräder aus. Nur für einen abgelegenen See wäre ein Auto praktischer gewesen. Deshalb beschlossen sie, diesen Ausflug nicht zu machen.

Auch beim Gepäck mussten sie anders planen. Statt mehrerer großer Koffer nahm jedes Familienmitglied nur eine kleinere Tasche mit. Die Unterkunft stellte Handtücher und einige Dinge für Kinder zur Verfügung, sodass die Familie weniger mitnehmen musste.

Am Ende waren alle überrascht, wie entspannt die Reise gewesen war. Besonders Michael gefiel, dass er nicht stundenlang selbst fahren musste. Seitdem hat die Familie noch zwei weitere Urlaube ohne Auto gemacht.

Michael sagt trotzdem, dass diese Art des Reisens nicht für jedes Ziel geeignet ist. Entscheidend sei, dass die Region gute Bus- und Bahnverbindungen bietet.', '', mt_id)
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
  VALUES (seed_exercise_id, 6, 'Warum war Michael Scholz zunächst unsicher?', 0)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Er dachte, man sei mit dem Auto unabhängiger.', true, 0),
    (seed_exercise_id, 'Er hatte Angst vor Zugreisen.', false, 1),
    (seed_exercise_id, 'Er wollte nicht in die Berge fahren.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 7, 'Was war mit der Gästekarte möglich?', 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Man konnte kostenlos ein Auto mieten.', false, 0),
    (seed_exercise_id, 'Man konnte bestimmte Verkehrsmittel kostenlos nutzen.', true, 1),
    (seed_exercise_id, 'Man bekam jeden Tag kostenlos Fahrräder.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 8, 'Was gefiel den Kindern an der Zugfahrt?', 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Sie konnten allein im Zug spielen.', false, 0),
    (seed_exercise_id, 'Ihre Eltern hatten während der Fahrt mehr Zeit für sie.', true, 1),
    (seed_exercise_id, 'Sie durften den Zugführer besuchen.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 9, 'Was änderte die Familie bei ihrem Gepäck?', 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Sie nahm weniger mit.', true, 0),
    (seed_exercise_id, 'Sie schickte die Koffer vorher per Post.', false, 1),
    (seed_exercise_id, 'Sie kaufte größere Koffer.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 10, 'Wann funktioniert Urlaub ohne Auto laut Michael besonders gut?', 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'Wenn das Urlaubsziel sehr nah ist.', false, 0),
    (seed_exercise_id, 'Wenn die Region gute öffentliche Verkehrsmittel hat.', true, 1),
    (seed_exercise_id, 'Wenn man nur zwei Tage bleibt.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "lesen_teil3_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-6-lesen-teil3-v1', 'Leseverstehen Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Finden Sie für jede Situation die passende Anzeige. Sie können jede Anzeige nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 11–20 auf dem Antwortbogen. Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein x.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil3_situations" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil3_announcements" ("exerciseId", "title", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Hotel am See', 'Familienzimmer, Frühstück inklusive, eigener Spielplatz und direkter Zugang zum See. Kinder bis sechs Jahre übernachten kostenlos.', 0),
    (seed_exercise_id, 'City Hostel', 'Preiswerte Zimmer im Stadtzentrum. Einzel-, Doppel- und Mehrbettzimmer. Hauptbahnhof nur fünf Minuten zu Fuß entfernt.', 1),
    (seed_exercise_id, 'Radurlaub Aktiv', 'Geführte Fahrradtouren durch die Region. Tages- und Mehrtagestouren. Fahrradverleih möglich. Gepäcktransport auf Wunsch.', 2),
    (seed_exercise_id, 'Last-Minute-Reisen', 'Kurzfristig freie Hotelzimmer und Pauschalreisen. Angebote für Abreise innerhalb der nächsten sieben Tage.', 3),
    (seed_exercise_id, 'Deutschlands schönste Wanderwege', 'Geführte Wanderungen für Anfänger und Fortgeschrittene. Wochenendtouren inklusive Übernachtung und Frühstück.', 4),
    (seed_exercise_id, 'Ferienwohnung Sonnenblick', 'Ruhige Lage, Küche, zwei Schlafzimmer und Balkon. Bushaltestelle direkt vor dem Haus. Mindestaufenthalt fünf Nächte.', 5),
    (seed_exercise_id, 'Flughafentransfer 24', 'Fahrten von Ihrer Wohnung direkt zum Flughafen und zurück. Buchung telefonisch oder online. Service rund um die Uhr.', 6),
    (seed_exercise_id, 'Reiseversicherung Plus', 'Schutz bei Krankheit, Reiseabbruch und verlorenem Gepäck. Tarife für Einzelpersonen und Familien.', 7),
    (seed_exercise_id, 'Sprachreise nach Wien', 'Deutsch lernen und die Stadt kennenlernen. Zwei Wochen Sprachkurs mit Unterkunft bei einer Gastfamilie.', 8),
    (seed_exercise_id, 'Camping Naturpark', 'Stellplätze für Zelte und Wohnmobile. Sanitäranlagen, kleiner Supermarkt und Freizeitprogramm für Kinder.', 9),
    (seed_exercise_id, 'Städtereisen für Singles', 'Wochenendreisen für Alleinreisende zwischen 25 und 45 Jahren. Gemeinsame Stadtführungen und Abendprogramm.', 10),
    (seed_exercise_id, 'Gepäckservice Bahn', 'Wir holen Ihre Koffer zu Hause ab und bringen sie direkt in Ihr Hotel. Buchung mindestens drei Werktage vor Reisebeginn.', 11);
  INSERT INTO "lesen_teil3_situations"
    ("exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
    (seed_exercise_id, 11, 'Sie reisen allein und möchten am Wochenende andere Leute in Ihrem Alter kennenlernen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 10), 0),
    (seed_exercise_id, 12, 'Sie fahren mit kleinen Kindern in Urlaub und suchen ein Hotel mit Angeboten für Familien.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0), 1),
    (seed_exercise_id, 13, 'Sie möchten nächste Woche spontan verreisen und suchen ein günstiges kurzfristiges Angebot.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 3), 2),
    (seed_exercise_id, 14, 'Sie möchten im Urlaub mehrere Tage mit dem Fahrrad unterwegs sein, haben aber kein eigenes Fahrrad.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 2), 3),
    (seed_exercise_id, 15, 'Sie fahren mit dem Zug in Urlaub und möchten Ihren großen Koffer nicht selbst tragen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 11), 4),
    (seed_exercise_id, 16, 'Sie möchten Urlaub machen und dabei gleichzeitig Ihr Deutsch verbessern.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8), 5),
    (seed_exercise_id, 17, 'Sie möchten in einer ruhigen Wohnung wohnen und selbst kochen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5), 6),
    (seed_exercise_id, 18, 'Sie fliegen sehr früh am Morgen und brauchen eine Fahrt direkt von zu Hause zum Flughafen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 6), 7),
    (seed_exercise_id, 19, 'Sie möchten für drei Tage einen Wohnwagen mieten und damit durch Deutschland fahren.', true, NULL, 8),
    (seed_exercise_id, 20, 'Sie möchten draußen übernachten und suchen einen Platz für Ihr Zelt.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 9), 9);

  INSERT INTO "sprachbausteine_exercises"
    ("teil_number", "content_revision", "label", "instruction", "duration_minutes",
     "image_url", "body", "modelltest_id")
  VALUES (1, 'modelltest-6-sprachbausteine-teil1-v1', 'Sprachbausteine Teil 1',
    'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, '', 'Liebe Maria,

endlich sind wir aus unserem Urlaub zurück. Wir waren zehn Tage in Österreich, _____ es uns wirklich sehr gut gefallen hat.

Wir sind diesmal nicht mit dem Auto gefahren, _____ wir die lange Fahrt vermeiden wollten. Stattdessen _____ wir den Zug genommen. Das war viel entspannter als erwartet.

Unser Hotel lag direkt _____ einem kleinen See. Jeden Morgen konnten wir dort frühstücken und dabei auf die Berge schauen.

Am dritten Tag _____ wir eine längere Wanderung gemacht. Das Wetter war zuerst schön, aber am Nachmittag hat es plötzlich stark geregnet. Zum Glück hatten wir Regenjacken _____ .

Besonders gut hat mir gefallen, _____ wir viele regionale Gerichte probieren konnten. Mein Lieblingsessen war eine Suppe, die ich vorher noch nie _____ hatte.

Nächstes Jahr möchten wir vielleicht wieder dorthin fahren. Wenn du möchtest, _____ du gern mitkommen.

Ich zeige dir bald die Fotos, _____ wir uns sehen.

Liebe Grüße
Sandra', mt_id)
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
    (seed_exercise_id, 'wo', true, 0),
    (seed_exercise_id, 'wann', false, 1),
    (seed_exercise_id, 'ob', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '22', 22, 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'weil', true, 0),
    (seed_exercise_id, 'obwohl', false, 1),
    (seed_exercise_id, 'sondern', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '23', 23, 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'haben', true, 0),
    (seed_exercise_id, 'sind', false, 1),
    (seed_exercise_id, 'wurden', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '24', 24, 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'an', true, 0),
    (seed_exercise_id, 'für', false, 1),
    (seed_exercise_id, 'über', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '25', 25, 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'haben', true, 0),
    (seed_exercise_id, 'sind', false, 1),
    (seed_exercise_id, 'hatten', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '26', 26, 5)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'dabei', true, 0),
    (seed_exercise_id, 'damit', false, 1),
    (seed_exercise_id, 'daran', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '27', 27, 6)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'dass', true, 0),
    (seed_exercise_id, 'ob', false, 1),
    (seed_exercise_id, 'als', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '28', 28, 7)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'gegessen', true, 0),
    (seed_exercise_id, 'essen', false, 1),
    (seed_exercise_id, 'aß', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '29', 29, 8)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'kannst', true, 0),
    (seed_exercise_id, 'musst', false, 1),
    (seed_exercise_id, 'sollst', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '30', 30, 9)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'wenn', true, 0),
    (seed_exercise_id, 'obwohl', false, 1),
    (seed_exercise_id, 'damit', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "sprachbausteine_teil2_exercises"
    ("contentRevision", "label", "instruction", "durationMinutes", "image_url", "body", "modelltest_id")
  VALUES ('modelltest-6-sprachbausteine-teil2-v1', 'Sprachbausteine Teil 2', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, '', 'Sehr geehrte Damen und Herren,

ich habe Ihre Ferienwohnung im Internet gefunden und interessiere mich sehr _____ Ihr Angebot. Meine Frau und ich möchten im August eine Woche in Ihrer Region verbringen und hätten _____ einige Fragen.

Auf Ihrer Internetseite steht, dass die Wohnung ungefähr drei Kilometer vom Zentrum entfernt liegt. Können Sie mir bitte sagen, _____ es eine gute Busverbindung gibt?

Wir reisen mit dem Zug an und würden _____ ungern ein Auto mieten. Außerdem möchten wir wissen, _____ Einkaufsmöglichkeiten in der Nähe sind.

Wir interessieren uns besonders für Wanderungen. Gibt es Wege, die direkt an der Unterkunft beginnen, _____ muss man zuerst mit dem Bus fahren?

In der Beschreibung steht, dass Fahrräder vorhanden sind. Sind diese im Preis enthalten oder müssen wir _____ bezahlen?

Wir haben außerdem einen kleinen Hund. Bitte teilen Sie uns mit, ob Haustiere _____ erlaubt sind.

Falls die Wohnung in der Woche vom 10. bis 17. August noch frei ist, würden wir sie _____ reservieren.

Wir wären Ihnen sehr _____, wenn Sie uns bald antworten könnten.

Mit freundlichen Grüßen
Peter Lang', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "durationMinutes" = EXCLUDED."durationMinutes",
    "image_url" = EXCLUDED."image_url", "body" = EXCLUDED."body"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "sprachbausteine_teil2_gaps" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "sprachbausteine_teil2_words" ("exerciseId", "letter", "content", "sortOrder") VALUES
    (seed_exercise_id, 'a', 'ABER', 0),
    (seed_exercise_id, 'b', 'DAFÜR', 1),
    (seed_exercise_id, 'c', 'DANKBAR', 2),
    (seed_exercise_id, 'd', 'DESHALB', 3),
    (seed_exercise_id, 'e', 'FÜR', 4),
    (seed_exercise_id, 'f', 'GERNE', 5),
    (seed_exercise_id, 'g', 'NOCH', 6),
    (seed_exercise_id, 'h', 'OB', 7),
    (seed_exercise_id, 'i', 'ODER', 8),
    (seed_exercise_id, 'j', 'WELCHE', 9),
    (seed_exercise_id, 'k', 'WENN', 10),
    (seed_exercise_id, 'l', 'TROTZDEM', 11),
    (seed_exercise_id, 'm', 'AUCH', 12),
    (seed_exercise_id, 'n', 'WIE', 13),
    (seed_exercise_id, 'o', 'DAMIT', 14);
  INSERT INTO "sprachbausteine_teil2_gaps"
    ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
    (seed_exercise_id, '31', 31, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'e'), 0),
    (seed_exercise_id, '32', 32, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'g'), 1),
    (seed_exercise_id, '33', 33, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'h'), 2),
    (seed_exercise_id, '34', 34, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'd'), 3),
    (seed_exercise_id, '35', 35, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'j'), 4),
    (seed_exercise_id, '36', 36, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'i'), 5),
    (seed_exercise_id, '37', 37, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'b'), 6),
    (seed_exercise_id, '38', 38, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'm'), 7),
    (seed_exercise_id, '39', 39, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'f'), 8),
    (seed_exercise_id, '40', 40, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'c'), 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 41–45. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 41–45. Sie haben dazu 30 Sekunden Zeit.',
    'modelltest-6-hoeren-teil1-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-6-hoeren/modelltest-6-hoeren-teil1.mp3', '',
    '', '41
Ich fliege eigentlich nicht besonders gern. Deshalb fahre ich innerhalb Europas meistens mit dem Zug. Letzten Sommer bin ich sogar bis nach Italien gefahren. Die Reise hat länger gedauert als mit dem Flugzeug, aber ich konnte während der Fahrt lesen und schlafen. Für mich war das viel entspannter.

42
Früher habe ich meinen Urlaub immer mehrere Monate vorher geplant. Heute mache ich das anders. Ich schaue meistens erst ein oder zwei Wochen vorher, welche Hotels oder Flüge noch günstig sind. Manchmal findet man tolle Angebote, aber natürlich kann man dann nicht jedes Reiseziel auswählen.

43
Mit unseren beiden kleinen Kindern fahren wir am liebsten auf einen Campingplatz. Wir schlafen allerdings nicht im Zelt, sondern mieten dort ein kleines Ferienhaus. Die Kinder können draußen spielen und finden schnell andere Kinder. Für uns Eltern ist das ziemlich entspannt.

44
Ich reise jedes Jahr allein für ein paar Tage in eine andere Stadt. Viele Freunde verstehen das nicht, aber ich finde es angenehm. Ich kann selbst entscheiden, wann ich aufstehe, was ich besichtige und wo ich esse. Wenn ich Gesellschaft möchte, buche ich manchmal eine Stadtführung.

45
Bei langen Reisen nehme ich normalerweise viel zu viel mit. Dieses Jahr möchte ich versuchen, nur mit einem kleinen Koffer zu reisen. Ich habe gemerkt, dass ich viele Sachen im Urlaub überhaupt nicht brauche. Außerdem ist es einfacher, wenn man mit dem Zug unterwegs ist.')
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
    (seed_exercise_id, 41, 'Der Sprecher reist innerhalb Europas meistens mit dem Flugzeug.', '-', 0),
    (seed_exercise_id, 42, 'Die Sprecherin bucht ihren Urlaub heute eher kurzfristig.', '+', 1),
    (seed_exercise_id, 43, 'Die Familie schläft beim Camping im Zelt.', '-', 2),
    (seed_exercise_id, 44, 'Der Sprecher reist gern allein.', '+', 3),
    (seed_exercise_id, 45, 'Die Sprecherin möchte dieses Jahr weniger Gepäck mitnehmen.', '+', 4);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 46–55. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 46–55. Sie haben dazu eine Minute Zeit.',
    'modelltest-6-hoeren-teil2-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-6-hoeren/modelltest-6-hoeren-teil2.mp3', '',
    '', 'Moderatorin: Willkommen bei unserem Reisemagazin. Heute sprechen wir über nachhaltiges Reisen. Bei mir im Studio ist Herr Martin Faber. Er arbeitet bei einem Reiseveranstalter, der sich auf umweltfreundliche Urlaubsangebote spezialisiert hat. Guten Tag, Herr Faber.

Herr Faber: Guten Tag.

Moderatorin: Herr Faber, was bedeutet nachhaltiges Reisen eigentlich?

Herr Faber: Das kann verschiedene Dinge bedeuten. Zum Beispiel kann man für kürzere Strecken den Zug statt des Flugzeugs nehmen, kleinere regionale Hotels unterstützen oder im Urlaub öffentliche Verkehrsmittel benutzen.

Moderatorin: Bedeutet nachhaltiges Reisen automatisch, dass Urlaub teurer wird?

Herr Faber: Nein, nicht unbedingt. Zugtickets können teuer sein, wenn man sehr kurzfristig bucht. Wer früh plant, findet aber häufig günstige Angebote. Auch kleine Pensionen sind oft nicht teurer als große Hotels.

Moderatorin: Welche Reisen buchen Ihre Kunden besonders häufig?

Herr Faber: Sehr beliebt sind momentan Reisen innerhalb Deutschlands und in die Nachbarländer. Viele unserer Kunden fahren nach Österreich, in die Schweiz oder in die Niederlande. Fernreisen bieten wir zwar auch an, aber deutlich seltener.

Moderatorin: Reisen Ihre Kunden hauptsächlich mit dem Zug?

Herr Faber: Bei Reisen innerhalb Europas versuchen wir das möglichst oft. Manchmal ist das aber schwierig, zum Beispiel wenn das Ziel schlecht mit der Bahn erreichbar ist. Dann organisieren wir auch Busreisen oder kombinieren verschiedene Verkehrsmittel.

Moderatorin: Was ist bei den Unterkünften wichtig?

Herr Faber: Wir arbeiten gern mit kleineren Hotels und Pensionen zusammen. Viele verwenden regionale Lebensmittel oder achten darauf, Energie und Wasser zu sparen. Aber natürlich schauen wir auch auf Komfort und Qualität.

Moderatorin: Müssen Urlauber während einer solchen Reise auf viele Dinge verzichten?

Herr Faber: Nein. Nachhaltig reisen bedeutet nicht, dass man keinen Komfort haben darf. Wichtig ist eher, bewusste Entscheidungen zu treffen. Man kann zum Beispiel in einem guten Hotel wohnen und trotzdem mit öffentlichen Verkehrsmitteln reisen.

Moderatorin: Gibt es bestimmte Altersgruppen, die sich besonders dafür interessieren?

Herr Faber: Früher waren es vor allem jüngere Menschen. Inzwischen interessieren sich aber Kunden fast aller Altersgruppen dafür. Besonders Familien fragen häufig nach Angeboten, bei denen sie ohne eigenes Auto reisen können.

Moderatorin: Welche Probleme gibt es dabei?

Herr Faber: Ein Problem ist manchmal das Gepäck. Wenn Familien mit Kindern unterwegs sind, möchten sie natürlich einiges mitnehmen. Deshalb arbeiten einige unserer Partnerhotels mit einem Gepäckservice zusammen.

Moderatorin: Was empfehlen Sie Menschen, die nachhaltiger reisen möchten?

Herr Faber: Man muss nicht sofort alles verändern. Man kann zum Beispiel zunächst ein Reiseziel wählen, das mit dem Zug erreichbar ist. Oder man bleibt etwas länger an einem Ort, statt in wenigen Tagen mehrere Städte zu besuchen.

Moderatorin: Und wird nachhaltiges Reisen in Zukunft wichtiger?

Herr Faber: Davon bin ich überzeugt. Wir sehen jedes Jahr mehr Nachfrage. Deshalb erweitern wir unser Angebot im kommenden Jahr sogar um mehrere neue Bahnreisen.

Moderatorin: Vielen Dank für das Gespräch.

Herr Faber: Sehr gerne.')
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
    (seed_exercise_id, 46, 'Nachhaltiges Reisen kann bedeuten, häufiger den Zug zu benutzen.', '+', 0),
    (seed_exercise_id, 47, 'Nachhaltige Reisen sind immer teurer als andere Reisen.', '-', 1),
    (seed_exercise_id, 48, 'Viele Kunden reisen in Deutschlands Nachbarländer.', '+', 2),
    (seed_exercise_id, 49, 'Der Reiseveranstalter organisiert ausschließlich Zugreisen.', '-', 3),
    (seed_exercise_id, 50, 'Bei der Auswahl von Hotels spielt auch die Qualität eine Rolle.', '+', 4),
    (seed_exercise_id, 51, 'Nachhaltiges Reisen bedeutet laut Herrn Faber, auf Komfort zu verzichten.', '-', 5),
    (seed_exercise_id, 52, 'Heute interessieren sich Menschen verschiedener Altersgruppen für nachhaltiges Reisen.', '+', 6),
    (seed_exercise_id, 53, 'Familien fragen häufig nach Reisen ohne eigenes Auto.', '+', 7),
    (seed_exercise_id, 54, 'Einige Partnerhotels bieten einen Gepäckservice an.', '+', 8),
    (seed_exercise_id, 55, 'Der Reiseveranstalter möchte sein Angebot an Bahnreisen verkleinern.', '-', 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind. Markieren Sie Ihre Lösungen für die Aufgaben 56–60 auf dem Antwortbogen. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch.',
    'modelltest-6-hoeren-teil3-v1', 8, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-6-hoeren/modelltest-6-hoeren-teil3.mp3', '',
    '', '56
Achtung, Reisende nach Hamburg. Der ICE 812 fährt heute wegen Bauarbeiten nicht von Gleis 7, sondern von Gleis 10. Die planmäßige Abfahrtszeit um 11 Uhr 24 bleibt unverändert.

57
Guten Tag, hier ist das Hotel Sonnenhof. Unser Frühstück wird montags bis freitags von 7 bis 10 Uhr angeboten. Am Wochenende können Sie von 8 bis 11 Uhr frühstücken. Das Restaurant befindet sich im Erdgeschoss neben der Rezeption.

58
Liebe Fluggäste, der Flug AB 327 nach Madrid verspätet sich um ungefähr 45 Minuten. Der neue Abflug ist für 16 Uhr 20 vorgesehen. Bitte bleiben Sie in der Nähe von Ausgang B12.

59
Herzlich willkommen im Stadtmuseum. Unsere Führung durch die historische Altstadt beginnt heute um 14 Uhr vor dem Haupteingang. Die Führung dauert ungefähr neunzig Minuten und kostet fünf Euro pro Person. Kinder unter zwölf Jahren nehmen kostenlos teil.

60
Hallo Frau Wagner, hier ist das Reisebüro Fernweh. Ihre Unterlagen für die Reise nach Wien sind jetzt vollständig. Sie können die Tickets und Hotelinformationen ab morgen bei uns abholen. Unser Büro ist morgen von 9 bis 18 Uhr geöffnet.')
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
    (seed_exercise_id, 56, 'Der Zug nach Hamburg fährt heute von einem anderen Gleis ab.', '+', 0),
    (seed_exercise_id, 57, 'Am Wochenende endet das Frühstück um 10 Uhr.', '-', 1),
    (seed_exercise_id, 58, 'Der Flug nach Madrid startet später als geplant.', '+', 2),
    (seed_exercise_id, 59, 'Kinder unter zwölf Jahren müssen für die Führung bezahlen.', '-', 3),
    (seed_exercise_id, 60, 'Frau Wagner kann ihre Reiseunterlagen ab morgen abholen.', '+', 4);

  INSERT INTO "writing_exercises"
    ("content_revision", "title", "subtitle", "task_type", "intro", "stimulus",
     "task_instructions", "bullet_points", "closing_reminder", "modelltest_id")
  VALUES ('modelltest-6-schreiben-v1', 'Schriftlicher Ausdruck', 'Sie haben von einem Freund folgende E-Mail erhalten:',
    'brief', 'Sie haben von einem Freund folgende E-Mail erhalten:', '{"heading":"Liebe/r __________,","subheading":null,"body":"ich möchte im Sommer gern ein paar Tage in deiner Region verbringen. Ich war noch nie dort und weiß deshalb überhaupt nicht, was man sehen oder unternehmen kann.\n\nIch möchte nicht nur Sehenswürdigkeiten besuchen, sondern auch etwas in der Natur machen. Außerdem weiß ich noch nicht, ob ich mit dem Auto oder mit dem Zug kommen soll.\n\nKannst du mir ein paar Tipps geben? Vielleicht können wir ja auch einen Tag zusammen etwas unternehmen.\n\nSchreib mir bald!","features":[],"contact":{"name":"Daniel","lines":["Viele Grüße"]},"callToAction":null,"imageUrl":null}'::jsonb,
    'Antworten Sie auf die E-Mail. Schreiben Sie etwas zu allen vier Punkten:', ARRAY['welche Sehenswürdigkeiten Daniel besuchen sollte', 'welche Aktivität in der Natur Sie empfehlen', 'welches Verkehrsmittel für die Reise am besten ist', 'was Sie gemeinsam mit Daniel unternehmen möchten'],
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
    'Unterhalten Sie sich mit Ihrer Partnerin bzw. Ihrem Partner über folgende Themen:', '["Name","Woher sie oder er kommt","Wie sie oder er wohnt","Familie","Wo sie oder er Deutsch gelernt hat","Was sie oder er macht","Sprachen","Zusätzliche Prüferfrage: wohin er oder sie gern reist","Zusätzliche Prüferfrage: wie er oder sie normalerweise Urlaub macht"]'::jsonb, 'Die Prüfenden können außerdem noch weitere Fragen stellen.', 10,
    300, '', NULL, 'modelltest-6-sprechen-teil-1-v1')
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
  VALUES (mt_id, 2, 'Teil 2 Über ein Thema sprechen', 'Teilnehmer/in A / Teilnehmer/in B', 'Urlaub am Meer oder Urlaub in den Bergen?',
    'Sie haben in einer Zeitschrift etwas zum Thema „Urlaub am Meer oder Urlaub in den Bergen?“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', '["Teilnehmer/in A — Lisa Brenner, 28 Jahre, Erzieherin: „Im Urlaub möchte ich mich erholen. Deshalb fahre ich am liebsten ans Meer. Ich kann am Strand liegen, schwimmen und abends in einem Restaurant essen. Im Alltag bin ich viel unterwegs, deshalb möchte ich im Urlaub nicht jeden Tag lange Wanderungen machen.“","Teilnehmer/in B — Thomas Krüger, 35 Jahre, Mechaniker: „Für mich ist Urlaub in den Bergen viel interessanter. Ich wandere gern und möchte mich bewegen. Außerdem genieße ich die Ruhe und die Natur. Einen ganzen Tag am Strand zu liegen wäre mir viel zu langweilig.“"]'::jsonb, 'Sie haben in einer Zeitschrift etwas zum Thema „Urlaub am Meer oder Urlaub in den Bergen?“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', 15,
    300, '', NULL, 'modelltest-6-sprechen-teil-2-v1')
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
  VALUES (mt_id, 3, 'Teil 3 Gemeinsam etwas planen', 'Teilnehmer/in A und B', 'Gemeinsamen Wochenendausflug planen',
    'Sie möchten mit einigen Freunden am kommenden Wochenende einen zweitägigen Ausflug machen. Sie und Ihre Gesprächspartnerin bzw. Ihr Gesprächspartner sollen den Ausflug gemeinsam organisieren. Überlegen Sie, wohin Sie fahren möchten und was alles organisiert werden muss.', '["Wohin?","Wie fahren?","Übernachtung","Aktivitäten","Essen","Kosten","Wer organisiert was?","..."]'::jsonb, 'Entscheiden Sie zuerst, was Sie machen möchten und warum. Tragen Sie Ihrem Partner Ihre Ideen vor und begründen Sie sie. Reagieren Sie auf die Ideen Ihres Partners bzw. Ihrer Partnerin und die Begründungen. Einigen Sie sich auf einen gemeinsamen Programmvorschlag.', 5,
    300, '', NULL, 'modelltest-6-sprechen-teil-3-v1')
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
