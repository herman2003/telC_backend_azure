import {
  daysInPeriodEnding,
  periodStartBefore,
  wholeDaysRemaining,
} from './billing-period';
import {
  MIN_PRO_RATA_CHARGE_XAF,
  midPeriodAdditionHt,
  priceSeatsDue,
} from './seat-prorata';

/** Midnight Douala as an ISO instant (UTC). */
const doualaMidnight = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00+01:00`);

describe('Douala day helpers for prorata', () => {
  it('counts 27 days left from 5 Jan to 1 Feb Douala (D4 Alain)', () => {
    expect(
      wholeDaysRemaining(
        doualaMidnight('2026-01-05'),
        doualaMidnight('2026-02-01'),
      ),
    ).toBe(27);
  });

  it('measures January as 31 days for an anchor-1 period ending 1 Feb', () => {
    const paidUntil = doualaMidnight('2026-02-01');
    expect(periodStartBefore(paidUntil, 1).toISOString()).toBe(
      doualaMidnight('2026-01-01').toISOString(),
    );
    expect(daysInPeriodEnding(paidUntil, 1)).toBe(31);
  });
});

describe('midPeriodAdditionHt', () => {
  it('matches the D4 worked example: +6 seats on 5 Jan → 23_600 HT', () => {
    const result = midPeriodAdditionHt({
      addedSeats: 6,
      unitPriceXaf: 4_500,
      paidUntil: doualaMidnight('2026-02-01'),
      now: doualaMidnight('2026-01-05'),
      anchorDay: 1,
    });

    // 6 × 4500 × 27 / 31 ≈ 23_516.13 → ceil to 100 = 23_600
    expect(result).toEqual({
      amountHtXaf: 23_600,
      daysLeft: 27,
      daysInPeriod: 31,
      addedSeats: 6,
    });
  });

  it('applies the minimum charge when a few days remain', () => {
    const result = midPeriodAdditionHt({
      addedSeats: 1,
      unitPriceXaf: 4_500,
      paidUntil: doualaMidnight('2026-02-01'),
      now: doualaMidnight('2026-01-29'),
      anchorDay: 1,
    });

    // 1 × 4500 × 3 / 31 ≈ 435 → ceil 100 = 500 → min 1_000
    expect(result.daysLeft).toBe(3);
    expect(result.amountHtXaf).toBe(MIN_PRO_RATA_CHARGE_XAF);
  });

  it('never returns below the minimum even on the last day', () => {
    const result = midPeriodAdditionHt({
      addedSeats: 1,
      unitPriceXaf: 4_500,
      paidUntil: doualaMidnight('2026-02-01'),
      now: new Date('2026-01-31T22:00:00Z'), // still 31 Jan Douala
      anchorDay: 1,
    });

    expect(result.amountHtXaf).toBe(MIN_PRO_RATA_CHARGE_XAF);
  });
});

describe('priceSeatsDue', () => {
  it('prices a first purchase as the full pack HT', () => {
    expect(
      priceSeatsDue({
        wanted: 10,
        paidSeats: 0,
        paidUntil: null,
        anchorDay: null,
        unitPriceXaf: 4_500,
        now: doualaMidnight('2026-01-19'),
      }),
    ).toEqual({
      midPeriod: false,
      billableSeats: 10,
      amountHtXaf: 45_000,
      daysLeft: null,
      daysInPeriod: null,
    });
  });

  it('prices a mid-period addition with day prorata', () => {
    const due = priceSeatsDue({
      wanted: 16,
      paidSeats: 10,
      paidUntil: doualaMidnight('2026-02-01'),
      anchorDay: 1,
      unitPriceXaf: 4_500,
      now: doualaMidnight('2026-01-05'),
    });

    expect(due.midPeriod).toBe(true);
    expect(due.billableSeats).toBe(6);
    expect(due.amountHtXaf).toBe(23_600);
  });

  it('returns billableSeats 0 without throwing when nothing was added', () => {
    expect(
      priceSeatsDue({
        wanted: 10,
        paidSeats: 10,
        paidUntil: doualaMidnight('2026-02-01'),
        anchorDay: 1,
        unitPriceXaf: 4_500,
        now: doualaMidnight('2026-01-05'),
      }),
    ).toEqual({
      midPeriod: true,
      billableSeats: 0,
      amountHtXaf: 0,
      daysLeft: null,
      daysInPeriod: null,
    });
  });
});
