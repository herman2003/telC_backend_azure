/**
 * Parse German lemma senses from English Wiktionary (MediaWiki API).
 * Free / CC BY-SA — multi-sense + DE examples with EN glosses.
 */

export type WiktionarySense = {
  meaningEn: string;
  exampleDe: string | null;
  exampleEn: string | null;
};

const MAX = 5;

/**
 * Extract # sense lines under the German ===Verb=== / ===Noun=== … section.
 */
export function parseEnWiktionaryGermanSenses(
  wikitext: string,
  posHint?: string,
): WiktionarySense[] {
  const section = extractGermanPosSection(wikitext, posHint);
  if (!section) return [];

  const senses: WiktionarySense[] = [];
  const lines = section.split('\n');
  let current: WiktionarySense | null = null;

  for (const line of lines) {
    const senseMatch = line.match(/^#\s+(.+)$/);
    const uxMatch = line.match(/^#:\s*\{\{ux\|de\|([^|]+)\|([^}]*)\}\}/);
    // Also: #: {{uxi|de|...|...}}
    const uxiMatch =
      uxMatch || line.match(/^#:\s*\{\{uxi\|de\|([^|]+)\|([^}]*)\}\}/);

    if (senseMatch && !line.startsWith('#:') && !line.startsWith('#*')) {
      const meaningEn = cleanWikitext(senseMatch[1]);
      if (!meaningEn || isJunkSense(meaningEn)) {
        current = null;
        continue;
      }
      current = {
        meaningEn,
        exampleDe: null,
        exampleEn: null,
      };
      senses.push(current);
      if (senses.length >= MAX) break;
      continue;
    }

    if (uxiMatch && current && !current.exampleDe) {
      current.exampleDe = cleanWikitext(uxiMatch[1]);
      current.exampleEn = cleanWikitext(uxiMatch[2]) || null;
    }
  }

  return senses.filter((s) => s.meaningEn.length >= 2);
}

function extractGermanPosSection(
  wikitext: string,
  posHint?: string,
): string | null {
  const deStart = wikitext.search(/^==\s*German\s*==\s*$/m);
  if (deStart < 0) return null;
  const rest = wikitext.slice(deStart);
  const nextLang = rest.search(/\n==\s*[^=].*==\s*$/m);
  const german = nextLang > 0 ? rest.slice(0, nextLang) : rest;

  const posHeaders = posHeadersFor(posHint);
  for (const header of posHeaders) {
    const re = new RegExp(`^===\\s*${header}\\s*===\\s*$`, 'im');
    const m = german.match(re);
    if (!m || m.index == null) continue;
    const from = m.index + m[0].length;
    const after = german.slice(from);
    const end = after.search(/^===\s*[^=].*===\s*$/m);
    return end >= 0 ? after.slice(0, end) : after;
  }
  // Fallback: first ===…=== block under German
  const any = german.match(
    /^===\s*(Verb|Noun|Adjective|Adverb|Preposition)\s*===\s*$/im,
  );
  if (!any || any.index == null) return null;
  const from = any.index + any[0].length;
  const after = german.slice(from);
  const end = after.search(/^===\s*[^=].*===\s*$/m);
  return end >= 0 ? after.slice(0, end) : after;
}

function posHeadersFor(posHint?: string): string[] {
  switch ((posHint ?? '').toLowerCase()) {
    case 'verb':
      return ['Verb'];
    case 'noun':
      return ['Noun'];
    case 'adj':
    case 'adjective':
      return ['Adjective'];
    case 'adv':
    case 'adverb':
      return ['Adverb'];
    case 'prep':
    case 'preposition':
      return ['Preposition'];
    default:
      return ['Verb', 'Noun', 'Adjective', 'Adverb', 'Preposition'];
  }
}

function cleanWikitext(s: string): string {
  return s
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkSense(meaningEn: string): boolean {
  const g = meaningEn.toLowerCase();
  return (
    g.length < 2 || /\b(gerund|participle|conjugation|inflection)\b/.test(g)
  );
}

export type WiktionaryApiParse = {
  parse?: { wikitext?: { ['*']?: string } };
};

export function sensesFromWiktionaryParse(
  json: WiktionaryApiParse,
  posHint?: string,
): WiktionarySense[] {
  const wt = json.parse?.wikitext?.['*'];
  if (!wt) return [];
  return parseEnWiktionaryGermanSenses(wt, posHint);
}
