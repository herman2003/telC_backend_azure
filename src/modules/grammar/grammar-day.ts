import { MODELLTEST_PERIOD_EPOCH_MS } from '../modelltests/seven-day-period';

const MS_PER_DAY = 86_400_000;

export function grammarDayIndex(now: Date = new Date()): number {
  return Math.floor((now.getTime() - MODELLTEST_PERIOD_EPOCH_MS) / MS_PER_DAY);
}

export function grammarDayBounds(now: Date = new Date()): {
  date: string;
  indexInEpoch: number;
  nextThemeAt: Date;
} {
  const indexInEpoch = grammarDayIndex(now);
  const dayStartMs = MODELLTEST_PERIOD_EPOCH_MS + indexInEpoch * MS_PER_DAY;
  const nextThemeAt = new Date(dayStartMs + MS_PER_DAY);
  const date = new Date(dayStartMs).toISOString().slice(0, 10);
  return { date, indexInEpoch, nextThemeAt };
}

/**
 * Pick today's topic from an ordered published pool.
 * Throws if the pool is empty.
 */
export function topicOfTheDay<T>(
  pool: readonly T[],
  now: Date = new Date(),
): T {
  if (pool.length === 0) {
    throw new Error('GRAMMAR_POOL_EMPTY');
  }
  const index = grammarDayIndex(now) % pool.length;
  return pool[index];
}
