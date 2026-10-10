-- Modelltest 3 normalized from seed source JSON.
-- Runtime-only mapping: extraction provenance/sourceTrack are intentionally omitted.
-- Re-running replaces only this Modelltest's child content, keeping the seed deterministic.
BEGIN;

DO $$
DECLARE
  mt_id UUID;
  seed_exercise_id UUID;
BEGIN
  INSERT INTO "modelltests" ("number", "title", "exam_only")
  VALUES (3, 'Modelltest 3', FALSE)
  ON CONFLICT ("number") DO UPDATE SET "title" = EXCLUDED."title"
  RETURNING "id" INTO mt_id;

  INSERT INTO "lesen_teil1_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-3-lesen-teil1-v1', 'Leseverstehen Teil 1', 'Lesen Sie die Überschriften a–j und die Texte 1–5. Finden Sie für jeden Text die passende Überschrift. Sie können jede Überschrift nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 1–5 auf dem Antwortbogen.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision",
    "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil1_texts" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil1_titles" ("exerciseId", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Immer mehr deutsche Familien reisen mit der Bahn', 0),
    (seed_exercise_id, 'Buchtipp: Hilfe bei Schlafproblemen', 1),
    (seed_exercise_id, 'Der Computer: Liebstes Hobby von Deutschlands Frauen', 2),
    (seed_exercise_id, 'Neu bei der Bahn: Spezielle Informationen und Angebote für Radfahrer', 3),
    (seed_exercise_id, 'Neu am Markt: Billige Schlaftabletten', 4),
    (seed_exercise_id, 'Familien reisen billiger', 5),
    (seed_exercise_id, 'Urlaub mit dem Fahrrad in Deutschland immer beliebter', 6),
    (seed_exercise_id, 'Kultur im Urlaub: Interessen je nach Alter unterschiedlich', 7),
    (seed_exercise_id, 'Umfrage: Wer verwendet den Computer am häufigsten?', 8),
    (seed_exercise_id, 'Deutschland: Immer mehr Touristen reisen in den Westen', 9);
  INSERT INTO "lesen_teil1_texts"
    ("exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
    (seed_exercise_id, 1, NULL, NULL, 'Wer ist der typische Computerfan? Das B.A.T. Freizeitforschungsinstitut Hamburg ermittelte einige Eigenschaften: Er ist männlich, jung und hat einen höheren Schulabschluss. Bei der Beschäftigung am heimischen Computer stehen Textverarbeitung und Spiele ganz oben, es folgen private Buchhaltung, Grafikprogramme und Tabellenkalkulation.', 0, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8)),
    (seed_exercise_id, 2, NULL, NULL, '„Bahn&Bike“ heißt ein 222-seitiger Prospekt, den die Deutsche Bahn AG in Zusammenarbeit mit der Deutschen Zentrale für Tourismus herausgebracht hat und der wichtige Informationen für jene bereitstellt, die ihren Radurlaub mit Bahnfahren verbinden wollen. Das Motto lautet: Hin mit der Bahn – das Rad vor Ort mieten. Der Prospekt enthält Angaben zur Streckenlänge und Wegbeschaffenheit, Adressen von Verleihstationen, verweist auf Sehenswürdigkeiten sowie Unterkünfte und wird durch Karten ergänzt. Die Broschüre kostet 5 Euro und ist im Buchhandel beziehungsweise an Fahrkartenschaltern zu beziehen.', 1, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 3)),
    (seed_exercise_id, 3, NULL, NULL, 'Ausführliche Informationen zum Thema „Schlafstörungen“ finden Sie im gleichnamigen Patientenratgeber von Dr. med. Fritz Hohagen. Sie erfahren, was den Schlaf stört und was Sie dagegen unternehmen können. Für 9,95 Euro erhalten Sie das Buch in Apotheken oder direkt beim Wort&Bild Verlag, 82065 Baierbrunn.', 2, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 1)),
    (seed_exercise_id, 4, NULL, NULL, 'Jetzt wird für Familien Reisen mit der Bahn zwischen Österreich und Deutschland noch ein gutes Stück günstiger. Denn ab 6. Oktober gibt es den Familien-Super-Sparpreis. Ein echter Traumpreis für die ganze Familie – vom Baby bis zum Großpapa – da kann man wirklich sparen. Der Familien-Super-Sparpreis gilt für Familien, bestehend aus ein oder zwei Erwachsenen (Eltern, auch Großeltern) und deren Kindern/Enkelkindern bis zum vollendeten 17. Lebensjahr, wobei mindestens ein Kind/Enkelkind an der Reise teilnehmen muss.', 3, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 5)),
    (seed_exercise_id, 5, NULL, NULL, 'Touristen zwischen 14 und 29 Jahren sowie zwischen 40 und 49 Jahren haben ein besonders großes Interesse an der Kultur des jeweiligen Reiselandes, während die Gruppe der 30- bis 39-jährigen im Urlaub „eine Kulturpause einlegt“. Dies geht aus der neuesten Analyse der Forschungsgemeinschaft Urlaub und Reisen e. V. hervor. Urlauber aus Ostdeutschland, so die Studie, zeigen wiederum mehr Kulturinteresse als Reisende aus dem Westen. Grundsätzlich gelte: Je höher das Einkommen und die Schulbildung sind, umso mehr besteht im Urlaub der Wunsch, Land und Leute kennenzulernen.', 4, (SELECT "id" FROM "lesen_teil1_titles" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 7));

  INSERT INTO "lesen_teil2_exercises"
    ("contentRevision", "label", "instruction", "cautionNote", "topSender",
     "topReceiver", "topBody", "quotedThread", "modelltest_id")
  VALUES ('modelltest-3-lesen-teil2-v1', 'Leseverstehen Teil 2', 'Lesen Sie den Text und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.',
    '', '', '',
    'Büro-Werkstatt: Chance für behinderte Menschen

Computerarbeit im Auftrag privater Firmen – jeder Dritte findet nach einem fünfmonatigen Kurs einen Job. Interessierte Unternehmen werden noch gesucht.

Margit, die junge Frau im Rollstuhl, erledigt die Lohnverrechnung für einen Verlag. Reinhard, seit der Geburt gehbehindert, tippt für die Direktion von Hewlett Packard Protokolle und Preislisten. Martin, seine Unterarme sind verkürzt, layoutet die Speisekarte eines Wiener Restaurants.
Drei junge körperbehinderte Menschen am Computer – alle drei können auf eine abgeschlossene kaufmännische Ausbildung verweisen. Dennoch hat man sie auf dem Arbeitsamt als „schwer vermittelbar“ eingestuft – was de facto nicht vermittelbar bedeutet. Zurzeit arbeiten Margit, Reinhard und Martin – gemeinsam mit sieben anderen behinderten Menschen – in der „Büro-Werkstatt“ in Wien-Stadlau. Hier werden körperbehinderte Schulabgänger auf das Berufsleben vorbereitet. In einem fünfmonatigen Kurs lernen sie, das in der Schule Gelernte in die Praxis umzusetzen. Ihre Dienste werden von Privatfirmen (darunter auch die OMV und zwei Banken) zugekauft.
Gleichzeitig wird ihnen bei der Jobsuche geholfen. „Leicht ist das nicht“, sagt Betreuer Günther Hos. „Es gibt so viele Arbeitslose, die nicht behindert sind. Wer nimmt schon einen Mitarbeiter mit Handicap?“ Zwar wären die Firmen gesetzlich verpflichtet, pro 25 Beschäftigte einen Behinderten einzustellen. Die meisten Firmen nützen jedoch die Möglichkeit, sich „freizukaufen“ (die sogenannte „Ausgleichstaxe“ beträgt rund 150 Euro monatlich).
Trotz der Rahmenbedingungen kann Hos mit einer durchaus positiven Bilanz aufwarten: „Immerhin haben wir seit der Vereinsgründung vor drei Jahren ein Drittel unserer Leute untergebracht.“ Auch ein Dienst an der Allgemeinheit, denn jede Vermittlung bedeutet: ein Arbeitsloser weniger, ein Steuerzahler mehr.
Gegründet wurde die Büro-Werkstatt von einer Lehrerin: Heide Hanisch, die in einer Wiener berufsbildenden Schule Geografie und Geschichte unterrichtet, wollte nicht länger hinnehmen, dass ihre behinderten Schüler erst ausgebildet werden, um dann als Arbeitnehmer nicht gebraucht zu werden.

Nähere Informationen, auch für interessierte Firmen: „Büro-Werkstatt“ in Wien-Stadlau, Telefon: 0222/283 85 75.', '', mt_id)
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
  VALUES (seed_exercise_id, 6, 'In einem fünfmonatigen Kurs können die Teilnehmer', 0)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'eine berufliche Ausbildung abschließen.', false, 0),
    (seed_exercise_id, 'lernen, was sie in der Schule verpasst haben.', false, 1),
    (seed_exercise_id, 'praktische Erfahrungen mit der Büroarbeit sammeln.', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 7, 'Die Büro-Werkstatt versucht außerdem,', 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'auch jenen Arbeitslosen zu helfen, die nicht behindert sind.', false, 0),
    (seed_exercise_id, 'Behinderte auf die Abschlussprüfungen vorzubereiten.', false, 1),
    (seed_exercise_id, 'für die behinderten Menschen eine Arbeit zu finden.', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 8, 'Laut Gesetz müssen österreichische Firmen pro 25 Beschäftigte', 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'eine besondere Steuer zahlen.', false, 0),
    (seed_exercise_id, 'einen Behinderten einstellen oder eine monatliche Gebühr bezahlen.', true, 1),
    (seed_exercise_id, 'für jeden Behinderten monatlich 150 Euro bezahlen.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 9, 'Seit der Vereinsgründung', 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'konnte für ein Drittel der behinderten Kursteilnehmer eine Arbeit gefunden werden.', true, 0),
    (seed_exercise_id, 'konnte Günther Hos für den Verein schon viel Geld sparen.', false, 1),
    (seed_exercise_id, 'zahlen Arbeitslose um ein Drittel weniger Steuern.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "lesen_teil2_questions"
    ("exerciseId", "questionNumber", "prompt", "sortOrder")
  VALUES (seed_exercise_id, 10, 'Die Lehrerin, die die Büro-Werkstatt gegründet hat,', 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "lesen_teil2_options" ("questionId", "content", "isCorrect", "sortOrder") VALUES
    (seed_exercise_id, 'wollte etwas tun, damit Behinderte einen Arbeitsplatz erhalten.', true, 0),
    (seed_exercise_id, 'wollte nicht länger Geografie und Geschichte unterrichten.', false, 1),
    (seed_exercise_id, 'wird nach der Ausbildung der Behinderten nicht mehr gebraucht.', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "lesen_teil2_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "lesen_teil3_exercises"
    ("contentRevision", "label", "instruction", "modelltest_id")
  VALUES ('modelltest-3-lesen-teil3-v1', 'Leseverstehen Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Finden Sie für jede Situation die passende Anzeige. Sie können jede Anzeige nur einmal benutzen. Markieren Sie Ihre Lösungen für die Aufgaben 11–20 auf dem Antwortbogen. Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein x.', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "lesen_teil3_situations" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "lesen_teil3_announcements" ("exerciseId", "title", "content", "sortOrder") VALUES
    (seed_exercise_id, 'Thai-China-Vietnam – Asiatisches Spezialitäten-Restaurant – Bong - Hong', '81379 Boschetsrieder Straße 140
Tel./Fax 089/785 56 52
täglich von 11.30 – 14.30 Uhr
und 17.30 – 23.00 Uhr
Kein Ruhetag
Alle Gerichte auch zum Mitnehmen
und Heimservice', 0),
    (seed_exercise_id, 'Ristorante OLINDO', 'Italienisches Restaurant
• hausgemachte Nudeln
• Fischspezialitäten
• Mittagsmenues ab 7.50 Euro
Bei schönem Wetter Gartenbetrieb
Fallmerayerstr. 16
München-Schwabing', 1),
    (seed_exercise_id, 'Wir wünschen unseren Kunden und allen, die es noch werden wollen, schöne Ferien und gute Erholung.', '... sind Sie für den Urlaub auch gut versichert?
Fragen Sie:
Helmut Schwabe
Herzogstraße 88 · Vers.-Büro
Tel.: 089-303097, Fax 059-3073802
VERMITTLUNG FÜR DIE UNTERNEHMEN DER
VERSICHERUNGSKAMMER BAYERN', 2),
    (seed_exercise_id, 'SEATOP Reisen', 'Der Flug- und Hotelspezialist
WELTWEIT REISEN
Mietwagen
Hotelvermittlung – Rundreisen –
Sommertermine nach USA noch
Plätze frei
Tel. 53 91 84 · Fax 53 67 78', 3),
    (seed_exercise_id, 'COUNCIL TRAVEL', 'Adalbertstr. 32, 80799 München 40
Tel: 089/39 50 22  Fax: 39 70 04
Für Studenten/Jugendliche
New York/Boston ....................329,–
Los Angeles ............................429,–
Miami/Chicago ......................349,–
Mexico ....................................499,–
Hongkong ...............................529,–
Amsterdam ...............................99,–
London......................................99,–
Edinburgh ...............................129,–
Barcelona..................................99,–
Stockholm ...............................159,–
Helsinki ...................................199,–
Paris..........................................99,–
Madrid .....................................129,–
Tel Aviv....................................299,–
Alle Preise zzgl. Sicherheitsgebühr u. Steuern
SPRACHREISEN & ABENTEUERREISEN
A travel division of the Council on International Educational Exchange (EIEE)
Spezialpreise auch für JEDERMANN!', 4),
    (seed_exercise_id, 'Kreittmayr', 'Kneipe mit Biergarten
Billard und Kegelbahnen
Jeden Fr. oder Sa. live
Bundesliga-Topspiele
Kreittmayrstr. 15
Tel. 523 17 34
Mo. – Fr. 11.00 – 1.00
Sa. + So. 17.00 – 1.00', 5),
    (seed_exercise_id, 'Internationaler Stammtisch', 'Deutsche und ausländische Jugendliche in München
ist das Thema, das der Internationale Stammtisch am Montag,
den 4. September, um 19.30 Uhr im Ratskeller
„Moriskengewölbe“ (Marienplatz) diskutieren wird.', 6),
    (seed_exercise_id, 'Nachprüfung', 'Lehrerin bereitet intensiv vor
in: Latein, Englisch,
Französisch, Deutsch
Tel.: 308 51 17', 7),
    (seed_exercise_id, 'Unterricht', 'Nachhilfe in Mathe-Physik mit viel Geduld u.
Erfahrung von Gymnasiallehrer, Tel. 260 95 57

Mathe/Physik/Chemie, Nachhilfe f. alle Kl.,
Gymn., Realschule, FOS, Abi-Vorbereitung,
Schulwechsel, Hausbes. f. ganz MÜ. ohne
Zuschlag Tel. 089/834 04 40 o. 36 14 55 1

***Erf. Dipl.-Math. gibt*** MATHE (alles für Abi
u. Studium) PHYSIK (für ABI), Tel. 271 29 32', 8),
    (seed_exercise_id, 'City-Reisebüro', 'Klenzestr. 7 · 80469 München
Campmobile
USA/CANADA
z.B. San Francisco/
Los Angeles
ab € 35,– pro Tag
Früh buchen lohnt!
Telefon 089 290 45 65', 9),
    (seed_exercise_id, 'Kurse', 'Für Erwachsene und Kinder mit (Sprach-)Schwierigkeiten
Gisela Geiger
Leopoldstraße 83 · 80802 München · Telefon 39 99 95', 10),
    (seed_exercise_id, 'SPRACHBÖRSE', 'Deutsch als Fremdsprache · Fremdsprachen · Kindersprachkurse
• Prüfungskurse
• Geschäftsdeutsch
• muttersprachl. Lehrkräfte
• Minigruppen und Einzelunterricht
• schon für Kinder ab 4 Jahren
Sprachbörse: Nähe Rotkreuzplatz · Tel. 16 14 79 · Schulstraße 31', 11);
  INSERT INTO "lesen_teil3_situations"
    ("exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
    (seed_exercise_id, 11, 'Sie möchten mit Freunden in einem Restaurant essen. Da das Wetter schön ist, möchten Sie gerne draußen sitzen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 1), 0),
    (seed_exercise_id, 12, 'Sie möchten heute nicht selbst kochen, sondern lieber ein warmes Essen kaufen und mit nach Hause nehmen.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 0), 1),
    (seed_exercise_id, 13, 'In den Sommerferien möchten Sie gerne in die USA fliegen. Sie brauchen dort auch eine Unterkunft.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 3), 2),
    (seed_exercise_id, 14, 'Reisebüros bieten billigere Flüge an, wenn man in letzter Minute bucht. Sie suchen so einen Flug.', true, NULL, 3),
    (seed_exercise_id, 15, 'Ihre Tochter, die studiert, möchte in die USA fliegen. Sie suchen einen billigen Flug für sie.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 4), 4),
    (seed_exercise_id, 16, 'Ihr Sohn ist schlecht in Mathematik und braucht deshalb noch Unterricht außerhalb der Schule.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 8), 5),
    (seed_exercise_id, 17, 'Das Kind Ihrer Freunde hat Probleme beim Sprechen und braucht deshalb Hilfe.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 10), 6),
    (seed_exercise_id, 18, 'Sie haben einen jungen Franzosen zu Besuch. Sie möchten, dass er in einen Deutschkurs geht.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 11), 7),
    (seed_exercise_id, 19, 'Sie möchten, dass Ihr Sohn in einen Jugendclub geht.', true, NULL, 8),
    (seed_exercise_id, 20, 'Sie interessieren sich für die Probleme ausländischer Jugendlicher in Deutschland.', false, (SELECT "id" FROM "lesen_teil3_announcements" WHERE "exerciseId" = seed_exercise_id AND "sortOrder" = 6), 9);

  INSERT INTO "sprachbausteine_exercises"
    ("teil_number", "content_revision", "label", "instruction", "duration_minutes",
     "image_url", "body", "modelltest_id")
  VALUES (1, 'modelltest-3-sprachbausteine-teil1-v1', 'Sprachbausteine Teil 1',
    'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, '', 'Liebe Karin,

nach meinem Praktikum in Frankreich bin ich jetzt wieder zu Hause. Wie du ja weißt, wollte ich eigentlich nach Paris, _____ das hat dann leider nicht geklappt. Doch dann habe ich eine Stelle als Praktikant bei _____ Firma in Straßburg gefunden.

Dort _____ ich drei Monate geblieben. Die Arbeit war sehr _____ – ich musste schon um 8.00 Uhr im Büro sein –, hat mir aber _____ sehr gut gefallen.
Ich habe _____ dieser Zeit in verschiedenen Abteilungen gearbeitet und so nicht nur etwas über die Herstellung von Fernsehgeräten _____, sondern auch über den Verkauf.
Und die Kollegen, mit _____ ich am meisten zu tun hatte, waren wirklich sehr nett.

Nach dem Praktikum habe ich noch zwei Wochen Urlaub bei _____ Freunden gemacht. Darüber erzähle ich _____ bald mehr – für heute muss ich Schluss machen.

Liebe Grüße
Fritz', mt_id)
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
    (seed_exercise_id, 'aber', true, 0),
    (seed_exercise_id, 'denn', false, 1),
    (seed_exercise_id, 'sondern', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '22', 22, 1)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'eine', false, 0),
    (seed_exercise_id, 'einen', false, 1),
    (seed_exercise_id, 'einer', true, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '23', 23, 2)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'bin', true, 0),
    (seed_exercise_id, 'habe', false, 1),
    (seed_exercise_id, 'wurde', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '24', 24, 3)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'anstrengend', true, 0),
    (seed_exercise_id, 'anstrengende', false, 1),
    (seed_exercise_id, 'anstrengendes', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '25', 25, 4)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'trotzdem', true, 0),
    (seed_exercise_id, 'wegen', false, 1),
    (seed_exercise_id, 'weshalb', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '26', 26, 5)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'bis', false, 0),
    (seed_exercise_id, 'in', true, 1),
    (seed_exercise_id, 'nach', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '27', 27, 6)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'gelernt', true, 0),
    (seed_exercise_id, 'lernen', false, 1),
    (seed_exercise_id, 'lernte', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '28', 28, 7)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'dem', false, 0),
    (seed_exercise_id, 'denen', true, 1),
    (seed_exercise_id, 'die', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '29', 29, 8)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'meine', false, 0),
    (seed_exercise_id, 'meinen', true, 1),
    (seed_exercise_id, 'meiner', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;
  INSERT INTO "sprachbausteine_gaps"
    ("exercise_id", "gap_key", "gap_number", "sort_order")
  VALUES (seed_exercise_id, '30', 30, 9)
  RETURNING "id" INTO seed_exercise_id;
  INSERT INTO "sprachbausteine_gap_options" ("gap_id", "content", "is_correct", "sort_order") VALUES
    (seed_exercise_id, 'dir', true, 0),
    (seed_exercise_id, 'Ihnen', false, 1),
    (seed_exercise_id, 'uns', false, 2);
  SELECT "id" INTO seed_exercise_id FROM "sprachbausteine_exercises" WHERE "modelltest_id" = mt_id;

  INSERT INTO "sprachbausteine_teil2_exercises"
    ("contentRevision", "label", "instruction", "durationMinutes", "image_url", "body", "modelltest_id")
  VALUES ('modelltest-3-sprachbausteine-teil2-v1', 'Sprachbausteine Teil 2', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, '', 'Hotel-Pension Janosch
ruhige Lage, Wanderwege, Bademöglichkeiten,
Tennis, Freizeitprogramm für Kinder,
Familienappartements: 1 Woche pro Person
nur € 99,– inkl. Frühstück, spezielle Kinderermäßigung.
Anfragen an: Herbert Janosch, Griesweg 3, A-5020 Innsbruck

Sehr geehrter Herr Janosch,

ich habe Ihre Anzeige gelesen und interessiere mich sehr _____ Ihr Angebot. Ich möchte mit meiner Familie vom 10.–24. August in Österreich Urlaub machen und hätte deshalb _____ noch nähere Informationen.
Meine Frau und mich interessiert ganz _____ das Freizeitprogramm für Kinder, _____ wir zwei Kinder (3 und 8 Jahre) haben. Gibt es Schwimm- und Tenniskurse für Kinder und _____ ja, was kosten sie? In Ihrer Anzeige steht auch, dass Sie für die Unterkunft günstige Angebote für Kinder haben. Wie viel _____ wir pro Woche für unsere Kinder bezahlen?
Und _____ noch eine letzte Frage: Wir haben einen kleinen Hund, von dem sich meine Kinder nicht trennen können und den wir _____ auch mitnehmen müssten. Wäre das möglich?

Bitte schreiben Sie uns so bald wie möglich, _____ wir uns bald entscheiden können.
Außerdem wären wir Ihnen sehr _____, wenn Sie uns einige Prospekte oder Bilder Ihrer Pension sowie der Umgebung zusenden würden.

Mit freundlichen Grüßen
Ihr Anton Müller', mt_id)
  ON CONFLICT ("modelltest_id") DO UPDATE SET
    "contentRevision" = EXCLUDED."contentRevision", "label" = EXCLUDED."label",
    "instruction" = EXCLUDED."instruction", "durationMinutes" = EXCLUDED."durationMinutes",
    "image_url" = EXCLUDED."image_url", "body" = EXCLUDED."body"
  RETURNING "id" INTO seed_exercise_id;

  DELETE FROM "sprachbausteine_teil2_gaps" WHERE "exerciseId" = seed_exercise_id;
  DELETE FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id;
  INSERT INTO "sprachbausteine_teil2_words" ("exerciseId", "letter", "content", "sortOrder") VALUES
    (seed_exercise_id, 'a', 'BESONDERS', 0),
    (seed_exercise_id, 'b', 'DA', 1),
    (seed_exercise_id, 'c', 'DAFÜR', 2),
    (seed_exercise_id, 'd', 'DAMALS', 3),
    (seed_exercise_id, 'e', 'DAMIT', 4),
    (seed_exercise_id, 'f', 'DANKBAR', 5),
    (seed_exercise_id, 'g', 'DESHALB', 6),
    (seed_exercise_id, 'h', 'FÜR', 7),
    (seed_exercise_id, 'i', 'GERNE', 8),
    (seed_exercise_id, 'j', 'KÖNNTEN', 9),
    (seed_exercise_id, 'k', 'MIT', 10),
    (seed_exercise_id, 'l', 'MÜSSTEN', 11),
    (seed_exercise_id, 'm', 'SCHLIESSLICH', 12),
    (seed_exercise_id, 'n', 'WANN', 13),
    (seed_exercise_id, 'o', 'WENN', 14);
  INSERT INTO "sprachbausteine_teil2_gaps"
    ("exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
    (seed_exercise_id, '31', 31, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'h'), 0),
    (seed_exercise_id, '32', 32, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'i'), 1),
    (seed_exercise_id, '33', 33, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'a'), 2),
    (seed_exercise_id, '34', 34, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'b'), 3),
    (seed_exercise_id, '35', 35, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'o'), 4),
    (seed_exercise_id, '36', 36, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'l'), 5),
    (seed_exercise_id, '37', 37, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'm'), 6),
    (seed_exercise_id, '38', 38, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'g'), 7),
    (seed_exercise_id, '39', 39, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'e'), 8),
    (seed_exercise_id, '40', 40, (SELECT "id" FROM "sprachbausteine_teil2_words" WHERE "exerciseId" = seed_exercise_id AND "letter" = 'f'), 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41-45 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 41-45. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 41-45. Sie haben dazu 30 Sekunden Zeit.',
    'modelltest-3-hoeren-teil1-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-3-hoeren-teil1.mp3', '',
    '', 'Wir beschäftigen uns heute mit der Frage „Gleichberechtigung im Haushalt“ und konfrontierten über 50 verheiratete Paare mit der Frage: „Wie teilen Sie sich die Arbeit im Haushalt?“ Hören Sie dazu einige Stellungnahmen:

41
Na, eigentlich mach alles ich, ich bin zu Haus, daher koch ich, ich wasch ab, ich bügle, ich versorge das Kind, na ja mein Mann macht vielleicht den Abwasch und den Garten – für den ist er zuständig und einkaufen gehn wir beide.

42
Wo ich im Haushalt helfe, ach Gott kochen kochen tu immer ich, das macht mir großen Spaß. Dafür wäscht meine Frau eben ab ähm ... Wäsche waschen mach ich nicht so gerne das macht sie, dafür geh ich immer gerne einkaufen und Garten, Blumengießen, dass ich ein bisschen aus dem Haus rauskomme.

43
Tja, bei uns ist das so, mein Mann ist voll berufstätig, ich bin zu Hause mit unseren zwei kleinen Kindern, 3 und 5 Jahre alt, tja, und dann schaut’s so aus, dass ich koche, abwasche, ähm, aufräumen, das muss auch ich machen, vor allem die Kinderzimmer schauen ja wirklich immer schrecklich aus. Wäschewaschen mach auch ich, ebenso das Bügeln. Das Einkaufen übernimmt er, putzen tu ich und im Sommer betreut er den Garten und gießt die Blumen, denn Gartenarbeit ist etwas, das kann ich nicht, das mag ich nicht.

44
Puh, wissen Sie, bei uns ist das eigentlich ganz unterschiedlich, das hängt von der Situation ab. Meistens koche ich und gehe auch einkaufen, während meine Partnerin sich eher mit Aufräumen und Abwaschen beschäftigt. Äh, die Wäsche, die teilen wir uns und, äh, Garten haben wir keinen, daher fällt das weg.

45
Also mein Mann, der ist ziemlich faul, der macht überhaupt nur, was ihm Spaß macht. Einkaufen geht er ja – aber er hält sich nicht an die Liste, die ich ihm aufschreibe, er kauft immer irgendwas, meistens zu teure Sachen. Ab und zu kocht er, aber das Abwaschen überlässt er mir, na, aufräumen tut er sowieso nicht, die Wäsche schmeißt er einfach ins Eck, das ist meine Sache, von Putzen kann keine Rede sein, also und um den Garten kümmert sich bei uns eigentlich überhaupt keiner – der verwildert.')
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
    (seed_exercise_id, 41, 'Die Sprecherin muss im Haushalt fast alles alleine machen.', '+', 0),
    (seed_exercise_id, 42, 'Der Sprecher wäscht das Geschirr und die Wäsche.', '-', 1),
    (seed_exercise_id, 43, 'Die Sprecherin ist berufstätig und hat keine Zeit für die Hausarbeit.', '-', 2),
    (seed_exercise_id, 44, 'Der Sprecher teilt sich mit seiner Partnerin die Arbeit je nach Situation auf.', '+', 3),
    (seed_exercise_id, 45, 'Die Sprecherin ist froh, dass ihr Mann so viele Hausarbeiten übernimmt.', '-', 4);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46-55 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 46-55. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 46-55. Sie haben dazu eine Minute Zeit.',
    'modelltest-3-hoeren-teil2-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-3-hoeren-teil2.mp3', '',
    '', 'J.: = Journalist
S.: = Frau Seiffert

J.: Der Turn- und Sportverein Neustadt wird in diesem Jahr 100 Jahre alt und feiert diesen Geburtstag mit einem großen Programm. Ich begrüße dazu heute hier im Studio eine Vertreterin des Turn- und Sportvereins Neustadt, Frau Seiffert. Guten Tag!
S.: Guten Tag!
J.: Frau Seiffert, welche Aufgaben haben Sie denn im Verein?
S.: Ja, also ich führe bei allen Sitzungen Protokoll. Ich schreibe also alles auf, worüber diskutiert wird und was beschlossen wird. Schriftführerin heißt das.
J.: Aha. Vielleicht liegen Ihnen als Schriftführerin da sogar noch Papiere aus den ersten Vereinsjahren vor... ?
S.: Ja, so ist es. Unsere Kollegen früher waren nämlich äußerst sorgfältig. So konnten wir in unserer Festzeitung zum 100. Geburtstag das Programm von der ersten Hauptversammlung des Vereins veröffentlichen. Das macht sich sehr nett.
J.: Unglaublich, dass trotz der zwei Kriege in diesem Jahrhundert solche Papiere und Unterlagen noch vorhanden sind. Also, ich nehme mal an, als Ihr Verein vor 100 Jahren gegründet wurde, war Sport doch sicher nur eine Sache für Männer?
S.: Ja, klar. Am Anfang war Sport reine Männersache. Es hat 16 Jahre gedauert, bis bei uns die ersten Frauen dazukamen. Das war ein echter Fortschritt für die Zeit damals, Anfang des 20. Jahrhunderts.
J.: Ja, das kann man sich gut vorstellen. Wie viele Frauen haben Sie denn heute im Verein im Vergleich zu Männern?
S.: Ja, also heute sind es ziemlich viele. Über 50 Prozent der Mitglieder sind Frauen, d. h. mehr als 1000 der insgesamt 2000 Mitglieder.
J.: Ihr Verein hat ja hier in Neustadt eine schöne Anlage mit Sportplätzen im Freien und einer großen Halle. Wer finanziert denn das eigentlich alles?
S.: Ja, also 50 Prozent des Geldes, das wir brauchen, bekommen wir durch unsere Mitglieder, in Form von Mitgliedsbeiträgen, den Rest bekommen wir von der Stadt und vom Deutschen Sportbund dazu.
J.: Wenn man sich Ihr Angebot ansieht, dann staunt man. Da gibt es alles, was zur Zeit gefragt ist: von Aerobic über sportliches Gehen bis hin zu Mutter-Kind-Gymnastik.
S.: Ja, das stimmt. Im Grunde genommen bieten wir fast jede Sportart an, außer Schwimmen. Es gibt im Nachbarort ein großes Schwimmbad mit einem Extra-Schwimmverein. Also, da wäre es Unsinn, wenn wir eine eigene Abteilung für Schwimmen aufmachen würden.
J.: Woher kommen denn Ihre Trainer und die Lehrer für alle diese vielen Sportarten?
S.: Ja, also die meisten kommen aus dem Verein selber. Wir bilden ja viele Leute aus, die später Sport studieren oder Leistungssport machen. Diese Leute bitten wir oft, im eigenen Verein zu unterrichten.
J.: Ja, klar – so bleiben Ihnen die Talente praktisch erhalten. Frau Seiffert, ich bedanke mich für Ihren Besuch hier in unserem Studio und wünsche Ihrem Verein auch für die nächsten 100 Jahre alles Gute.
S.: Danke.')
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
    (seed_exercise_id, 46, 'Der Sportverein plant eine große Feier.', '+', 0),
    (seed_exercise_id, 47, 'Der Journalist unterhält sich mit einer Vertreterin des Sportvereins.', '+', 1),
    (seed_exercise_id, 48, 'Viele Papiere aus den Anfängen des Vereins sind im Krieg verloren gegangen.', '-', 2),
    (seed_exercise_id, 49, 'Der Verein veröffentlicht jedes Jahr eine Festzeitung.', '-', 3),
    (seed_exercise_id, 50, 'Der Verein hatte von Anfang an auch Frauen als Mitglieder.', '-', 4),
    (seed_exercise_id, 51, 'Heute gibt es im Verein mehr Frauen als Männer.', '+', 5),
    (seed_exercise_id, 52, 'Im Verein kann man Sport im Freien und in der Halle treiben.', '+', 6),
    (seed_exercise_id, 53, 'Die Mitglieder müssen die Kosten für ihren Verein alleine tragen.', '-', 7),
    (seed_exercise_id, 54, 'Der Sportverein bietet auch Schwimmkurse an.', '-', 8),
    (seed_exercise_id, 55, 'Einige Leute, die im Verein ausgebildet wurden, arbeiten dort heute als Lehrer.', '+', 9);

  INSERT INTO "listening_exercises"
    ("modelltest_id", "part", "title", "subtitle", "instruction", "content_revision",
     "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript")
  VALUES (mt_id, 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56-60 richtig oder falsch sind. Markieren Sie Ihre Lösungen für die Aufgaben 56-60 auf dem Antwortbogen. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch.',
    'modelltest-3-hoeren-teil3-v1', 10, 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/modelltest-3-hoeren-teil3.mp3', '',
    '', '56
Also, wenn Sie aus dem Bahnhof rauskommen, sind Sie in der Schillerstraße. Gehen Sie dann nach rechts und immer geradeaus, bis Sie zu einer Kreuzung kommen. Das ist die Königstraße. Überqueren Sie die Königstraße, bleiben Sie aber in der Schillerstraße. Wir sind dann ein Stückchen weiter, gegenüber vom Kino Gloria.

57
Guten Tag, meine Damen und Herren. Wir bringen Ihnen jetzt einen Ausschnitt aus dem Programm der Zürcher Filmtheater.

Filmcasino: „Frühstück bei Tiffany“, 18 Uhr 30 und 20 Uhr 30.
City Kino 1: „Sommer“, 18 Uhr 45 und 21 Uhr
City Kino 2: „Starke Jungs“, 18 Uhr 15 und 19 Uhr 45

Das Kino Gloria-Palast ist zur Zeit ...

58
Und nun der Wetterbericht des Wetteramtes München für Montag, den 28. Oktober. Südbayern: Anfangs noch vereinzelt Regen, später zunehmend sonnig mit Höchsttemperaturen bis 18 Grad. Nachts geringer Bodenfrost. Nordbayern: Wechselhaft mit Schauern, dabei mild und sehr windig. Temperaturen nachts bis -2 Grad.

59
Guten Tag. Wir begrüßen alle neu hinzugestiegenen Fahrgäste im ICE Riemenschneider auf der Fahrt von Hamburg nach Nürnberg. Unser Zugrestaurant finden Sie zwischen der 1. und 2. Wagenklasse, wo Sie das Speisewagen-Team ab 11.30 Uhr gern zum Mittagessen erwartet. Verehrte Fahrgäste, auch eine Minibar befindet sich im Zug. Sollten Sie Appetit haben auf einen kleinen Imbiss oder auf kalte und warme Getränke, diese Dinge können Sie im Abteil kaufen. Die Minibar kommt durch die zweite Wagenklasse. Weitere Auskünfte und Informationen erhalten Sie beim ICE-Team dieses Zuges. Wir wünschen Ihnen eine angenehme Reise.

60
Das ist Spitze. Sommerschlussverkauf. Jetzt bei uns mit Superangeboten. Ja, bei uns gibt’s zum Beispiel damenhafte Röcke für nur 39 Euro und modische Pullover in lässiger Weite. Wählen Sie aus verschiedenen Farben und Formen – das Stück nur 19 Euro. Und das gibt’s ganz aktuell – für Sie, meine Herren: Oberhemden in großer Auswahl, pflegeleicht, für nur 5 Euro. Oder die modischen City-Hosen für Herren, vollwaschbar und echt günstig, nur 10 Euro. Greifen Sie zu, solange der Vorrat reicht.')
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
    (seed_exercise_id, 56, 'Das Büro ist in der Schillerstraße.', '+', 0),
    (seed_exercise_id, 57, 'Der Film „Sommer“ läuft im Filmcasino.', '-', 1),
    (seed_exercise_id, 58, 'Im Süden Bayerns wird es am Nachmittag schön und nicht sehr warm.', '+', 2),
    (seed_exercise_id, 59, 'Im Zugrestaurant können Sie auch Zeitungen kaufen.', '-', 3),
    (seed_exercise_id, 60, 'Damenröcke kosten heute 39 Euro.', '+', 4);

  INSERT INTO "writing_exercises"
    ("content_revision", "title", "subtitle", "task_type", "intro", "stimulus",
     "task_instructions", "bullet_points", "closing_reminder", "modelltest_id")
  VALUES ('modelltest-3-schreiben-v1', 'Schriftlicher Ausdruck', 'Sie haben von einer Freundin folgende E-Mail erhalten:',
    'brief', 'Sie haben von einer Freundin folgende E-Mail erhalten:', '{"heading":"Liebe/r                      ,","subheading":null,"body":"danke für deine nette Einladung! Ich komme dich sehr gerne besuchen, um dein Land kennenzulernen - wie du weißt, war ich ja noch nie da. Wann wäre die beste Zeit, dich zu besuchen? Ich weiß noch nicht einmal, ob es bei euch im Sommer sehr heiß wird – allzu große Hitze mag ich nämlich nicht so sehr. Und gibt es sonst noch irgendwelche Dinge, die ich wissen sollte, bevor ich diese Reise mache?\n\nBitte schreib mir möglichst bald, damit ich mich gut auf die Reise vorbereiten kann.","features":[],"contact":{"name":"Marianne","lines":["Herzliche Grüße"]},"callToAction":null,"imageUrl":null}'::jsonb,
    'Antworten Sie auf die E-Mail. Schreiben Sie etwas zu allen vier Punkten:', ARRAY['welche Ausflüge Sie mit Marianne machen wollen', 'was die beste Jahreszeit für die Reise ist', 'welche Kleidung sie mitnehmen soll', 'wie sie sich am besten auf die Reise vorbereiten kann'],
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
    'Unterhalten Sie sich mit Ihrer Partnerin bzw. Ihrem Partner über folgende Themen:', '["Name","Woher sie oder er kommt","Wie sie oder er wohnt (Wohnung, Haus, Garten …)","Familie","Wo sie oder er Deutsch gelernt hat","Was sie oder er macht (Schule, Studium, Beruf …)","Sprachen (welche? wie lange? warum?)","Zusätzliche Prüferfrage: wie er oder sie das Wochenende verbringt","Zusätzliche Prüferfrage: welche Hobbys er oder sie hat"]'::jsonb, 'Die Prüfenden können außerdem noch weitere Fragen stellen.', 10,
    300, '', NULL, 'modelltest-3-sprechen-teil-1-v1')
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
  VALUES (mt_id, 2, 'Teil 2 Über ein Thema sprechen', 'Teilnehmer/in A / Teilnehmer/in B', 'Gruppenreisen',
    'Sie haben in einer Zeitschrift etwas zum Thema „Gruppenreisen“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', '["Teilnehmer/in A — Sabine Klostermann, 33 Jahre, Bürokauffrau: „Ich verreise gern in einer Gruppe. Allein reisen macht mir keinen Spaß. Bei Gruppenreisen kann man neue Leute kennen lernen und hat immer Gesellschaft. Außerdem ist ein Reiseführer dabei, der einem die Sehenswürdigkeiten zeigt.“","Teilnehmer/in B — Jens Mühle, 39 Jahre, Physiker: „Wenn man mit einer Gruppe unterwegs ist, gibt es meist ein festes Programm. Daher reise ich immer allein. Manchmal möchte ich ausschlafen, manchmal etwas besichtigen. Ganz nach Lust und Laune. In einer Gruppe wäre das nicht möglich.“"]'::jsonb, 'Sie haben in einer Zeitschrift etwas zum Thema „Gruppenreisen“ gelesen. Berichten Sie Ihrer Gesprächspartnerin/Ihrem Gesprächspartner darüber. Ihre Gesprächspartnerin/Ihr Gesprächspartner hat eine andere Meinung dazu gelesen und berichtet Ihnen auch darüber. Unterhalten Sie sich dann mit Ihrer Gesprächspartnerin/Ihrem Gesprächspartner über das Thema. Sagen Sie Ihre Meinung und erzählen Sie von eigenen Erfahrungen.', 15,
    300, '', NULL, 'modelltest-3-sprechen-teil-2-v1')
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
  VALUES (mt_id, 3, 'Teil 3 Gemeinsam etwas planen', 'Teilnehmer/in A und B', 'Party',
    'Sie haben zwei Wochen Urlaub gemacht und in dieser Zeit einige nette Deutsche kennen gelernt. Vor dem Ende des Urlaubs und bevor Ihre Bekannten alle wieder nach Hause fahren, möchten Sie eine Abschiedsparty feiern. Sie haben die Aufgabe, zusammen mit Ihrem Gesprächspartner/Ihrer Gesprächspartnerin diese Party zu planen. Überlegen Sie sich, was alles zu tun ist und wer welche Aufgaben übernimmt. Sie haben sich schon diese Liste gemacht.', '["Wann?","Wo?","Essen","Getränke","Wer bezahlt wofür?","..."]'::jsonb, 'Entscheiden Sie zuerst, was Sie machen möchten und warum. Tragen Sie Ihrem Partner Ihre Ideen vor und begründen Sie sie. Reagieren Sie auf die Ideen Ihres Partners bzw. Ihrer Partnerin und die Begründungen. Einigen Sie sich auf einen gemeinsamen Programmvorschlag.', 5,
    300, '', NULL, 'modelltest-3-sprechen-teil-3-v1')
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
