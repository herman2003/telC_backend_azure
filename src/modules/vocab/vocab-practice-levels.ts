/**
 * Vocab free-practice presets = grammar levels × 2.5 (rounded).
 * Grammar: 10/15/20 Q · 5/7/10 min → Vocab: 25/38/50 Q · 13/18/25 min.
 */

export type VocabPracticeDifficulty = 'easy' | 'medium' | 'hard';

export interface VocabPracticeLevel {
  id: string;
  difficulty: VocabPracticeDifficulty;
  /** Client-side timer hint — not enforced server-side. */
  durationMinutes: number;
  questionCount: number;
}

/** Multiplier vs grammar practice (questions + timer). */
export const VOCAB_VS_GRAMMAR_PRACTICE_FACTOR = 2.5;

export const VOCAB_PRACTICE_LEVELS: readonly VocabPracticeLevel[] = [
  { id: '1', difficulty: 'easy', durationMinutes: 13, questionCount: 25 },
  { id: '2', difficulty: 'medium', durationMinutes: 18, questionCount: 38 },
  { id: '3', difficulty: 'hard', durationMinutes: 25, questionCount: 50 },
] as const;

export const VOCAB_PRACTICE_DIFFICULTIES: readonly VocabPracticeDifficulty[] = [
  'easy',
  'medium',
  'hard',
] as const;

export function isVocabPracticeDifficulty(
  value: string,
): value is VocabPracticeDifficulty {
  return (VOCAB_PRACTICE_DIFFICULTIES as readonly string[]).includes(value);
}

export function vocabPracticeQuestionCountFor(
  difficulty: VocabPracticeDifficulty,
): number {
  const level = VOCAB_PRACTICE_LEVELS.find((l) => l.difficulty === difficulty);
  return level?.questionCount ?? 1;
}

export function vocabPracticeDurationMinutesFor(
  difficulty: VocabPracticeDifficulty,
): number {
  const level = VOCAB_PRACTICE_LEVELS.find((l) => l.difficulty === difficulty);
  return level?.durationMinutes ?? 1;
}
