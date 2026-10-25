import {
  asCorrectionPackage,
  correctionMapFromQuestions,
} from '../src/modules/listening/listening-correction';

describe('listening-correction', () => {
  const full = {
    evidence: 'quote',
    whyCorrect: 'why',
    whyOppositeFails: 'not that',
    learningPoint: 'tip',
    audioHighlight: { startMs: null, endMs: null },
  };

  it('accepts a complete package', () => {
    expect(asCorrectionPackage(full)).toEqual(full);
  });

  it('rejects incomplete packages', () => {
    expect(asCorrectionPackage({ evidence: 'only' })).toBeNull();
    expect(asCorrectionPackage(null)).toBeNull();
  });

  it('builds a qN map and omits empty items', () => {
    expect(
      correctionMapFromQuestions([
        { question_number: 41, correction: full },
        { question_number: 42, correction: null },
      ]),
    ).toEqual({ q41: full });
    expect(
      correctionMapFromQuestions([{ question_number: 41, correction: null }]),
    ).toBeUndefined();
  });
});
