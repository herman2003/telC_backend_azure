/** Fixed UTC epoch. Changing this in production resets every student's window. */
export const MODELLTEST_PERIOD_EPOCH_MS = Date.UTC(2026, 0, 1);

const MS_PER_DAY = 86_400_000;
const DAYS_PER_PERIOD = 7;

export interface SevenDayPeriod {
  /** 0-based index of the 7-day window since the epoch. */
  periodIndex: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Rolling 7×24h windows from MODELLTEST_PERIOD_EPOCH_MS (UTC).
 * Not calendar weeks — flip can fall on any weekday.
 */
export function getSevenDayPeriod(now: Date = new Date()): SevenDayPeriod {
  const nowMs = now.getTime();
  const dayIndex = Math.floor((nowMs - MODELLTEST_PERIOD_EPOCH_MS) / MS_PER_DAY);
  const periodIndex = Math.floor(dayIndex / DAYS_PER_PERIOD);
  const periodStartMs =
    MODELLTEST_PERIOD_EPOCH_MS + periodIndex * DAYS_PER_PERIOD * MS_PER_DAY;
  const periodEndMs = periodStartMs + DAYS_PER_PERIOD * MS_PER_DAY - 1;

  return {
    periodIndex,
    periodStart: new Date(periodStartMs),
    periodEnd: new Date(periodEndMs),
  };
}
