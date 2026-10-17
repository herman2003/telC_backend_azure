import {
  DEFAULT_GRAMMAR_LANG,
  localizeExercise,
  localizeGrammarTopic,
  parseGrammarLang,
  type GrammarExerciseLocaleSource,
  type GrammarTopicLocaleSource,
} from './grammar-locale';

const sample: GrammarTopicLocaleSource = {
  title_de: 'Nominativ',
  title_fr: 'Nominatif',
  title_en: 'Nominative',
  rule_de: 'Regel DE lang',
  rule_fr: 'Règle FR longue',
  rule_en: 'Rule EN long',
  notes_fr: 'Note FR',
  notes_en: 'Note EN',
  notes_de: 'Hinweis DE',
  examples: [
    {
      de: 'Der Hund bellt.',
      fr: 'Le chien aboie.',
      en: 'The dog barks.',
    },
  ],
};

describe('parseGrammarLang', () => {
  it('defaults to fr when missing or empty', () => {
    expect(parseGrammarLang(undefined)).toBe(DEFAULT_GRAMMAR_LANG);
    expect(parseGrammarLang(null)).toBe('fr');
    expect(parseGrammarLang('')).toBe('fr');
  });

  it('accepts fr, en, de (case-insensitive)', () => {
    expect(parseGrammarLang('fr')).toBe('fr');
    expect(parseGrammarLang('EN')).toBe('en');
    expect(parseGrammarLang('De')).toBe('de');
  });

  it('falls back to fr for unknown values', () => {
    expect(parseGrammarLang('es')).toBe('fr');
    expect(parseGrammarLang('deutsch')).toBe('fr');
  });
});

describe('localizeGrammarTopic', () => {
  it('returns French course fields and FR gloss by default path', () => {
    const loc = localizeGrammarTopic(sample, 'fr');
    expect(loc).toEqual({
      lang: 'fr',
      title: 'Nominatif',
      rule: 'Règle FR longue',
      notes: 'Note FR',
      examples: [{ de: 'Der Hund bellt.', gloss: 'Le chien aboie.' }],
    });
  });

  it('returns English course fields and EN gloss', () => {
    const loc = localizeGrammarTopic(sample, 'en');
    expect(loc.title).toBe('Nominative');
    expect(loc.rule).toBe('Rule EN long');
    expect(loc.notes).toBe('Note EN');
    expect(loc.examples[0].gloss).toBe('The dog barks.');
  });

  it('returns German course fields; example gloss is null', () => {
    const loc = localizeGrammarTopic(sample, 'de');
    expect(loc.title).toBe('Nominativ');
    expect(loc.rule).toBe('Regel DE lang');
    expect(loc.notes).toBe('Hinweis DE');
    expect(loc.examples[0]).toEqual({
      de: 'Der Hund bellt.',
      gloss: null,
    });
  });

  it('falls back EN title/rule to FR when EN missing', () => {
    const loc = localizeGrammarTopic(
      { ...sample, title_en: null, rule_en: null, notes_en: null },
      'en',
    );
    expect(loc.title).toBe('Nominatif');
    expect(loc.rule).toBe('Règle FR longue');
    expect(loc.notes).toBe('Note FR');
  });

  it('falls back EN gloss to FR when EN gloss missing', () => {
    const loc = localizeGrammarTopic(
      {
        ...sample,
        examples: [{ de: 'Ich gehe.', fr: 'Je vais.', en: null }],
      },
      'en',
    );
    expect(loc.examples[0].gloss).toBe('Je vais.');
  });

  it('falls back DE notes to FR when notes_de missing', () => {
    const loc = localizeGrammarTopic({ ...sample, notes_de: null }, 'de');
    expect(loc.notes).toBe('Note FR');
  });
});

const exerciseSample: GrammarExerciseLocaleSource = {
  prompt_fr: 'Complète : Der _____ bellt.',
  prompt_en: 'Complete: Der _____ bellt.',
  prompt_de: 'Ergänze: Der _____ bellt.',
  explanation_fr: 'Akkusatif',
  explanation_en: 'Accusative',
  explanation_de: 'Akkusativ',
};

describe('localizeExercise', () => {
  it('returns French prompt and explanation', () => {
    expect(localizeExercise(exerciseSample, 'fr')).toEqual({
      prompt: 'Complète : Der _____ bellt.',
      explanation: 'Akkusatif',
    });
  });

  it('returns English prompt and explanation', () => {
    expect(localizeExercise(exerciseSample, 'en')).toEqual({
      prompt: 'Complete: Der _____ bellt.',
      explanation: 'Accusative',
    });
  });

  it('returns German prompt and explanation', () => {
    expect(localizeExercise(exerciseSample, 'de')).toEqual({
      prompt: 'Ergänze: Der _____ bellt.',
      explanation: 'Akkusativ',
    });
  });

  it('falls back EN/DE prompt and explanation to FR when missing', () => {
    const sparse: GrammarExerciseLocaleSource = {
      prompt_fr: 'Prompt FR',
      prompt_en: null,
      prompt_de: null,
      explanation_fr: 'Explication FR',
      explanation_en: null,
      explanation_de: null,
    };
    expect(localizeExercise(sparse, 'en')).toEqual({
      prompt: 'Prompt FR',
      explanation: 'Explication FR',
    });
    expect(localizeExercise(sparse, 'de')).toEqual({
      prompt: 'Prompt FR',
      explanation: 'Explication FR',
    });
  });

  it('returns null explanation when all explanation fields empty', () => {
    expect(
      localizeExercise(
        {
          prompt_fr: 'Q',
          prompt_en: null,
          prompt_de: null,
          explanation_fr: null,
          explanation_en: null,
          explanation_de: null,
        },
        'fr',
      ).explanation,
    ).toBeNull();
  });
});
