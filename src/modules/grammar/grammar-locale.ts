import { shortExplanation } from './grammar-exercise-templates';

export const GRAMMAR_LANGS = ['fr', 'en', 'de'] as const;
export type GrammarLang = (typeof GRAMMAR_LANGS)[number];
export const DEFAULT_GRAMMAR_LANG: GrammarLang = 'fr';

export function parseGrammarLang(raw?: string | null): GrammarLang {
  if (raw == null || raw === '') return DEFAULT_GRAMMAR_LANG;
  const normalized = raw.trim().toLowerCase();
  if ((GRAMMAR_LANGS as readonly string[]).includes(normalized)) {
    return normalized as GrammarLang;
  }
  return DEFAULT_GRAMMAR_LANG;
}

export type GrammarTopicLocaleSource = {
  title_de: string;
  title_fr: string;
  title_en: string | null;
  rule_de: string;
  rule_fr: string;
  rule_en: string | null;
  notes_fr: string | null;
  notes_en?: string | null;
  notes_de?: string | null;
  examples: Array<{
    de: string;
    fr: string | null;
    en: string | null;
  }>;
};

export type LocalizedGrammarTopicFields = {
  lang: GrammarLang;
  title: string;
  rule: string;
  notes: string | null;
  examples: Array<{ de: string; gloss: string | null }>;
};

function pickWithFallback(
  primary: string | null | undefined,
  fallback: string,
): string {
  const trimmed = primary?.trim();
  return trimmed ? trimmed : fallback;
}

function pickNotes(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string | null {
  const trimmed = primary?.trim();
  if (trimmed) return trimmed;
  const fb = fallback?.trim();
  return fb ? fb : null;
}

/**
 * Localizes lesson fields for the course UI.
 * Example sentence stays German (`de`); gloss follows `lang` (null for `de`).
 */
export function localizeGrammarTopic(
  topic: GrammarTopicLocaleSource,
  lang: GrammarLang,
): LocalizedGrammarTopicFields {
  switch (lang) {
    case 'fr':
      return {
        lang,
        title: topic.title_fr,
        rule: topic.rule_fr,
        notes: topic.notes_fr,
        examples: topic.examples.map((e) => ({
          de: e.de,
          gloss: e.fr,
        })),
      };
    case 'en':
      return {
        lang,
        title: pickWithFallback(topic.title_en, topic.title_fr),
        rule: pickWithFallback(topic.rule_en, topic.rule_fr),
        notes: pickNotes(topic.notes_en, topic.notes_fr),
        examples: topic.examples.map((e) => ({
          de: e.de,
          gloss: e.en ?? e.fr,
        })),
      };
    case 'de':
      return {
        lang,
        title: topic.title_de,
        rule: topic.rule_de,
        notes: pickNotes(topic.notes_de, topic.notes_fr),
        examples: topic.examples.map((e) => ({
          de: e.de,
          gloss: null,
        })),
      };
    default: {
      const _exhaustive: never = lang;
      return _exhaustive;
    }
  }
}

export type GrammarExerciseLocaleSource = {
  prompt_fr: string;
  prompt_en?: string | null;
  prompt_de?: string | null;
  explanation_fr?: string | null;
  explanation_en?: string | null;
  explanation_de?: string | null;
};

export type LocalizedGrammarExerciseFields = {
  prompt: string;
  explanation: string | null;
};

/**
 * Localizes exercise prompt + explanation for practice / of-the-day UI.
 * Falls back to French when the requested language is missing.
 */
export function localizeExercise(
  exo: GrammarExerciseLocaleSource,
  lang: GrammarLang,
  topic?: Pick<GrammarTopicLocaleSource, 'rule_fr' | 'rule_en' | 'rule_de'>,
): LocalizedGrammarExerciseFields {
  // Repair legacy generated summaries without changing authored corrections or
  // requiring a destructive regeneration of exercise IDs and student progress.
  const completeExplanation = (value: string | null): string | null => {
    if (!topic || !value) return value;
    const rule =
      lang === 'de' && exo.explanation_de?.trim()
        ? topic.rule_de
        : lang === 'en' && exo.explanation_en?.trim()
          ? pickWithFallback(topic.rule_en, topic.rule_fr)
          : topic.rule_fr;
    const legacy = shortExplanation(rule);
    if (value === legacy || value.startsWith(`${legacy}\n\n`)) {
      return rule.trim() + value.slice(legacy.length);
    }
    return value;
  };
  switch (lang) {
    case 'fr':
      return {
        prompt: exo.prompt_fr,
        explanation: completeExplanation(pickNotes(exo.explanation_fr, null)),
      };
    case 'en':
      return {
        prompt: pickWithFallback(exo.prompt_en, exo.prompt_fr),
        explanation: completeExplanation(
          pickNotes(exo.explanation_en, exo.explanation_fr),
        ),
      };
    case 'de':
      return {
        prompt: pickWithFallback(exo.prompt_de, exo.prompt_fr),
        explanation: completeExplanation(
          pickNotes(exo.explanation_de, exo.explanation_fr),
        ),
      };
    default: {
      const _exhaustive: never = lang;
      return _exhaustive;
    }
  }
}
