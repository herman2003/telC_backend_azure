/**
 * Build easy / medium / hard exercises from a topic example (no Gemini).
 */

export interface GeneratedExercise {
  kind: 'mcq' | 'cloze';
  difficulty: 'easy' | 'medium' | 'hard';
  sort_order: number;
  prompt_de: string | null;
  prompt_fr: string;
  options_json: string[] | null;
  answer: string;
  explanation_fr: string;
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

export function generateExercisesFromExample(input: {
  titleFr: string;
  ruleFr: string;
  exampleDe: string;
  exampleEn: string | null;
}): GeneratedExercise[] {
  const { titleFr, ruleFr, exampleDe, exampleEn } = input;
  const words = exampleDe.split(/\s+/).filter((w) => w.length > 2);
  const target =
    words[Math.min(1, words.length - 1)]?.replace(/[.,!?]/g, '') ||
    exampleDe.slice(0, 12);
  const cloze = exampleDe.replace(target, '_____');

  const easyOptions = scrambleOptions(exampleEn || titleFr, [
    'Incorrect option A',
    'Incorrect option B',
    titleFr === (exampleEn || titleFr) ? 'Autre sens' : titleFr,
  ]);

  return [
    {
      kind: 'mcq',
      difficulty: 'easy',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: `Que signifie l’exemple : « ${exampleDe} » ?`,
      options_json: easyOptions,
      answer: exampleEn || titleFr,
      explanation_fr: ruleFr,
    },
    {
      kind: 'cloze',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: cloze,
      prompt_fr: `Complète : ${cloze}`,
      options_json: null,
      answer: target,
      explanation_fr: ruleFr,
    },
    {
      kind: 'mcq',
      difficulty: 'hard',
      sort_order: 0,
      prompt_de: exampleDe,
      prompt_fr: `Quel thème grammatical correspond à « ${exampleDe} » ?`,
      options_json: scrambleOptions(titleFr, [
        'Passiv',
        'Konjunktiv I',
        'Partizip II',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
    },
  ];
}

/** Minimal fallback when a topic has no example sentence. */
export function generateMinimalExercises(input: {
  titleFr: string;
  ruleFr: string;
}): GeneratedExercise[] {
  const { titleFr, ruleFr } = input;
  return [
    {
      kind: 'mcq',
      difficulty: 'easy',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: `Quel est le thème de cette leçon ?`,
      options_json: scrambleOptions(titleFr, [
        'Artikel',
        'Präposition',
        'Adjektiv',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
    },
    {
      kind: 'mcq',
      difficulty: 'medium',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: `La règle « ${ruleFr.slice(0, 80)}… » traite de :`,
      options_json: scrambleOptions(titleFr, ['Tempus', 'Modus', 'Numerus']),
      answer: titleFr,
      explanation_fr: ruleFr,
    },
    {
      kind: 'mcq',
      difficulty: 'hard',
      sort_order: 0,
      prompt_de: null,
      prompt_fr: `Identifie le sujet grammatical : ${titleFr}`,
      options_json: scrambleOptions(titleFr, [
        'Syntax',
        'Phonetik',
        'Orthografie',
      ]),
      answer: titleFr,
      explanation_fr: ruleFr,
    },
  ];
}
