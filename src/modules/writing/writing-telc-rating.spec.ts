import {
  buildTelcSchreibenRating,
  capTaskFulfilment,
  letterPoints,
  scoreFromTelcPoints,
  telcSchreibenPoints,
} from './writing-telc-rating';

describe('writing-telc-rating', () => {
  it('maps A/B/C/D to 5/3/1/0', () => {
    expect(letterPoints('A')).toBe(5);
    expect(letterPoints('B')).toBe(3);
    expect(letterPoints('C')).toBe(1);
    expect(letterPoints('D')).toBe(0);
  });

  it('scales three criteria to /45 and kills on D for I or III', () => {
    expect(
      telcSchreibenPoints({
        taskFulfilment: 'A',
        communicativeDesign: 'A',
        formalAccuracy: 'A',
      }),
    ).toEqual({ points: 45, killed: false });

    expect(
      telcSchreibenPoints({
        taskFulfilment: 'B',
        communicativeDesign: 'A',
        formalAccuracy: 'C',
      }).points,
    ).toBe((3 + 5 + 1) * 3);

    expect(
      telcSchreibenPoints({
        taskFulfilment: 'D',
        communicativeDesign: 'A',
        formalAccuracy: 'A',
      }),
    ).toEqual({ points: 0, killed: true });

    expect(
      telcSchreibenPoints({
        taskFulfilment: 'A',
        communicativeDesign: 'A',
        formalAccuracy: 'D',
      }),
    ).toEqual({ points: 0, killed: true });
  });

  it('caps taskFulfilment from points_addressed', () => {
    expect(capTaskFulfilment('A', 1, 4)).toBe('D');
    expect(capTaskFulfilment('A', 2, 4)).toBe('C');
    expect(capTaskFulfilment('A', 3, 4)).toBe('B');
    expect(capTaskFulfilment('A', 4, 4)).toBe('A');
    expect(capTaskFulfilment('C', 4, 4)).toBe('C');
    // N < 4: addressed ≥ N keeps model letter
    expect(capTaskFulfilment('A', 3, 3)).toBe('A');
    // N > 4: addressed ≥ 4 still keeps model (even if < N)
    expect(capTaskFulfilment('A', 4, 5)).toBe('A');
  });

  it('does not kill on communicativeDesign D alone', () => {
    expect(
      telcSchreibenPoints({
        taskFulfilment: 'A',
        communicativeDesign: 'D',
        formalAccuracy: 'A',
      }),
    ).toEqual({ points: (5 + 0 + 5) * 3, killed: false });
  });

  it('builds rating and derived percent score', () => {
    const rating = buildTelcSchreibenRating(
      {
        taskFulfilment: 'A',
        communicativeDesign: 'A',
        formalAccuracy: 'A',
      },
      1,
      4,
    );
    expect(rating.taskFulfilment).toBe('D');
    expect(rating.points).toBe(0);
    expect(scoreFromTelcPoints(rating.points)).toBe(0);

    const full = buildTelcSchreibenRating(
      {
        taskFulfilment: 'A',
        communicativeDesign: 'A',
        formalAccuracy: 'A',
      },
      4,
      4,
    );
    expect(full.points).toBe(45);
    expect(scoreFromTelcPoints(full.points)).toBe(100);
  });
});
