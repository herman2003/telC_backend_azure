/**
 * Build easy / medium / hard exercises from a topic example (no Gemini).
 * Prompts and explanations are produced in FR / EN / DE for course UI lang.
 */

export interface GeneratedExercise {
  kind: 'mcq' | 'cloze';
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
  prompt_de: string | null;
  prompt_fr: string;
  prompt_en: string;
  options_json: string[] | null;
  answer: string;
  explanation_fr: string;
  explanation_en: string;
  explanation_de: string;
}

function scrambleOptions(correct: string, distractors: string[]): string[] {
  const pool = [correct, ...distractors.filter((d) => d && d !== correct)];
  // Stable shuffle from answer length so re-runs are deterministic per topic.
  const seed = correct.length + distractors.join('').length;
  return [...pool].sort((a, b) => {
    const ha = (a.charCodeAt(0) + seed) % 97;
    const hb = (b.charCodeAt(0) + seed) % 97;
    return ha - hb || a.localeCompare(b);
  });
}

function truncateRule(rule: string, max = 80): string {
  if (rule.length <= max) return rule;
  return `${rule.slice(0, max)}…`;
}

export function generateExercisesFromExample(input: {
  titleFr: string;
  titleEn: string | null;
  titleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  ruleDe: string;
  exampleDe: string;
  exampleEn: string | null;
}): GeneratedExercise[] {
  const { titleFr, ruleFr, ruleEn, ruleDe, exampleDe, exampleEn } = input;
  const ruleEnResolved = ruleEn?.trim() || ruleFr;

  const words = exampleDe.split(/\s+/).filter((w) => w.length > 2);
  const target =
    words[Math.min(1, words.length - 1)]?.replace(/[.,!?]/g, '') ||
    exampleDe.slice(0, 12);
  const cloze = exampleDe.replace(target, '_____');

  const easyAnswer = exampleEn || titleFr;
  const easyOptions = scrambleOptions(easyAnswer, [
    'Incorrect option A',
    'Incorrect option B',
    titleFr === easyAnswer ? 'Autre sens' : titleFr,
  ]);

  return [
    {
      kind: 'mcq',
      difficulty: 'easy',
      sort_order: 0,
      prompt_de: `Was bedeutet das Beispiel: « ${exampleDe} »?`,
      prompt_fr: `Que signifie l’exemple : « ${exampleDe} » ?`,
      prompt_en: `What does the example mean: « ${exampleDe} »?`,
      options_json: easyOptions,
      answer: easyAnswer,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
    {
      kind: 'cloze',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: `Ergänze: ${cloze}`,
      prompt_fr: `Complète : ${cloze}`,
      prompt_en: `Complete: ${cloze}`,
      options_json: null,
      answer: target,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
    {
      kind: 'mcq',
      difficulty: 'hard',
      sort_order: 0,
      prompt_de: `Welches Grammatikthema passt zu « ${exampleDe} »?`,
      prompt_fr: `Quel thème grammatical correspond à « ${exampleDe} » ?`,
      prompt_en: `Which grammar topic matches « ${exampleDe} »?`,
      options_json: scrambleOptions(titleFr, [
        'Passiv',
        'Konjunktiv I',
        'Partizip II',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
  ];
}

/** Minimal fallback when a topic has no example sentence. */
export function generateMinimalExercises(input: {
  titleFr: string;
  titleEn: string | null;
  titleDe: string;
  ruleFr: string;
  ruleEn: string | null;
  ruleDe: string;
}): GeneratedExercise[] {
  const { titleFr, titleEn, titleDe, ruleFr, ruleEn, ruleDe } = input;
  const titleEnResolved = titleEn?.trim() || titleFr;
  const ruleEnResolved = ruleEn?.trim() || ruleFr;
  const ruleFrShort = truncateRule(ruleFr);
  const ruleEnShort = truncateRule(ruleEnResolved);
  const ruleDeShort = truncateRule(ruleDe);

  return [
    {
      kind: 'mcq',
      difficulty: 'easy',
      sort_order: 0,
      prompt_de: `Was ist das Thema dieser Lektion?`,
      prompt_fr: `Quel est le thème de cette leçon ?`,
      prompt_en: `What is the topic of this lesson?`,
      options_json: scrambleOptions(titleFr, [
        'Artikel',
        'Präposition',
        'Adjektiv',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
    {
      kind: 'mcq',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: `Die Regel « ${ruleDeShort} » behandelt:`,
      prompt_fr: `La règle « ${ruleFrShort} » traite de :`,
      prompt_en: `The rule « ${ruleEnShort} » is about:`,
      options_json: scrambleOptions(titleFr, ['Tempus', 'Modus', 'Numerus']),
      answer: titleFr,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
    {
      kind: 'mcq',
      difficulty: 'hard',
      sort_order: 0,
      prompt_de: `Identifiziere das Grammatikthema: ${titleDe}`,
      prompt_fr: `Identifie le sujet grammatical : ${titleFr}`,
      prompt_en: `Identify the grammar topic: ${titleEnResolved}`,
      options_json: scrambleOptions(titleFr, [
        'Syntax',
        'Phonetik',
        'Orthografie',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
      explanation_en: ruleEnResolved,
      explanation_de: ruleDe,
    },
  ];
}
