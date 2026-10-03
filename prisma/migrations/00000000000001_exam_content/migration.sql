-- The exam content: Modelltest 1 and 2.
--
-- A schema baseline creates tables, not content, and the integration suite reads
-- real exercises — "the Hören exercise of Modelltest 1, as seeded". So the
-- content is captured here, read out of the database that has it right rather
-- than re-derived from the five seed migrations this replaces. Those were
-- written against the schema as it stood at the time, and at least one of them
-- could no longer be replayed at all: `modelltest_id` became NOT NULL in August,
-- after they were written.
--
-- Parents before children, so the foreign keys hold. ON CONFLICT DO NOTHING on
-- every statement, so applying it to a database that already has the content
-- changes nothing.
--
-- 325 rows across 20 tables.

-- modelltests: 2 rows
INSERT INTO "modelltests" ("id", "number", "title", "created_at", "exam_only") VALUES
  ('66ae8d06-0514-403f-801d-ab2cb4d440b6', 2, 'Modelltest 2', '2026-08-21T17:40:56.444Z'::timestamptz, FALSE),
  ('bee41782-747a-4b53-8059-801f3ad2bcfe', 1, 'Modelltest 1', '2026-05-05T18:48:39.372Z'::timestamptz, FALSE)
ON CONFLICT ("number") DO NOTHING;

-- sprachbausteine_exercises: 2 rows
INSERT INTO "sprachbausteine_exercises" ("teil_number", "content_revision", "label", "instruction", "duration_minutes", "body", "created_at", "id", "modelltest_id", "image_url") VALUES
  (1, 'modelltest-1-v1', 'Sprachbausteine, Teil 1', 'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, 'Schroeder & Söhne, Aufzüge und Industrielifts

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

-30- Geschäftsleitung', '2026-04-22T16:05:10.059Z'::timestamptz, 'aaaaaaaa-0001-0001-0001-000000000001', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/sprachbausteine-teil-1.png'),
  (1, 'modelltest-2-sprachbausteine-teil1-v1', 'Sprachbausteine, Teil 1', 'Lesen Sie den Text und schließen Sie die Lücken 21–30. Welche Lösung (a, b oder c) ist jeweils richtig?
Markieren Sie Ihre Lösungen für die Aufgaben 21–30 auf dem Antwortbogen.', 18, 'Information: Neue Schließanlage

Im kommenden Monat -21- in unserem Bürogebäude eine neue Schließanlage eingebaut. Wir möchten Sie schon jetzt -22- die wichtigsten Änderungen informieren.

Bis zum Ende dieses Monats kann jeder Mitarbeiter in der Personalabteilung -23- persönliche Zugangskarte abholen. Sie müssen bei der Abholung persönlich erscheinen und auch eine Quittung -24-.

Ab dem kommenden Monat können Sie den Haupteingang im Erdgeschoss sowie die Türen zu den Büros im ersten und zweiten Stock nur noch -25- Ihrer Zugangskarte öffnen. Einige Mitarbeiter (u. a. Abteilungsleiter) haben noch einen Schlüssel -26- den Haupteingang. Bitte geben Sie diese Schlüssel -27-, nachdem die neue Schließanlage eingebaut wurde.

Die Bedienung -28- Schließanlage ist ganz leicht: Halten Sie Ihre Zugangskarte einfach an das Lesegerät und die Tür wird automatisch geöffnet. Sollten Sie Probleme mit der Karte haben, -29- Sie sich jederzeit an die Mitarbeiter am Empfang wenden.

Wichtig: Wenn Sie Ihre Zugangskarte verlieren oder die Karte -30- wird, melden Sie sich bitte sofort beim Empfang! Wir müssen Ihre Karte dann sperren lassen.', '2026-08-21T15:40:56.444Z'::timestamptz, 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990', '66ae8d06-0514-403f-801d-ab2cb4d440b6', '')
ON CONFLICT ("id") DO NOTHING;

-- sprachbausteine_gaps: 20 rows
INSERT INTO "sprachbausteine_gaps" ("gap_key", "gap_number", "sort_order", "id", "exercise_id") VALUES
  ('30', 30, 9, '03c5d74e-2fed-49c7-a26a-0d9c68183f94', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('24', 24, 3, '4a41df47-08da-44ac-b4b2-c4de3e501552', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('23', 23, 2, '7d6280b1-c322-4f1a-960d-3634e5ce5467', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('27', 27, 6, '860c0138-83f7-4a65-9ece-158298a6cb95', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('26', 26, 5, 'adb94a52-2ae1-4e14-bf2c-67f5d26d2fb7', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('21', 21, 0, 'ba396900-d682-44ae-9564-b8a907177cbc', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('21', 21, 0, 'bbbbbbbb-0021-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('22', 22, 1, 'bbbbbbbb-0022-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('23', 23, 2, 'bbbbbbbb-0023-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('24', 24, 3, 'bbbbbbbb-0024-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('25', 25, 4, 'bbbbbbbb-0025-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('26', 26, 5, 'bbbbbbbb-0026-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('27', 27, 6, 'bbbbbbbb-0027-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('28', 28, 7, 'bbbbbbbb-0028-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('29', 29, 8, 'bbbbbbbb-0029-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('30', 30, 9, 'bbbbbbbb-0030-0001-0001-000000000001', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('28', 28, 7, 'c38a3290-56e0-4b11-a960-77cca8f0881d', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('22', 22, 1, 'cae40e03-e084-4049-a54e-b57c5c9e71f6', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('25', 25, 4, 'd6c2c119-2a4d-4bb3-b5aa-665fdc6f0e8e', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990'),
  ('29', 29, 8, 'f8a86ffe-460b-4dba-82e7-ed75ea9b760b', 'dbb40a5c-6526-44a5-a54b-ee6bd5a63990')
ON CONFLICT ("id") DO NOTHING;

-- sprachbausteine_gap_options: 60 rows
INSERT INTO "sprachbausteine_gap_options" ("content", "is_correct", "sort_order", "id", "gap_id") VALUES
  ('der', TRUE, 0, '0311cf93-3715-4247-b4e3-34c2951cf15d', 'c38a3290-56e0-4b11-a960-77cca8f0881d'),
  ('unterschreiben', TRUE, 0, '05536208-554f-456e-960a-803f3909cac9', '4a41df47-08da-44ac-b4b2-c4de3e501552'),
  ('für', TRUE, 0, '0629b1e5-2d50-45c3-ba0b-222536a9b8d7', 'adb94a52-2ae1-4e14-bf2c-67f5d26d2fb7'),
  ('Gruß', FALSE, 2, '0b351cbe-a652-4965-a3a8-0edc14571104', 'bbbbbbbb-0029-0001-0001-000000000001'),
  ('gestehlt', FALSE, 0, '0ca6e798-83d2-4e32-81cb-9801d3ba944d', '03c5d74e-2fed-49c7-a26a-0d9c68183f94'),
  ('an', FALSE, 1, '1732a719-7d53-436e-b8e1-7951357e6e90', '860c0138-83f7-4a65-9ece-158298a6cb95'),
  ('bei', FALSE, 1, '18b15b62-bf28-4bf0-8586-de0c95648a51', 'd6c2c119-2a4d-4bb3-b5aa-665fdc6f0e8e'),
  ('wenn', FALSE, 2, '19f17508-64a4-4b42-8bb7-91d499700c4a', 'bbbbbbbb-0024-0001-0001-000000000001'),
  ('einer', FALSE, 2, '22a47b61-a0a4-4713-b15d-2a191203373f', 'bbbbbbbb-0027-0001-0001-000000000001'),
  ('müssen', FALSE, 2, '2566ca03-cca1-4fab-8ec1-c686d5acb3b0', 'f8a86ffe-460b-4dba-82e7-ed75ea9b760b'),
  ('muss', TRUE, 1, '27ab02c9-77b4-45f8-af33-3d5c557972a5', 'bbbbbbbb-0028-0001-0001-000000000001'),
  ('können', TRUE, 0, '299609ff-4215-4718-9d11-21e2c9a368c2', 'f8a86ffe-460b-4dba-82e7-ed75ea9b760b'),
  ('ab', TRUE, 0, '2d9391cb-a8f0-444c-8b93-673c91717e65', '860c0138-83f7-4a65-9ece-158298a6cb95'),
  ('musste', FALSE, 2, '2f51a932-611f-491b-849b-94218f14a2fc', 'bbbbbbbb-0028-0001-0001-000000000001'),
  ('dessen', FALSE, 1, '37800121-a435-402c-be15-08a518d39fd6', 'bbbbbbbb-0023-0001-0001-000000000001'),
  ('die', TRUE, 2, '3b12ab4b-bf9d-4426-a545-ff7bb5f72726', 'bbbbbbbb-0023-0001-0001-000000000001'),
  ('die', FALSE, 2, '467cd8f5-6f1d-4115-b64d-31c376b34a9a', 'c38a3290-56e0-4b11-a960-77cca8f0881d'),
  ('der', FALSE, 2, '46ffc82d-f26f-4784-9fe3-8e996db3ca06', 'bbbbbbbb-0026-0001-0001-000000000001'),
  ('über', FALSE, 2, '4726f4b7-3c15-486a-93f1-ceb46c8d6718', 'adb94a52-2ae1-4e14-bf2c-67f5d26d2fb7'),
  ('dem', FALSE, 0, '4b3d9b9e-cae6-4e1d-9c4c-c3e63d943a86', 'bbbbbbbb-0023-0001-0001-000000000001'),
  ('des', FALSE, 1, '4baffa89-7577-4b5f-99db-83bfbc838597', 'c38a3290-56e0-4b11-a960-77cca8f0881d'),
  ('müssen', FALSE, 0, '4cd6aefc-eb99-4676-aa0e-d01974706d87', 'bbbbbbbb-0028-0001-0001-000000000001'),
  ('den', TRUE, 1, '62cf2a62-78bb-4fee-8fb8-6f1fbe1daeee', 'bbbbbbbb-0026-0001-0001-000000000001'),
  ('das', FALSE, 0, '65f3def6-6f57-4e3b-866a-461becbbe81b', 'bbbbbbbb-0026-0001-0001-000000000001'),
  ('seine', TRUE, 1, '6837681c-a180-48cc-befd-2b17f13723bd', '7d6280b1-c322-4f1a-960d-3634e5ce5467'),
  ('wenn', FALSE, 1, '704b30f7-49b8-46ce-9a9c-02ce5eeddb0b', 'bbbbbbbb-0021-0001-0001-000000000001'),
  ('unterschrieben', FALSE, 1, '72efaca2-2e69-4082-934e-7898ce860492', '4a41df47-08da-44ac-b4b2-c4de3e501552'),
  ('gestohlen', TRUE, 2, '740bdf4e-c2d7-4ea9-9f21-516e0339fee0', '03c5d74e-2fed-49c7-a26a-0d9c68183f94'),
  ('gestiehlt', FALSE, 1, '7ce7881a-cd7c-41be-a549-5703be21f1a8', '03c5d74e-2fed-49c7-a26a-0d9c68183f94'),
  ('zu', FALSE, 2, '7d66ddee-79e4-4908-8d54-9fb4b4311e13', '860c0138-83f7-4a65-9ece-158298a6cb95'),
  ('nach', FALSE, 1, '870e58af-23ca-42da-b92d-4770127f237e', 'adb94a52-2ae1-4e14-bf2c-67f5d26d2fb7'),
  ('würde', FALSE, 1, '8e7a8ac7-2078-4ee1-8886-07f76c3a8971', 'ba396900-d682-44ae-9564-b8a907177cbc'),
  ('ihr', FALSE, 0, '9091bd90-066b-4d2c-9190-d1ebdb547824', 'bbbbbbbb-0022-0001-0001-000000000001'),
  ('unsere', FALSE, 2, '931fe0e6-d118-4e6f-93a9-cbd34cda1902', '7d6280b1-c322-4f1a-960d-3634e5ce5467'),
  ('wird', TRUE, 0, 'a6dd2958-1b57-4960-9521-9535728b8115', 'ba396900-d682-44ae-9564-b8a907177cbc'),
  ('wurde', FALSE, 2, 'a8020d1d-d910-4733-b55b-bd514534b24b', 'ba396900-d682-44ae-9564-b8a907177cbc'),
  ('Unsere', FALSE, 2, 'a9e0862f-dc5b-42cd-b2d8-d1c58c2e8a5c', 'bbbbbbbb-0030-0001-0001-000000000001'),
  ('aus', FALSE, 0, 'b126943c-dc59-46c2-ad59-27b1fad47f35', 'd6c2c119-2a4d-4bb3-b5aa-665fdc6f0e8e'),
  ('ihre', FALSE, 0, 'b31f3486-0b01-4078-ba19-53b5a32e42f2', '7d6280b1-c322-4f1a-960d-3634e5ce5467'),
  ('an', FALSE, 0, 'b3d15129-249b-4720-b8f3-26ee933e3270', 'cae40e03-e084-4049-a54e-b57c5c9e71f6'),
  ('eine', TRUE, 1, 'b6f0c8be-0f16-40c5-ae43-faecab4832fc', 'bbbbbbbb-0027-0001-0001-000000000001'),
  ('Grüßen', TRUE, 1, 'b75ff750-e76b-438b-b5c4-904bb15f0df8', 'bbbbbbbb-0029-0001-0001-000000000001'),
  ('sie', FALSE, 1, 'ba6918d7-67fa-44dd-bd5e-2f725e3316a3', 'bbbbbbbb-0022-0001-0001-000000000001'),
  ('möchten', FALSE, 1, 'be3d4209-b072-47a3-bd14-4c60fbd28bc9', 'f8a86ffe-460b-4dba-82e7-ed75ea9b760b'),
  ('ein', FALSE, 0, 'bec2dd2b-97fa-4d39-a05b-3613df5764b7', 'bbbbbbbb-0027-0001-0001-000000000001'),
  ('Sie', TRUE, 2, 'c1fc443e-c3e7-4af7-bcc4-8990d8e2cec4', 'bbbbbbbb-0022-0001-0001-000000000001'),
  ('wie', TRUE, 2, 'c6acfa99-a7e2-4a66-bc0b-09aeb10736a1', 'bbbbbbbb-0021-0001-0001-000000000001'),
  ('durch', FALSE, 1, 'c902a0b9-4a87-436d-bd96-9d16aa5612b4', 'bbbbbbbb-0025-0001-0001-000000000001'),
  ('weil', FALSE, 1, 'cf298fbd-eaf9-4661-8e9f-1d032ff5e8e7', 'bbbbbbbb-0024-0001-0001-000000000001'),
  ('über', TRUE, 2, 'd5a6a66b-563b-4b81-9233-444acd8f5f57', 'cae40e03-e084-4049-a54e-b57c5c9e71f6'),
  ('mit', TRUE, 2, 'd5bc025e-f230-4e52-985f-79a84f88c196', 'd6c2c119-2a4d-4bb3-b5aa-665fdc6f0e8e'),
  ('als', TRUE, 0, 'd691a344-c340-4352-9132-acbd9c96a72d', 'bbbbbbbb-0025-0001-0001-000000000001'),
  ('für', FALSE, 1, 'd728ac28-7a93-4c11-b2db-0d3171b6cad4', 'cae40e03-e084-4049-a54e-b57c5c9e71f6'),
  ('zu unterschreiben', FALSE, 2, 'e18d4c18-6172-4a8c-a16f-8bd101c59c42', '4a41df47-08da-44ac-b4b2-c4de3e501552'),
  ('wenn', FALSE, 2, 'e83868cf-c0b6-4590-8795-ab62113b2cd3', 'bbbbbbbb-0025-0001-0001-000000000001'),
  ('dass', TRUE, 0, 'eb30b660-c28b-4a73-b640-5be85e0da482', 'bbbbbbbb-0024-0001-0001-000000000001'),
  ('ob', FALSE, 0, 'f0c42783-23c5-439f-a8d0-6f46b25bd784', 'bbbbbbbb-0021-0001-0001-000000000001'),
  ('Ihre', TRUE, 1, 'f5d3b2c2-49bf-4917-aa47-ea98c8739ba8', 'bbbbbbbb-0030-0001-0001-000000000001'),
  ('Grüße', FALSE, 0, 'f856cfab-7909-40f3-b725-d98b66766559', 'bbbbbbbb-0029-0001-0001-000000000001'),
  ('Eure', FALSE, 0, 'f8ef9853-35be-4a6f-8dc6-8bef47cbfc08', 'bbbbbbbb-0030-0001-0001-000000000001')
ON CONFLICT ("id") DO NOTHING;

-- sprachbausteine_teil2_exercises: 2 rows
INSERT INTO "sprachbausteine_teil2_exercises" ("id", "contentRevision", "label", "instruction", "durationMinutes", "body", "createdAt", "modelltest_id", "image_url") VALUES
  ('00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'modelltest-1-sprachbausteine-teil2-v1', '', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o. Jedes Wort passt nur einmal. Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, 'Olga Fedorow
Sichelstr. 11 b
40625 Düsseldorf

Städtisches Klinikum Solingen gemeinnützige GmbH
Personalmanagement
Gotenstraße 1
42653 Solingen

Düsseldorf, 26. 07. 2015

Bewerbung

Sehr geehrte Damen und Herren,

in der WELT habe ich Ihre -31- gefunden, die mich sofort interessierte.
Um die ausgeschriebene -32- der stellvertretenden Pflegedienstleitung -33- ich mich.

In Russland habe ich meine schulische und berufliche -34- erhalten und drei Jahre praktische
Erfahrungen im Krankenhaus sammeln können. Nach unserer Übersiedlung nach Österreich
habe ich meine Sprachkenntnisse -35- und fand im Allgemeinen Krankenhaus der Stadt Wien
eine Anstellung als Stationsschwester. Nach einem Jahr -36- ich die Pflegedienstleitung in der
Gynäkologischen Abteilung.

Jetzt hat mein Mann in Düsseldorf eine attraktive Stelle als IT-Systemkoordinator angeboten
bekommen, und so sind wir kurzentschlossen hierher umgezogen.
Ich möchte diese Veränderung als -37- nutzen, um neue Erfahrungen in leitender Position eines
großen Klinikums zu sammeln.

Einzelheiten meiner Ausbildung und meines -38- Werdegangs können Sie meinem
Lebenslauf und den beigefügten Zeugnissen/Bescheinigungen -39- . Über die Möglichkeit eines
-40- Gespräches würde ich mich freuen.

Mit freundlichen Grüßen
Olga Fedorow
Anlagen', '2026-04-24T15:37:22.540Z'::timestamptz, 'bee41782-747a-4b53-8059-801f3ad2bcfe', 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/sprachbausteine-teil-2.png'),
  ('63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'modelltest-2-sprachbausteine-teil2-v1', 'Sprachbausteine, Teil 2', 'Lesen Sie den Text und schließen Sie die Lücken 31–40. Benutzen Sie die Wörter a–o.
Jedes Wort passt nur einmal.
Markieren Sie Ihre Lösungen für die Aufgaben 31–40 auf dem Antwortbogen.', 18, 'Papierbörse GmbH
Verkauf
Schlossweg 180
10130 Berlin

Pallhuber & Söhne
Einkauf
Kirchstraße 1
70900 Neudorf

20.04.2015

Reklamation

Sehr geehrte Damen und Herren,

am 03.04. haben wir bei Ihnen 100 Kartons Papier (Format DIN A4) sowie 50 Pakete Briefumschläge (Format C4) -31-.

Vor zwei Tagen haben wir Ihre -32- erhalten, aber leider war sie nicht vollständig. Wir haben nur 95 Kartons Papier und 40 Pakete Briefumschläge -33-. Natürlich haben wir sofort bei Ihnen angerufen, aber leider haben wir niemanden -34-. Deshalb beschweren wir uns nun schriftlich bei Ihnen. Bitte -35- Sie uns die fehlende Ware innerhalb einer Woche zu.

Wir sind -36- seit 5 Jahren Kunde bei Ihnen. In der Vergangenheit waren wir auch immer sehr zufrieden mit dem Versand sowie der Qualität der -37-. Wir hoffen, dass derartige -38- in Zukunft nicht mehr vorkommen.

Bitte antworten Sie uns -39- und bestätigen Sie den Erhalt dieser Reklamation. Gerne können Sie sich auch telefonisch bei uns -40-. Unsere Rufnummer haben Sie ja.

Mit freundlichen Grüßen
K. Meyer', '2026-08-21T15:40:56.444Z'::timestamptz, '66ae8d06-0514-403f-801d-ab2cb4d440b6', '')
ON CONFLICT ("id") DO NOTHING;

-- sprachbausteine_teil2_words: 30 rows
INSERT INTO "sprachbausteine_teil2_words" ("id", "exerciseId", "letter", "content", "sortOrder") VALUES
  ('05e1a980-ebb6-4bd9-ae81-037f6d3a1bb1', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'm', 'STELLE', 12),
  ('1544e014-304c-414e-a469-7e91e591a396', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'k', 'NOCH', 10),
  ('2137dc62-5a06-48ce-ba8d-dc7f72cd8478', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'k', 'NAHM', 10),
  ('2c9991d5-fe96-4276-8a19-0420d401f970', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'j', 'NACHTRÄGLICH', 9),
  ('2d530d4c-2b0e-46bf-a338-b2efb91fda90', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'b', 'BEREITS', 1),
  ('301591ff-3b50-4cb3-8719-b455f84af5da', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'n', 'UMGEHEND', 13),
  ('332214f7-5f23-4836-b9c6-eb6c714e1a33', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'f', 'BESONDEREN', 5),
  ('33908ea4-9b57-4ce4-9c93-193ca4eb8835', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'o', 'VERBESSERT', 14),
  ('34ab2be7-c00d-470b-a0da-be8a559ca1fc', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'h', 'ENTNEHMEN', 7),
  ('3dda4d18-b8f8-4f45-a4c5-e07643740d81', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'g', 'CHANCE', 6),
  ('46d2250a-55f9-4f21-bf6d-d11b203347ed', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'e', 'ERREICHT', 4),
  ('59551aa0-69aa-44b2-a414-054da53cefdb', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'h', 'MEISTENS', 7),
  ('684167f8-2955-4782-9032-587703610a01', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'l', 'PERSÖNLICHEN', 11),
  ('6b901fa1-7eff-4a0f-bc74-3aa8b8e63512', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'n', 'ÜBERNAHM', 13),
  ('6efdff42-3e15-4b2d-8859-7265d2addd9e', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'a', 'ANZEIGE', 0),
  ('80a0659d-8ea1-44d8-bee4-61427bf519ae', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'd', 'BEWERBE', 3),
  ('87d3d7e9-8e39-4b19-b6a8-6aa39a1602e4', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'e', 'BERUFLICHEN', 4),
  ('9741a287-172b-409f-9ae4-e1911002a7ef', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'i', 'MELDEN', 8),
  ('a383e90c-9d16-46c1-8968-43d58fec1a4f', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'c', 'AUSBILDUNG', 2),
  ('a4d05b1b-d1e1-41a7-a56a-cf872a0bd085', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'i', 'KARRIERE', 8),
  ('abfc0148-3e84-4be9-a9ff-4d5160fc21a1', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'c', 'BESTELLT', 2),
  ('ac61e85a-4c9a-4cd4-bb3a-e7c03cc6cfb3', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'a', 'ANTWORT', 0),
  ('b9368c97-1cdb-4b9e-8a96-001d78ed4b19', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'f', 'GEHÖRT', 5),
  ('b9d63d87-d3c2-4fc7-9a68-cf984567786e', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'g', 'LIEFERUNG', 6),
  ('c47efb1a-be86-4534-94fd-b885a1f16705', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'l', 'PROBLEME', 11),
  ('d780d946-7c47-4861-877d-3662516628e4', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'j', 'LESEN', 9),
  ('deda0caf-6c19-40f1-b181-af98f8afe1a4', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'd', 'ERHALTEN', 3),
  ('f0702b22-d03c-48c6-a9e0-e3d2c8d63b44', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', 'b', 'ARBEIT', 1),
  ('f5ccf416-73af-4c08-9578-b487ddb1fd99', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'm', 'SENDEN', 12),
  ('fff7ae2e-4536-4345-9e29-1deeaca21d29', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', 'o', 'WAREN', 14)
ON CONFLICT ("id") DO NOTHING;

-- sprachbausteine_teil2_gaps: 20 rows
INSERT INTO "sprachbausteine_teil2_gaps" ("id", "exerciseId", "gapKey", "gapNumber", "correctWordId", "sortOrder") VALUES
  ('0351e9bf-4e96-49ad-92bf-3d6c4dc20edb', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '37', 37, 'fff7ae2e-4536-4345-9e29-1deeaca21d29', 6),
  ('08382af3-d5da-4b86-bb5c-e88e37e27cb6', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '39', 39, '301591ff-3b50-4cb3-8719-b455f84af5da', 8),
  ('0cbb969e-322b-472c-a7d5-e0ac573b6236', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '37', 37, '3dda4d18-b8f8-4f45-a4c5-e07643740d81', 6),
  ('0dc9f943-92e4-4337-ba81-b5985338dcfe', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '38', 38, 'c47efb1a-be86-4534-94fd-b885a1f16705', 7),
  ('2e487e3a-6aba-4445-a67b-84741a5b0916', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '32', 32, '05e1a980-ebb6-4bd9-ae81-037f6d3a1bb1', 1),
  ('3b825df1-904e-4321-a84f-e15b671f69ea', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '36', 36, '2d530d4c-2b0e-46bf-a338-b2efb91fda90', 5),
  ('6785337e-2895-45b7-9146-f45c64305d81', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '34', 34, '46d2250a-55f9-4f21-bf6d-d11b203347ed', 3),
  ('69523088-32f0-4e82-be2e-41014ac004d2', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '38', 38, '87d3d7e9-8e39-4b19-b6a8-6aa39a1602e4', 7),
  ('6ebddde8-5f82-4bfd-a4d8-5afe33ccaee7', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '32', 32, 'b9d63d87-d3c2-4fc7-9a68-cf984567786e', 1),
  ('6fb84c60-c6f8-419d-be97-2529ba9960f6', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '35', 35, '33908ea4-9b57-4ce4-9c93-193ca4eb8835', 4),
  ('71c79745-5d32-4075-992e-76337fe89a4b', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '40', 40, '9741a287-172b-409f-9ae4-e1911002a7ef', 9),
  ('90da324c-6e08-4b8a-a633-7d0b055bc5e6', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '39', 39, '34ab2be7-c00d-470b-a0da-be8a559ca1fc', 8),
  ('95cbf271-c865-49b2-a56a-57f55c5e07ce', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '33', 33, 'deda0caf-6c19-40f1-b181-af98f8afe1a4', 2),
  ('9bb9bdee-115a-4e1c-9a3d-a1bcb20daf5e', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '34', 34, 'a383e90c-9d16-46c1-8968-43d58fec1a4f', 3),
  ('9d2f5b85-5fad-48b6-b7dd-c6bdaefbb64d', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '31', 31, '6efdff42-3e15-4b2d-8859-7265d2addd9e', 0),
  ('af88faa7-3c38-4b63-8dc0-5a7c66ca2288', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '35', 35, 'f5ccf416-73af-4c08-9578-b487ddb1fd99', 4),
  ('b8442f54-6b50-4301-adee-a15d56db1399', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '40', 40, '684167f8-2955-4782-9032-587703610a01', 9),
  ('c5c0cc21-c427-49dc-9c78-88ebc6dd2d38', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '36', 36, '6b901fa1-7eff-4a0f-bc74-3aa8b8e63512', 5),
  ('cf985ab3-4a85-4d14-ba30-117b76aab958', '00423e3c-6b72-464f-ab16-0baceb0bd0d4', '33', 33, '80a0659d-8ea1-44d8-bee4-61427bf519ae', 2),
  ('da5d2000-4ca9-4aed-9f3d-306ae5f5901f', '63fb7681-6b6a-48b4-bc7e-06381b6f4da7', '31', 31, 'abfc0148-3e84-4be9-a9ff-4d5160fc21a1', 0)
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil1_exercises: 2 rows
INSERT INTO "lesen_teil1_exercises" ("id", "contentRevision", "label", "instruction", "createdAt", "modelltest_id") VALUES
  ('1935a872-a304-4029-bc33-17ac95265982', 'modelltest-2-lesen-teil1-v1', 'Leseverstehen, Teil 1', 'Lesen Sie die folgenden fünf Texte. Es fehlt jeweils der Betreff. Entscheiden Sie, welcher Betreff (a–j) am besten zu welcher Betreffzeile (1–5) passt.
Tragen Sie Ihre Lösungen für die Aufgaben 1–5 in den Antwortbogen ein.', '2026-08-21T15:40:56.444Z'::timestamptz, '66ae8d06-0514-403f-801d-ab2cb4d440b6'),
  ('eeeeeeee-0001-0001-0001-000000000001', 'modelltest-1-lesen-teil1-v1', 'Leseverstehen, Teil 1', 'Lesen Sie die folgenden fünf Texte. Es fehlt jeweils der Betreff. Entscheiden Sie, welcher Betreff (a–j) am besten zu welcher Betreffzeile (1–5) passt. Tragen Sie Ihre Lösungen für die Aufgaben 1–5 in den Antwortbogen ein.', '2026-04-23T14:46:14.434Z'::timestamptz, 'bee41782-747a-4b53-8059-801f3ad2bcfe')
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil1_titles: 20 rows
INSERT INTO "lesen_teil1_titles" ("id", "exerciseId", "content", "sortOrder") VALUES
  ('01e3ae5b-1f6a-4d04-8db2-b605403b42f9', '1935a872-a304-4029-bc33-17ac95265982', 'Beschwerde', 1),
  ('30d5b8d3-553c-487c-a51f-444c25605ef0', '1935a872-a304-4029-bc33-17ac95265982', 'Nachbestellung', 6),
  ('3c6d6c9d-dddd-495a-a09d-8efddbb2fef9', '1935a872-a304-4029-bc33-17ac95265982', 'Terminabsage', 8),
  ('54e13952-1feb-47a2-a92e-8e437b87f30b', '1935a872-a304-4029-bc33-17ac95265982', 'Abschiedsfeier', 0),
  ('6da22f93-b4e1-49d2-8317-690bf3bf9298', '1935a872-a304-4029-bc33-17ac95265982', 'Terminbestätigung', 9),
  ('8f21391c-612a-4931-95ad-d8d7502e5ac9', '1935a872-a304-4029-bc33-17ac95265982', 'Krankmeldung', 5),
  ('91eab2d0-70d7-4991-b2b8-1eaa26231802', '1935a872-a304-4029-bc33-17ac95265982', 'Erstbestellung', 3),
  ('aa74f43a-9c10-4a37-9a8f-a473d4f104a2', '1935a872-a304-4029-bc33-17ac95265982', 'Termin verschieben?', 7),
  ('d1e7f672-9722-4ed7-a043-ec0772f812d2', '1935a872-a304-4029-bc33-17ac95265982', 'Firmenjubiläum', 4),
  ('d4083c25-a38b-4f94-8b0f-82428edade67', '1935a872-a304-4029-bc33-17ac95265982', 'Eingangsbestätigung', 2),
  ('ffffffff-0001-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Anfrage', 0),
  ('ffffffff-0002-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Lieferschein', 1),
  ('ffffffff-0003-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Reklamation', 2),
  ('ffffffff-0004-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Schadensmeldung', 3),
  ('ffffffff-0005-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Schließregelung', 4),
  ('ffffffff-0006-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Sommerfest', 5),
  ('ffffffff-0007-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminabsage', 6),
  ('ffffffff-0008-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminverschiebung', 7),
  ('ffffffff-0009-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Terminzusage', 8),
  ('ffffffff-0010-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 'Übernachtung', 9)
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil1_texts: 10 rows
INSERT INTO "lesen_teil1_texts" ("id", "exerciseId", "textNumber", "von", "an", "body", "sortOrder", "correctTitleId") VALUES
  ('0cbd59d1-df4e-42e1-b4ee-f55161286781', '1935a872-a304-4029-bc33-17ac95265982', 1, 'Wilfried Jung, Novo-Bank', 'Manfred Ulmen, Büro & Co.', 'Gesendet: 22.5.2015, 14:27

Sehr geehrter Herr Ulmen,
vielen Dank für Ihre E-Mail und Ihren Terminvorschlag. Gerne können wir uns am Freitag um 12 Uhr in unserem Konferenzraum treffen, um über eine mögliche Bestellung neuer Büromöbel zu sprechen.

Mit freundlichen Grüßen
W. Jung
Filialleiter Novo-Bank Neustadt', 0, '6da22f93-b4e1-49d2-8317-690bf3bf9298'),
  ('3fe62839-12d5-4244-b4cf-f8323d830c56', '1935a872-a304-4029-bc33-17ac95265982', 3, NULL, NULL, 'Sehr geehrte Frau Thang,
wie Sie wissen, benutzen wir seit vielen Jahren in unserem Hotel die Geschirrserie „Sommerbrise“. Da in der Zwischenzeit wieder einige Sachen kaputt gegangen sind, würden wir gerne folgende Geschirrteile bestellen:

30 Teller (groß), Nr. 321-TL
15 Teller (tief), Nr. 321-TT
20 Salatteller, Nr. 321-ST

Ich hoffe, die Serie wird noch immer produziert. Bitte bestätigen Sie doch so schnell wie möglich die Bestellung. Vielen Dank!

Mit freundlichen Grüßen
Joachim Sauer
Restaurant „Zum Anker“', 2, '30d5b8d3-553c-487c-a51f-444c25605ef0'),
  ('44444444-0001-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 1, 'r.fazli@grb.com', 'v.gruedle@grb.com', 'Hallo Frau Grüdle,
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
Ramik Fazli', 0, 'ffffffff-0007-0001-0001-000000000001'),
  ('44444444-0002-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 2, NULL, NULL, 'Liebe Kolleginnen und Kollegen,
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
Verwaltungsleitung', 1, 'ffffffff-0005-0001-0001-000000000001'),
  ('44444444-0003-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 3, 'rene.gallack@fa-rzw.de', 'stephan.gerke@werbeagentur.net', 'Sehr geehrter Herr Gerke,
vielen Dank für Ihre schnelle Lieferung. Wir haben 4.000 Stück
Werbebroschüren für unser neuestes Produkt bestellt. Allerdings
haben Sie 500 Stück weniger geliefert. Aber auf dem Lieferschein
steht die bestellte Menge.
Wir hoffen, dass es sich um ein Versehen handelt und erwarten in
Kürze Ihre Nachlieferung.
Mit freundlichen Grüßen
René Gallack', 2, 'ffffffff-0003-0001-0001-000000000001'),
  ('44444444-0004-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 4, 'i.villa@kompsit.net', 'aurum@gaestehaus.com', 'Sehr geehrte Damen und Herren,
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
Ines Villa', 3, 'ffffffff-0001-0001-0001-000000000001'),
  ('44444444-0005-0001-0001-000000000001', 'eeeeeeee-0001-0001-0001-000000000001', 5, 'michaela.rojka@rett-platt.de', 'nella.weber@rett-platt.de', 'Hallo Nella,
ich habe gerade in meinem Kalender unser Treffen morgen um 16 Uhr
entdeckt. Wir wollten doch den Aufbau des Seminars zum
interkulturellen Training „Fettnäpfchen in Russland vermeiden"
besprechen. Könnten wir uns auch direkt nach der Mittagspause um
13.30 Uhr zusammensetzen? Danach muss ich nämlich zum Elternabend
in Michas Kindergarten. Das Sommerfest steht an ...
Sag mir kurz Bescheid.
Michaela', 4, 'ffffffff-0008-0001-0001-000000000001'),
  ('988dfcd1-56fa-4425-bf91-4c9eb8efa5eb', '1935a872-a304-4029-bc33-17ac95265982', 2, NULL, NULL, 'Sehr geehrte Damen und Herren,
wir bestätigen den Erhalt Ihrer Reklamation bezüglich Ihrer Telefonkosten. Wir werden die Angelegenheit umgehend prüfen und melden uns innerhalb der nächsten 14 Tage wieder bei Ihnen. Sollten Sie in der Zwischenzeit Fragen haben, stehen wir Ihnen unter unserer kostenlosen Hotline gerne zur Verfügung.

Mit freundlichen Grüßen
Telefix GmbH', 1, 'd4083c25-a38b-4f94-8b0f-82428edade67'),
  ('dbe5911a-17bf-49d2-b95a-752e309edae7', '1935a872-a304-4029-bc33-17ac95265982', 4, NULL, NULL, 'Liebe Marion,
wir hatten uns für morgen um 10 Uhr verabredet, um in Raum R001 gemeinsam an der Präsentation für die Betriebsversammlung zu arbeiten. Leider muss ich nun morgen Früh noch etwas für meinen Kollegen erledigen, der krank ist. Das wird so bis zum Mittag dauern, deshalb würde ich mich gerne erst gegen 14 Uhr treffen. Wäre das okay für dich?

Liebe Grüße
Christina', 3, 'aa74f43a-9c10-4a37-9a8f-a473d4f104a2'),
  ('ef0d8a0c-35b6-41bf-b9bf-9d350f49aa98', '1935a872-a304-4029-bc33-17ac95265982', 5, 'Maria Olbas', 'alle', 'Gesendet: 25.5.2015, 14:23

Liebe Kolleginnen und Kollegen,
am kommenden Montag wird unser Kollege Rolf Groß nach 35 Jahren Firmenzugehörigkeit in den Ruhestand verabschiedet. Die Feier beginnt gegen 10 Uhr und endet mit einem gemeinsamen Mittagessen um 12.30 Uhr.
Wer noch etwas Geld in das Sparschwein tun möchte, das wir Rolf am Montag schenken, kann sich noch bis Freitag bei mir melden.

Kollegiale Grüße
Maria Olbas (Betriebsrat)', 4, '54e13952-1feb-47a2-a92e-8e437b87f30b')
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil2_exercises: 2 rows
INSERT INTO "lesen_teil2_exercises" ("id", "contentRevision", "label", "instruction", "cautionNote", "topSender", "topReceiver", "topBody", "quotedThread", "createdAt", "modelltest_id") VALUES
  ('0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 'modelltest-2-lesen-teil2-v1', 'Leseverstehen, Teil 2', 'Lesen Sie die E-Mails und die Aufgaben 6–10. Welche Lösung (a, b oder c) ist jeweils richtig?
Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.', 'Achtung!
Die Aufgaben stehen nicht immer in der gleichen Reihenfolge wie die Informationen im Text.', 'R. Hubert <ralf.hubert@hubert-renovierung.de>', 'M. Scheuer <margit.scheuer@tiptopreisen.eu>', 'Betreff: Re: Aw: Re: Mängel bei Renovierungsarbeiten
Gesendet: 06.03. um 07:35 Uhr

Sehr geehrte Frau Scheuer,
vielen Dank für die Terminbestätigung. Den gewünschten Kostenvoranschlag erhalten Sie bis spätestens morgen mit gesonderter Mail.

Mit freundlichen Grüßen
Ralf Hubert', 'Margit Scheuer schrieb am 05.03. um 14:12 Uhr
> Sehr geehrter Herr Hubert,
> gerne bestätige ich den Termin am 09.03. für das Nachstreichen der Wand. Wegen des Kratzers im Boden
> muss ich mich bei Ihnen entschuldigen: Von meiner Chefin habe ich erfahren, dass der Kratzer im Boden bei
> der Lieferung eines neuen Schranks vorgestern entstanden ist. Der Schaden wird von der Versicherung des
> Lieferanten bezahlt. Machen Sie mir doch bitte einen Kostenvoranschlag für die Reparatur des Bodens.
>
> Mit freundlichen Grüßen
> Margit Scheuer

Ralf Hubert schrieb am 05.03. um 08:01 Uhr:
>> Sehr geehrte Frau Scheuer,
>> es tut mir sehr leid, dass Sie mit unserer Arbeit nicht ganz zufrieden sind. Natürlich werden wir noch einmal
>> in Ihr Reisebüro kommen und die Wand oberhalb des Regals richtig streichen. Würde es Ihnen am 09.03.
>> gegen 10 Uhr passen? Den Kratzer im Boden können wir aber leider nicht als Mangel akzeptieren: Wir
>> haben den Boden bereits vor 3 Tagen verlegt, und Ihre Chefin hat schriftlich bestätigt, dass die Arbeit
>> ordnungsgemäß ausgeführt wurde. Vor 3 Tagen war noch kein Kratzer im Boden.
>>
>> Mit freundlichen Grüßen
>> Ralf Hubert (Hubert Renovierungen)

Margit Scheuer schrieb am 04.03. um 12:49 Uhr:
>>> Sehr geehrter Herr Hubert,
>>> gestern Abend haben Sie ja die Renovierungsarbeiten in unserem Reisebüro abgeschlossen. Leider sind
>>> wir nicht ganz zufrieden und müssen uns daher bei Ihnen beschweren.
>>> Die neuen Böden in unserem Büro sehen zwar sehr gut aus, aber an einer Stelle ist ein großer Kratzer in
>>> der Oberfläche (direkt am Eingang!). Außerdem wurden die Wände nicht richtig gestrichen: Über dem
>>> Regal sieht man leider noch alte Farbe. Wir haben starken Kundenverkehr, und natürlich fallen diese
>>> Mängel sofort negativ auf. Wir möchten Sie daher bitten, die Mängel innerhalb einer Woche zu beseitigen.
>>> Vielen Dank im Voraus.
>>>
>>> Mit freundlichen Grüßen
>>> Margit Scheuer (TipTop-Reisen GmbH)', '2026-08-21T15:40:56.444Z'::timestamptz, '66ae8d06-0514-403f-801d-ab2cb4d440b6'),
  ('cccccccc-0002-0002-0002-000000000001', 'modelltest-1-lesen-teil2-v1', 'Leseverstehen, Teil 2', 'Lesen Sie die E-Mail und die Aufgaben 1–5. Welche Lösung (a, b oder c) ist jeweils richtig? Markieren Sie Ihre Lösungen für die Aufgaben 6–10 auf dem Antwortbogen.', 'Achtung! Die Aufgaben stehen nicht immer in der gleichen Reihenfolge wie die Informationen im Text.', 'k.weisshaupt@web.de', 'j.baric@freenet.com', 'Sehr geehrter Herr Baric,
vielen Dank für Ihr Angebot, das ich annehme.
Bitte bestellen Sie die notwendigen Zusatzgeräte.
Mit freundlichen Grüßen
Karin Weisshaupt
------
Johannes Baric schrieb:
Sehr geehrte Frau Weisshaupt,
vielen Dank für Ihre freundliche Mail. Dass Sie mit dem Wagen zufrieden sind, freut uns sehr.
Zu Ihren Wünschen kann ich Ihnen mitteilen, dass wir die gewünschten Arbeiten gerne in unserer eigenen
Werkstatt durchführen können. Die Arbeiten werden an einem Tag durchgeführt. Die Lieferung der
Zusatzgeräte dauert ab Bestellung zwei Werktage.
Zu den Kosten teile ich lhnen mit, dass die Freisprechanlage € 450,00, die Diebstahlsicherung € 525,00 und
der CD-Player € 610,00 kosten. Der gesamte Einbau kostet dann zusätzlich € 500,00, alle Preise jeweils
zzgl. der gesetzlichen MwSt.
Wenn Sie mit diesem Angebot einverstanden sind, können wir die Arbeiten am Dienstag in der kommenden
Woche ausführen.
Selbstverständlich stellen wir Ihnen für diesen Tag kostenlos einen Leihwagen zur Verfügung.
Bitte teilen Sie uns mit, ob Sie unser Angebot annehmen möchten.
Mit freundlichen Grüßen
Johannes Baric
Autohandel Baric GmbH
----
Karin Weisshaupt schrieb:
Sehr geehrter Herr Baric,
ich habe vor einem Monat bei Ihnen einen Neuwagen, VW Passat, gekauft. Ich bin mit dem
Wagen sehr zufrieden. Während unseres Verkaufsgespräches haben Sie mir freundlicherweise
Prospektmaterial zur Verfügung gestellt, in dem alle zusätzlichen Ausstattungsmöglichkeiten für den Wagen
angeboten werden.
Ich habe mich nun dafür entschieden, folgende Extras einbauen zu lassen:
eine Freisprechanlage für mein Handy, da ich beruflich viel mit dem Wagen unterwegs bin und auch
beruflich telefonisch erreichbar sein muss, eine Diebstahlsicherung und einen sehr guten CD-Player.
Ich möchte die Einbauarbeiten gerne in Ihrer Werkstatt durchführen lassen. Alle Arbeiten sollten an einem
Tag durchgeführt werden. Den Zeitpunkt dafür müssten wir vorab genau besprechen, weil ich meine Termine
dann besser planen kann.
Bitte teilen Sie mir mit, ob dies so möglich ist und ob Sie in den nächsten Tagen einen Termin freihaben.
Außerdem bitte ich um Ihr Angebot mit allen Informationen, welche Kosten auf mich zukommen.
Ich danke Ihnen und verbleibe
mit freundlichen Grüßen
Karin Weisshaupt

', 'Johannes Baric schrieb:
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
>> Karin Weisshaupt', '2026-04-22T17:24:04.270Z'::timestamptz, 'bee41782-747a-4b53-8059-801f3ad2bcfe')
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil2_questions: 10 rows
INSERT INTO "lesen_teil2_questions" ("id", "exerciseId", "questionNumber", "prompt", "sortOrder") VALUES
  ('050c220e-618d-4014-b041-f13cbaf754a5', '0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 6, 'Herr Hubert', 0),
  ('2264c28f-0417-43cd-b766-ad94c1e15f97', '0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 10, 'Frau Scheuer beschwert sich, weil', 4),
  ('abce268c-44d8-45bd-b04d-d4f6d4496e7e', '0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 8, 'Die Schäden am Boden', 2),
  ('c135eec2-026a-4f64-b9a8-b8ce70cf4d36', '0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 9, 'Herr Hubert', 3),
  ('dddddddd-0006-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 6, 'Die Arbeiten können in der Werkstatt durchgeführt werden, wenn', 0),
  ('dddddddd-0007-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 7, 'Frau Weisshaupt benötigt eine Freisprechanlage, weil sie', 1),
  ('dddddddd-0008-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 8, 'Die genannten zusätzlichen Kosten sind für', 2),
  ('dddddddd-0009-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 9, 'Die Werkstatt braucht für die Einbauarbeiten', 3),
  ('dddddddd-0010-0002-0002-000000000001', 'cccccccc-0002-0002-0002-000000000001', 10, 'Der Leihwagen kostet für Frau Weisshaupt', 4),
  ('f8878c17-59fe-4647-8940-f40a77cc05b0', '0b2d7bf4-7493-42f1-801a-f1a26e6df49c', 7, 'Nach dem Verlegen des Bodens', 1)
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil2_options: 45 rows
INSERT INTO "lesen_teil2_options" ("id", "questionId", "content", "isCorrect", "sortOrder") VALUES
  ('0280b9e6-2f2a-4fa1-bce4-12cc6cf659fa', 'dddddddd-0008-0002-0002-000000000001', 'alle Einbauarbeiten', TRUE, 0),
  ('0dc07e6a-f717-4765-93ea-2b5ff3458ead', 'dddddddd-0009-0002-0002-000000000001', 'fünf Stunden', FALSE, 1),
  ('13a1beba-3525-42cc-9d33-4939513738a7', 'dddddddd-0009-0002-0002-000000000001', 'fünf Stunden', FALSE, 1),
  ('154900f2-36f3-496c-853a-74e3a868685f', 'dddddddd-0010-0002-0002-000000000001', 'gar nichts', TRUE, 2),
  ('39ad25eb-d762-4b5a-8f0d-1f7745761bd8', '050c220e-618d-4014-b041-f13cbaf754a5', 'schickt am 6. oder 7. März einen Kostenvoranschlag.', TRUE, 2),
  ('3a53ed51-5e2d-4563-b118-abc44f5413a3', 'c135eec2-026a-4f64-b9a8-b8ce70cf4d36', 'schreibt, dass der Boden ohne Beschädigung verlegt wurde.', TRUE, 2),
  ('3f9c991d-5d73-4258-b5f0-cb1b8286fdc1', 'dddddddd-0006-0002-0002-000000000001', 'der Termin nicht abgesprochen werden muss', FALSE, 0),
  ('40697d6e-ca4c-4841-8cf9-d3ee4c1cbf60', 'dddddddd-0007-0002-0002-000000000001', 'gerne mit ihren Freundinnen telefonisch Kontakt hat', FALSE, 1),
  ('432d8300-9336-4c89-8961-11ae6f545782', 'c135eec2-026a-4f64-b9a8-b8ce70cf4d36', 'bietet einen Termin für die Reparatur des Bodens an.', FALSE, 0),
  ('4356c55e-06b0-4b32-8a49-0a78fb644a96', 'c135eec2-026a-4f64-b9a8-b8ce70cf4d36', 'denkt, dass die Chefin des Reisebüros für den Kratzer verantwortlich ist.', FALSE, 1),
  ('47991737-4b28-4fbe-b3a8-af31fbc2e3fd', 'dddddddd-0010-0002-0002-000000000001', '€ 525,00', FALSE, 1),
  ('4b733775-5216-4abd-8620-fd923251c3c3', 'dddddddd-0007-0002-0002-000000000001', 'gerne mit ihren Freundinnen telefonisch Kontakt hat', FALSE, 1),
  ('4c22ac1e-166a-476d-a750-92bcdb300256', '2264c28f-0417-43cd-b766-ad94c1e15f97', 'die Kunden wegen der mangelhaften Renovierung nicht mehr kommen.', FALSE, 0),
  ('521cce15-63f2-4875-be27-c054136789ce', 'dddddddd-0007-0002-0002-000000000001', 'jederzeit für ihre Familie erreichbar sein möchte', FALSE, 2),
  ('5a3c2ba2-cd79-4562-8382-a6a2dc902b75', 'dddddddd-0010-0002-0002-000000000001', '€ 525,00', FALSE, 1),
  ('5d1ba520-d1db-4ccf-a265-c5c863e47654', 'dddddddd-0006-0002-0002-000000000001', 'der Termin von der Werkstatt festgelegt werden kann', FALSE, 1),
  ('5d2c0d7f-4384-4438-8ac6-d97acc54d875', 'dddddddd-0010-0002-0002-000000000001', '€ 450,00', FALSE, 0),
  ('63a4cfa3-6175-468f-ae77-9f9173d4ae21', 'dddddddd-0009-0002-0002-000000000001', 'zwei Tage', FALSE, 2),
  ('69faa04d-30f1-4332-9355-59cb25cdaaec', 'dddddddd-0006-0002-0002-000000000001', 'der Termin von der Werkstatt festgelegt werden kann', FALSE, 1),
  ('76f7186d-b40c-465a-94b4-868c24879cc2', 'dddddddd-0008-0002-0002-000000000001', 'den CD-Player', FALSE, 1),
  ('8717f1e8-7e1d-462f-a400-f33530b1b906', 'dddddddd-0007-0002-0002-000000000001', 'den Wagen beruflich nutzt', TRUE, 0),
  ('8c38da13-973f-49d9-a016-d722c517b382', 'f8878c17-59fe-4647-8940-f40a77cc05b0', 'hat die Vorgesetzte von Frau Scheuer die Arbeiten geprüft.', TRUE, 0),
  ('92e548dd-7c49-43ac-83aa-cd07295051d0', 'dddddddd-0009-0002-0002-000000000001', 'einen Tag', TRUE, 0),
  ('a2a642ac-57d1-402d-8e65-bc2f62fadcfc', 'dddddddd-0008-0002-0002-000000000001', 'den CD-Player', FALSE, 1),
  ('a555d772-e8cc-47b6-b82c-a930d87611df', 'dddddddd-0006-0002-0002-000000000001', 'der Termin vorher mit Frau Weisshaupt abgesprochen wird', TRUE, 2),
  ('b3e8a5f5-8ad9-491d-943f-430675408674', 'dddddddd-0007-0002-0002-000000000001', 'jederzeit für ihre Familie erreichbar sein möchte', FALSE, 2),
  ('b4b7eaae-2ef4-4888-bee7-adb79c8afa90', '050c220e-618d-4014-b041-f13cbaf754a5', 'informiert Frau Scheuer innerhalb von 24 Stunden telefonisch über die Kosten.', FALSE, 1),
  ('b6d1664f-aebf-4356-a751-d819d30fcc57', 'f8878c17-59fe-4647-8940-f40a77cc05b0', 'wurden die Arbeiten von Herrn Huberts Vorgesetztem geprüft.', FALSE, 2),
  ('b6de2485-1bb5-4f06-8fce-e52f4a485d56', 'abce268c-44d8-45bd-b04d-d4f6d4496e7e', 'werden am 09.03. von Herrn Hubert repariert.', FALSE, 1),
  ('bf05fd8f-6159-4f04-b1e5-02efefaa9d1c', 'f8878c17-59fe-4647-8940-f40a77cc05b0', 'hat Frau Scheuer die Arbeiten überprüft.', FALSE, 1),
  ('c2a015b2-36e2-43ad-a964-5d073a1aaa68', 'dddddddd-0008-0002-0002-000000000001', 'die Diebstahlsicherung', FALSE, 2),
  ('c4bea386-bca0-4924-a854-3b52d5909fc6', 'dddddddd-0008-0002-0002-000000000001', 'alle Einbauarbeiten', TRUE, 0),
  ('c6d1a7fd-c433-482a-816e-4dcb2bcb86ea', 'dddddddd-0009-0002-0002-000000000001', 'zwei Tage', FALSE, 2),
  ('c9ca4159-d288-481e-9a79-02c483bbee28', 'dddddddd-0007-0002-0002-000000000001', 'den Wagen beruflich nutzt', TRUE, 0),
  ('cc2c7c12-570a-4c95-ac80-ab52f615bbf0', '2264c28f-0417-43cd-b766-ad94c1e15f97', 'Herr Hubert einen Kratzer in die Eingangstür gemacht hat.', FALSE, 2),
  ('cce510b0-2af3-4ff9-a46c-34c637ef5576', 'dddddddd-0006-0002-0002-000000000001', 'der Termin nicht abgesprochen werden muss', FALSE, 0),
  ('d11cbd33-2b66-4acc-9491-85975b38957e', '2264c28f-0417-43cd-b766-ad94c1e15f97', 'die Malerarbeiten nicht richtig ausgeführt wurden.', TRUE, 1),
  ('d2c632e1-63ac-49c4-9b83-39bf51c61382', 'abce268c-44d8-45bd-b04d-d4f6d4496e7e', 'sind durch Mitarbeiter des Reisebüros entstanden.', FALSE, 0),
  ('da03f4ae-23f9-46cd-902c-369d9671f338', 'dddddddd-0009-0002-0002-000000000001', 'einen Tag', TRUE, 0),
  ('e95e29af-274e-4aa7-a99e-5366d843e3ee', 'dddddddd-0006-0002-0002-000000000001', 'der Termin vorher mit Frau Weisshaupt abgesprochen wird', TRUE, 2),
  ('eb8808a9-6c6c-4bb9-ba3b-da16dbcc37d3', 'abce268c-44d8-45bd-b04d-d4f6d4496e7e', 'wurden von einer anderen Firma verursacht.', TRUE, 2),
  ('f02de7ae-38b6-495d-8c24-77d71c0f120b', '050c220e-618d-4014-b041-f13cbaf754a5', 'bringt den Kostenvoranschlag am 9.3. persönlich vorbei.', FALSE, 0),
  ('f5310c57-4dce-4cd3-90ba-6338865928e9', 'dddddddd-0010-0002-0002-000000000001', '€ 450,00', FALSE, 0),
  ('f594e6e8-bc81-4cbd-83a1-872d2bdf6f87', 'dddddddd-0008-0002-0002-000000000001', 'die Diebstahlsicherung', FALSE, 2),
  ('ff2354eb-ac40-4c6d-bbce-f446b5dea722', 'dddddddd-0010-0002-0002-000000000001', 'gar nichts', TRUE, 2)
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil3_exercises: 2 rows
INSERT INTO "lesen_teil3_exercises" ("id", "contentRevision", "label", "instruction", "createdAt", "modelltest_id") VALUES
  ('8f892a63-ac7b-436e-a029-263d44101fb6', 'modelltest-2-lesen-teil3-v1', 'Leseverstehen, Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l. Finden Sie für jede Situation die passende Anzeige.
Sie können jede Anzeige nur einmal benutzen.
Markieren Sie Ihre Lösungen für die Aufgaben 11–20 auf dem Antwortbogen.
Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein X.', '2026-08-21T15:40:56.444Z'::timestamptz, '66ae8d06-0514-403f-801d-ab2cb4d440b6'),
  ('bbbbbbbb-0001-0003-0003-000000000001', 'modelltest-1-lesen-teil3-v1', 'Leseverstehen, Teil 3', 'Lesen Sie die Situationen 11–20 und die Anzeigen a–l.Finden Sie für jede Situation die passende Anzeige.Sie können jede Anzeige nur einmal benutzen.Markieren Sie Ihre Lösungen für die Aufgaben 11–20auf dem Antwortbogen.
Wenn Sie zu einer Situation keine Anzeige finden, markieren Sie ein X.', '2026-04-24T08:02:46.641Z'::timestamptz, 'bee41782-747a-4b53-8059-801f3ad2bcfe')
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil3_announcements: 24 rows
INSERT INTO "lesen_teil3_announcements" ("id", "exerciseId", "title", "content", "sortOrder") VALUES
  ('14b9c891-6037-4057-9f38-b7bf14cd298b', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Wir reinigen für Sie!', 'Was? Außenanlagen wie Bürgersteige, Einfahrten, Parkplätze usw.
Wann? Reinigung ist ganz nach Bedarf rund um die Uhr möglich.
Wer? Reinigungsdienst Weber,
info@reinigungsdienstweber.de', 11),
  ('36139f92-e96c-4ea1-927c-34564bd50571', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Bewegung statt sitzen', 'Sie arbeiten viel am Schreibtisch? Sie brauchen mehr Bewegung? Lauftreff in der Innenstadt, jeden Di. und Do. ab 18.30 Uhr. Anfänger willkommen. Laufrouten durch den Stadtpark.
Infos: Ingo Schmoll, Tel. 0179/660 123', 4),
  ('3946ac07-bdf5-403a-ad2b-8ec5b82d441e', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Büroarbeiten', 'Erledige Büroarbeiten (Abtippen, Ablage, Korrespondenz usw.) auf selbstständiger Basis, zuverlässig und pünktlich. Noch freie Kapazitäten (ca. 10 Std./Woche).', 10),
  ('4e2b80a9-2f13-4b96-b59b-c4663ac7c37d', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Gesund im Beruf', 'Kurs für alle, die sich über gesundes Arbeiten informieren wollen: gesunder Arbeitsplatz, sich richtig bewegen, Stress vermeiden. 3 x Mo. 18–21 Uhr, Teilnahmegebühr 75 Euro, Übernahme durch Arbeitgeber möglich. Infos & Anmeldung:
www.bildungsakademie-neustadt.de', 9),
  ('55803a14-3bc8-455f-b0fd-673fa1b5d7cc', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Elektroinstallationen', 'Wir führen Elektroinstallationen schnell und fachgerecht aus – von der Lampe bis zum Herd. Natürlich verlegen wir bei Bedarf auch neue Stromleitungen. Rabatte für Großkunden.
Elektriker Peter Reimann,
Tel. 0140/922 911 900', 0),
  ('8a74208f-3db4-413f-b094-0526026888ae', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Elektronikgroßmarkt Mars', 'PCs, Notebooks, Monitore und mehr gibt es nur bei uns zum besten Preis. Super Angebote für Firmenkunden, sprechen Sie uns an!
Kostenlose Hotline: Tel. 0800/100 200 999
www.elektronik-mars.de', 2),
  ('8d90a1d8-7c69-4044-ae6f-0647118f33f7', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Wer viel am Schreibtisch arbeitet, ...', '… weiß bequeme Möbel zu schätzen.
Unser Möbelhaus ist spezialisiert auf Büromöbel, auch für Großkunden.
Neuen Katalog jetzt anfordern!
ProBüro GmbH, 01805/132097', 8),
  ('96032703-0419-4ecb-80d7-8933d2a8c7b0', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Hilfe im Büro', 'Mittelständisches Unternehmen sucht Aushilfe auf Stundenbasis für Tätigkeiten wie das Kopieren und Sortieren von Unterlagen, Abtippen von Diktaten etc. Interesse?
Rufen Sie an: 0889/299293-0', 3),
  ('97c2cf63-9cba-4657-9a67-7344414a41b4', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Altes in neuem Gewand', 'Wir gestalten Ihre Büroräume neu mit schönen Tapeten und frischen Farben. Arbeiten können auch am Wochenende ausgeführt werden.
Kontakt: anfrage@malermeister-limm.eu', 7),
  ('9b22e8a0-aa05-4aa7-9f75-43fefaf3bdae', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Bürowelt Markus', 'Umschläge (in allen Größen)
Schreibgeräte (Bleistifte, Kulis, Füller etc.)
Kleingeräte (Locher, Hefter usw.)
Papier (bis DIN A1 auf Lager)
Und vieles mehr!
www.bueroweltmarkus.eu', 5),
  ('dddddddd-0001-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Rechtsanwalt Mark Lutz', 'Fachanwalt f. Medizin- u. Sozialrecht. Seit 25 Jahren bieten wir unsere Dienste an. Remscheider Str. 216, 83012 Oberfeld. www.ra-lutz.de. (0762) 335 62', 0),
  ('dddddddd-0002-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Grober Schmutz muss weg!', 'Ihr Spezialist in Sachen Reinigung Jasmin Lehr. Unterhaltsreinigung • Baureinigung • Winterdienst. Firma Grobe, Unter der Esche 8, 85689 Eickenpfahl. Heribert.Grobe@grobe.eu', 1),
  ('dddddddd-0003-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Anwälte Hilge, Neumann', 'Fachanwälte für Patentrecht, zugelassen beim Europäischen Patentamt u. Gemeinschaftsmarkenamt. Unsere Kanzlei begleitet Sie über das Antragsverfahren bis zum Eintrag Ihrer Marke. Nussweg 9, 79876 Plauberg. info@hilgeneumann.de, 0345 2476', 2),
  ('dddddddd-0004-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Firma für Schutz', 'Soforteinsatz mit Notdienst und 24-Stunden-Notrufzentrale. Baustellenbewachung, Unterstützung durch unsere speziell trainierten Vierbeiner, Wachhunde, Kassendienst. Kostenlose Rufnummer aus allen Mobilnetzen: 534209', 3),
  ('dddddddd-0005-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Wirtschaftsprüfungs- u. Steuerberatungsgesellschaft', 'Ihr Ansprechpartner für ein erfolgreiches Unternehmen. Diplom-Betriebswirt Steuerberater Henrik Bott. info@henrik-bott.com', 4),
  ('dddddddd-0006-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Unsere Dienste zu Ihrer Verfügung!', 'Kontroll- und Schließdienste, diskret und sicher. Wir führen regelmäßig Schließgänge durch, schalten Ihre Alarmanlage scharf und deaktivieren sie wieder. Bewachungs- und Sicherheitsdienst Plagemann. info@plagemann.de', 5),
  ('dddddddd-0007-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Wegmeier — Beratungsgesellschaft mbH', 'GmbH-Beratung • Vereinssteuerrecht • Existenzgründungsberatung • Seminarangebot rund um Ihre Selbstständigkeit. 56498 Rippert, Wolframring 98–102. Tel.: 0987 9865', 6),
  ('dddddddd-0008-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Objektsicherheit', 'Bären-Wache: Ein Einsatz für Kontroll-/Schließdienste! Wir kommen zu jeder Stunde, in jeder Jahreszeit — egal, ob es schneit oder die Sonne scheint. Wir vermitteln Ihnen auch kompetente Mitarbeiter für die Pforte oder den Empfang! An der Brücke 7, 23987 Erlenburg', 7),
  ('dddddddd-0009-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Zuverlässige Lohnbuchhalterin', 'mit fundierten aktuellen Kenntnissen im Lohnsteuer-, Sozialversicherungs- und Tarifrecht sucht neue Herausforderung. PV 3445', 8),
  ('dddddddd-0010-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Jana Potok & Partner GbR', 'Rechtsanwälte — Fachanwälte f. Arbeitsrecht. Wir beraten und vertreten Sie kompetent in allen Problemfällen rund um Ihre Arbeitsstelle. Ringstr. 11–14, 90187 Untermark. Buero-untermark@ra-potok-partner.de', 9),
  ('dddddddd-0011-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Klarsicht Gebäudereinigung GmbH', 'Ihr Partner für alle Gebäudedienste. Fassadenreinigung • Glasreinigung • Desinfektion • Teppichreinigung. info@klarsicht.net. Rotbarschweg 9, 43651 Buchse', 10),
  ('dddddddd-0012-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 'Frische Raumpflege GmbH & Co Gebäudereinigung & Service KG', 'Sie werden staunen, was unsere Putzfeen vollbringen! E-mail: info@fr-born.de. www.frische-raumpflege-born.de', 11),
  ('e164c11d-8532-45ee-91bb-4df480f1847b', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Reinigungskraft', 'mit langjähriger Erfahrung im Reinigen von Innen- und Außenbereichen gesucht, pünktlich und zuverlässig. Bitte neues Betätigungsfeld ab sofort.
Tel. 0176/555090909', 6),
  ('f28f307d-86c8-4f4c-b2a8-dd975b0d3023', '8f892a63-ac7b-436e-a029-263d44101fb6', 'Meininger – Dienstleistungen rund ums Büro', 'Zuverlässiger Dienstleister seit vielen Jahren, mehrere Großkunden. Angebot flexibel nach Ihren Bedürfnissen (Reinigung von Möbeln, Böden und Fenstern, Müllentsorgung, Versorgung von Pflanzen etc.).
Infos: Herr Paul, 0800/190921', 1)
ON CONFLICT ("id") DO NOTHING;

-- lesen_teil3_situations: 20 rows
INSERT INTO "lesen_teil3_situations" ("id", "exerciseId", "situationNumber", "content", "noMatch", "correctAnnouncementId", "sortOrder") VALUES
  ('29656e0c-6b50-44d3-afde-5a79934222ec', '8f892a63-ac7b-436e-a029-263d44101fb6', 17, 'Sie möchten Druckerpapier bestellen.', FALSE, '9b22e8a0-aa05-4aa7-9f75-43fefaf3bdae', 6),
  ('3d9c6db0-ad05-4ec1-978f-5f9625379e22', '8f892a63-ac7b-436e-a029-263d44101fb6', 14, 'Sie suchen neue Bürostühle für Ihr Unternehmen.', FALSE, '8d90a1d8-7c69-4044-ae6f-0647118f33f7', 3),
  ('642b75e7-5538-4355-bea9-8bb7caffdd2c', '8f892a63-ac7b-436e-a029-263d44101fb6', 13, 'Ihr kleines Unternehmen sucht jemanden, der für fünf Stunden pro Woche bei der Büroarbeit hilft.', FALSE, '3946ac07-bdf5-403a-ad2b-8ec5b82d441e', 2),
  ('6743ba69-44ff-471e-97e0-f30600cc2216', '8f892a63-ac7b-436e-a029-263d44101fb6', 16, 'Sie suchen jemanden, der den Firmenparkplatz in Ordnung hält.', FALSE, '14b9c891-6037-4057-9f38-b7bf14cd298b', 5),
  ('8938156f-08ef-4fa0-8a05-ea0427ac751f', '8f892a63-ac7b-436e-a029-263d44101fb6', 12, 'Sie möchten den Gemeinschaftsraum in Ihrer Firma neu tapezieren lassen.', FALSE, '97c2cf63-9cba-4657-9a67-7344414a41b4', 1),
  ('a545e512-558d-4235-8b6b-151542428f3d', '8f892a63-ac7b-436e-a029-263d44101fb6', 18, 'Sie suchen einen Dienstleister für die Reinigung der Bürofenster.', FALSE, 'f28f307d-86c8-4f4c-b2a8-dd975b0d3023', 7),
  ('bf6585f5-eb60-4b33-9667-231614d60497', '8f892a63-ac7b-436e-a029-263d44101fb6', 20, 'Sie möchten Informationen darüber, was Sie gegen Stress am Arbeitsplatz tun können.', FALSE, '4e2b80a9-2f13-4b96-b59b-c4663ac7c37d', 9),
  ('da28a4b5-4869-4bd7-9d20-3cba426fe0a0', '8f892a63-ac7b-436e-a029-263d44101fb6', 19, 'Sie wollen in Ihrem Unternehmen eine neue Beleuchtungsanlage anbringen lassen.', FALSE, '55803a14-3bc8-455f-b0fd-673fa1b5d7cc', 8),
  ('e703b508-8458-4873-a15d-b6fc723429a0', '8f892a63-ac7b-436e-a029-263d44101fb6', 11, 'Ihr Unternehmen braucht neue Computer und Sie wollen ein Angebot einholen.', FALSE, '8a74208f-3db4-413f-b094-0526026888ae', 0),
  ('eeeeeeee-0011-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 11, 'Ihr Arbeitgeber hat Ihnen zwei Monate lang keinen Lohn gezahlt.', FALSE, 'dddddddd-0010-0003-0003-000000000001', 0),
  ('eeeeeeee-0012-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 12, 'Sie wollen sich selbstständig machen und möchten sich noch besser informieren.', FALSE, 'dddddddd-0007-0003-0003-000000000001', 1),
  ('eeeeeeee-0013-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 13, 'Das Gelände Ihrer Firma soll in der Nacht mit Wachhunden geschützt werden.', FALSE, 'dddddddd-0004-0003-0003-000000000001', 2),
  ('eeeeeeee-0014-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 14, 'Sie suchen jemanden für den Empfang.', FALSE, 'dddddddd-0008-0003-0003-000000000001', 3),
  ('eeeeeeee-0015-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 15, 'Zum 50-jährigen Firmenjubiläum erwarten Sie viele Gäste. Sie wollen für ihre Sicherheit sorgen.', TRUE, NULL, 4),
  ('eeeeeeee-0016-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 16, 'Ihr Unternehmen benötigt Hilfe in Steuerfragen.', FALSE, 'dddddddd-0005-0003-0003-000000000001', 5),
  ('eeeeeeee-0017-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 17, 'Die Fenster Ihrer Firma müssen gereinigt werden.', FALSE, 'dddddddd-0011-0003-0003-000000000001', 6),
  ('eeeeeeee-0018-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 18, 'Ihre Reinigungskraft im Großraumbüro arbeitet unzuverlässig und Sie suchen einen Ersatz.', FALSE, 'dddddddd-0012-0003-0003-000000000001', 7),
  ('eeeeeeee-0019-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 19, 'Am Firmenort hatten Sie im letzten Jahr große Schwierigkeiten mit dem Schnee, der nicht geräumt wurde.', FALSE, 'dddddddd-0002-0003-0003-000000000001', 8),
  ('eeeeeeee-0020-0003-0003-000000000001', 'bbbbbbbb-0001-0003-0003-000000000001', 20, 'Mitarbeiter Ihrer Firma wollen eine neue technische Erfindung anmelden und damit schützen.', FALSE, 'dddddddd-0003-0003-0003-000000000001', 9),
  ('ef2f561b-3991-41c9-9902-c45b37ad12b0', '8f892a63-ac7b-436e-a029-263d44101fb6', 15, 'Sie suchen eine Stelle als Bürokraft in Teil- oder Vollzeit.', TRUE, NULL, 4)
ON CONFLICT ("id") DO NOTHING;

-- listening_exercises: 6 rows
INSERT INTO "listening_exercises" ("id", "modelltest_id", "part", "title", "subtitle", "instruction", "content_revision", "duration_minutes", "audio_url", "bundled_audio_asset", "image_url", "transcript", "created_at", "exam_plays_allowed") VALUES
  ('06cbc490-dc63-4ea1-b491-c1a569d88489', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören ein Gespräch. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig (+) oder falsch (–) sind.
Markieren Sie Ihre Lösungen für die Aufgaben 46–55 auf dem Antwortbogen.
Lesen Sie jetzt die Aufgaben 46–55. Sie haben dazu eine Minute Zeit.', 'modelltest-2-hoeren-teil2-v1', 10, '', '', '', 'Judith Rose, Ralf Trommler

Judith Rose: Guten Morgen, Herr Trommler! Das ist ja schön, dass wir uns als Betriebsrat heute zusammensetzen können, um über die Pläne der Firmenleitung für einen Fitnessraum zu sprechen.
Ralf Trommler: Hallo, Frau Rose. Ja, das finde ich auch. Der Betriebsrat hat ja vor vielen Jahren schon mal so einen Vorschlag gemacht, aber damals wurde er sofort vom Geschäftsführer abgelehnt.
Judith Rose: Ach ja? Da war ich wohl noch gar nicht in der Firma. Ich war nämlich ziemlich überrascht, als ich vorgestern von der Idee gehört habe, einen Fitnessraum in unserem Betrieb einzurichten. Ich dachte, das wäre ein ziemlich spontaner Einfall gewesen.
Ralf Trommler: So genau weiß ich ehrlich gesagt auch nicht mehr, wer den Vorschlag zuerst gemacht hat. Und noch ist ja nichts entschieden. Jedenfalls haben wir jetzt die Aufgabe, uns dazu Gedanken zu machen. Ich schlage vor, dass wir jetzt erst mal ein paar Ideen sammeln, zum Beispiel Vorteile und Nachteile so eines Raumes, und in den nächsten Wochen können wir auch noch die Mitarbeiter befragen.
Judith Rose: Ja, das wäre gut. Ich würde auch gerne wissen, was unsere Kolleginnen und Kollegen davon halten. Also, fangen wir erst mal an. Mein erster Gedanke war, dass so ein Fitnessraum sicher eine Menge Geld kostet. Das könnte man doch besser für neue Mitarbeiterparkplätze oder Monatstickets ausgeben.
Ralf Trommler: Okay … ich notiere das mal. Ich denke aber, dass wir viele Geräte auch günstig gebraucht kaufen können, das gibt es doch heutzutage sicher im Internet. Außerdem würde ich dann meine private Mitgliedschaft im Fitnessclub kündigen, da würde ich natürlich sparen.
Judith Rose: Hmm, da ist was dran. Was natürlich auch für einen Fitnessraum spricht, ist, dass bei uns ja viele Kolleginnen und Kollegen von morgens bis abends am Computer sitzen und sich schon oft über Probleme mit dem Rücken beklagt haben. Wenn man zwischendurch immer mal wieder kurz Sport machen kann, bleibt man länger gesund und kann auch besser arbeiten.
Ralf Trommler: Ja, da haben Sie recht. Vielleicht gibt es langfristig auch nicht mehr so viele Krankmeldungen wie im letzten Jahr. Dann wäre es aber auch sinnvoll, wenn die Mitarbeiter während ihrer Arbeitszeit Sport machen dürfen, oder?
Judith Rose: Na ja … so pauschal geht das sicher nicht, dann würden einige wahrscheinlich von morgens bis abends nur noch Sport machen. Aber vielleicht eine halbe Stunde pro Woche … Wir können es ja mal vorschlagen.
Ralf Trommler: Mir ist noch etwas anderes eingefallen. Diese Fitnessgeräte sind ja nicht gerade leise, das könnte doch die Arbeit der anderen beeinträchtigen. Natürlich hängt es davon ab, wie wir den Raum isolieren und wo der Raum genau ist, aber so viel Platz haben wir ja nun auch nicht, irgendein Büro wäre immer in der Nähe.
Judith Rose: Stimmt, das sollte man vorab prüfen. Ehrlich gesagt, haben wir jetzt schon einige Nachteile oder zumindest problematische Aspekte gefunden, sodass ich langsam denke, ein Lauftreff am Abend wäre vielleicht besser.
Ralf Trommler: Hmm, also ich persönlich möchte nach Feierabend lieber nach Hause zu meiner Familie und nicht erst noch eine Stunde durch den Park joggen. Ich würde bei so etwas nicht mitmachen. Aber gut, wir können ja jetzt erst mal einen Fragebogen machen und die Kollegen befragen …
Judith Rose: Genau, wir haben ja schon einiges, ich setze mich gleich an den Computer und trage mal die Vor- und Nachteile zusammen …', '2026-08-21T17:40:56.444Z'::timestamptz, 1),
  ('4d9a006f-f8f2-4837-ae5f-729654f44386', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören die Aussagen von fünf Personen. Sie hören die Aussagen nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig (+) oder falsch (–) sind.', 'modelltest-1-teil-1-v1', 6, '', '', 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/hoerverstehen_teil1.png', NULL, '2026-08-21T16:26:24.216Z'::timestamptz, 1),
  ('6406b5ef-7e51-4a47-826b-5252706bf414', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 1, 'Teil 1', 'Hörverstehen, Teil 1', 'Sie hören die Aussagen von fünf Personen. Sie hören die Aussagen nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig (+) oder falsch (–) sind.
Markieren Sie Ihre Lösungen für die Aufgaben 41–45 auf dem Antwortbogen.
Lesen Sie jetzt die Aufgaben 41–45. Sie haben dazu 30 Sekunden Zeit.', 'modelltest-2-hoeren-teil1-v1', 10, '', '', '', 'Moderatorin: Das Thema unserer heutigen Umfrage betrifft eigentlich alle, die arbeiten: das Essen in der Mittagspause. Wir haben einige Mitarbeiter aus unterschiedlichen Firmen gefragt. Hören Sie nun die Antworten.

41
Carlos Ramirez, Lagerist
Seit etwa einem Monat haben wir in unserer Firma auch eine Kantine. Viele Kollegen waren skeptisch, weil man ja oft hört, dass das Essen in einer Kantine nicht so gut sein soll. Ehrlich gesagt habe ich das früher auch gedacht. Ich war dann gleich nach der Eröffnung in unserer Kantine essen, und ich muss sagen – die Qualität der Mahlzeiten ist wirklich super. Jetzt gehe ich fast jeden Tag in die Kantine, allerdings … es gibt sehr oft die gleichen Mahlzeiten, ich würde mir da deutlich mehr Abwechslung wünschen.

42
Julia Reichelt, Sekretärin
Wir haben keine Kantine in unserem Betrieb, dafür sind wir viel zu klein. Aber in der Nähe gibt es viele Restaurants, die haben oft Mittagsangebote, und das Essen schmeckt auch toll. Meine Kollegin Sabine geht fast jeden Tag mittags raus. Ehrlich gesagt, ist mir das aber auf Dauer zu teuer, deshalb esse ich meist in unserem Pausenraum, zum Beispiel ein belegtes Brot oder einen Salat. So etwas kann ich gut zu Hause vorbereiten und dann einfach mitnehmen.

43
Marcus Thon, Systemadministrator
Tja, ehrlich gesagt, bleibe ich mittags nicht so gerne in der Firma, obwohl wir einen sehr schönen Pausenraum haben. Ich brauche einfach frische Luft und muss auch mal was anderes sehen als immer nur die Büroräume unserer Firma. Und ich möchte mich in der Pause eigentlich auch nicht über die Arbeit unterhalten, Pause ist schließlich Pause. Deshalb bin ich beim Mittagessen am liebsten allein, da kann ich wirklich entspannen und mal den Kopf freikriegen.

44
Vera Ingelhoff, Teamleiterin
Wir haben schon lange eine Kantine in der Firma. Früher gab es natürlich viel Fleisch, wie in den meisten Kantinen. Viele Kolleginnen und Kollegen wollten aber vegetarisch essen und sind deshalb kaum in die Kantine gegangen. Inzwischen gibt es dort auch regelmäßig vegetarische Gerichte und sogar Bio-Mahlzeiten. Das finde ich super, jetzt findet wirklich jeder was. Ich esse übrigens auch ab und zu mal vegetarisch, aber ich mag auch Fleisch. Von daher finde ich das Angebot jetzt optimal.

45
Alexej Romanow, Mechatroniker
Ich arbeite in einer Autowerkstatt in einem Gewerbegebiet, und wir haben gegenüber einen Imbiss. Da gibt es Pommes, Currywurst und so was. Richtig gesund ist das ja nicht, und deshalb war ich früher auch höchstens einmal pro Woche dort. Aber … wir haben in letzter Zeit so viel Arbeit, dass kaum Zeit für die Pause bleibt – und was soll ich sagen? Zurzeit gehe ich fast täglich rüber zum Imbiss.', '2026-08-21T17:40:56.444Z'::timestamptz, 1),
  ('835623a4-16cf-4117-89c0-9cb8c5765a0c', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören fünf kurze Texte. Sie hören die Texte zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig (+) oder falsch (–) sind.', 'modelltest-1-teil-3-v1', 10, '', '', 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/hoerverstehen_teil3.png', NULL, '2026-08-21T16:26:24.216Z'::timestamptz, 1),
  ('a5aeb389-7dc6-4890-8438-d77be92f2e23', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 2, 'Teil 2', 'Hörverstehen, Teil 2', 'Sie hören ein Gespräch. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig (+) oder falsch (–) sind.', 'modelltest-1-teil-2-v1', 10, '', '', 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev/hoerverstehen_teil2.png', NULL, '2026-08-21T16:26:24.216Z'::timestamptz, 1),
  ('f63e694e-e9d3-493b-961a-2db42eb5c345', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 3, 'Teil 3', 'Hörverstehen, Teil 3', 'Sie hören fünf kurze Texte. Sie hören die Texte zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig (+) oder falsch (–) sind.
Markieren Sie Ihre Lösungen für die Aufgaben 56–60 auf dem Antwortbogen.
Lesen Sie jetzt die Aufgabe 56.', 'modelltest-2-hoeren-teil3-v1', 10, '', '', '', '56
Ihr PC funktioniert nicht und Sie rufen eine Hotline an.
Guten Tag, Sie haben die PC-Servicehotline für unsere klein- und mittelständischen Firmenkunden gewählt. Leider sind momentan alle Leitungen besetzt. Sie werden mit dem nächsten freien Mitarbeiter verbunden. Zur Verbesserung unserer Servicequalität werden einzelne Gespräche aufgezeichnet. Wenn Sie mit der Aufzeichnung Ihres Gesprächs einverstanden sind, sagen Sie jetzt bitte deutlich „Ja“ …

57
Sie besuchen eine Lebensmittelmesse und hören eine Durchsage.
Liebe Messebesucher, wir möchten Sie auf eine aktuelle Veranstaltung um 15 Uhr in Halle 4.3 aufmerksam machen. Mitarbeiter vom Deutschen Lebensmittelinstitut erläutern dort die neuesten Vorgaben für Zusatzstoffe. Auch die Kennzeichnung der Waren wird ein Thema sein. Gerne können Sie dort auch Ihre Fragen stellen. Die Veranstaltung ist für Messebesucher kostenlos.

58
Sie kommen Montagfrüh in den Betrieb und hören den Anrufbeantworter ab.
Ja, hallo, Schneider hier, Ralf Schneider. Ich hatte vergangene Woche bei Ihnen neues Büromaterial bestellt, 5000 Blatt Papier, diverse Stifte und auch noch neue Aktenordner. Jetzt ist Samstag, und die Lieferung ist gerade angekommen, nur leider fehlt ausgerechnet das Papier. Ich muss aber bis Mittwoch Unterlagen für eine Schulung ausdrucken. Bitte melden Sie sich doch umgehend bei mir.

59
Sie müssen zu einer Messe in Frankfurt und hören am Bahnhof folgende Durchsage:
Sehr geehrte Reisende, beachten Sie bitte folgenden Hinweis zur S8 nach Offenbach über Frankfurt Flughafen und Frankfurt Hauptbahnhof: Wegen einer Oberleitungsstörung müssen alle Züge des Nahverkehrs derzeit umgeleitet werden. Dadurch verlängert sich die Fahrtzeit um etwa 20 Minuten. Wir bitten dies zu entschuldigen. Reisende nach Frankfurt Hauptbahnhof können ohne Zuschlag den ICE 1597 nutzen. Der Zug steht abfahrbereit an Gleis 4.

60
Sie hören nach der Mittagspause folgende Nachricht auf Ihrem Anrufbeantworter:
Hallo, hier ist die Firma Reinigungsblitz. Sie hatten ja bei uns neue Reinigungsmittel bestellt, und wir hatten versprochen, dass wir heute noch liefern. Leider ist unser Lkw nun unterwegs liegengeblieben, und wir können noch nicht sagen, ob wir es heute noch schaffen, die Ware zu Ihnen zu bringen, oder erst morgen. Rufen Sie mich kurz zurück? Danke!', '2026-08-21T17:40:56.444Z'::timestamptz, 1)
ON CONFLICT ("id") DO NOTHING;

-- listening_questions: 40 rows
INSERT INTO "listening_questions" ("id", "exercise_id", "question_number", "prompt", "correct_answer", "sort_order") VALUES
  ('00d9abc3-05cb-4620-b6f5-fff38c7dec92', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 48, 'Herr Lissitsky meint, die Quartalszahlen zeigen eine positive Entwicklung.', '-', 2),
  ('06cb0c47-3f2f-44b9-b367-38f6e6465342', '06cbc490-dc63-4ea1-b491-c1a569d88489', 52, 'Frau Rose schlägt vor, dass die Mitarbeiter einen Tag pro Woche Sport machen sollten.', '-', 6),
  ('14cfff3b-3691-4c87-87ae-bd6b6bfb1ef5', '835623a4-16cf-4117-89c0-9cb8c5765a0c', 59, 'Frau Arnold kann Ihnen zu Ihrer Fortbildung Auskunft geben.', '-', 3),
  ('1f5efbc0-0e59-4560-adff-858f952ed605', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 52, 'Die Firma versteht die Mahnungen nicht.', '+', 6),
  ('2001fdc0-37f7-4bfd-b0f6-12f15b6c1552', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 55, 'Frau Pauß erwartet keine Antwort von Herrn Lissitsky.', '-', 9),
  ('2ad36490-dfcb-4ab0-bf87-64e944d3c9fd', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 53, 'Herr Lissitsky hat sich um die bezahlten Rechnungen gekümmert.', '-', 7),
  ('3036309f-161d-40b8-8d5f-b716b724cd3a', '06cbc490-dc63-4ea1-b491-c1a569d88489', 50, 'Viele Mitarbeiter in der Firma haben Rückenbeschwerden.', '+', 4),
  ('32c8ffae-9d9f-4c42-9392-8ebc3f6951f1', '4d9a006f-f8f2-4837-ae5f-729654f44386', 44, 'Maria Vallomäinen erklärt, wie Fortbildungsveranstaltungen entstehen.', '+', 3),
  ('3e3285b4-186a-4b07-9c63-2c4e2685cd2e', '4d9a006f-f8f2-4837-ae5f-729654f44386', 45, 'Manus Mani lehnt Fortbildungen ab, weil dann seine eigene Arbeit liegen bleibt.', '+', 4),
  ('3f0a277b-989e-4344-84f8-19aa5ae09aa7', '6406b5ef-7e51-4a47-826b-5252706bf414', 41, 'Carlos Ramirez findet die Auswahl an Speisen in der Kantine seiner Firma sehr gut.', '-', 0),
  ('4023e12d-b9c3-4909-9ffd-33b03b6da1fe', '06cbc490-dc63-4ea1-b491-c1a569d88489', 47, 'Herr Trommler schlägt vor, auch die Meinung der Kollegen einzuholen.', '+', 1),
  ('4a12f74c-c5e9-4397-9f61-fc339bec1fe6', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 47, 'Herr Lissitsky hat nicht so viel zu tun.', '-', 1),
  ('5502e2a2-ac09-4ab7-b0bf-689e03b5541a', '835623a4-16cf-4117-89c0-9cb8c5765a0c', 58, 'Im Falle einer Notsituation kann Ihnen die Firma Sabel nicht helfen.', '+', 2),
  ('5c608f12-87b4-4c3d-8183-d8bee14810bd', '06cbc490-dc63-4ea1-b491-c1a569d88489', 46, 'Frau Rose kannte die Pläne für einen Fitnessraum schon seit mehreren Wochen.', '-', 0),
  ('69513e28-548a-4960-8ae9-0f02ae47bed5', '4d9a006f-f8f2-4837-ae5f-729654f44386', 43, 'Weng Wang stellt vor dem Seminar viele Fragen an die Seminarleitung.', '-', 2),
  ('728c5890-e749-4723-9eeb-ee62d7887cf7', '4d9a006f-f8f2-4837-ae5f-729654f44386', 42, 'Alena Groll bildet sich regelmäßig weiter.', '+', 1),
  ('829cbb7d-589d-4b4b-a0e2-11b5b453f3ad', 'f63e694e-e9d3-493b-961a-2db42eb5c345', 60, 'Das Auslieferungsfahrzeug hatte eine Panne.', '+', 4),
  ('8a0294d1-5374-4579-b936-17eabed0cd72', '835623a4-16cf-4117-89c0-9cb8c5765a0c', 57, 'Der Chef berücksichtigt die Änderung in der Tagesordnung.', '+', 1),
  ('8d532414-9e73-458b-b243-a5db4d6b2c76', '6406b5ef-7e51-4a47-826b-5252706bf414', 45, 'Alexej Romanow geht heute öfter zum Imbiss als früher.', '+', 4),
  ('9267cd91-d060-40e5-a80a-0edcd227bd7a', '06cbc490-dc63-4ea1-b491-c1a569d88489', 49, 'Herr Trommler denkt, dass man die Kosten niedrig halten kann.', '+', 3),
  ('a610bddf-c7f5-4653-a0ea-ba25b34f23d9', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 46, 'Frau Pauß möchte Herrn Lissitsky kurz sprechen.', '+', 0),
  ('a789fd2b-01a8-479f-a570-669b5c26d0bd', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 49, 'Frau Pauß spricht über die Lieferung an die ausländische Firma Novis.', '+', 3),
  ('b71bfefb-db7d-4942-9fde-de657d367647', '6406b5ef-7e51-4a47-826b-5252706bf414', 44, 'Vera Ingelhoff wünscht sich mehr vegetarische Gerichte in der Kantine.', '-', 3),
  ('b7f82ee7-689c-40a0-a3e0-eca18518ef10', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 50, 'Der Auftrag war leicht auszuführen.', '-', 4),
  ('b8a4067e-da3b-4a58-bdfa-cbe305d8fe23', '06cbc490-dc63-4ea1-b491-c1a569d88489', 51, 'Herr Trommler meint, dass es weniger Fehlstunden wegen Krankheit gibt, wenn die Mitarbeiter Sport machen.', '+', 5),
  ('ba57f7eb-82d8-49ab-acb5-fded9ea7501d', 'f63e694e-e9d3-493b-961a-2db42eb5c345', 57, 'Bei der Veranstaltung geht es auch um die Beschriftung von Lebensmitteln.', '+', 1),
  ('c1aedf92-7501-4c10-85cd-2d093ccf1adc', 'f63e694e-e9d3-493b-961a-2db42eb5c345', 58, 'Herr Schneider hatte die Ware am letzten Mittwoch bestellt.', '-', 2),
  ('c32230ec-b937-433f-bf09-f94f6d6db06e', '06cbc490-dc63-4ea1-b491-c1a569d88489', 54, 'Frau Rose denkt, dass man andere Möglichkeiten suchen sollte, um Sport zu treiben.', '+', 8),
  ('d054339f-a554-4b36-abe7-6266470fea9f', '06cbc490-dc63-4ea1-b491-c1a569d88489', 53, 'Der Fitnessraum kann weit entfernt von den Büros eingerichtet werden.', '-', 7),
  ('da39b4aa-efb0-4efa-8e18-cba3890b0f2d', '6406b5ef-7e51-4a47-826b-5252706bf414', 42, 'Julia Reichelt bringt Essen von zu Hause mit, um Geld zu sparen.', '+', 1),
  ('dab6e8c7-befb-4b83-b493-31f6a4cc16c8', '06cbc490-dc63-4ea1-b491-c1a569d88489', 55, 'Für Ralf Trommler ist Sport im Anschluss an die Arbeit eine gute Alternative.', '-', 9),
  ('db84af8f-bf5b-4841-9527-e230dbbc1992', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 51, 'Die Firma Novis beklagt sich nun.', '+', 5),
  ('ee3a006d-876c-4c04-be48-a00e328fb53f', '835623a4-16cf-4117-89c0-9cb8c5765a0c', 56, 'Herr Lehmann würde gern später kommen.', '+', 0),
  ('f31a5074-90da-4b7d-9395-0be9ee6a7c2c', 'f63e694e-e9d3-493b-961a-2db42eb5c345', 56, 'Sie sollen während des Gesprächs etwas aufschreiben.', '-', 0),
  ('f75c1927-31b8-4940-a294-9ac1ef2a2f37', '06cbc490-dc63-4ea1-b491-c1a569d88489', 48, 'Frau Rose findet, dass das Geld eher für andere Zwecke ausgegeben werden sollte.', '+', 2),
  ('f89dadb2-3a66-44fa-bf69-555e77a47746', 'f63e694e-e9d3-493b-961a-2db42eb5c345', 59, 'Der nächste Zug nach Frankfurt fährt in 20 Minuten.', '-', 3),
  ('fca1c3cf-b937-4e1e-bb66-5e607c28ea70', '4d9a006f-f8f2-4837-ae5f-729654f44386', 41, 'Für Manfred Rienke ist das Fortbildungsangebot wichtig.', '-', 0),
  ('fd3389d2-c61a-408d-9ed1-6ed7be7c22ca', '835623a4-16cf-4117-89c0-9cb8c5765a0c', 60, 'Sie kommen nicht pünktlich am Zielort an.', '+', 4),
  ('fe3b6a55-9ce8-4867-8cf9-16aa3f6a2f62', 'a5aeb389-7dc6-4890-8438-d77be92f2e23', 54, 'Frau Pauß bittet Herrn Lissitsky um seine Hilfe bei der Suche nach möglichen Ursachen.', '+', 8),
  ('fe500385-c2b7-4d63-878a-5c0d2c6ecea5', '6406b5ef-7e51-4a47-826b-5252706bf414', 43, 'Marcus Thon geht mittags am liebsten ohne Kollegen essen.', '+', 2)
ON CONFLICT ("id") DO NOTHING;

-- speaking_exercises: 6 rows
INSERT INTO "speaking_exercises" ("id", "modelltest_id", "part", "title", "subtitle", "topic_title", "topic_description", "topic_points", "instructions", "duration_minutes", "prep_duration_seconds", "image_url", "exam_image_url", "content_revision", "created_at") VALUES
  ('087aaab1-ba7e-4d8a-8967-997a19aa7303', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 3, 'Mündlicher Ausdruck – Teil 3 Gemeinsam eine Aufgabe lösen', 'Teilnehmer/in A und B', 'Firmenjubiläum planen', 'Nächsten Monat hat ein Kollege Firmenjubiläum, er arbeitet schon seit 30 Jahren in der Firma. Sie sollen eine kleine Feier für ihn planen.
Hier einige Punkte, die Ihnen bei der Planung helfen:', '["Wo feiern?","Essen/Getränke kaufen, bestellen oder mitbringen?","Welche Dekoration (Tischdecken, Bilder, Luftballons, ...)?","Geschenk für den Kollegen (was für ein Geschenk/wer kauft es)?","Begrüßung/Rede (wer und wie lang?)"]'::jsonb, 'Entscheiden Sie zuerst, was Sie machen möchten und warum.
Tragen Sie Ihrem Partner Ihre Ideen vor und begründen Sie sie.
Reagieren Sie auf die Ideen Ihres Partners bzw. Ihrer Partnerin und die Begründungen.
Einigen Sie sich auf einen gemeinsamen Programmvorschlag.', 5, 300, '', NULL, 'modelltest-2-sprechen-teil-3-v1', '2026-08-21T17:40:56.444Z'::timestamptz),
  ('4d219495-89e0-453b-b0dd-33455de12e89', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 3, 'Répétition', 'Répétez la phrase après l''écoute.', 'Aufgabe: Ein Abschiedsfest planen', 'Ihr Kollege Patrick verlässt die Firma. Sie möchten mit Ihrer Partnerin eine Überraschungsparty organisieren.', '["Wann feiern?","Wo feiern?","Essen und Trinken?","Geschenk für Patrick?","Wer wird eingeladen?"]'::jsonb, 'In this Teil, you will discuss a task with a partner. Take a position, suggest ideas, and reach an agreement together.', 5, 300, 'assets/images/modules/sprechen.jpg', NULL, 'modelltest-1-sprechen-teil-3-v1', '2026-08-21T16:26:24.216Z'::timestamptz),
  ('5a903121-7f19-4d95-bc28-e3b171059759', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 2, 'Mündlicher Ausdruck – Teil 2 Gespräch über ein Thema', '', 'Auswirkungen des Bahnstreiks', 'Sie haben in einer Zeitung etwas zum Thema „Auswirkungen des Bahnstreiks“ gelesen. Berichten Sie Ihrer Partnerin bzw. Ihrem Partner, welche Informationen Sie haben.
Ihre Partnerin bzw. Ihr Partner hat zum gleichen Thema andere Informationen und berichtet auch darüber. Unterhalten Sie sich danach über das Thema. Erzählen Sie von persönlichen Erfahrungen, stellen Sie Fragen und reagieren Sie auf Fragen Ihrer Partnerin bzw. Ihres Partners.', '["Teilnehmer/in A — Nicole Siepenkotten (35 Jahre, Netzwerk-Installateurin): Ich bin Spezialistin für Netzwerke in einer IT-Firma. Meine Arbeit ist fast immer vor Ort bei den Kunden zu erledigen, also bin ich täglich in einer anderen Richtung unserer Region unterwegs. Ich fahre immer mit der Bahn. Und jetzt der Streik! Mein supermodernes Smartphone hilft mir aber, die letzten noch funktionierenden Verbindungen herauszufinden! Und so habe ich eigentlich keine wirklichen Probleme.","Teilnehmer/in B — Marc Heidinger (23 Jahre, Student): Ich studiere Mathematik und Informatik. Für mich ist es sehr wichtig, neben dem Studium noch ein Halbtagspraktikum in einer IT-Firma machen zu können. Da ich aber aus finanziellen Gründen noch bei meinen Eltern auf dem Dorf lebe, ist der Streik für mich eine Katastrophe. Die S-Bahn als einzige Verbindung in die Großstadt fährt momentan nur noch gelegentlich. Wenn ich mit Bussen fahre und dreimal umsteige, brauche ich zweieinhalb Stunden. Das ist sehr anstrengend."]'::jsonb, 'Sie haben in einer Zeitung etwas zum Thema „Auswirkungen des Bahnstreiks“ gelesen. Berichten Sie Ihrer Partnerin bzw. Ihrem Partner, welche Informationen Sie haben.
Ihre Partnerin bzw. Ihr Partner hat zum gleichen Thema andere Informationen und berichtet auch darüber. Unterhalten Sie sich danach über das Thema. Erzählen Sie von persönlichen Erfahrungen, stellen Sie Fragen und reagieren Sie auf Fragen Ihrer Partnerin bzw. Ihres Partners.', 15, 300, '', NULL, 'modelltest-2-sprechen-teil-2-v1', '2026-08-21T17:40:56.444Z'::timestamptz),
  ('7d73451f-82db-41fa-91cf-ad5c0725d556', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 1, 'Lire à voix haute', 'Lisez la phrase affichée à voix haute.', 'Aufgabe: Stellen Sie sich vor', 'Sprechen Sie über sich. Gehen Sie auf die folgenden Punkte ein. Bilden Sie vollständige Sätze.', '["Name","Alter","Land & Wohnort","Sprachen","Beruf","Hobby"]'::jsonb, 'In this Teil, you will introduce yourself. Talk about your name, where you are from, your hobbies, and your work or studies. Speak naturally and clearly.', 10, 300, 'assets/images/modules/sprechen.jpg', NULL, 'modelltest-1-sprechen-teil-1-v1', '2026-08-21T16:26:24.216Z'::timestamptz),
  ('b303c646-4bdc-4420-981a-298a06f6bc9c', '66ae8d06-0514-403f-801d-ab2cb4d440b6', 1, 'Mündlicher Ausdruck – Teil 1 Kontaktaufnahme', 'Teilnehmer/in A und B', 'Kontaktaufnahme', 'Unterhalten Sie sich mit Ihrer Partnerin bzw. Ihrem Partner über folgende Themen:', '["Name","woher sie oder er kommt","wie sie oder er wohnt (Wohnung, Haus, Garten, ...)","Familie","wo sie oder er Deutsch gelernt hat","was sie oder er macht (Beruf, Arbeit, Ausbildung, ...)","Sprachen (welche? wie lange? warum?)","Zusätzliche Prüferfrage: was Ihnen an Ihrem Beruf besonders gut gefällt","Zusätzliche Prüferfrage: wie und wo Sie gern Ihren Urlaub verbringen"]'::jsonb, 'Die Prüfenden können außerdem noch weitere Fragen stellen.', 10, 300, '', NULL, 'modelltest-2-sprechen-teil-1-v1', '2026-08-21T17:40:56.444Z'::timestamptz),
  ('bd84d916-6371-47d6-90e7-f270fa96b390', 'bee41782-747a-4b53-8059-801f3ad2bcfe', 2, 'Dialogue', 'Pratiquez des échanges courts en situation.', 'Aufgabe: Bildbeschreibung', 'Beschreiben Sie das Bild genau. Was sehen Sie? Wie ist die Situation?', '["Was sehen Sie auf dem Foto?","Was machen die Personen?","Wie ist die Umgebung/Wetter?","Ihre persönliche Meinung zum Thema."]'::jsonb, 'In this Teil, you will describe a picture and express your opinion on the topic shown. Give concrete examples and elaborate your thoughts.', 15, 300, 'assets/images/modules/sprechen.jpg', 'assets/images/modules/sprechen.jpg', 'modelltest-1-sprechen-teil-2-v1', '2026-08-21T16:26:24.216Z'::timestamptz)
ON CONFLICT ("id") DO NOTHING;

-- writing_exercises: 2 rows
INSERT INTO "writing_exercises" ("id", "content_revision", "title", "subtitle", "task_type", "intro", "stimulus", "task_instructions", "bullet_points", "closing_reminder", "created_at", "modelltest_id") VALUES
  ('0af1e03c-5b50-4d5d-bed4-bf18c5721b59', 'v1', 'E-Mail / Brief', 'Formeller Brief', 'brief', 'Sie sehen folgende Anzeige:', '{"body":"In unserem neu gebauten Bürogebäude sind noch Räume frei","contact":{"name":"CenterBüros GmbH","lines":["Neuer Wall 120","50160 Köln"]},"heading":"Büroräume in Neubaukomplex zu vermieten!","features":["Gebäude mit 6 Stockwerken","zentrale Lage","helle, großzügige Büros, zwischen 15 und 25 m²","Kaffeeküche","Konferenzräume","vier Aufzüge","moderne Anschlüsse in allen Räumen (z. B. Internet/DSL-Anschlüsse)","Hausmeisterservice rund um die Uhr","moderne Sicherheitstechnik"],"callToAction":"Vereinbaren Sie einen Besichtigungstermin oder fordern Sie weitere Informationen an:"}'::jsonb, 'Sie arbeiten in einem Übersetzerbüro. Ihr Chef möchte größere Büroräume mieten. Schreiben Sie einen Brief an die CenterBüros GmbH. Bitten Sie um Informationen und schreiben Sie etwas zu den folgenden Punkten:', ARRAY['Beschreiben Sie Ihr Unternehmen.', 'Was für Räume brauchen Sie?', 'Wie viele Räume brauchen Sie?', 'Wann brauchen Sie die Räume?', 'Fragen Sie nach den Kosten.']::text[], 'Bevor Sie den Brief schreiben, überlegen Sie sich die passende Reihenfolge der Punkte, eine passende Einleitung und einen passenden Schluss. Vergessen Sie auch nicht Datum und Anrede.', '2026-05-30T12:30:12.033Z'::timestamptz, 'bee41782-747a-4b53-8059-801f3ad2bcfe'),
  ('5196c237-2ef9-4ffc-885a-dabf364873e4', 'modelltest-2-schreiben-v1', 'E-Mail / Brief', 'Formeller Brief', 'brief', 'Sie lesen folgende Anzeige:', '{"body":"Wir bieten Ihnen alles, was Sie für eine tolle Kinderparty brauchen, z. B.:","contact":{"name":"Mini-Party","lines":["Schlossweg 213, 92280 Neudorf","E-Mail: info@miniparty.eu"]},"heading":"Große Party für die Kleinen!","features":["Clown „Pedro“ mit seinen Luftballon-Tieren","Mini-Hüpfburg","Schminken und Verkleiden (Kostüme inklusive)","Spiele für Kinder zwischen 3 und 13 Jahren","Singen mit „Caruso“, dem singenden Clown","Zauberer „Merlin“"],"imageUrl":null,"subheading":"Kindergeburtstage, Sommerfeste und vieles mehr ...","callToAction":"Wir haben auch für Ihre Party das passende Programm – sprechen Sie uns an!"}'::jsonb, 'Sie arbeiten in einem Kindergarten. Die Kindergartenleiterin plant eine Feier. Schreiben Sie einen Brief an den Party-Veranstalter. Bitten Sie um Informationen und schreiben Sie etwas zu den folgenden vier Punkten:', ARRAY['beschreiben Sie die geplante Feier', 'welche Leistungen Sie wünschen', 'fragen Sie nach Kosten und Terminen', 'fragen Sie nach bisherigen Kunden (wer, Zufriedenheit, ...)']::text[], 'Bevor Sie den Brief schreiben, überlegen Sie sich die passende Reihenfolge der Punkte, eine passende Einleitung und einen passenden Schluss. Vergessen Sie auch nicht Datum und Anrede.', '2026-08-21T17:40:56.444Z'::timestamptz, '66ae8d06-0514-403f-801d-ab2cb4d440b6')
ON CONFLICT ("id") DO NOTHING;
