/**
 * Parse German lemma senses from French Wiktionary (MediaWiki API).
 * Free / CC BY-SA — native French glosses + DE examples with FR gloss.
 */

export type FrWiktionarySense = {
  meaningFr: string;
  exampleDe: string | null;
  exampleFr: string | null;
};

const MAX = 5;

export function parseFrWiktionaryGermanSenses(
  wikitext: string,
  posHint?: string,
): FrWiktionarySense[] {
  const section = extractGermanPosSectionFr(wikitext, posHint);
  if (!section) return [];

  const senses: FrWiktionarySense[] = [];
  const lines = section.split('\n');
  let current: FrWiktionarySense | null = null;

  for (const line of lines) {
    const senseMatch = line.match(/^#\s+(.+)$/);
    if (
      senseMatch &&
      !line.startsWith('#:') &&
      !line.startsWith('#*') &&
      !line.startsWith('#;')
    ) {
      const meaningFr = cleanFrWikitext(senseMatch[1]);
      if (!meaningFr || isJunkFrSense(meaningFr)) {
        current = null;
        continue;
      }
      current = { meaningFr, exampleDe: null, exampleFr: null };
      senses.push(current);
      if (senses.length >= MAX) break;
      continue;
    }

    if (current && !current.exampleDe) {
      const ex = parseExempleTemplate(line);
      if (ex) {
        current.exampleDe = ex.exampleDe;
        current.exampleFr = ex.exampleFr;
      }
    }
  }

  return senses.filter((s) => s.meaningFr.length >= 2);
}

function extractGermanPosSectionFr(
  wikitext: string,
  posHint?: string,
): string | null {
  const deStart = wikitext.search(/^==\s*\{\{langue\|de\}\}\s*==\s*$/m);
  if (deStart < 0) return null;
  const rest = wikitext.slice(deStart);
  const nextLang = rest.search(/\n==\s*\{\{langue\|(?!de)[^}]+\}\}\s*==\s*$/m);
  const german = nextLang > 0 ? rest.slice(0, nextLang) : rest;

  for (const pos of posKeysFr(posHint)) {
    const re = new RegExp(
      `^===\\s*\\{\\{S\\|${pos}\\|de\\}\\}\\s*===\\s*$`,
      'im',
    );
    const m = german.match(re);
    if (!m || m.index == null) continue;
    const from = m.index + m[0].length;
    const after = german.slice(from);
    const end = after.search(/^===\s*\{\{S\|/m);
    return end >= 0 ? after.slice(0, end) : after;
  }

  // Fallback: first S|…|de under German
  const any = german.match(/^===\s*\{\{S\|[^}|]+\|de\}\}\s*===\s*$/im);
  if (!any || any.index == null) return null;
  const from = any.index + any[0].length;
  const after = german.slice(from);
  const end = after.search(/^===\s*\{\{S\|/m);
  return end >= 0 ? after.slice(0, end) : after;
}

function posKeysFr(posHint?: string): string[] {
  switch ((posHint ?? '').toLowerCase()) {
    case 'verb':
      return ['verbe'];
    case 'noun':
      return ['nom'];
    case 'adj':
    case 'adjective':
      return ['adjectif'];
    case 'adv':
    case 'adverb':
      return ['adverbe'];
    case 'prep':
    case 'preposition':
      return ['préposition', 'preposition'];
    default:
      return ['verbe', 'nom', 'adjectif', 'adverbe', 'préposition'];
  }
}

/** `#* {{exemple | lang=de | … | sens=…}}` */
function parseExempleTemplate(
  line: string,
): { exampleDe: string; exampleFr: string | null } | null {
  if (!/\{\{exemple/i.test(line)) return null;
  // Flatten pipes; capture content after lang=de and optional sens=
  const langDe = line.match(
    /\{\{exemple\s*\|[^}]*?lang\s*=\s*de\s*\|([^}]*)\}\}/i,
  );
  if (!langDe) return null;
  const inner = langDe[1] ?? '';
  const sensMatch = inner.match(/\|\s*sens\s*=\s*([^|]*)/i);
  const exampleFr = sensMatch ? cleanFrWikitext(sensMatch[1]) : null;
  // First pipe segment before sens= / other named params is the DE sentence
  const dePart = inner.split('|').find((p) => {
    const t = p.trim();
    return t && !/^\w+\s*=/.test(t);
  });
  if (!dePart) return null;
  const exampleDe = cleanFrWikitext(dePart);
  if (!exampleDe) return null;
  return { exampleDe, exampleFr };
}

function cleanFrWikitext(s: string): string {
  return s
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/^[,;\s.]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkFrSense(meaningFr: string): boolean {
  const g = meaningFr.toLowerCase();
  return g.length < 2 || /\b(conjugaison|participe|gérondif|flexion)\b/.test(g);
}

export type FrWiktionaryApiParse = {
  parse?: { wikitext?: { ['*']?: string }; title?: string };
  error?: { code?: string };
};

export function sensesFromFrWiktionaryParse(
  json: FrWiktionaryApiParse,
  posHint?: string,
): FrWiktionarySense[] {
  const wt = json.parse?.wikitext?.['*'];
  if (!wt) return [];
  return parseFrWiktionaryGermanSenses(wt, posHint);
}
