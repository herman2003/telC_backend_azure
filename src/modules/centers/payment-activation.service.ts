import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type EntitlementProduct } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { generateActivationCode } from './activation-code-format';
import {
  GRACE_PERIOD_DAYS,
  SubscriptionPolicyService,
} from './subscription-policy.service';
import { anchorDayFrom, periodEndAfter } from './billing-period';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The payment kinds that grant an entitlement rather than seats or a period.
 *
 * `PaymentKind` and `EntitlementProduct` share their names deliberately, so an
 * invoice line and the row it granted read alike, and this set is the one
 * place that relies on it.
 */
const ENTITLEMENT_KINDS = new Set<string>([
  'PREP_PASS',
  'AI_SPEAKING_CREDIT',
  'AI_ASSISTED_LEARNING',
]);

interface CapTargets {
  codeIds: string[];
  capPerCode: number;
}

/**
 * What the manager chose, read back out of a JSON column.
 *
 * Shape-checked rather than cast. The column is written from a request, and
 * anything unrecognisable means no caps rather than a failed activation — the
 * money has already moved.
 */
function readCapTargets(metadata: Prisma.JsonValue | null): CapTargets | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const { codeIds, capPerCode } = metadata as Record<string, unknown>;
  if (!Array.isArray(codeIds) || codeIds.length === 0) return null;
  if (typeof capPerCode !== 'number' || !Number.isInteger(capPerCode)) {
    return null;
  }
  if (capPerCode <= 0) return null;

  const ids = codeIds.filter((id): id is string => typeof id === 'string');
  return ids.length > 0 ? { codeIds: ids, capPerCode } : null;
}

/**
 * Generous on purpose. This runs from a provider webhook, where a slow answer
 * costs nothing and a spurious failure makes the provider retry. Concurrent
 * activations for one center also queue behind each other's row locks, so the
 * second must be allowed to wait for the first.
 */
const ACTIVATION_TRANSACTION = { maxWait: 10_000, timeout: 20_000 };

/**
 * Today's day of the month in Africa/Douala.
 *
 * Through `Intl` rather than by adding an hour to UTC: the offset is a fact
 * about the zone, not a constant, and hard-coding +1 is how a date library
 * eventually gets it wrong.
 */
export type ActivationOutcome = 'ACTIVATED' | 'ALREADY_ACTIVE';

export interface ActivationResult {
  outcome: ActivationOutcome;
  paymentId: string;
  centerId: string;
  paidUntil: Date | null;
}

export interface FailureResult {
  outcome: 'MARKED_FAILED' | 'UNCHANGED';
  paymentId: string;
}

/**
 * The one place a payment turns into access.
 *
 * Everything a successful payment changes happens here, in one transaction:
 * the payment's status, the center's seat rows, its plan and `paid_until`.
 * Provider code — the fake one today, Notch Pay tomorrow — verifies that money
 * moved and then calls `activate`. It never writes these tables itself. A
 * second writer is exactly how grandfathering or the exactly-once rule would
 * be broken.
 */
@Injectable()
export class PaymentActivationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SubscriptionPolicyService,
  ) {}

  /**
   * Grants what a payment bought, exactly once.
   *
   * EXACTLY ONCE comes from a compare-and-swap on the payment row: only a
   * payment not already SUCCEEDED is moved to SUCCEEDED, and a duplicated or
   * concurrent call updates zero rows and changes nothing else. The row lock
   * that update takes makes a concurrent second call wait, then find the
   * payment already settled.
   *
   * A payment marked FAILED or EXPIRED still activates. The provider is the
   * authority on whether money moved, and a success that arrives late has
   * still taken the center's money.
   *
   * SEATS ARE SET, NOT ADDED. A payment's seat count is everything the center
   * will hold, the same "totals, not increments" meaning the quote has. The
   * quantity AND the price are written; stamping the payment's own price
   * rather than today's list price is what keeps grandfathering true, and it
   * overwrites a zero-priced trial seat with the paid one.
   *
   * MONEY RECEIVED IS HONOURED. If students were provisioned between quote and
   * payment, the center may now be over its seats. Activation still succeeds:
   * refusing would take the money and grant nothing, and being over the limit
   * already blocks new provisioning without evicting anyone.
   */
  async activate(paymentId: string): Promise<ActivationResult> {
    return this.prisma.$transaction(async (tx) => {
      const settled = await tx.payment.updateMany({
        where: { id: paymentId, status: { not: 'SUCCEEDED' } },
        data: { status: 'SUCCEEDED', succeeded_at: new Date() },
      });

      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        select: {
          center_id: true,
          kind: true,
          quantity: true,
          unit_price_xaf: true,
          renews_period: true,
          metadata: true,
        },
      });

      if (!payment) {
        throw new NotFoundException('PAYMENT_NOT_FOUND');
      }

      if (settled.count === 0) {
        // Already applied. Report where the center stands and change nothing.
        const subscription = await tx.centerSubscription.findUnique({
          where: { center_id: payment.center_id },
          select: { paid_until: true },
        });

        return {
          outcome: 'ALREADY_ACTIVE',
          paymentId,
          centerId: payment.center_id,
          paidUntil: subscription?.paid_until ?? null,
        };
      }

      // What the money bought. Exam slots are a balance, not a period: a
      // center that buys slots is not thereby paid up, and a center that is
      // paid up does not thereby hold slots.
      // Both exam products, each into its own pool. Matching only
      // EXAM_SLOTS would send an AI purchase down the seats path: it would
      // extend the subscription, overwrite the seat row, and leave the
      // center with no exam slots at all for money it had spent.
      if (payment.kind === 'EXAM_SLOTS' || payment.kind === 'EXAM_SLOTS_AI') {
        const pool =
          payment.kind === 'EXAM_SLOTS_AI'
            ? { exam_ai_slots_remaining: { increment: payment.quantity } }
            : { exam_slots_remaining: { increment: payment.quantity } };

        await tx.center.update({
          where: { id: payment.center_id },
          data: pool,
        });

        const subscription = await tx.centerSubscription.findUnique({
          where: { center_id: payment.center_id },
          select: { paid_until: true },
        });

        return {
          outcome: 'ACTIVATED',
          paymentId,
          centerId: payment.center_id,
          // Reported, not moved: buying an exam does not extend a
          // subscription, and the caller should see that it did not.
          paidUntil: subscription?.paid_until ?? null,
        };
      }

      // The add-ons. Like exam slots, a balance rather than a period: buying
      // credits is not paying for Start, and a centre that tops up must not
      // thereby extend the period it owes money for.
      if (ENTITLEMENT_KINDS.has(payment.kind)) {
        await this.grantEntitlement(
          tx,
          payment.center_id,
          payment.kind as unknown as EntitlementProduct,
          payment.quantity,
          payment.metadata,
        );

        const subscription = await tx.centerSubscription.findUnique({
          where: { center_id: payment.center_id },
          select: { paid_until: true },
        });

        return {
          outcome: 'ACTIVATED',
          paymentId,
          centerId: payment.center_id,
          // Reported, not moved, for the same reason exam slots report it.
          paidUntil: subscription?.paid_until ?? null,
        };
      }

      // Before the paid period is extended, and that order is load-bearing:
      // the anchor day only moves for a centre that was BLOCKED, and blocked
      // is derived from `paid_until`. Extending first would make every centre
      // look ACTIVE here, so one coming back after a lapse would keep an
      // anchor day it is no longer paying for.
      //
      // Only for a payment that starts a period, for the same reason it does
      // not move the date. A centre that adds a seat and whose webhook lands
      // more than a week later reads as BLOCKED here, and would have its
      // renewal day rewritten by a payment that bought no period at all.
      if (payment.renews_period) {
        await this.setAnchorDay(tx, payment.center_id);
      }
      // Only a payment that starts a period moves the date. A mid-period
      // addition reports where the period already stood (D4 rule 3), and the
      // row decides that — not the clock, which by now may have passed the
      // end of the period the center is still inside of.
      const paidUntil = payment.renews_period
        ? await this.extendPaidPeriod(tx, payment.center_id)
        : await this.currentPaidUntil(tx, payment.center_id);
      await this.setSeats(
        tx,
        payment.center_id,
        payment.quantity,
        payment.unit_price_xaf,
      );
      await this.retireTrialCodes(tx, payment.center_id);
      await this.retireSurplusCodes(tx, payment.center_id, payment.quantity);
      await this.mintMissingCodes(tx, payment.center_id, payment.quantity);

      return {
        outcome: 'ACTIVATED',
        paymentId,
        centerId: payment.center_id,
        paidUntil,
      };
    }, ACTIVATION_TRANSACTION);
  }

  /**
   * Records that the provider reported the payment failed.
   *
   * Only a PENDING payment moves, so a failure event arriving after the
   * success — out of order — can never undo access that was granted.
   */
  async markFailed(paymentId: string): Promise<FailureResult> {
    const moved = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'FAILED', failed_at: new Date() },
    });

    if (moved.count === 1) {
      return { outcome: 'MARKED_FAILED', paymentId };
    }

    const exists = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }

    return { outcome: 'UNCHANGED', paymentId };
  }

  /**
   * Adds one paid period, from the later of now and the current end.
   *
   * From the current end, so paying early does not throw away days already
   * bought; from now, so a lapsed center does not buy days in the past.
   *
   * The subscription row is locked first (`FOR UPDATE`). Two different
   * payments for one center activating at once would otherwise both read the
   * same `paid_until`, both add thirty days, and one period would be lost. With
   * the lock, the second waits, then reads the extended value. The new date is
   * computed here rather than in SQL because the column is a timestamp without
   * a time zone, and date arithmetic across the driver boundary can shift by
   * the local UTC offset.
   */
  /**
   * Credits the unallocated pool, then assigns to seats the manager chose.
   *
   * The order matters. **The pool is credited whatever happens to the
   * assignments**: the money has moved, and an activation that failed because
   * one seat had been deactivated would leave the centre paying for nothing.
   * A seat that cannot be assigned is skipped; those units stay unallocated.
   *
   * For AI Speaking (ADR 0003), each successful assign moves `capPerCode` from
   * the pool onto the seat. Prep Pass / AI Assisted Learning only use the
   * pool (period grants happen later); metadata caps are ignored for them.
   *
   * `metadata` is treated as untrusted: only codes that still exist, still
   * belong to this centre and are not deactivated get an assignment.
   */
  private async grantEntitlement(
    tx: Prisma.TransactionClient,
    centerId: string,
    product: EntitlementProduct,
    quantity: number,
    metadata: Prisma.JsonValue | null,
  ): Promise<void> {
    await tx.centerEntitlementPool.upsert({
      where: { center_id_product: { center_id: centerId, product } },
      create: { center_id: centerId, product, balance: quantity },
      // Accumulates. A second purchase is more of the same pot, never a reset.
      update: { balance: { increment: quantity } },
    });

    if (product !== 'AI_SPEAKING_CREDIT') return;

    const targets = readCapTargets(metadata);
    if (!targets) return;

    const usable = await tx.activationCode.findMany({
      where: {
        id: { in: targets.codeIds },
        center_id: centerId,
        status: { not: 'DEACTIVATED' },
      },
      select: { id: true },
    });

    for (const code of usable) {
      const moved = await tx.centerEntitlementPool.updateMany({
        where: {
          center_id: centerId,
          product,
          balance: { gte: targets.capPerCode },
        },
        data: { balance: { decrement: targets.capPerCode } },
      });
      if (moved.count !== 1) {
        // Remaining units stay unallocated. Do not fail the activation.
        break;
      }

      await tx.codeEntitlementCap.upsert({
        where: { code_id_product: { code_id: code.id, product } },
        create: { code_id: code.id, product, cap: targets.capPerCode },
        // Raised, not replaced: a second purchase for one seat is more
        // assigned stock, and replacing would silently undo a hand raise.
        update: { cap: { increment: targets.capPerCode } },
      });
    }
  }

  /**
   * Where the period stands, for a payment that must not move it.
   *
   * Locked like `extendPaidPeriod` locks, so a renewal committing alongside
   * this addition is reported as the row the center ends up with rather than
   * the one it had a moment earlier.
   */
  private async currentPaidUntil(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
  ): Promise<Date | null> {
    const rows = await tx.$queryRaw<{ paid_until: Date | null }[]>`
      SELECT paid_until
        FROM center_subscriptions
       WHERE center_id = ${centerId}
         FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('CENTER_SUBSCRIPTION_NOT_FOUND');
    }

    return rows[0].paid_until;
  }

  private async extendPaidPeriod(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
  ): Promise<Date> {
    const rows = await tx.$queryRaw<
      { paid_until: Date | null; anchor_day: number | null }[]
    >`
      SELECT paid_until, anchor_day
        FROM center_subscriptions
       WHERE center_id = ${centerId}
         FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('CENTER_SUBSCRIPTION_NOT_FOUND');
    }

    const now = new Date();
    const { paid_until: current, anchor_day: anchor } = rows[0];

    // WHERE THE NEW PERIOD STARTS FROM, which is the whole of rules 7 and 9.
    //
    // While the center is paid up, and through the grace week after that, the
    // period runs from the one that ended: days already bought are not thrown
    // away, and a school paying six days late is not given those six days for
    // nothing — it had access through them. Once grace has run out the center
    // was blocked, blocked days are not charged, and the period starts today.
    const lapsed =
      current === null ||
      now.getTime() >= current.getTime() + GRACE_PERIOD_DAYS * DAY_MS;
    const from = lapsed ? now : current;

    // `setAnchorDay` ran first, so a first purchase and a center coming back
    // from blocked already have one. A center that has been paying since before
    // the column existed does not, and its anchor is the day its current period
    // ends on — which is what the reset window has always assumed.
    const paidUntil = periodEndAfter(from, anchor ?? anchorDayFrom(from));

    await tx.centerSubscription.update({
      where: { center_id: centerId },
      data: { plan: 'PAID', paid_until: paidUntil },
    });

    return paidUntil;
  }

  /** The payment's quantity and price, written onto the center's seat row. */
  /**
   * Remembers the day of the month this centre's periods end on (D4 rule 9).
   *
   * A day, not a date, because the rule is that the day survives months that
   * do not have it: 31 January becomes 28 February and then 31 March again.
   * A stored date would lose that the first time it met a short month.
   *
   * Counted in **Africa/Douala**. The server runs in UTC, and Douala is an
   * hour ahead, so a school paying at 23:30 UTC on the 31st has already
   * reached the 1st where it is sitting. Anchoring on the 31st would bill it
   * a day early, every month, for the life of the account.
   *
   * SET ONCE, then left alone. Adding seats mid-period must never move the
   * renewal date (rule 3) — the exception is a centre that was BLOCKED, where
   * paying starts a new period that day because the blocked days were never
   * charged (rule 7). A centre in grace keeps its day: it is late, not
   * starting again.
   *
   * Nothing reads this yet. It is captured now because it cannot be recovered
   * later — the day a school first paid is only knowable on the day it pays —
   * and `code-reset-allowance.ts` already names it as what will replace its
   * stand-in period.
   */
  private async setAnchorDay(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
  ): Promise<void> {
    const subscription = await tx.centerSubscription.findUnique({
      where: { center_id: centerId },
      select: {
        anchor_day: true,
        plan: true,
        trial_started_at: true,
        trial_ends_at: true,
        paid_until: true,
      },
    });
    if (!subscription) return;

    const blocked = this.policy.evaluate(subscription).status === 'BLOCKED';
    if (subscription.anchor_day !== null && !blocked) return;

    // A center that has been paying since before this column existed keeps the
    // day it has been renewing on, which is the day its current period ends.
    // Stamping today instead would move a renewal date the school is already
    // used to, and shorten the period it had paid for — the one thing rule 3
    // and rule 7 agree must not happen outside a lapse.
    //
    // Today's date only for a first purchase, which has no period yet, and for a
    // center coming back from blocked, where rule 7 says a new period starts on
    // the day it pays.
    const keepsItsDay = !blocked && subscription.paid_until !== null;

    await tx.centerSubscription.update({
      where: { center_id: centerId },
      data: {
        anchor_day: anchorDayFrom(
          keepsItsDay ? subscription.paid_until! : new Date(),
        ),
      },
    });
  }

  /**
   * Replaces the trial's codes with paid ones.
   *
   * A trial code carries an expiry of its own; a paid code carries none and
   * follows the center's `paid_until`. That difference is what identifies a
   * trial code here, and it is also why leaving one alone would be a bug: the
   * student would lose access on the old trial date, days after their school
   * paid (D4 rule 2).
   *
   * THE ORDER IS LOAD-BEARING. A student may hold at most one connected code
   * — a partial unique index, migration 20260918200000 — so the replacement
   * cannot be inserted while the trial one is still CONNECTED. The old row is
   * deactivated first, in the same transaction, and only then is the new one
   * written.
   *
   * AND THE STUDENT KEEPS THEIR SCHOOL. The ordinary deactivation path clears
   * `students.center_id`, because that is how a manager removes somebody.
   * Here nobody is being removed: they are being moved onto the seat their
   * school has just paid for, and clearing it would cut off the one student
   * the payment was meant to keep.
   *
   * Runs on every paid activation and finds nothing after the first, because
   * no dated code is left to find.
   */
  private async retireTrialCodes(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
  ): Promise<void> {
    const dated = await tx.activationCode.findMany({
      where: {
        center_id: centerId,
        expires_at: { not: null },
        status: { not: 'DEACTIVATED' },
      },
      select: {
        id: true,
        status: true,
        student_id: true,
        linked_name: true,
        linked_email: true,
        connected_at: true,
      },
    });

    for (const code of dated) {
      await tx.activationCode.update({
        where: { id: code.id },
        data: { status: 'DEACTIVATED' },
      });

      await tx.activationCodeEvent.create({
        data: {
          code_id: code.id,
          center_id: centerId,
          // Nobody at the school acted. The payment did.
          center_user_id: null,
          from_status: code.status,
          to_status: 'DEACTIVATED',
          student_id: code.student_id,
        },
      });

      // Only a redeemed one needs a replacement carrying its student. An
      // unredeemed trial code is simply gone, and `mintMissingCodes` tops the
      // center back up to its quota.
      if (!code.student_id) continue;

      const moved = await tx.activationCode.create({
        data: {
          center_id: centerId,
          code: generateActivationCode(),
          status: 'CONNECTED',
          student_id: code.student_id,
          // Copied, so the Users page still names the person on the seat
          // rather than showing a connected row with nobody on it.
          linked_name: code.linked_name,
          linked_email: code.linked_email,
          connected_at: code.connected_at,
          expires_at: null,
        },
      });

      await tx.activationCodeEvent.create({
        data: {
          code_id: moved.id,
          center_id: centerId,
          center_user_id: null,
          from_status: 'ACTIVATED',
          to_status: 'CONNECTED',
          student_id: code.student_id,
        },
      });
    }
  }

  /**
   * Gives the center one code per seat it has paid for.
   *
   * Without this a school could buy ten places and enrol one student: seats
   * were counted and the paid period extended, but codes were created in
   * exactly one place in the backend — the trial — so there was nothing to
   * hand out (D4 rule 2).
   *
   * TOPS UP, NEVER REPLACES. Ten seats with one code already held means nine
   * new ones. Existing codes are never touched: somebody may be using one,
   * and a code is how a student keeps their access.
   *
   * DEACTIVATED ONES DO NOT COUNT. That status is terminal — nothing brings a
   * code back — so counting them would quietly cost a school a seat it keeps
   * paying for every time a manager takes one back.
   *
   * TWO SEPARATE GUARDS, against two separate mistakes. A replayed webhook
   * never reaches here at all: the compare-and-swap on the payment row sends
   * a second call for the same payment down the ALREADY_ACTIVE path. What
   * the counting protects against is a SECOND PAYMENT — a renewal — which
   * legitimately runs this branch again. Without it, a school renewing ten
   * seats would end up holding twenty codes, and twenty places to learn for
   * the price of ten.
   *
   * The count sits inside the transaction that mints, so two payments landing
   * together cannot both see an empty centre: the second waits on the first's
   * locks and then counts its rows.
   *
   * On the rare collision the unique index rejects the insert and the whole
   * activation fails, which is what `generateActivationCode` documents as the
   * caller's job: the provider retries the webhook and the retry generates
   * fresh values. A pre-check would be, in that function's words, a race
   * dressed up as a guarantee.
   */
  /**
   * Hands back the codes a smaller pack stopped paying for.
   *
   * A renewal may shrink (D4 rule 5), and seats ARE the code pool (D1): without
   * this, a school renewing seventeen seats as twelve would keep seventeen
   * working codes for twelve seats' money, forever, since a paid code carries
   * no expiry of its own.
   *
   * ONLY CODES NOBODY HOLDS. A connected code is a student with access, and
   * this file does not evict students — the same stance activation already
   * takes when a center ends up over its seats ("being over the limit already
   * blocks new provisioning without evicting anyone"). So a pack that shrinks
   * below the number of connected students sheds what it can and leaves the
   * rest; the floors in `PricingService` are what keep that from happening,
   * because an order below the student count is refused before it is priced.
   *
   * Newest first, so the codes a school has had longest — and most likely
   * written down or handed out — are the ones that survive.
   */
  private async retireSurplusCodes(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
    seats: number,
  ): Promise<void> {
    const live = await tx.activationCode.count({
      where: { center_id: centerId, status: { not: 'DEACTIVATED' } },
    });

    const surplus = live - seats;
    if (surplus <= 0) return;

    const spare = await tx.activationCode.findMany({
      where: { center_id: centerId, status: 'ACTIVATED' },
      orderBy: { created_at: 'desc' },
      take: surplus,
      select: { id: true, status: true },
    });

    for (const code of spare) {
      await tx.activationCode.update({
        where: { id: code.id },
        data: { status: 'DEACTIVATED' },
      });

      await tx.activationCodeEvent.create({
        data: {
          code_id: code.id,
          center_id: centerId,
          // Nobody at the school acted. The smaller renewal did.
          center_user_id: null,
          from_status: code.status,
          to_status: 'DEACTIVATED',
          student_id: null,
        },
      });
    }
  }

  private async mintMissingCodes(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
    seats: number,
  ): Promise<void> {
    const holding = await tx.activationCode.count({
      where: { center_id: centerId, status: { not: 'DEACTIVATED' } },
    });

    const missing = Math.max(0, seats - holding);
    if (missing === 0) return;

    await tx.activationCode.createMany({
      data: Array.from({ length: missing }, () => ({
        center_id: centerId,
        code: generateActivationCode(),
        // Null, so the code follows the center's `paid_until`. Only a trial
        // code carries a date of its own, which is what makes it the one to
        // retire when a school starts paying.
        expires_at: null,
      })),
    });
  }

  private async setSeats(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
    seats: number,
    unitPriceXaf: number,
  ): Promise<void> {
    await tx.centerSeat.upsert({
      where: { center_id: centerId },
      update: { quantity: seats, unit_price_xaf: unitPriceXaf },
      create: {
        center_id: centerId,
        quantity: seats,
        unit_price_xaf: unitPriceXaf,
      },
    });
  }
}
