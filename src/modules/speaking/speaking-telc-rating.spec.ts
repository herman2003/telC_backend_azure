import {
  buildTelcSprechenRating,
  criterionPercent,
  isTelcLetter,
  m10MaxPoints,
  m10PointsForTeil,
  scoreFromM10Points,
} from './speaking-telc-rating';

const ALL_A = {
  expression: 'A',
  taskFulfilment: 'A',
  formalAccuracy: 'A',
  pronunciation: 'A',
} as const;

describe('speaking-telc-rating (M10)', () => {
  it('accepts A-D letters only', () => {
    expect(isTelcLetter('A')).toBe(true);
    expect(isTelcLetter('D')).toBe(true);
    expect(isTelcLetter('E')).toBe(false);
  });

  /**
   * B1, unchanged by the B2 work. These are the assertions that were here
   * before `level` existed, with 'B1' threaded through: they are the guarantee
   * that adding a second level moved none of B1's numbers.
   */
  describe('B1', () => {
    it('maps Teil 1 letters to /15 (AAAA = 15)', () => {
      expect(m10PointsForTeil(ALL_A, 'B1', 1)).toEqual({
        points: 15,
        maxPoints: 15,
      });
      expect(m10MaxPoints('B1', 1)).toBe(15);
    });

    it('maps Teil 2/3 letters to /30 (AAAA = 30)', () => {
      expect(m10PointsForTeil(ALL_A, 'B1', 2)).toEqual({
        points: 30,
        maxPoints: 30,
      });
      expect(m10PointsForTeil(ALL_A, 'B1', 3).maxPoints).toBe(30);
    });

    it('uses criterion-4 table (T1 A=3, T2 A=6) and zeros a single D', () => {
      expect(
        m10PointsForTeil(
          { ...ALL_A, pronunciation: 'D' },
          'B1',
          1,
        ).points,
      ).toBe(12);
      expect(
        m10PointsForTeil(
          {
            expression: 'B',
            taskFulfilment: 'A',
            formalAccuracy: 'C',
            pronunciation: 'B',
          },
          'B1',
          2,
        ).points,
      ).toBe(6 + 8 + 2 + 4);
    });

    it('derives percent score and criterion mirrors', () => {
      const rating = buildTelcSprechenRating(ALL_A, 'B1', 1);
      expect(rating.points).toBe(15);
      expect(rating.maxPoints).toBe(15);
      expect(scoreFromM10Points(rating.points, rating.maxPoints)).toBe(100);
      expect(criterionPercent('A', 'B1', 1, 'expression')).toBe(100);
      expect(criterionPercent('B', 'B1', 1, 'pronunciation')).toBe(
        Math.round((2 / 3) * 100),
      );
      expect(criterionPercent('B', 'B1', 2, 'expression')).toBe(
        Math.round((6 / 8) * 100),
      );
    });
  });

  /**
   * B2 is a third table, not a scaling of B1.
   *
   * telc weights all three scored parts equally at 25 (B1 runs 15/30/30) and
   * maps the letters differently: criteria 1-3 are 7/5/3/0 and Aussprache
   * 4/2/1/0. A C is worth 3 at B2 where it is 1 at B1 Teil 1 and 2 at Teil
   * 2/3, so no arithmetic on B1's values produces B2's.
   */
  describe('B2', () => {
    it('weights all three scored parts at 25', () => {
      for (const teil of [1, 2, 3]) {
        expect(m10PointsForTeil(ALL_A, 'B2', teil)).toEqual({
          points: 25,
          maxPoints: 25,
        });
        expect(m10MaxPoints('B2', teil)).toBe(25);
      }
    });

    it('maps criteria 1-3 to 7/5/3/0 and Aussprache to 4/2/1/0', () => {
      const points = (letter: 'A' | 'B' | 'C' | 'D') =>
        m10PointsForTeil(
          {
            expression: letter,
            taskFulfilment: 'D',
            formalAccuracy: 'D',
            pronunciation: 'D',
          },
          'B2',
          1,
        ).points;
      expect([points('A'), points('B'), points('C'), points('D')]).toEqual([
        7, 5, 3, 0,
      ]);

      const aussprache = (letter: 'A' | 'B' | 'C' | 'D') =>
        m10PointsForTeil(
          {
            expression: 'D',
            taskFulfilment: 'D',
            formalAccuracy: 'D',
            pronunciation: letter,
          },
          'B2',
          1,
        ).points;
      expect([
        aussprache('A'),
        aussprache('B'),
        aussprache('C'),
        aussprache('D'),
      ]).toEqual([4, 2, 1, 0]);
    });

    it('scores a C above what B1 would give it', () => {
      // The reason B2 cannot be derived from B1 by scaling.
      const allC = {
        expression: 'C',
        taskFulfilment: 'C',
        formalAccuracy: 'C',
        pronunciation: 'C',
      } as const;
      expect(m10PointsForTeil(allC, 'B2', 1).points).toBe(3 + 3 + 3 + 1);
      expect(m10PointsForTeil(allC, 'B1', 1).points).toBe(1 + 1 + 1 + 1);
    });

    it('the three scored parts add up to the 75 oral points', () => {
      const total = [1, 2, 3].reduce(
        (sum, teil) => sum + m10MaxPoints('B2', teil),
        0,
      );
      expect(total).toBe(75);
    });
  });

  /**
   * B2 opens with an unscored `Einander kennenlernen`, which the content
   * carries as part 0. Rating it is meaningless, and the previous
   * normalisation would have silently treated it as Teil 1 — scoring an
   * introduction against B1's 15-point opener. Refused rather than coerced.
   *
   * The HTTP boundary already rejects it (`@Min(1) @Max(3)` on the DTO), so
   * this is the guard for an internal caller.
   */
  describe('the unscored introduction', () => {
    it.each([0, -1, 4])('refuses to rate Teil %i', (teil) => {
      expect(() => m10PointsForTeil(ALL_A, 'B2', teil)).toThrow(
        /not a scored Teil/,
      );
      expect(() => m10MaxPoints('B2', teil)).toThrow(/not a scored Teil/);
      expect(() => buildTelcSprechenRating(ALL_A, 'B2', teil)).toThrow(
        /not a scored Teil/,
      );
    });
  });
});
