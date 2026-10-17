import {
  VOCAB_PRACTICE_LEVELS,
  VOCAB_VS_GRAMMAR_PRACTICE_FACTOR,
  vocabPracticeDurationMinutesFor,
  vocabPracticeQuestionCountFor,
} from './vocab-practice-levels';

/** Grammar baselines (see grammar-practice-levels). */
const GRAMMAR_Q = { easy: 10, medium: 15, hard: 20 } as const;
const GRAMMAR_MIN = { easy: 5, medium: 7, hard: 10 } as const;

describe('vocab-practice-levels', () => {
  it('uses factor 2.5 vs grammar', () => {
    expect(VOCAB_VS_GRAMMAR_PRACTICE_FACTOR).toBe(2.5);
  });

  it('has 3 levels with questions = round(grammar × 2.5)', () => {
    expect(VOCAB_PRACTICE_LEVELS).toHaveLength(3);
    expect(vocabPracticeQuestionCountFor('easy')).toBe(
      Math.round(GRAMMAR_Q.easy * 2.5),
    );
    expect(vocabPracticeQuestionCountFor('medium')).toBe(
      Math.round(GRAMMAR_Q.medium * 2.5),
    );
    expect(vocabPracticeQuestionCountFor('hard')).toBe(
      Math.round(GRAMMAR_Q.hard * 2.5),
    );
    expect([
      vocabPracticeQuestionCountFor('easy'),
      vocabPracticeQuestionCountFor('medium'),
      vocabPracticeQuestionCountFor('hard'),
    ]).toEqual([25, 38, 50]);
  });

  it('has timers = round(grammar × 2.5) minutes', () => {
    expect(vocabPracticeDurationMinutesFor('easy')).toBe(
      Math.round(GRAMMAR_MIN.easy * 2.5),
    );
    expect(vocabPracticeDurationMinutesFor('medium')).toBe(
      Math.round(GRAMMAR_MIN.medium * 2.5),
    );
    expect(vocabPracticeDurationMinutesFor('hard')).toBe(
      Math.round(GRAMMAR_MIN.hard * 2.5),
    );
    expect([
      vocabPracticeDurationMinutesFor('easy'),
      vocabPracticeDurationMinutesFor('medium'),
      vocabPracticeDurationMinutesFor('hard'),
    ]).toEqual([13, 18, 25]);
  });
});
