/**
 * Rule 9 of D4, on its own, where it can be argued with.
 *
 * Every month-end question lives here rather than behind a payment, because the
 * function is pure: no database, no clock, no Prisma. An integration test could
 * only ever reach one month at a time, and the interesting cases are February
 * and the months that follow it.
 *
 * Africa/Douala is UTC+1 all year, so a Douala midnight is the previous day at
 * 23:00 UTC. Every expectation below is written in UTC on purpose — asserting
 * against a formatted Douala string would pass even if the instant were wrong.
 */
import { periodEndAfter } from '../src/modules/centers/billing-period';

/** Midnight in Douala on the given date, as the instant it really is. */
const doualaMidnight = (iso: string) =>
  new Date(`${iso}T00:00:00+01:00`).toISOString();

const endAfter = (from: string, anchorDay: number) =>
  periodEndAfter(new Date(from), anchorDay).toISOString();

describe('periodEndAfter', () => {
  it('ends the period on the anchor day of the next month', () => {
    expect(endAfter('2026-01-01T13:00:00Z', 1)).toBe(
      doualaMidnight('2026-02-01'),
    );
  });

  it('keeps a 31 anchor through February and gives it back in March', () => {
    // The rule this exists for. A school anchored on the 31st must not become a
    // 28th school because February is short.
    const february = endAfter('2026-01-31T12:00:00Z', 31);
    expect(february).toBe(doualaMidnight('2026-02-28'));

    // Anchored on 31 still, so the next period ends on the real day again.
    const march = periodEndAfter(new Date(february), 31);
    expect(march.toISOString()).toBe(doualaMidnight('2026-03-31'));
  });

  it('clamps a 30 anchor in February only', () => {
    expect(endAfter('2026-01-30T12:00:00Z', 30)).toBe(
      doualaMidnight('2026-02-28'),
    );
    expect(endAfter('2026-03-30T12:00:00Z', 30)).toBe(
      doualaMidnight('2026-04-30'),
    );
  });

  it('clamps a 29 anchor in a common February but not in a leap one', () => {
    // 2027 is common, 2028 is a leap year.
    expect(endAfter('2027-01-29T12:00:00Z', 29)).toBe(
      doualaMidnight('2027-02-28'),
    );
    expect(endAfter('2028-01-29T12:00:00Z', 29)).toBe(
      doualaMidnight('2028-02-29'),
    );
  });

  it('rolls the year over from December', () => {
    expect(endAfter('2026-12-15T12:00:00Z', 15)).toBe(
      doualaMidnight('2027-01-15'),
    );
  });

  it('takes the next anchor when this month has already passed it', () => {
    // A center anchored on the 1st paying on the 20th: the next boundary is the
    // 1st of next month, not one in the past.
    expect(endAfter('2026-03-20T12:00:00Z', 1)).toBe(
      doualaMidnight('2026-04-01'),
    );
  });

  it('takes this month when the anchor is still ahead', () => {
    // Paying in grace: `from` is the period that just ended, so the next
    // boundary is the following anchor and no later. A school anchored on the
    // 1st that lapsed on 1 May is paid to 1 June, never 1 July.
    expect(endAfter('2026-05-01T00:00:00+01:00', 1)).toBe(
      doualaMidnight('2026-06-01'),
    );
  });

  it('never returns the instant it was given', () => {
    // `from` is itself an anchor boundary on every renewal. Returning it would
    // sell a period of zero length.
    const onTheBoundary = new Date('2026-06-01T00:00:00+01:00');
    expect(periodEndAfter(onTheBoundary, 1).getTime()).toBeGreaterThan(
      onTheBoundary.getTime(),
    );
  });

  it('lands on a Douala midnight, which is 23:00 UTC the day before', () => {
    // Spelled out, because an off-by-one-hour boundary would make every pro rata
    // day count wrong by a day for anyone paying late in the evening.
    expect(endAfter('2026-01-10T12:00:00Z', 10)).toBe(
      '2026-02-09T23:00:00.000Z',
    );
  });

  it('reads the anchor in Douala, not UTC', () => {
    // 23:30 UTC on the 31st is already the 1st in Douala. A center paying then
    // is anchored on the 1st, and its period ends on the 1st.
    expect(endAfter('2026-01-31T23:30:00Z', 1)).toBe(
      doualaMidnight('2026-03-01'),
    );
  });
});
