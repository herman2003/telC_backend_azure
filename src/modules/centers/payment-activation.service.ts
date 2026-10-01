import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type EntitlementProduct } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { generateActivationCode } from './activation-code-format';

/**
 * How long one payment buys.
 *
 * A fixed day count rather than "one calendar month", so there is no
 * month-end arithmetic to get wrong (31 January plus a month) and it sits
 * alongside the day-based trial and grace constants.
 */
export const PAID_PERIOD_DAYS = 30;

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
  constructor(private readonly prisma: PrismaService) {}

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

      const paidUntil = await this.extendPaidPeriod(tx, payment.center_id);
      await this.setSeats(
        tx,
        payment.center_id,
        payment.quantity,
        payment.unit_price_xaf,
      );
      await this.retireTrialCodes(tx, payment.center_id);
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
   * Credits the pool, then applies the caps the manager chose at purchase.
   *
   * The order matters. **The pool is credited whatever happens to the caps**:
   * the money has moved, and an activation that failed because one seat had
   * been deactivated in the meantime would leave the centre paying for
   * nothing. A cap that cannot be applied is dropped, silently and on purpose.
   *
   * `metadata` reached us from the purchase request hours earlier and is
   * treated as untrusted on the way out: only codes that still exist, still
   * belong to this centre and are not deactivated get one. Without that check
   * a centre could cap a rival's seat by sending its id.
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
      await tx.codeEntitlementCap.upsert({
        where: { code_id_product: { code_id: code.id, product } },
        create: { code_id: code.id, product, cap: targets.capPerCode },
        // Raised, not replaced: a second purchase for one seat is more
        // allowance, and replacing would silently undo a cap a manager had
        // raised by hand.
        update: { cap: { increment: targets.capPerCode } },
      });
    }
  }

  private async extendPaidPeriod(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    centerId: string,
  ): Promise<Date> {
    const rows = await tx.$queryRaw<{ paid_until: Date | null }[]>`
      SELECT paid_until
        FROM center_subscriptions
       WHERE center_id = ${centerId}
         FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new NotFoundException('CENTER_SUBSCRIPTION_NOT_FOUND');
    }

    const now = Date.now();
    const current = rows[0].paid_until?.getTime() ?? now;
    const paidUntil = new Date(
      Math.max(now, current) + PAID_PERIOD_DAYS * DAY_MS,
    );

    await tx.centerSubscription.update({
      where: { center_id: centerId },
      data: { plan: 'PAID', paid_until: paidUntil },
    });

    return paidUntil;
  }

  /** The payment's quantity and price, written onto the center's seat row. */
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
