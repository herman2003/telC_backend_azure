/**
 * Build German conjugation rows for VocabVerbForm (DE only).
 * Uses german-verbs + german-verbs-dict.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const GermanVerbsLib = require('german-verbs') as GermanVerbsApi;
const GermanVerbsDict = require('german-verbs-dict/dist/verbs.json') as Record<
  string,
  unknown
>;
/* eslint-enable @typescript-eslint/no-require-imports */

type PersonNumber = [person: 1 | 2 | 3, number: 'S' | 'P'];

interface GermanVerbsApi {
  getConjugation: (
    dict: Record<string, unknown>,
    verb: string,
    tense: string,
    person: number,
    number: string,
    aux?: string,
  ) => string[];
  getVerbInfo: (
    dict: Record<string, unknown>,
    verb: string,
  ) => VerbInfo | undefined;
  getPartizip2: (dict: Record<string, unknown>, verb: string) => string;
  alwaysUsesSein: (verb: string) => boolean;
}

interface VerbInfo {
  hasPrefix?: boolean;
  IMP?: { S?: string; P?: string };
  PA2?: string[];
  INF?: string;
}

/** Spec person keys (API / DB). */
export const CONJ_PERSONS = [
  'ich',
  'du',
  'er_sie_es',
  'wir',
  'ihr',
  'sie_Sie',
] as const;

export type ConjPerson = (typeof CONJ_PERSONS)[number];

export const CONJ_TENSES = [
  'praesens',
  'praeteritum',
  'perfekt',
  'konjunktiv_ii',
  'imperativ',
] as const;

export type ConjTense = (typeof CONJ_TENSES)[number];

const PERSON_MAP: Array<{ key: ConjPerson; pn: PersonNumber }> = [
  { key: 'ich', pn: [1, 'S'] },
  { key: 'du', pn: [2, 'S'] },
  { key: 'er_sie_es', pn: [3, 'S'] },
  { key: 'wir', pn: [1, 'P'] },
  { key: 'ihr', pn: [2, 'P'] },
  { key: 'sie_Sie', pn: [3, 'P'] },
];

const TENSE_LIB: Record<
  Exclude<ConjTense, 'imperativ'>,
  { lib: string; needsAux: boolean }
> = {
  praesens: { lib: 'PRASENS', needsAux: false },
  praeteritum: { lib: 'PRATERITUM', needsAux: false },
  perfekt: { lib: 'PERFEKT', needsAux: true },
  konjunktiv_ii: { lib: 'KONJUNKTIV2_PRATERITUM', needsAux: false },
};

export interface VerbFormRow {
  tense: ConjTense;
  person: string;
  form_de: string;
}

export interface ConjugationResult {
  rows: VerbFormRow[];
  auxiliary: 'haben' | 'sein';
  partizipIi: string | null;
  separable: boolean;
}

function normalizeLemma(lemma: string): {
  verb: string;
  reflexive: boolean;
} {
  const trimmed = lemma.trim().toLowerCase();
  const m = trimmed.match(/^sich\s+(.+)$/);
  if (m) return { verb: m[1].trim(), reflexive: true };
  return { verb: trimmed, reflexive: false };
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** True if lemma is in german-verbs-dict. */
export function hasVerbInDict(lemma: string): boolean {
  const { verb } = normalizeLemma(lemma);
  return Object.hasOwn(GermanVerbsDict, verb);
}

/** Longer first — used to recover base verb for sein/haben heuristic. */
const SEPARABLE_PREFIXES = [
  'auseinander',
  'gegenüber',
  'entgegen',
  'entlang',
  'zusammen',
  'herunter',
  'herauf',
  'hinaus',
  'herein',
  'hinauf',
  'hinunter',
  'vorbei',
  'weiter',
  'zurück',
  'fest',
  'teil',
  'statt',
  'über',
  'unter',
  'durch',
  'ab',
  'an',
  'auf',
  'aus',
  'bei',
  'ein',
  'mit',
  'nach',
  'vor',
  'zu',
  'weg',
  'hin',
  'her',
  'los',
  'um',
];

function baseAfterSeparablePrefix(verb: string): string | null {
  for (const p of SEPARABLE_PREFIXES) {
    if (verb.startsWith(p) && verb.length > p.length + 2) {
      return verb.slice(p.length);
    }
  }
  return null;
}

export function resolveAuxiliary(
  lemma: string,
  preferred?: string | null,
): 'haben' | 'sein' {
  if (preferred === 'sein' || preferred === 'haben') return preferred;
  const { verb } = normalizeLemma(lemma);
  try {
    if (GermanVerbsLib.alwaysUsesSein(verb)) return 'sein';
    const base = baseAfterSeparablePrefix(verb);
    if (base && GermanVerbsLib.alwaysUsesSein(base)) return 'sein';
  } catch {
    /* ignore */
  }
  return 'haben';
}

/**
 * Build all V1 conjugation cells for a German infinitive.
 * Returns null if the verb is not in the dictionary.
 */
export function buildConjugation(
  lemma: string,
  options?: { auxiliary?: string | null },
): ConjugationResult | null {
  const { verb } = normalizeLemma(lemma);
  if (!hasVerbInDict(verb)) return null;

  const info = GermanVerbsLib.getVerbInfo(GermanVerbsDict, verb);
  const auxiliary = resolveAuxiliary(verb, options?.auxiliary);
  const auxFlag = auxiliary === 'sein' ? 'SEIN' : 'HABEN';
  const separable = Boolean(info?.hasPrefix);

  let partizipIi: string | null = null;
  try {
    partizipIi = GermanVerbsLib.getPartizip2(GermanVerbsDict, verb) || null;
  } catch {
    partizipIi = info?.PA2?.[0] ?? null;
  }

  const rows: VerbFormRow[] = [];

  for (const tense of [
    'praesens',
    'praeteritum',
    'perfekt',
    'konjunktiv_ii',
  ] as const) {
    const meta = TENSE_LIB[tense];
    for (const { key, pn } of PERSON_MAP) {
      const [person, number] = pn;
      try {
        const parts = meta.needsAux
          ? GermanVerbsLib.getConjugation(
              GermanVerbsDict,
              verb,
              meta.lib,
              person,
              number,
              auxFlag,
            )
          : GermanVerbsLib.getConjugation(
              GermanVerbsDict,
              verb,
              meta.lib,
              person,
              number,
            );
        rows.push({ tense, person: key, form_de: joinParts(parts) });
      } catch {
        /* skip missing cell */
      }
    }
  }

  // Imperativ: du / ihr / Sie (no ich/wir/er)
  pushImperativeRows(rows, verb, info);

  if (rows.length === 0) return null;
  return { rows, auxiliary, partizipIi, separable };
}

function pushImperativeRows(
  rows: VerbFormRow[],
  verb: string,
  info: VerbInfo | undefined,
): void {
  const imp = info?.IMP;
  if (imp?.S) {
    rows.push({ tense: 'imperativ', person: 'du', form_de: imp.S });
  } else {
    // Separable verbs often lack IMP — use Präsens 1S (fahre ab)
    try {
      const parts = GermanVerbsLib.getConjugation(
        GermanVerbsDict,
        verb,
        'PRASENS',
        1,
        'S',
      );
      rows.push({
        tense: 'imperativ',
        person: 'du',
        form_de: joinParts(parts),
      });
    } catch {
      /* skip */
    }
  }

  if (imp?.P) {
    rows.push({ tense: 'imperativ', person: 'ihr', form_de: imp.P });
  } else {
    try {
      const parts = GermanVerbsLib.getConjugation(
        GermanVerbsDict,
        verb,
        'PRASENS',
        2,
        'P',
      );
      rows.push({
        tense: 'imperativ',
        person: 'ihr',
        form_de: joinParts(parts),
      });
    } catch {
      /* skip */
    }
  }

  try {
    const parts = GermanVerbsLib.getConjugation(
      GermanVerbsDict,
      verb,
      'PRASENS',
      3,
      'P',
    );
    if (parts.length === 2) {
      rows.push({
        tense: 'imperativ',
        person: 'Sie',
        form_de: `${parts[0]} Sie ${parts[1]}`,
      });
    } else {
      rows.push({
        tense: 'imperativ',
        person: 'Sie',
        form_de: joinParts([...parts, 'Sie']),
      });
    }
  } catch {
    rows.push({ tense: 'imperativ', person: 'Sie', form_de: `${verb} Sie` });
  }
}
