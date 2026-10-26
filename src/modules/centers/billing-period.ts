/**
 * When a center's paid period ends.
 *
 * A calendar month ending on the center's anchor day, in Africa/Douala — not
 * thirty days after it paid (D4 rule 9). Thirty days made the renewal date
 * wander: a school paying on the 1st of January was due on the 31st in March,
 * and a school is not a stopwatch.
 *
 * Pure on purpose. No database, no clock of its own, no Prisma — everything
 * arrives as arguments, which is what lets February be a unit test instead of a
 * thing discovered in production next February.
 *
 * Africa/Douala is UTC+1 the whole year with no daylight saving, which is why
 * this is arithmetic rather than a timezone library. The offset is stated once,
 * here, and nowhere else.
 */

/** Africa/Douala, all year. */
const DOUALA_OFFSET_MS = 60 * 60 * 1000;

/** The day of the month in Douala — the day a center's periods end on. */
export function anchorDayFrom(at: Date): number {
  return doualaParts(at).day;
}

/**
 * The first period boundary strictly after `from`.
 *
 * STRICTLY after, because on a renewal `from` is itself a boundary: the period
 * that just ended. Returning it would sell a period of no length at all.
 *
 * That one rule covers every case the decisions doc lists, which is why there is
 * no flag here saying which it is:
 *
 * - a first purchase, where `from` is the payment and the anchor its own day, so
 *   the boundary is that day next month;
 * - paying early, where `from` is the current `paid_until`, so the days already
 *   bought are kept rather than thrown away;
 * - paying in grace, where `from` is the period that lapsed, so a school
 *   anchored on the 1st that pays on the 6th is paid to the 1st of next month
 *   and not the one after — it had access through those six days.
 */
export function periodEndAfter(from: Date, anchorDay: number): Date {
  const { year, month } = doualaParts(from);

  // This month's boundary first. It is the answer whenever the anchor is still
  // ahead of `from`, which is what keeps a lapsed period from skipping a month.
  const thisMonth = boundaryOf(year, month, anchorDay);
  if (thisMonth.getTime() > from.getTime()) return thisMonth;

  return month === 12
    ? boundaryOf(year + 1, 1, anchorDay)
    : boundaryOf(year, month + 1, anchorDay);
}

/**
 * Midnight in Douala on the anchor day of one month, clamped to that month.
 *
 * CLAMPED ON READ, NEVER STORED. An anchor of 31 shows up as the 28th in
 * February and as the 31st again in March. Writing the clamped day back would
 * turn a 31 center into a 28 center for good, which is the bug rule 9 exists to
 * prevent.
 *
 * Midnight rather than the hour the center happened to pay at: a period boundary
 * is a day, and pro rata counts whole days left. An instant carrying somebody's
 * payment time makes "days left" a fraction, and the fraction would have to be
 * rounded somewhere less visible than here.
 */
function boundaryOf(year: number, month: number, anchorDay: number): Date {
  const day = Math.min(anchorDay, daysInMonth(year, month));

  return new Date(Date.UTC(year, month - 1, day) - DOUALA_OFFSET_MS);
}

/** Day zero of the next month is the last day of this one. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Midnight Douala that opened the period ending at `paidUntil`.
 *
 * `paidUntil` is itself a period boundary (midnight Douala on the anchor day).
 * The current period started on the previous month's boundary — same clamp
 * rules as `periodEndAfter`.
 */
export function periodStartBefore(paidUntil: Date, anchorDay: number): Date {
  const { year, month } = doualaParts(paidUntil);

  return month === 1
    ? boundaryOf(year - 1, 12, anchorDay)
    : boundaryOf(year, month - 1, anchorDay);
}

/**
 * Whole Douala calendar days from `from` (that day inclusive) until
 * `untilExclusive` (that Douala day exclusive).
 *
 * Pro rata counts days, not hours: paying on 5 Jan with `paid_until` = 1 Feb
 * midnight Douala leaves 27 days (5–31 Jan), matching D4's worked example.
 */
export function wholeDaysRemaining(from: Date, untilExclusive: Date): number {
  const start = startOfDoualaDay(from);
  const end = startOfDoualaDay(untilExclusive);
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / 86_400_000);
}

/** Length of the open period ending at `paidUntil`, in whole Douala days. */
export function daysInPeriodEnding(
  paidUntil: Date,
  anchorDay: number,
): number {
  return wholeDaysRemaining(periodStartBefore(paidUntil, anchorDay), paidUntil);
}

/**
 * The calendar date in Douala, as numbers.
 *
 * Shifting the instant by the offset and reading it in UTC, rather than
 * formatting and parsing it back: `Intl` would answer the same question, and
 * then the answer would have to be turned from strings into numbers, which is
 * where a locale puts the month where the day should be.
 */
function doualaParts(at: Date): { year: number; month: number; day: number } {
  const shifted = new Date(at.getTime() + DOUALA_OFFSET_MS);

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function startOfDoualaDay(at: Date): Date {
  const { year, month, day } = doualaParts(at);
  return new Date(Date.UTC(year, month - 1, day) - DOUALA_OFFSET_MS);
}
