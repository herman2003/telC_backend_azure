import {
  buildTelcSprechenRating,
  criterionPercent,
  isTelcLetter,
  m10MaxPoints,
  m10PointsForTeil,
  scoreFromM10Points,
} from './speaking-telc-rating';

describe('speaking-telc-rating (M10)', () => {
  it('accepts A–D letters only', () => {
    expect(isTelcLetter('A')).toBe(true);
    expect(isTelcLetter('D')).toBe(true);
    expect(isTelcLetter('E')).toBe(false);
  });

  it('maps Teil 1 letters to /15 (AAAA = 15)', () => {
    expect(
      m10PointsForTeil(
        {
          expression: 'A',
          taskFulfilment: 'A',
          formalAccuracy: 'A',
          pronunciation: 'A',
        },
        1,
      ),
    ).toEqual({ points: 15, maxPoints: 15 });
    expect(m10MaxPoints(1)).toBe(15);
  });

  it('maps Teil 2/3 letters to /30 (AAAA = 30)', () => {
    expect(
      m10PointsForTeil(
        {
          expression: 'A',
          taskFulfilment: 'A',
          formalAccuracy: 'A',
          pronunciation: 'A',
        },
        2,
      ),
    ).toEqual({ points: 30, maxPoints: 30 });
    expect(
      m10PointsForTeil(
        {
          expression: 'A',
          taskFulfilment: 'A',
          formalAccuracy: 'A',
          pronunciation: 'A',
        },
        3,
      ).maxPoints,
    ).toBe(30);
  });

  it('uses criterion-4 table (T1 A=3, T2 A=6) and zeros a single D', () => {
    expect(
      m10PointsForTeil(
        {
          expression: 'A',
          taskFulfilment: 'A',
          formalAccuracy: 'A',
          pronunciation: 'D',
        },
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
        2,
      ).points,
    ).toBe(6 + 8 + 2 + 4);
  });

  it('derives percent score and criterion mirrors', () => {
    const rating = buildTelcSprechenRating(
      {
        expression: 'A',
        taskFulfilment: 'A',
        formalAccuracy: 'A',
        pronunciation: 'A',
      },
      1,
    );
    expect(rating.points).toBe(15);
    expect(rating.maxPoints).toBe(15);
    expect(scoreFromM10Points(rating.points, rating.maxPoints)).toBe(100);
    expect(criterionPercent('A', 1, 'expression')).toBe(100);
    expect(criterionPercent('B', 1, 'pronunciation')).toBe(
      Math.round((2 / 3) * 100),
    );
    expect(criterionPercent('B', 2, 'expression')).toBe(
      Math.round((6 / 8) * 100),
    );
  });
});
