import { GRAMMAR_PRACTICE_LEVELS } from './grammar-practice-levels';

describe('GRAMMAR_PRACTICE_LEVELS', () => {
  it('keeps 5/7/10 minute hints and increasing question counts 10/15/20', () => {
    expect(GRAMMAR_PRACTICE_LEVELS).toEqual([
      { id: '1', difficulty: 'easy', durationMinutes: 5, questionCount: 10 },
      { id: '2', difficulty: 'medium', durationMinutes: 7, questionCount: 15 },
      { id: '3', difficulty: 'hard', durationMinutes: 10, questionCount: 20 },
    ]);
  });
});
