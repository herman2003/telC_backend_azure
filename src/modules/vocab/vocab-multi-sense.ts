/**
 * Multi-sense drafts from offline enrich (Gemini / dictionary JSON).
 * Sense #0 = most relevant to Modelltest context when provided.
 */

export type MultiSenseDraft = {
  meaningFr: string;
  meaningEn: string;
  exampleDe: string;
  exampleFr: string | null;
  exampleEn: string | null;
  noteFr: string | null;
};

const MAX_SENSES = 5;
const MIN_SENSES = 1;

function cleanStr(v: unknown, fallback = ''): string {
  if (typeof v !== 'string') return fallback;
  return v.trim();
}

function cleanNullable(v: unknown): string | null {
  const s = cleanStr(v);
  return s || null;
}

/**
 * Parse Gemini / tool JSON: `{ "senses": [ { meaningFr, meaningEn, exampleDe, ... } ] }`
 * or a bare array of sense objects.
 */
export function parseMultiSenseJson(raw: string): MultiSenseDraft[] | null {
  const text = raw.trim();
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  let rows: unknown[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { senses?: unknown }).senses)
  ) {
    rows = (parsed as { senses: unknown[] }).senses;
  } else {
    return null;
  }

  const out: MultiSenseDraft[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const meaningFr = cleanStr(r.meaningFr ?? r.meaning_fr);
    const meaningEn = cleanStr(r.meaningEn ?? r.meaning_en);
    const exampleDe = cleanStr(r.exampleDe ?? r.example_de);
    if (!meaningFr || !exampleDe) continue;
    // Drop morphology / conjugation noise from bad model outputs
    if (isMorphologyNoise(meaningFr) || isMorphologyNoise(meaningEn)) continue;
    out.push({
      meaningFr,
      meaningEn: meaningEn || meaningFr,
      exampleDe,
      exampleFr: cleanNullable(r.exampleFr ?? r.example_fr),
      exampleEn: cleanNullable(r.exampleEn ?? r.example_en),
      noteFr: cleanNullable(r.noteFr ?? r.note_fr),
    });
    if (out.length >= MAX_SENSES) break;
  }

  return out.length >= MIN_SENSES ? out : null;
}

/**
 * Move the sense that best matches the MT snippet to index 0.
 * Heuristic: shared tokens between context and exampleDe / meaningFr.
 */
export function orderSensesByContext(
  senses: MultiSenseDraft[],
  contextSnippet: string | null | undefined,
): MultiSenseDraft[] {
  if (!contextSnippet?.trim() || senses.length <= 1) return [...senses];

  const ctxTokens = tokenize(contextSnippet);
  if (ctxTokens.size === 0) return [...senses];

  let bestIdx = 0;
  let bestScore = -1;
  senses.forEach((s, i) => {
    const score = overlapScore(
      ctxTokens,
      tokenize(`${s.exampleDe} ${s.meaningFr}`),
    );
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  });

  if (bestIdx === 0 || bestScore <= 0) return [...senses];
  const copy = [...senses];
  const [best] = copy.splice(bestIdx, 1);
  return [best, ...copy];
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3),
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const t of a) {
    if (b.has(t)) n += 1;
  }
  return n;
}

/** Reject conjugation / grammar-meta "meanings". */
export function isMorphologyNoise(gloss: string): boolean {
  const g = gloss.toLowerCase();
  return (
    /\b(gerund|participle|infinitive|conjugat|declension|second-person|first-person|third-person|plural dependent|singular dependent|imperative form|present of|past of)\b/.test(
      g,
    ) || /\b(gérondif|participe|conjugu|personne du|forme de)\b/.test(g)
  );
}

export function needsMultiSenseEnrich(
  senses: Array<{ meaning_fr: string }>,
): boolean {
  if (senses.length === 0) return true;
  if (senses.length === 1) return true;
  return senses.some((s) => s.meaning_fr.trim() === '(à enrichir)');
}
