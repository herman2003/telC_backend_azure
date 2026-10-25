import { correctionMapFromGenericItems } from '../src/shared/training-correction';

describe('correctionMapFromGenericItems', () => {
  const full = {
    evidence: 'quote',
    whyCorrect: 'why',
    whyDistractorsFail: { a: 'no' },
    learningPoint: 'tip',
  };

  it('builds an item-number map and omits incomplete rows', () => {
    expect(
      correctionMapFromGenericItems([
        { itemNumber: 1, correction: full },
        { itemNumber: 2, correction: { evidence: 'only' } },
        { itemNumber: 3, correction: null },
      ]),
    ).toEqual({ '1': full });
  });

  it('returns undefined when nothing is complete', () => {
    expect(
      correctionMapFromGenericItems([{ itemNumber: 1, correction: null }]),
    ).toBeUndefined();
  });
});
