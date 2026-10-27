import {
  a12MaxPoints,
  buildA12SpeakingRating,
  isA12SpeakingLevel,
} from './speaking-a12-m10';

describe('speaking-a12-m10', () => {
  it('recognises A1/A2 only', () => {
    expect(isA12SpeakingLevel('A1')).toBe(true);
    expect(isA12SpeakingLevel('B1')).toBe(false);
  });

  it('A1 Teil maxima are 3 / 6 / 6', () => {
    expect(a12MaxPoints('A1', 1)).toBe(3);
    expect(a12MaxPoints('A1', 2)).toBe(6);
    expect(a12MaxPoints('A1', 3)).toBe(6);
  });

  it('A2 Teil maxima are 3 / 6 / 6', () => {
    expect(a12MaxPoints('A2', 1)).toBe(3);
    expect(a12MaxPoints('A2', 2)).toBe(6);
    expect(a12MaxPoints('A2', 3)).toBe(6);
  });

  it('sums FULL bands and ignores NOT_ASSESSED in percent denominator', () => {
    const rating = buildA12SpeakingRating('A1', 1, {
      vorstellen: 'FULL',
      buchstabieren: 'NOT_ASSESSED',
      zahlen: 'HALF',
    });
    expect(rating.points).toBe(1.5);
    expect(rating.assessedMaxPoints).toBe(2);
    expect(rating.scorePercent).toBe(75);
    expect(rating.maxPoints).toBe(3);
  });

  it('A2 Teil 3 allows 1.5 half points', () => {
    const rating = buildA12SpeakingRating('A2', 3, {
      erfuellungDerAufgabenstellung: 'HALF',
      sprachlicheRealisierung: 'FULL',
    });
    expect(rating.points).toBe(4.5);
    expect(rating.scorePercent).toBe(75);
  });
});
