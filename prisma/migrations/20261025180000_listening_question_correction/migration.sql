-- Training correction packages on Hören questions (pilot: B1 MT3 Teil 1).
-- Contract: docs/contracts/training-correction-package.md

ALTER TABLE "listening_questions"
  ADD COLUMN IF NOT EXISTS "correction" JSONB;

-- Modelltest 3 · Hören Teil 1 · items 41–45 (reviewed against source transcript).
UPDATE "listening_questions" AS q
SET "correction" = v.package::jsonb
FROM "listening_exercises" AS e,
     (VALUES
       (41, '{
         "evidence": "Na, eigentlich mach alles ich, ich bin zu Haus, daher koch ich, ich wasch ab, ich bügle, ich versorge das Kind",
         "whyCorrect": "Die Sprecherin sagt, dass sie praktisch alles macht. Sie nennt mehrere Aufgaben: kochen, abwaschen, bügeln und das Kind versorgen.",
         "whyOppositeFails": "„Falsch“ passt nicht, weil sie ausdrücklich beschreibt, dass die Hausarbeit hauptsächlich bei ihr liegt.",
         "learningPoint": "„Fast alles“ bedeutet nicht „wirklich alles“. Kleine Ausnahmen machen die Aussage nicht falsch.",
         "audioHighlight": { "startMs": null, "endMs": null }
       }'),
       (42, '{
         "evidence": "Dafür wäscht meine Frau eben ab ähm ... Wäsche waschen mach ich nicht so gerne das macht sie",
         "whyCorrect": "Seine Frau wäscht ab und übernimmt auch die Wäsche. Die Aussage ordnet diese Aufgaben der falschen Person zu.",
         "whyOppositeFails": "„Richtig“ würde bedeuten, dass er beide Aufgaben übernimmt. Im Text übernimmt sie seine Frau.",
         "learningPoint": "„Abwaschen“ bedeutet Geschirr reinigen. „Wäsche waschen“ betrifft Kleidung. Achte bei beiden Aufgaben darauf, wer sie macht.",
         "audioHighlight": { "startMs": null, "endMs": null }
       }'),
       (43, '{
         "evidence": "mein Mann ist voll berufstätig, ich bin zu Hause mit unseren zwei kleinen Kindern, 3 und 5 Jahre alt",
         "whyCorrect": "„Voll berufstätig“ bezieht sich auf ihren Mann. Die Sprecherin beschreibt sich selbst als zu Hause mit den Kindern.",
         "whyOppositeFails": "„Richtig“ würde die Berufstätigkeit der Sprecherin zuordnen. In dieser Textstelle spricht sie aber über ihren Mann.",
         "learningPoint": "Achte auf den Wechsel zwischen „mein Mann“ und „ich“. Eine Information kann stimmen, aber in der Aufgabe der falschen Person zugeordnet sein.",
         "audioHighlight": { "startMs": null, "endMs": null }
       }'),
       (44, '{
         "evidence": "Puh, wissen Sie, bei uns ist das eigentlich ganz unterschiedlich, das hängt von der Situation ab.",
         "whyCorrect": "Er erklärt, dass die Aufteilung unterschiedlich ist und von der Situation abhängt. Das entspricht „je nach Situation“.",
         "whyOppositeFails": "„Falsch“ passt nicht: Seine Aussage bestätigt ausdrücklich, dass die Situation die Aufteilung bestimmt.",
         "learningPoint": "„Je nach Situation“ und „von der Situation abhängen“ drücken hier denselben Gedanken aus.",
         "audioHighlight": { "startMs": null, "endMs": null }
       }'),
       (45, '{
         "evidence": "Also mein Mann, der ist ziemlich faul, der macht überhaupt nur, was ihm Spaß macht.",
         "whyCorrect": "Sie kritisiert ihren Mann als faul. Ihre Worte zeigen Unzufriedenheit und keine Freude über seine Hilfe.",
         "whyOppositeFails": "„Richtig“ würde Zufriedenheit ausdrücken. Die negative Beschreibung ihres Mannes widerspricht dem.",
         "learningPoint": "Achte auf wertende Wörter: „ziemlich faul“ zeigt deutlich eine negative Haltung.",
         "audioHighlight": { "startMs": null, "endMs": null }
       }')
     ) AS v(question_number, package)
WHERE q.exercise_id = e.id
  AND e.content_revision = 'modelltest-3-hoeren-teil1-v1'
  AND q.question_number = v.question_number;
