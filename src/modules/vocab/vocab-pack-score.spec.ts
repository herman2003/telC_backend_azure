import {
  MIN_OUTSIDE_MT_RATIO,
  VOCAB_PACK_TOTAL,
  outsideMtCount,
  scorePackCandidate,
  selectWeeklyPack,
  type PackCandidate,
} from './vocab-pack-score';

function cand(
  partial: Partial<PackCandidate> &
    Pick<PackCandidate, 'entryId' | 'lemma' | 'pos'>,
): PackCandidate {
  return {
    inModelltest: false,
    skillCount: 0,
    frequencyRank: null,
    dwdsFrequency: null,
    inCefrList: false,
    inGoetheList: false,
    inTelcList: false,
    isNoise: false,
    ...partial,
  };
}

describe('vocab-pack-score', () => {
  it('quotas sum to 100', () => {
    expect(VOCAB_PACK_TOTAL).toBe(100);
  });

  it('scores MT + multi-skill higher than catalogue-only', () => {
    const mt = scorePackCandidate(
      cand({
        entryId: '1',
        lemma: 'Antrag',
        pos: 'noun',
        inModelltest: true,
        skillCount: 3,
      }),
    );
    const cat = scorePackCandidate(
      cand({
        entryId: '2',
        lemma: 'Tisch',
        pos: 'noun',
        inCefrList: true,
        frequencyRank: 1000,
      }),
    );
    expect(mt).toBeGreaterThan(cat);
  });

  it('always keeps at least ~30% outside MT when catalogue is available', () => {
    const candidates: PackCandidate[] = [];
    for (let i = 0; i < 80; i += 1) {
      candidates.push(
        cand({
          entryId: `mt-n-${i}`,
          lemma: `MtNoun${i}`,
          pos: 'noun',
          inModelltest: true,
          skillCount: 2,
        }),
      );
    }
    for (let i = 0; i < 80; i += 1) {
      candidates.push(
        cand({
          entryId: `out-n-${i}`,
          lemma: `OutNoun${i}`,
          pos: 'noun',
          inCefrList: true,
          frequencyRank: 500 + i,
        }),
      );
    }
    for (const pos of ['verb', 'adj', 'adv', 'prep'] as const) {
      for (let i = 0; i < 40; i += 1) {
        candidates.push(
          cand({
            entryId: `mt-${pos}-${i}`,
            lemma: `Mt${pos}${i}`,
            pos,
            inModelltest: true,
            skillCount: 1,
          }),
        );
        candidates.push(
          cand({
            entryId: `out-${pos}-${i}`,
            lemma: `Out${pos}${i}`,
            pos,
            inCefrList: true,
            frequencyRank: 800 + i,
          }),
        );
      }
    }

    const pack = selectWeeklyPack(candidates);
    expect(pack.length).toBe(100);
    const outside = outsideMtCount(pack);
    expect(outside).toBeGreaterThanOrEqual(
      Math.floor(VOCAB_PACK_TOTAL * MIN_OUTSIDE_MT_RATIO),
    );
  });

  it('is deterministic', () => {
    const candidates = [
      cand({ entryId: 'a', lemma: 'Alpha', pos: 'noun', inModelltest: true }),
      cand({ entryId: 'b', lemma: 'Beta', pos: 'noun', inCefrList: true }),
    ];
    expect(selectWeeklyPack(candidates)).toEqual(selectWeeklyPack(candidates));
  });

  it('scores Goethe list higher than generic CEFR catalogue', () => {
    const goethe = scorePackCandidate(
      cand({
        entryId: 'g',
        lemma: 'Arbeit',
        pos: 'noun',
        inGoetheList: true,
        dwdsFrequency: 5,
      }),
    );
    const cefr = scorePackCandidate(
      cand({
        entryId: 'c',
        lemma: 'Tisch',
        pos: 'noun',
        inCefrList: true,
        frequencyRank: 3000,
      }),
    );
    expect(goethe).toBeGreaterThan(cefr);
  });
});
