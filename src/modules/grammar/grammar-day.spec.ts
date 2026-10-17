import { MODELLTEST_PERIOD_EPOCH_MS } from '../modelltests/seven-day-period';
import { grammarDayIndex, topicOfTheDay } from './grammar-day';

describe('topicOfTheDay', () => {
  const pool = ['a', 'b', 'c'] as const;

  it('is deterministic for the same instant', () => {
    const now = new Date(MODELLTEST_PERIOD_EPOCH_MS + 10 * 86_400_000);
    expect(topicOfTheDay(pool, now)).toBe(topicOfTheDay(pool, now));
  });

  it('advances with the day index', () => {
    const day0 = new Date(MODELLTEST_PERIOD_EPOCH_MS);
    const day1 = new Date(MODELLTEST_PERIOD_EPOCH_MS + 86_400_000);
    expect(topicOfTheDay(pool, day0)).toBe('a');
    expect(topicOfTheDay(pool, day1)).toBe('b');
  });

  it('cycles when the pool is smaller than seven days', () => {
    const day3 = new Date(MODELLTEST_PERIOD_EPOCH_MS + 3 * 86_400_000);
    expect(topicOfTheDay(pool, day3)).toBe('a');
    expect(grammarDayIndex(day3) % pool.length).toBe(0);
  });

  it('throws when the pool is empty', () => {
    expect(() => topicOfTheDay([], new Date())).toThrow('GRAMMAR_POOL_EMPTY');
  });
});
