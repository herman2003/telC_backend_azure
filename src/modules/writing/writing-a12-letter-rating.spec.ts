import {
  buildA12LetterRating,
  isA12Band,
  parseA12LetterRubric,
} from './writing-a12-letter-rating';

const A1_RUBRIC = {
  contentPoints: {
    selectRequired: 3,
    pointsPerPoint: [3, 1.5, 0] as [number, number, number],
  },
  communicativeDesign: {
    points: [1, 0.5, 0] as [number, number, number],
  },
};

describe('writing-a12-letter-rating', () => {
  it('parses the A1/A2 material.rubric shape', () => {
    expect(
      parseA12LetterRubric({
        bulletPoints: ['a', 'b', 'c'],
        rubric: A1_RUBRIC,
      }),
    ).toEqual(A1_RUBRIC);
    expect(parseA12LetterRubric({})).toBeNull();
  });

  it('FULL×3 + FULL KG = 10 → 100%', () => {
    const rating = buildA12LetterRating(
      ['FULL', 'FULL', 'FULL'],
      'FULL',
      A1_RUBRIC,
      10,
    );
    expect(rating.points).toBe(10);
    expect(rating.scorePercent).toBe(100);
  });

  it('PARTIAL content + PARTIAL KG uses half-points', () => {
    const rating = buildA12LetterRating(
      ['PARTIAL', 'PARTIAL', 'PARTIAL'],
      'PARTIAL',
      A1_RUBRIC,
      10,
    );
    expect(rating.points).toBe(5);
    expect(rating.scorePercent).toBe(50);
  });

  it('pads missing content bands as NONE', () => {
    const rating = buildA12LetterRating(['FULL'], 'NONE', A1_RUBRIC, 10);
    expect(rating.contentPointBands).toEqual(['FULL', 'NONE', 'NONE']);
    expect(rating.points).toBe(3);
  });

  it('recognises band literals only', () => {
    expect(isA12Band('FULL')).toBe(true);
    expect(isA12Band('A')).toBe(false);
  });
});
