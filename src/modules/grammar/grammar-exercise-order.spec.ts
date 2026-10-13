import {
  exerciseStatusAtIndex,
  sortGrammarExercises,
} from './grammar-exercise-order';

describe('sortGrammarExercises', () => {
  it('orders easy then medium then hard, then sort_order', () => {
    const sorted = sortGrammarExercises([
      { id: 'h', difficulty: 'hard', sort_order: 0 },
      { id: 'e1', difficulty: 'easy', sort_order: 1 },
      { id: 'e0', difficulty: 'easy', sort_order: 0 },
      { id: 'm', difficulty: 'medium', sort_order: 0 },
    ]);
    expect(sorted.map((e) => e.id)).toEqual(['e0', 'e1', 'm', 'h']);
  });
});

describe('exerciseStatusAtIndex', () => {
  it('locks everything until the lesson is completed', () => {
    expect(exerciseStatusAtIndex(0, false, 0)).toBe('locked');
  });

  it('unlocks the cursor and marks prior steps completed', () => {
    expect(exerciseStatusAtIndex(0, true, 1)).toBe('completed');
    expect(exerciseStatusAtIndex(1, true, 1)).toBe('unlocked');
    expect(exerciseStatusAtIndex(2, true, 1)).toBe('locked');
  });
});
