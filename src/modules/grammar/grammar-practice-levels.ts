import type { GrammarDifficulty } from './grammar-exercise-order';

export interface GrammarPracticeLevel {
  id: string;
  difficulty: GrammarDifficulty;
  durationMinutes: number;
}

/** Client-side timer hints for free practice — not enforced server-side. */
export const GRAMMAR_PRACTICE_LEVELS: readonly GrammarPracticeLevel[] = [
  { id: '1', difficulty: 'easy', durationMinutes: 5 },
  { id: '2', difficulty: 'medium', durationMinutes: 7 },
  { id: '3', difficulty: 'hard', durationMinutes: 10 },
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
