import {
  buildTopicEnrichUpdate,
  mergeGrammarExamples,
  type ExistingGrammarTopic,
  type GrammarEnrichLesson,
} from './grammar-enrich.merge';

const existing: ExistingGrammarTopic = {
  slug: 'nominativ-gram-a-001',
  title_de: 'Nominativ',
  title_fr: 'Nominatif court',
  title_en: 'Nominative short',
  rule_de: 'Kurz',
  rule_fr: 'Court',
  rule_en: 'Short',
  notes_fr: null,
  notes_en: null,
  notes_de: null,
  examples: [
    {
      id: 'ex-1',
      de: 'Der Hund bellt.',
      fr: null,
      en: 'The dog barks.',
    },
  ],
};

const lesson: GrammarEnrichLesson = {
  slug: 'nominativ-gram-a-001',
  titleFr: 'Le nominatif',
  titleEn: 'The nominative',
  titleDe: 'Der Nominativ (autre)',
  ruleFr: 'Longue règle FR…',
  ruleEn: 'Long rule EN…',
  ruleDe: 'Lange Regel DE…',
  notesFr: 'Astuce FR',
  notesEn: 'Tip EN',
  notesDe: 'Tipp DE',
  examples: [
    {
      de: 'Der Hund bellt.',
      fr: 'Le chien aboie.',
      en: 'The dog barks.',
    },
    {
      de: 'Die Frau liest.',
      fr: 'La femme lit.',
      en: 'The woman reads.',
    },
  ],
};

describe('buildTopicEnrichUpdate', () => {
  it('applies FR/EN/DE long rules and notes; preserves existing title_de', () => {
    const update = buildTopicEnrichUpdate(existing, lesson);
    expect(update.title_de).toBe('Nominativ');
    expect(update.title_fr).toBe('Le nominatif');
    expect(update.title_en).toBe('The nominative');
    expect(update.rule_fr).toBe('Longue règle FR…');
    expect(update.rule_en).toBe('Long rule EN…');
    expect(update.rule_de).toBe('Lange Regel DE…');
    expect(update.notes_fr).toBe('Astuce FR');
    expect(update.notes_en).toBe('Tip EN');
    expect(update.notes_de).toBe('Tipp DE');
  });

  it('uses enrichment titleDe only when existing title_de empty', () => {
    const update = buildTopicEnrichUpdate(
      { ...existing, title_de: '   ' },
      lesson,
    );
    expect(update.title_de).toBe('Der Nominativ (autre)');
  });
});

describe('mergeGrammarExamples', () => {
  it('updates glosses without changing existing de; creates new de rows', () => {
    const plan = mergeGrammarExamples(existing.examples, lesson.examples);
    expect(plan.updates).toEqual([
      {
        id: 'ex-1',
        fr: 'Le chien aboie.',
        en: 'The dog barks.',
      },
    ]);
    expect(plan.creates).toEqual([
      {
        de: 'Die Frau liest.',
        fr: 'La femme lit.',
        en: 'The woman reads.',
      },
    ]);
  });

  it('keeps existing gloss when incoming gloss empty', () => {
    const plan = mergeGrammarExamples(existing.examples, [
      { de: 'Der Hund bellt.', fr: null, en: null },
    ]);
    expect(plan.updates[0]).toEqual({
      id: 'ex-1',
      fr: null,
      en: 'The dog barks.',
    });
    expect(plan.creates).toEqual([]);
  });
});
