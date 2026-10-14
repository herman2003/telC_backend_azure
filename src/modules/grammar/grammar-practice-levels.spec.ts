import { GRAMMAR_PRACTICE_LEVELS } from './grammar-practice-levels';

describe('GRAMMAR_PRACTICE_LEVELS', () => {
  it('exposes easy/medium/hard with 5/7/10 minute hints', () => {
    expect(GRAMMAR_PRACTICE_LEVELS).toEqual([
      { id: '1', difficulty: 'easy', durationMinutes: 5 },
      { id: '2', difficulty: 'medium', durationMinutes: 7 },
      { id: '3', difficulty: 'hard', durationMinutes: 10 },
    ]);
  });
});
