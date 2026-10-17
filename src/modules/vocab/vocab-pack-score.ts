/**
 * Deterministic weekly vocab pack selection (100 lemmas).
 * Mixes MT occurrences + reputable catalogue; always keeps ≥30% outside MT.
 */

export const VOCAB_PACK_QUOTAS = {
  noun: 36,
  verb: 27,
  adj: 17,
  adv: 10,
  prep: 10,
} as const;

export type VocabPackPos = keyof typeof VOCAB_PACK_QUOTAS;

export const VOCAB_PACK_TOTAL = (
  Object.values(VOCAB_PACK_QUOTAS) as number[]
).reduce((a, b) => a + b, 0);

/** Minimum share of pack lemmas that must come from outside the MT. */
export const MIN_OUTSIDE_MT_RATIO = 0.3;

export type PackCandidate = {
  entryId: string;
  lemma: string;
  pos: VocabPackPos;
  inModelltest: boolean;
  skillCount: number;
  frequencyRank: number | null;
  /** DWDS corpus frequency class 0–6 (higher = more frequent). */
  dwdsFrequency: number | null;
  inCefrList: boolean;
  /** Official Goethe-Zertifikat word list (via DWDS). */
  inGoetheList: boolean;
  /** telc Beruf course lists (B1/B2 PDFs) — exam-aligned. */
  inTelcList: boolean;
  isNoise: boolean;
};

export type PackSelection = {
  entryId: string;
  pos: VocabPackPos;
  score: number;
  inModelltest: boolean;
};

export function scorePackCandidate(c: PackCandidate): number {
  if (c.isNoise) return -1000;
  let score = 0;
  if (c.inModelltest) score += 40;
  score += 15 * Math.min(4, Math.max(0, c.skillCount));
  if (c.frequencyRank != null) {
    if (c.frequencyRank <= 2000) score += 20;
    else if (c.frequencyRank <= 5000) score += 12;
  } else if (c.dwdsFrequency != null) {
    if (c.dwdsFrequency >= 5) score += 20;
    else if (c.dwdsFrequency >= 4) score += 12;
    else if (c.dwdsFrequency >= 3) score += 6;
  }
  // Official / exam-oriented lists outweigh generic CEFR dumps.
  if (c.inGoetheList || c.inTelcList) score += 15;
  else if (c.inCefrList) score += 10;
  return score;
}

function sortCandidates(list: PackCandidate[]): PackCandidate[] {
  return [...list].sort((a, b) => {
    const sa = scorePackCandidate(a);
    const sb = scorePackCandidate(b);
    if (sb !== sa) return sb - sa;
    return a.lemma.localeCompare(b.lemma, 'de');
  });
}

/**
 * Select up to 100 entries respecting per-pos quotas and ≥30% outside MT.
 */
export function selectWeeklyPack(candidates: PackCandidate[]): PackSelection[] {
  const usable = candidates.filter(
    (c) => !c.isNoise && c.pos in VOCAB_PACK_QUOTAS,
  );
  const selected: PackSelection[] = [];
  const selectedIds = new Set<string>();

  for (const pos of Object.keys(VOCAB_PACK_QUOTAS) as VocabPackPos[]) {
    const quota = VOCAB_PACK_QUOTAS[pos];
    const pool = sortCandidates(usable.filter((c) => c.pos === pos));
    const mtPool = pool.filter((c) => c.inModelltest);
    const outPool = pool.filter((c) => !c.inModelltest);
    const reserveOut = Math.min(
      outPool.length,
      Math.ceil(quota * MIN_OUTSIDE_MT_RATIO),
    );

    const pick: PackCandidate[] = [];
    for (const c of outPool) {
      if (pick.length >= reserveOut) break;
      if (selectedIds.has(c.entryId)) continue;
      pick.push(c);
    }
    for (const c of mtPool) {
      if (pick.length >= quota) break;
      if (selectedIds.has(c.entryId)) continue;
      if (pick.some((p) => p.entryId === c.entryId)) continue;
      pick.push(c);
    }
    for (const c of outPool) {
      if (pick.length >= quota) break;
      if (selectedIds.has(c.entryId)) continue;
      if (pick.some((p) => p.entryId === c.entryId)) continue;
      pick.push(c);
    }

    for (const c of pick.slice(0, quota)) {
      selectedIds.add(c.entryId);
      selected.push({
        entryId: c.entryId,
        pos,
        score: scorePackCandidate(c),
        inModelltest: c.inModelltest,
      });
    }
  }

  return selected;
}

export function outsideMtCount(selection: PackSelection[]): number {
  return selection.filter((s) => !s.inModelltest).length;
}
