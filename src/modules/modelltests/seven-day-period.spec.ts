import {
  getSevenDayPeriod,
  MODELLTEST_PERIOD_EPOCH_MS,
} from './seven-day-period';

const MS_PER_DAY = 86_400_000;

describe('getSevenDayPeriod', () => {
  it('starts period 0 at the epoch', () => {
    const { periodIndex, periodStart } = getSevenDayPeriod(
      new Date(MODELLTEST_PERIOD_EPOCH_MS),
    );

    expect(periodIndex).toBe(0);
    expect(periodStart.getTime()).toBe(MODELLTEST_PERIOD_EPOCH_MS);
  });

  it('stays on the same period through day 6', () => {
    const a = getSevenDayPeriod(
      new Date(MODELLTEST_PERIOD_EPOCH_MS + 6 * MS_PER_DAY),
    );
    const b = getSevenDayPeriod(new Date(MODELLTEST_PERIOD_EPOCH_MS));

    expect(a.periodIndex).toBe(b.periodIndex);
    expect(a.periodStart.getTime()).toBe(b.periodStart.getTime());
  });

  it('advances on day 7', () => {
    const day7 = getSevenDayPeriod(
      new Date(MODELLTEST_PERIOD_EPOCH_MS + 7 * MS_PER_DAY),
    );

    expect(day7.periodIndex).toBe(1);
    expect(day7.periodStart.getTime()).toBe(
      MODELLTEST_PERIOD_EPOCH_MS + 7 * MS_PER_DAY,
    );
  });
});
