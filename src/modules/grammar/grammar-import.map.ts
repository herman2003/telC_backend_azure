/**
 * Maps German Language API (rep12) grammar rows into our DB shape.
 * Used by the offline import script — not at request time.
 */

export interface Rep12GrammarRule {
  id: string;
  category_code?: string;
  category_name: string;
  subcategory?: string;
  rule_german: string;
  rule_english: string;
  example_de?: string;
  example_en?: string;
  notes?: string;
  cefr_levels?: string[];
  tags?: string[];
}

export interface MappedGrammarTopic {
  slug: string;
  category: string;
  titleDe: string;
  titleFr: string;
  titleEn: string;
  cefrLevels: string[];
  ruleDe: string;
  ruleFr: string;
  ruleEn: string;
  notesFr: string | null;
  externalId: string;
  sortOrder: number;
  example: { de: string; en: string | null; fr: string | null } | null;
}

/** Stable URL-safe slug from external id + subcategory. */
export function slugFromRep12(rule: Rep12GrammarRule): string {
  const base = (rule.subcategory || rule.category_name || rule.id)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const idPart = rule.id.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
  return `${base || 'topic'}-${idPart}`.slice(0, 120);
}

export function mapRep12GrammarRule(
  rule: Rep12GrammarRule,
  sortOrder: number,
): MappedGrammarTopic {
  const titleDe = rule.subcategory?.trim() || rule.category_name;
  const titleEn = titleDe;
  // V1: FR mirrors EN until a translation batch exists.
  const titleFr = titleEn;
  const ruleEn = rule.rule_english;
  const example =
    rule.example_de && rule.example_de.trim().length > 0
      ? {
          de: rule.example_de.trim(),
          en: rule.example_en?.trim() || null,
          fr: rule.example_en?.trim() || null,
        }
      : null;

  return {
    slug: slugFromRep12(rule),
    category: rule.category_name,
    titleDe,
    titleFr,
    titleEn,
    cefrLevels: (rule.cefr_levels ?? []).map((l) => l.toUpperCase()),
    ruleDe: rule.rule_german,
    ruleFr: ruleEn,
    ruleEn,
    notesFr: rule.notes?.trim() || null,
    externalId: rule.id,
    sortOrder,
    example,
  };
}
