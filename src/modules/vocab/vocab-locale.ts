/**
 * Vocab UI language — same contract as grammar (`?lang=fr|en|de`, default fr).
 */

export const VOCAB_LANGS = ['fr', 'en', 'de'] as const;
export type VocabLang = (typeof VOCAB_LANGS)[number];
export const DEFAULT_VOCAB_LANG: VocabLang = 'fr';

export function parseVocabLang(raw?: string | null): VocabLang {
  if (raw == null || raw === '') return DEFAULT_VOCAB_LANG;
  const normalized = raw.trim().toLowerCase();
  if ((VOCAB_LANGS as readonly string[]).includes(normalized)) {
    return normalized as VocabLang;
  }
  return DEFAULT_VOCAB_LANG;
}

export type VocabSenseLocaleSource = {
  meaning_fr: string;
  meaning_en: string | null;
  example_de: string;
  example_fr: string | null;
  example_en: string | null;
  note_fr: string | null;
  note_en: string | null;
};

export type LocalizedVocabSenseFields = {
  /** Gloss for UI language; null when lang=de (lemma/examples are already German). */
  meaning: string | null;
  /** Localized example gloss; example sentence stays in `exampleDe`. */
  exampleGloss: string | null;
  note: string | null;
};

function pickWithFallback(
  primary: string | null | undefined,
  fallback: string,
): string {
  const trimmed = primary?.trim();
  return trimmed ? trimmed : fallback;
}

function pickOptional(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const trimmed = primary?.trim();
  if (trimmed) return trimmed;
  const fb = fallback?.trim();
  return fb ? fb : null;
}

/**
 * Localizes sense gloss fields for the course UI.
 * German example sentence stays in `example_de` (mapped separately as exampleDe).
 */
export function localizeVocabSense(
  sense: VocabSenseLocaleSource,
  lang: VocabLang,
): LocalizedVocabSenseFields {
  switch (lang) {
    case 'fr':
      return {
        meaning: sense.meaning_fr,
        exampleGloss: sense.example_fr,
        note: sense.note_fr,
      };
    case 'en':
      return {
        meaning: pickWithFallback(sense.meaning_en, sense.meaning_fr),
        exampleGloss: pickOptional(sense.example_en, sense.example_fr),
        note: pickOptional(sense.note_en, sense.note_fr),
      };
    case 'de':
      return {
        meaning: null,
        exampleGloss: null,
        note: null,
      };
    default: {
      const _exhaustive: never = lang;
      return _exhaustive;
    }
  }
}
