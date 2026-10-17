import type { GrammarDifficulty } from './grammar-exercise-order';

export interface GrammarPracticeLevel {
  id: string;
  difficulty: GrammarDifficulty;
  /** Client-side timer hint — not enforced server-side. */
  durationMinutes: number;
  /**
   * Fixed QCM count for this level.
   * Higher difficulty → more questions (and harder items).
   */
  questionCount: number;
}

/**
 * Free-practice presets:
 * - timers stay 5 / 7 / 10 min (client hint only)
 * - questions increase with difficulty: 10 → 15 → 20
 */
export const GRAMMAR_PRACTICE_LEVELS: readonly GrammarPracticeLevel[] = [
  { id: '1', difficulty: 'easy', durationMinutes: 5, questionCount: 10 },
  { id: '2', difficulty: 'medium', durationMinutes: 7, questionCount: 15 },
  { id: '3', difficulty: 'hard', durationMinutes: 10, questionCount: 20 },
] as const;

export const GRAMMAR_PRACTICE_DIFFICULTIES: readonly GrammarDifficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;

export function isGrammarPracticeDifficulty(
  value: string,
): value is GrammarDifficulty {
  return (GRAMMAR_PRACTICE_DIFFICULTIES as readonly string[]).includes(value);
}

export function practiceQuestionCountFor(
  difficulty: GrammarDifficulty,
): number {
  const level = GRAMMAR_PRACTICE_LEVELS.find(
    (l) => l.difficulty === difficulty,
  );
  return level?.questionCount ?? 1;
}

/** Pool size to generate per topic (per difficulty). */
export function practicePoolCounts(): Record<GrammarDifficulty, number> {
  return {
    easy: practiceQuestionCountFor('easy'),
    medium: practiceQuestionCountFor('medium'),
    hard: practiceQuestionCountFor('hard'),
  };
}
