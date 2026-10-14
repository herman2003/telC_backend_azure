export type GrammarEnrichExample = {
  de: string;
  fr?: string | null;
  en?: string | null;
};

export type GrammarEnrichLesson = {
  slug: string;
  titleFr?: string;
  titleEn?: string;
  /** Optional; existing title_de is preserved when already set. */
  titleDe?: string;
  ruleFr: string;
  ruleEn: string;
  /** Long German lesson for germanophone UI (lang=de). */
  ruleDe: string;
  notesFr?: string | null;
  notesEn?: string | null;
  notesDe?: string | null;
  examples: GrammarEnrichExample[];
};

export type ExistingGrammarExample = {
  id: string;
  de: string;
  fr: string | null;
  en: string | null;
};

export type ExistingGrammarTopic = {
  slug: string;
  title_de: string;
  title_fr: string;
  title_en: string | null;
  rule_de: string;
  rule_fr: string;
  rule_en: string | null;
  notes_fr: string | null;
  notes_en: string | null;
  notes_de: string | null;
  examples: ExistingGrammarExample[];
};

export type GrammarTopicUpdatePayload = {
  title_fr: string;
  title_en: string | null;
  title_de: string;
  rule_fr: string;
  rule_en: string;
  rule_de: string;
  notes_fr: string | null;
  notes_en: string | null;
  notes_de: string | null;
};

export type GrammarExampleMergePlan = {
  /** Existing rows to patch (never changes `de`). */
  updates: Array<{ id: string; fr: string | null; en: string | null }>;
  /** New example sentences to insert. */
  creates: GrammarEnrichExample[];
};

function nonEmpty(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/**
 * Builds topic scalar update. Preserves existing title_de when already set.
 * Always applies long-form ruleFr/ruleEn/ruleDe and notes from enrichment.
 */
export function buildTopicEnrichUpdate(
  existing: ExistingGrammarTopic,
  lesson: GrammarEnrichLesson,
): GrammarTopicUpdatePayload {
  const keepTitleDe = nonEmpty(existing.title_de);
  return {
    title_fr: nonEmpty(lesson.titleFr) ?? existing.title_fr,
    title_en: nonEmpty(lesson.titleEn) ?? existing.title_en,
    title_de: keepTitleDe ?? nonEmpty(lesson.titleDe) ?? existing.title_de,
    rule_fr: lesson.ruleFr,
    rule_en: lesson.ruleEn,
    rule_de: lesson.ruleDe,
    notes_fr: nonEmpty(lesson.notesFr) ?? existing.notes_fr,
    notes_en: nonEmpty(lesson.notesEn) ?? existing.notes_en,
    notes_de: nonEmpty(lesson.notesDe) ?? existing.notes_de,
  };
}

/**
 * Merges examples by German sentence (`de`).
 * Never mutates existing `de`; fills/updates fr/en glosses; appends new `de`.
 */
export function mergeGrammarExamples(
  existing: ExistingGrammarExample[],
  incoming: GrammarEnrichExample[],
): GrammarExampleMergePlan {
  const byDe = new Map(
    existing.map((e) => [e.de.trim(), e] as const),
  );
  const updates: GrammarExampleMergePlan['updates'] = [];
  const creates: GrammarEnrichExample[] = [];

  for (const ex of incoming) {
    const de = ex.de?.trim();
    if (!de) continue;
    const found = byDe.get(de);
    if (found) {
      updates.push({
        id: found.id,
        fr: nonEmpty(ex.fr) ?? found.fr,
        en: nonEmpty(ex.en) ?? found.en,
      });
    } else {
      creates.push({
        de,
        fr: nonEmpty(ex.fr),
        en: nonEmpty(ex.en),
      });
      byDe.set(de, {
        id: `new-${de}`,
        de,
        fr: nonEmpty(ex.fr),
        en: nonEmpty(ex.en),
      });
    }
  }

  return { updates, creates };
}
