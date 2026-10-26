import {
  DEFAULT_VOCAB_LANG,
  localizeVocabSense,
  parseVocabLang,
} from './vocab-locale';

const sense = {
  meaning_fr: 'demande',
  meaning_en: 'application',
  example_de: 'Ich stelle einen Antrag.',
  example_fr: 'Je dépose une demande.',
  example_en: 'I submit an application.',
  note_fr: 'formel',
  note_en: 'formal',
};

describe('parseVocabLang', () => {
  it('defaults to fr', () => {
    expect(parseVocabLang(undefined)).toBe(DEFAULT_VOCAB_LANG);
    expect(parseVocabLang('')).toBe('fr');
    expect(parseVocabLang('xx')).toBe('fr');
  });

  it('accepts fr|en|de case-insensitive', () => {
    expect(parseVocabLang('EN')).toBe('en');
    expect(parseVocabLang('de')).toBe('de');
  });
});

describe('localizeVocabSense', () => {
  it('returns FR fields for lang=fr', () => {
    expect(localizeVocabSense(sense, 'fr')).toEqual({
      meaning: 'demande',
      exampleGloss: 'Je dépose une demande.',
      note: 'formel',
    });
  });

  it('returns EN with FR fallback', () => {
    expect(
      localizeVocabSense(
        {
          ...sense,
          meaning_en: null,
          example_en: null,
          note_en: null,
        },
        'en',
      ),
    ).toEqual({
      meaning: 'demande',
      exampleGloss: 'Je dépose une demande.',
      note: 'formel',
    });
  });

  it('returns null glosses for lang=de', () => {
    expect(localizeVocabSense(sense, 'de')).toEqual({
      meaning: null,
      exampleGloss: null,
      note: null,
    });
  });
});
