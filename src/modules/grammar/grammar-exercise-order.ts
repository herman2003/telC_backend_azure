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
