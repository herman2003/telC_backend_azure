export type GrammarDifficulty = 'easy' | 'medium' | 'hard';

const DIFFICULTY_RANK: Record<string, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

export interface OrderedExercise {
  id: string;
  difficulty: string;
  sort_order: number;
}

export function compareGrammarExercises(
  a: OrderedExercise,
  b: OrderedExercise,
): number {
  const da = DIFFICULTY_RANK[a.difficulty] ?? 99;
  const db = DIFFICULTY_RANK[b.difficulty] ?? 99;
  if (da !== db) return da - db;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.id.localeCompare(b.id);
}

export function sortGrammarExercises<T extends OrderedExercise>(
  exercises: T[],
): T[] {
  return [...exercises].sort(compareGrammarExercises);
}

/**
 * Of-the-day path keeps one step per difficulty (the primary sort_order),
 * so expanding the practice pool to 10×3 does not lengthen the daily flow.
 */
export function pickOfTheDayExercises<T extends OrderedExercise>(
  exercises: T[],
): T[] {
  const ordered = sortGrammarExercises(exercises);
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const exo of ordered) {
    if (seen.has(exo.difficulty)) continue;
    seen.add(exo.difficulty);
    picked.push(exo);
  }
  return picked;
}

export type ExerciseStepStatus = 'locked' | 'unlocked' | 'completed';

export function exerciseStatusAtIndex(
  index: number,
  lessonCompleted: boolean,
  nextExerciseIndex: number,
): ExerciseStepStatus {
  if (!lessonCompleted) return 'locked';
  if (index < nextExerciseIndex) return 'completed';
  if (index === nextExerciseIndex) return 'unlocked';
  return 'locked';
}
