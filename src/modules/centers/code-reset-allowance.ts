import type { ActivationCodeStatus } from '@prisma/client';
import { anchorDayFrom, periodEndAfter } from './billing-period';

/**
 * How many times a seat may be handed to a new student (D39), worked out from
 * the event log alone.
 *
 * Without a limit, one paid seat serves a whole class in turn. The limit is
 * counted rather than stored, so there is no counter to drift from what
 * actually happened: the log is the only fact.
 *
 * Two rules decide everything here, and both read the log the same way:
 *   - a RESET is an event whose `previous_code` is filled — never inferred
 *     from status moves;
 *   - a code is USED when the log holds a CONNECTED event since its last
 *     reset (or since it was created).
 *
 * Pure: the caller loads the events and the subscription; this decides.
 */

/** Resets of a used code allowed per paid billing period. */
export const PAID_RESETS_PER_PERIOD = 2;

/** Resets of a used code allowed during the free trial. */
export const TRIAL_RESETS = 1;

export interface CodeEventFact {
  created_at: Date;
  to_status: ActivationCodeStatus;
  previous_code: string | null;
}

export interface SubscriptionFacts {
  trial_started_at: Date | null;
  trial_ends_at: Date | null;
  paid_until: Date | null;
  /**
   * The day of the month this center's periods end on.
   *
   * Null for a center that has been paying since before the column existed; the
   * window then falls back to the day `paid_until` lands on, which is the same
   * answer.
   */
  anchor_day: number | null;
}

export interface ResetAllowance {
  /** Whether a student has redeemed this code since its last reset. */
  used: boolean;
  /** Whether a reset may happen now. Always true for an unused code. */
  allowed: boolean;
  /** Resets of a used code left in this period. */
  remaining: number;
  /**
   * When more resets become available: the next renewal. Null during a trial,
   * where the allowance does not refill.
   */
  resetsAvailableAt: Date | null;
}

export function resetAllowance(
  events: readonly CodeEventFact[],
  subscription: SubscriptionFacts,
  now: Date = new Date(),
): ResetAllowance {
  const { resetsOfUsedCode, usedSinceLastReset } = readLog(events);
  const period = currentPeriod(subscription);

  const counted = period
    ? resetsOfUsedCode.filter((at) => at > period.startsAfter && at <= now)
        .length
    : 0;
  const limit = period?.limit ?? 0;
  const remaining = Math.max(0, limit - counted);

  return {
    used: usedSinceLastReset,
    // A code nobody redeemed costs nothing to reset: a leaked or mistyped
    // value must always be replaceable.
    allowed: !usedSinceLastReset || remaining > 0,
    remaining,
    resetsAvailableAt: period?.resetsAvailableAt ?? null,
  };
}

/**
 * Walks the log in order, splitting it at each reset.
 *
 * A reset only counts against the limit if the stretch before it held a
 * CONNECTED event — resetting a code nobody used is free, so it must not eat
 * into the allowance either.
 */
function readLog(events: readonly CodeEventFact[]): {
  resetsOfUsedCode: Date[];
  usedSinceLastReset: boolean;
} {
  const ordered = [...events].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime(),
  );

  const resetsOfUsedCode: Date[] = [];
  let connectedInThisStretch = false;

  for (const event of ordered) {
    if (event.previous_code !== null) {
      if (connectedInThisStretch) {
        resetsOfUsedCode.push(event.created_at);
      }
      connectedInThisStretch = false;
      continue;
    }

    if (event.to_status === 'CONNECTED') {
      connectedInThisStretch = true;
    }
  }

  return { resetsOfUsedCode, usedSinceLastReset: connectedInThisStretch };
}

/**
 * The boundary the period ending at `endsAt` began on.
 *
 * `periodEndAfter` only answers forwards, so this steps back past the start it is
 * looking for and asks which boundary comes next. Keeping one direction of
 * month-end arithmetic is worth the hop: a backwards version would need its own
 * clamping rule, and the two would disagree in February.
 *
 * THIRTY-FIVE DAYS, which is more than the longest month on purpose. It lands
 * four to seven days before the start being looked for — past it, so the next
 * boundary is that start — and still comfortably inside the period before,
 * whose own start is at least twenty-eight days further back. Twenty-seven days
 * would land *after* the start and return the end again.
 */
function periodStartOf(endsAt: Date, anchorDay: number): Date {
  const beforeTheStart = new Date(endsAt.getTime() - 35 * 24 * 60 * 60 * 1000);

  return periodEndAfter(beforeTheStart, anchorDay);
}

/**
 * The window the limit is counted in.
 *
 * Paid: the period ending at `paid_until`, which starts at the anchor day one
 * month earlier (D4 rule 9). Subtracting a calendar month from `paid_until` gave
 * nearly the same answer, but not at the month ends it mattered at: a center
 * anchored on the 31st got a window starting on the 28th of February and another
 * starting on the 3rd of March, so a reset could fall outside both and be
 * counted twice, or inside both and be counted never.
 *
 * Trial: the trial itself, where the allowance does not refill.
 */
function currentPeriod(subscription: SubscriptionFacts): {
  startsAfter: Date;
  limit: number;
  resetsAvailableAt: Date | null;
} | null {
  if (subscription.paid_until) {
    const anchorDay =
      subscription.anchor_day ?? anchorDayFrom(subscription.paid_until);

    return {
      // One period back: the boundary this one started at. `periodEndAfter`
      // answers forwards, so it is asked from a day inside the previous period.
      startsAfter: periodStartOf(subscription.paid_until, anchorDay),
      limit: PAID_RESETS_PER_PERIOD,
      resetsAvailableAt: subscription.paid_until,
    };
  }

  if (subscription.trial_started_at) {
    return {
      // Inclusive of a reset in the trial's first instant.
      startsAfter: new Date(subscription.trial_started_at.getTime() - 1),
      limit: TRIAL_RESETS,
      resetsAvailableAt: null,
    };
  }

  // A center with neither is not finalized and cannot act on codes at all;
  // the lock refuses it before this is asked.
  return null;
}
