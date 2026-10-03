import { doualaDayOfMonth } from '../src/modules/centers/payment-activation.service';

/**
 * Which day it is where the school is.
 *
 * A pure function, tested with fixed instants, because the integration test
 * that covers it can only tell Douala from UTC between 23:00 and midnight —
 * a test that can fail for one hour in twenty-four is not a test, it is a
 * coin that usually lands the same way.
 *
 * Africa/Douala is UTC+1 all year: Cameroon has never observed daylight
 * saving, which is why a fixed offset would have worked and why reading the
 * zone still beats hard-coding one.
 */
describe('doualaDayOfMonth', () => {
  it('agrees with UTC during the day', () => {
    expect(doualaDayOfMonth(new Date('2026-10-15T09:00:00Z'))).toBe(15);
  });

  it('is already tomorrow after 23:00 UTC', () => {
    // The case the anchor day exists for. A school paying at 23:30 on the
    // 15th anchors on the 16th, because that is the date on the calendar in
    // the room where somebody pressed the button.
    expect(doualaDayOfMonth(new Date('2026-10-15T23:30:00Z'))).toBe(16);
  });

  it('rolls into the next month, not past the end of this one', () => {
    expect(doualaDayOfMonth(new Date('2026-10-31T23:30:00Z'))).toBe(1);
  });

  it('crosses the year the same way', () => {
    expect(doualaDayOfMonth(new Date('2026-12-31T23:30:00Z'))).toBe(1);
  });

  it('handles the last hour of a short month', () => {
    expect(doualaDayOfMonth(new Date('2027-02-28T23:30:00Z'))).toBe(1);
  });
});
