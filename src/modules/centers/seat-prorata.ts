import {
  anchorDayFrom,
  daysInPeriodEnding,
  wholeDaysRemaining,
} from './billing-period';

/**
 * Floor for a mid-period addition HT amount (B2).
 *
 * One seat with a few days left can land under Mobile Money fees; without a
 * floor the school pays fees that eat the invoice. 1_000 matches the D4
 * worked example (435 → charged 1_000).
 */
export const MIN_PRO_RATA_CHARGE_XAF = 1_000;

export interface MidPeriodProrataInput {
  /** Seats being added (wanted − already paid), ≥ 1. */
  addedSeats: number;
  /** HT catalogue / stamped unit price. */
  unitPriceXaf: number;
  /** Current `paid_until` (period end, midnight Douala). */
  paidUntil: Date;
  /** Clock for "today" in Douala. */
  now: Date;
  /**
   * Anchor day 1–31. Null → derive from `paidUntil` (same derivation the
   * subscription row uses when the column was never stamped).
   */
  anchorDay?: number | null;
}

export interface MidPeriodProrata {
  /** HT amount to charge now (after ceil-to-100, min floor, full-pack ceiling). */
  amountHtXaf: number;
  daysLeft: number;
  daysInPeriod: number;
  addedSeats: number;
}

/**
 * What a center owes for a seat order: full pack, or day-prorata on the delta.
 *
 * Shared by quote and create-payment so both show the same amount due now.
 */
export function priceSeatsDue(args: {
  wanted: number;
  paidSeats: number;
  paidUntil: Date | null;
  anchorDay: number | null;
  unitPriceXaf: number;
  now?: Date;
}): {
  midPeriod: boolean;
  billableSeats: number;
  amountHtXaf: number;
  daysLeft: number | null;
  daysInPeriod: number | null;
} {
  const now = args.now ?? new Date();
  const midPeriod =
    args.paidSeats > 0 &&
    args.paidUntil != null &&
    now.getTime() < args.paidUntil.getTime();

  const billableSeats = midPeriod
    ? args.wanted - args.paidSeats
    : args.wanted;

  // Zero / negative delta: callers map this to NOTHING_TO_PAY — do not call
  // midPeriodAdditionHt (it rejects addedSeats < 1).
  if (billableSeats <= 0) {
    return {
      midPeriod,
      billableSeats,
      amountHtXaf: 0,
      daysLeft: null,
      daysInPeriod: null,
    };
  }

  if (!midPeriod) {
    return {
      midPeriod: false,
      billableSeats,
      amountHtXaf: billableSeats * args.unitPriceXaf,
      daysLeft: null,
      daysInPeriod: null,
    };
  }

  const prorata = midPeriodAdditionHt({
    addedSeats: billableSeats,
    unitPriceXaf: args.unitPriceXaf,
    paidUntil: args.paidUntil!,
    now,
    anchorDay: args.anchorDay,
  });

  return {
    midPeriod: true,
    billableSeats,
    amountHtXaf: prorata.amountHtXaf,
    daysLeft: prorata.daysLeft,
    daysInPeriod: prorata.daysInPeriod,
  };
}

/**
 * HT for seats added mid-period (D4 rule 3).
 *
 * `ceil(added × price × daysLeft / daysInPeriod)` to the next 100 XAF, then at
 * least {@link MIN_PRO_RATA_CHARGE_XAF}, and at most a full pack for the seats
 * added (`added × unitPrice`) so bad dates never bill more than a month.
 * Caller applies VAT via `splitVatXaf`.
 */
export function midPeriodAdditionHt(
  input: MidPeriodProrataInput,
): MidPeriodProrata {
  if (!Number.isInteger(input.addedSeats) || input.addedSeats < 1) {
    throw new Error('addedSeats must be a positive integer');
  }
  if (!Number.isFinite(input.unitPriceXaf) || input.unitPriceXaf <= 0) {
    throw new Error('unitPriceXaf must be positive');
  }

  const anchorDay = input.anchorDay ?? anchorDayFrom(input.paidUntil);
  const daysInPeriod = daysInPeriodEnding(input.paidUntil, anchorDay);
  const daysLeft = wholeDaysRemaining(input.now, input.paidUntil);

  if (daysInPeriod < 1) {
    throw new Error('daysInPeriod must be at least 1');
  }

  // A payment on the last instant still owes the minimum, not zero.
  const effectiveDaysLeft = Math.max(daysLeft, 1);
  const fullPackHt = input.addedSeats * input.unitPriceXaf;
  const exact =
    (fullPackHt * effectiveDaysLeft) / daysInPeriod;
  const roundedUp = Math.ceil(exact / 100) * 100;
  const floored = Math.max(roundedUp, MIN_PRO_RATA_CHARGE_XAF);
  // Ceiling wins over floor if they ever conflict (catalogue pack < min fee).
  const amountHtXaf = Math.min(floored, fullPackHt);

  return {
    amountHtXaf,
    daysLeft: effectiveDaysLeft,
    daysInPeriod,
    addedSeats: input.addedSeats,
  };
}
