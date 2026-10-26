import type { SkillId } from '../student-activity/student-history';

export interface PrepTip {
  skill: SkillId;
  teil: number;
  title: string;
  objective: string;
  strategy: string[];
  traps: string[];
  practiceHint: string;
}

export const PREP_TIPS: PrepTip[] = [
  {
    skill: 'lesen',
    teil: 1,
    title: 'Lesen Teil 1 — Globalverstehen',
    objective:
      'Den globalen Inhalt von Kleinanzeigen erfassen und zur passenden Situation zuordnen.',
    strategy: [
      'Zuerst die Situation lesen, dann die Anzeigen überfliegen.',
      'Nach dem Hauptthema suchen (Was wird angeboten / gesucht?), nicht nach jedem Detail.',
      'Wörter aus der Situation im Text wiederfinden — aber prüfen, ob die Bedeutung wirklich passt.',
    ],
    traps: [
      'Ein einzelnes Wort aus der Situation steht in der falschen Anzeige.',
      'Ähnliche Angebote (Wohnung vs. Zimmer, Kurs vs. Prüfung) verwechseln.',
    ],
    practiceHint: 'Danach: ein Lesen-Teil-1 aus einem Modelltest üben.',
  },
  {
    skill: 'lesen',
    teil: 2,
    title: 'Lesen Teil 2 — Detailverstehen (kurz)',
    objective:
      'Wichtige Detailinformationen in einem kurzen Text finden (Richtig/Falsch, Multiple Choice).',
    strategy: [
      'Die Aussage / Frage zuerst lesen, dann gezielt im Text suchen.',
      'Zahlen, Namen, Orte und Verneinungen markieren.',
      'Nur das ankreuzen, was der Text wirklich sagt.',
    ],
    traps: [
      'Aussagen, die „fast“ stimmen, aber ein Detail verdrehen.',
      'Informationen aus dem eigenen Wissen statt aus dem Text.',
    ],
    practiceHint: 'Danach: Lesen Teil 2 mit Timer üben.',
  },
  {
    skill: 'lesen',
    teil: 3,
    title: 'Lesen Teil 3 — Globales Verstehen (E-Mails)',
    objective:
      'Den globalen Inhalt mehrerer kurzer E-Mails / Nachrichten zuordnen.',
    strategy: [
      'Betreff und ersten Satz lesen — oft reicht das für das Thema.',
      'Absender und Absicht erkennen (Frage, Bitte, Info, Absage).',
      'Doppelte Themen vergleichen: Was unterscheidet die E-Mails?',
    ],
    traps: [
      'Zwei E-Mails zum gleichen Thema — die Nuance (Termin vs. Absage) übersehen.',
      'Zu lange im Detail lesen und die Zeit verlieren.',
    ],
    practiceHint: 'Danach: Lesen Teil 3 zügig (Überfliegen) üben.',
  },
  {
    skill: 'hoeren',
    teil: 1,
    title: 'Hören Teil 1 — Kurze Alltagsgespräche',
    objective: 'Wichtige Informationen in kurzen Dialogen verstehen.',
    strategy: [
      'Vor dem Hören die Frage lesen — wissen, worauf du hörst.',
      'Beim ersten Hören Überblick, beim zweiten Detail prüfen.',
      'Auf Ort, Zeit, Preis und Absicht achten.',
    ],
    traps: [
      'Die erste genannte Option ist oft ein Ablenker.',
      'Ähnliche Zahlen oder Uhrzeiten verwechseln.',
    ],
    practiceHint: 'Danach: Hören Teil 1 mit genau zwei Durchläufen üben.',
  },
  {
    skill: 'hoeren',
    teil: 2,
    title: 'Hören Teil 2 — Längeres Gespräch',
    objective:
      'Details in einem längeren (oft beruflichen) Gespräch verstehen.',
    strategy: [
      'Fragen vorher scannen und Stichworte notieren.',
      'Dem Gesprächsverlauf folgen (Wer will was?).',
      'Antworten erst nach dem zweiten Hören endgültig festlegen.',
    ],
    traps: [
      'Eine Person korrigiert sich später — die erste Aussage zählt nicht.',
      'Zu früh ankreuzen und dann nicht mehr korrigieren.',
    ],
    practiceHint: 'Danach: Hören Teil 2 ohne Pause zwischen den Durchläufen.',
  },
  {
    skill: 'hoeren',
    teil: 3,
    title: 'Hören Teil 3 — Ansagen & Meinungen',
    objective:
      'Globale und selektive Infos in Ansagen bzw. Meinungen zu einem Thema verstehen.',
    strategy: [
      'Auf Signalwörter hören (zuerst, dann, wichtig, leider…).',
      'Meinungen: Wer ist dafür / dagegen / unsicher?',
      'Bei Ansagen: Was muss man tun? Bis wann?',
    ],
    traps: [
      'Hintergrundgeräusche und schnelles Sprechen — ruhig bleiben, Schlüsselwörter halten.',
      'Eigene Meinung statt der Meinung im Audio wählen.',
    ],
    practiceHint: 'Danach: Hören Teil 3 mit Notizen nur in Stichworten.',
  },
  {
    skill: 'sprachbausteine',
    teil: 1,
    title: 'Sprachbausteine Teil 1 — Grammatik',
    objective: 'Passende grammatische Formen in einem Text einsetzen.',
    strategy: [
      'Den ganzen Satz lesen — Subjekt, Zeit, Kasus prüfen.',
      'Endungen und Artikel bewusst wählen (Nominativ/Akkusativ/Dativ).',
      'Konnektoren und Verbposition beachten.',
    ],
    traps: [
      'Ein Wort, das inhaltlich passt, aber grammatisch falsch ist.',
      'Zu schnell entscheiden, ohne den ganzen Satz zu lesen.',
    ],
    practiceHint: 'Danach: Sprachbausteine Teil 1 langsam, Satz für Satz.',
  },
  {
    skill: 'sprachbausteine',
    teil: 2,
    title: 'Sprachbausteine Teil 2 — Lexik / Textbausteine',
    objective: 'Passende Wörter und Wendungen im Kontext wählen.',
    strategy: [
      'Kollokationen und feste Ausdrücke suchen (z. B. „eine Entscheidung treffen“).',
      'Register prüfen: formell vs. alltagssprachlich.',
      'Nach dem Einsetzen den ganzen Text noch einmal lesen.',
    ],
    traps: [
      'Synonyme, die im Kontext die falsche Bedeutung haben.',
      'Falsche Präposition bei Verben und Nomen.',
    ],
    practiceHint:
      'Danach: Sprachbausteine Teil 2 mit Fokus auf feste Wendungen.',
  },
  {
    skill: 'schreiben',
    teil: 1,
    title: 'Schreiben — Leitpunkte & Register',
    objective:
      'Alle Leitpunkte angemessen bearbeiten und ein passendes E-Mail-/Briefregister nutzen.',
    strategy: [
      '2 Minuten Vorbereitung: Reihenfolge der Leitpunkte, Betreff, Anrede, Einleitung, Schluss.',
      'Jeden Leitpunkt mit 1–2 Sätzen klar abdecken.',
      'Formell bleiben: Siezen, klarer Betreff, höflicher Schluss.',
    ],
    traps: [
      'Einen Leitpunkt vergessen → schwache Aufgabenbewältigung.',
      'Zu informell schreiben oder ohne Anrede/Schluss.',
    ],
    practiceHint: 'Danach: Schreiben mit Vorbereitungstimer (2 Min.) üben.',
  },
  {
    skill: 'sprechen',
    teil: 1,
    title: 'Sprechen Teil 1 — Einander kennenlernen',
    objective: 'Sich vorstellen und auf Anschlussfragen natürlich reagieren.',
    strategy: [
      'Kurz und klar: Name, Herkunft, Beruf/Studium, Hobbys.',
      'Fragen mit Beispielen beantworten, nicht nur mit Ja/Nein.',
      'Dem Partner zuhören und nachfragen.',
    ],
    traps: [
      'Auswendig gelernte Monologe ohne auf Fragen zu reagieren.',
      'Zu leise oder zu schnell sprechen.',
    ],
    practiceHint: 'Danach: Sprechen Teil 1 mit Elena oder einem Partner üben.',
  },
  {
    skill: 'sprechen',
    teil: 2,
    title: 'Sprechen Teil 2 — Über ein Thema sprechen',
    objective: 'Meinung äußern, begründen und Beispiele geben.',
    strategy: [
      'Struktur: Meinung → Grund → Beispiel → kurzer Schluss.',
      'Wendungen nutzen: „Meiner Meinung nach…“, „Zum Beispiel…“.',
      'Dem Partner Raum geben und auf Argumente eingehen.',
    ],
    traps: [
      'Nur behaupten ohne Begründung.',
      'Vom Thema abschweifen oder den Partner unterbrechen.',
    ],
    practiceHint: 'Danach: Sprechen Teil 2 zu einem Modelltest-Thema.',
  },
  {
    skill: 'sprechen',
    teil: 3,
    title: 'Sprechen Teil 3 — Gemeinsam etwas planen',
    objective:
      'Zusammen eine Aktivität planen und sich einigen (kein Streitgespräch).',
    strategy: [
      'Vorschläge machen und Alternativen nennen („Wir könnten…“).',
      'Auf Zeit, Ort, Kosten und nächste Schritte achten.',
      'Am Ende klar zusammenfassen, worauf ihr euch geeinigt habt.',
    ],
    traps: [
      'Einen Debatten-Stil führen statt zu planen.',
      'Alles allein entscheiden, ohne den Partner einzubeziehen.',
    ],
    practiceHint: 'Danach: Sprechen Teil 3 als gemeinsames Planen üben.',
  },
];
