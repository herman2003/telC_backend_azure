import {
  generateExercisesFromExample,
  generateExercisesFromExamples,
  generateMinimalExercises,
  germanFormDistractors,
  isPedagogicalExample,
  shortExplanation,
} from './grammar-exercise-templates';

describe('grammar-exercise-templates', () => {
  const base = {
    titleFr: 'Le nominatif',
    titleEn: 'The nominative',
    titleDe: 'Nominativ',
    ruleFr:
      '## Le nominatif\n\nLe **nominatif** marque le sujet. Posez Wer? / Was?',
    ruleEn:
      '## The nominative\n\nThe **nominative** marks the subject. Ask Wer? / Was?',
    ruleDe:
      '## Nominativ\n\nDer **Nominativ** bezeichnet das Subjekt. Frage: Wer? / Was?',
  };

  it('never emits Incorrect option placeholders', () => {
    const exercises = generateExercisesFromExamples({
      ...base,
      examples: [
        {
          de: 'Der Mann liest das Buch.',
          fr: 'L’homme lit.',
          en: 'The man reads.',
        },
        {
          de: 'Die Frau arbeitet in Berlin.',
          fr: 'La femme travaille.',
          en: 'The woman works.',
        },
        {
          de: 'Das Kind spielt im Garten.',
          fr: 'L’enfant joue.',
          en: 'The child plays.',
        },
      ],
      otherTitlesDe: ['Akkusativ', 'Dativ', 'Perfekt'],
    });

    for (const exo of exercises) {
      const blob = JSON.stringify(exo);
      expect(blob).not.toMatch(/Incorrect option/i);
      expect(exo.options_json?.length).toBeGreaterThanOrEqual(3);
      expect(exo.options_json).toContain(exo.answer);
    }
  });

  it('generates 10 easy / 15 medium / 20 hard exercises', () => {
    const exercises = generateExercisesFromExamples({
      ...base,
      examples: [
        { de: 'Der Mann liest das Buch.' },
        { de: 'Die Frau arbeitet in Berlin.' },
        { de: 'Das Kind spielt im Garten.' },
        { de: 'Ein Lehrer erklärt die Grammatik.' },
        { de: 'Die Studenten lernen Deutsch.' },
      ],
      otherTitlesDe: ['Akkusativ', 'Dativ', 'Perfekt'],
    });
    expect(exercises.filter((e) => e.difficulty === 'easy')).toHaveLength(10);
    expect(exercises.filter((e) => e.difficulty === 'medium')).toHaveLength(15);
    expect(exercises.filter((e) => e.difficulty === 'hard')).toHaveLength(20);
  });

  it('filters meta examples and keeps real sentences', () => {
    expect(isPedagogicalExample('Der Mann liest das Buch.', 'Nominativ')).toBe(
      true,
    );
    expect(
      isPedagogicalExample('Hier üben wir „Nominativ“ im Satz.', 'Nominativ'),
    ).toBe(false);
  });

  it('shortExplanation truncates long lesson text', () => {
    const tip = shortExplanation(base.ruleFr, 80);
    expect(tip.length).toBeLessThanOrEqual(80);
    expect(tip).not.toMatch(/^##/);
  });

  it('easy prompts are contextual, not only generic topic labels', () => {
    const exercises = generateExercisesFromExamples({
      ...base,
      examples: [{ de: 'Der Mann liest das Buch.' }],
    });
    const easy = exercises.filter((e) => e.difficulty === 'easy');
    expect(
      easy.some((e) =>
        /Artikel|Ergänze|Formulierung|Anfang/i.test(e.prompt_de ?? ''),
      ),
    ).toBe(true);
  });

  it('hard includes correction / error-spotting styles', () => {
    const hard = generateExercisesFromExamples({
      ...base,
      examples: [
        { de: 'Der Mann liest das Buch.' },
        { de: 'Die Frau arbeitet in Berlin.' },
      ],
      otherTitlesDe: ['Akkusativ'],
    }).filter((e) => e.difficulty === 'hard');
    expect(
      hard.some((e) =>
        /Fehler|Korrigiere|fehlerhaft|Corrige|Correct the/i.test(
          `${e.prompt_de} ${e.prompt_fr} ${e.prompt_en}`,
        ),
      ),
    ).toBe(true);
  });

  it('single-example wrapper still works', () => {
    const [easy] = generateExercisesFromExample({
      ...base,
      exampleDe: 'Der Mann liest das Buch.',
      exampleEn: 'The man reads the book.',
    });
    expect(easy.difficulty).toBe('easy');
    expect(easy.options_json).toContain(easy.answer);
  });

  it('germanFormDistractors produces distinct wrong sentences', () => {
    const correct = 'Der Mann liest das Buch.';
    const distractors = germanFormDistractors(correct);
    expect(distractors.length).toBeGreaterThanOrEqual(2);
    expect(distractors.every((d) => d !== correct)).toBe(true);
  });

  it('minimal exercises also avoid English placeholders', () => {
    const exercises = generateMinimalExercises({
      titleFr: 'Le passif',
      titleEn: 'The passive',
      titleDe: 'Passiv',
      ruleFr: 'Règle',
      ruleEn: 'Rule',
      ruleDe: 'Regel',
      otherTitlesDe: ['Aktiv', 'Perfekt'],
    });
    for (const exo of exercises) {
      expect(JSON.stringify(exo)).not.toMatch(/Incorrect option/i);
      expect(exo.answer).toBe('Passiv');
    }
    expect(exercises.filter((e) => e.difficulty === 'easy')).toHaveLength(10);
  });
});
