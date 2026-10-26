import {
  alerts,
  readiness,
  roundScores,
  skillPoints,
  skillScores,
  type ProgressWeights,
  type SkillScores,
  type TeilScore,
} from './progress-formula';

const NOW = new Date('2026-09-19T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

/**
 * telc Deutsch B1's own point caps, as a fixture rather than imported from
 * production (Part 7 Principle 2 of docs/architecture/multi-level.md): this
 * is the expected value a row-driven B1 lookup must reproduce, so a future
 * refactor that silently changes B1's weights fails this test loudly instead
 * of shipping.
 */
const B1_WEIGHTS: ProgressWeights = {
  skillMaxPoints: {
    LESEN: 75,
    SPRACHBAUSTEINE: 30,
    HOEREN: 75,
    SCHREIBEN: 45,
    SPRECHEN: 75,
  },
  teilsPerSkill: {
    HOEREN: 3,
    LESEN: 3,
    SPRACHBAUSTEINE: 2,
    SCHREIBEN: 1,
    SPRECHEN: 3,
  },
  writtenMax: 225,
  oralMax: 75,
  totalMax: 300,
  passRule: {
    type: 'PART_PERCENT',
    minimumPercent: null,
    writtenPercent: 60,
    oralPercent: 60,
  },
};

/** telc Deutsch A2's point caps, no Sprachbausteine, one combined bar. */
const A2_WEIGHTS: ProgressWeights = {
  skillMaxPoints: { LESEN: 15, HOEREN: 15, SCHREIBEN: 15, SPRECHEN: 15 },
  teilsPerSkill: { HOEREN: 3, LESEN: 3, SCHREIBEN: 2, SPRECHEN: 3 },
  writtenMax: 45,
  oralMax: 15,
  totalMax: 60,
  passRule: {
    type: 'TOTAL_PERCENT',
    minimumPercent: 60,
    writtenPercent: null,
    oralPercent: null,
  },
};

const scores = (over: Partial<SkillScores>): SkillScores => ({
  HOEREN: null,
  LESEN: null,
  SPRACHBAUSTEINE: null,
  SCHREIBEN: null,
  SPRECHEN: null,
  ...over,
});

const emptyReadiness = {
  score: null,
  written: null,
  oral: null,
  ready: false,
  pointsTotal: null,
  pointsWritten: null,
  pointsOral: null,
};

describe('skillScores', () => {
  it('averages the Teils, counting a Teil never attempted as 0', () => {
    const teils: TeilScore[] = [
      { skill: 'HOEREN', teil: 1, score: 90 },
      { skill: 'HOEREN', teil: 2, score: 60 },
    ];

    expect(skillScores(teils, B1_WEIGHTS).HOEREN).toBe(50); // (90 + 60 + 0) / 3
  });

  it('leaves a skill never practised as null, not 0', () => {
    const result = skillScores(
      [{ skill: 'SCHREIBEN', teil: 1, score: 70 }],
      B1_WEIGHTS,
    );

    expect(result.SCHREIBEN).toBe(70);
    expect(result.SPRECHEN).toBeNull();
  });

  it('ignores a Teil number the skill does not have', () => {
    const result = skillScores(
      [
        { skill: 'SPRACHBAUSTEINE', teil: 1, score: 80 },
        { skill: 'SPRACHBAUSTEINE', teil: 5, score: 0 },
      ],
      B1_WEIGHTS,
    );

    expect(result.SPRACHBAUSTEINE).toBe(40); // (80 + 0) / 2 Teils
  });

  it('leaves a skill this level does not offer as null, never NaN', () => {
    // A2 has no Sprachbausteine at all -- teilsPerSkill has no entry.
    const result = skillScores(
      [{ skill: 'SPRACHBAUSTEINE', teil: 1, score: 80 }],
      A2_WEIGHTS,
    );

    expect(result.SPRACHBAUSTEINE).toBeNull();
  });
});

describe('skillPoints', () => {
  it('maps percent scores onto the official telc B1 caps', () => {
    expect(skillPoints(scores({ LESEN: 100 }), 'LESEN', B1_WEIGHTS)).toBe(75);
    expect(
      skillPoints(
        scores({ SPRACHBAUSTEINE: 100 }),
        'SPRACHBAUSTEINE',
        B1_WEIGHTS,
      ),
    ).toBe(30);
    expect(skillPoints(scores({}), 'HOEREN', B1_WEIGHTS)).toBe(0);
  });

  it("contributes 0 for a skill the level doesn't have, not a crash", () => {
    expect(
      skillPoints(
        scores({ SPRACHBAUSTEINE: 100 }),
        'SPRACHBAUSTEINE',
        A2_WEIGHTS,
      ),
    ).toBe(0);
  });
});

describe('readiness', () => {
  const allAt = (value: number) =>
    scores({
      HOEREN: value,
      LESEN: value,
      SPRACHBAUSTEINE: value,
      SCHREIBEN: value,
      SPRECHEN: value,
    });

  it('is null under 5 attempts: not enough exercises yet', () => {
    expect(readiness(allAt(90), 4, B1_WEIGHTS)).toEqual(emptyReadiness);
  });

  it('weighs skills by official telc Deutsch B1 points, not equally', () => {
    const result = readiness(
      scores({
        HOEREN: 80,
        LESEN: 60,
        SPRACHBAUSTEINE: 70,
        SCHREIBEN: 90,
        SPRECHEN: 40,
      }),
      12,
      B1_WEIGHTS,
    );

    // 60 + 45 + 21 + 40.5 = 166.5 written; oral 30; total 196.5
    expect(result).toEqual({
      score: 66,
      written: 74,
      oral: 40,
      ready: false,
      pointsTotal: 197,
      pointsWritten: 167,
      pointsOral: 30,
    });
  });

  it('does not treat strong Sprachbausteine like strong Lesen/Hören', () => {
    const onlySb = readiness(
      scores({ SPRACHBAUSTEINE: 100, SPRECHEN: 100 }),
      10,
      B1_WEIGHTS,
    );
    const onlyLesen = readiness(
      scores({ LESEN: 100, SPRECHEN: 100 }),
      10,
      B1_WEIGHTS,
    );

    expect(onlySb.pointsWritten).toBe(30);
    expect(onlyLesen.pointsWritten).toBe(75);
    expect(onlySb.ready).toBe(false);
    expect(onlyLesen.ready).toBe(false);
    expect(onlySb.written!).toBeLessThan(onlyLesen.written!);
  });

  it('counts a skill never practised as 0, so skipping speaking is not ready', () => {
    expect(readiness(allAt(90), 20, B1_WEIGHTS).ready).toBe(true);
    expect(
      readiness({ ...allAt(90), SPRECHEN: null }, 20, B1_WEIGHTS),
    ).toMatchObject({
      score: 68,
      oral: 0,
      pointsOral: 0,
      ready: false,
    });
  });

  it('decides the pass on exact skill scores, not rounded ones', () => {
    // Sprechen Teils 60, 60, 59 = 59.67%: 44.75 pts < 45.
    const exact = skillScores(
      [
        { skill: 'SPRECHEN', teil: 1, score: 60 },
        { skill: 'SPRECHEN', teil: 2, score: 60 },
        { skill: 'SPRECHEN', teil: 3, score: 59 },
      ],
      B1_WEIGHTS,
    );
    const all = { ...allAt(90), SPRECHEN: exact.SPRECHEN };

    expect(roundScores(exact).SPRECHEN).toBe(60);
    expect(readiness(all, 20, B1_WEIGHTS).ready).toBe(false);
    expect(readiness(all, 20, B1_WEIGHTS).oral).toBe(60);
  });

  it('needs 135 written and 45 oral points, compared before rounding', () => {
    expect(readiness(allAt(60), 10, B1_WEIGHTS)).toMatchObject({
      ready: true,
      pointsWritten: 135,
      pointsOral: 45,
      pointsTotal: 180,
    });
    // Lesen 59% → written 134.25 < 135.
    expect(readiness({ ...allAt(60), LESEN: 59 }, 10, B1_WEIGHTS).ready).toBe(
      false,
    );
  });

  describe('A2: one combined bar, not two halves', () => {
    it('passes a candidate strong on paper and weak orally, which B1-style PART_PERCENT would fail', () => {
      const result = readiness(
        scores({ HOEREN: 100, LESEN: 100, SCHREIBEN: 100, SPRECHEN: 0 }),
        10,
        A2_WEIGHTS,
      );

      // 45/45 written, 0/15 oral: 45/60 = 75% combined.
      expect(result.pointsWritten).toBe(45);
      expect(result.pointsOral).toBe(0);
      expect(result.ready).toBe(true);
    });

    it('is not ready below the combined 60%', () => {
      const result = readiness(allAt(40), 10, A2_WEIGHTS);

      expect(result.ready).toBe(false);
    });

    it('never counts Sprachbausteine toward an A2 total, since the level has none', () => {
      const withSb = readiness(
        scores({
          HOEREN: 100,
          LESEN: 100,
          SCHREIBEN: 100,
          SPRECHEN: 100,
          SPRACHBAUSTEINE: 100,
        }),
        10,
        A2_WEIGHTS,
      );

      expect(withSb.pointsTotal).toBe(60);
    });
  });
});

describe('alerts', () => {
  const enough = {
    score: 70,
    written: 70,
    oral: 70,
    ready: true,
    pointsTotal: 210,
    pointsWritten: 158,
    pointsOral: 53,
  };

  it('flags a student with no activity for 7 days, or never', () => {
    expect(alerts(scores({}), enough, daysAgo(8), NOW)).toContainEqual({
      type: 'inactive',
      lastActivityAt: daysAgo(8),
    });
    expect(alerts(scores({}), enough, null, NOW)[0].type).toBe('inactive');
    expect(alerts(scores({}), enough, daysAgo(6), NOW)).toEqual([]);
  });

  it('flags readiness under 40, and not a readiness still unknown', () => {
    const low = {
      score: 39,
      written: 40,
      oral: 30,
      ready: false,
      pointsTotal: 117,
      pointsWritten: 90,
      pointsOral: 23,
    };
    const unknown = emptyReadiness;

    expect(alerts(scores({}), low, daysAgo(1), NOW)).toEqual([
      { type: 'low_progress', readiness: 39 },
    ]);
    expect(alerts(scores({}), unknown, daysAgo(1), NOW)).toEqual([]);
  });

  it('flags a practised skill under 45, never one not practised yet', () => {
    const found = alerts(
      scores({ LESEN: 44, HOEREN: 45 }),
      enough,
      daysAgo(1),
      NOW,
    );

    expect(found).toEqual([{ type: 'weak_skill', skill: 'LESEN', score: 44 }]);
  });
});
