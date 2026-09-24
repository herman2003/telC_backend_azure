import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  assertCenterProfileComplete,
  isIdempotencyViolation,
  type SignedCenterIdentity,
} from './payment-shared';

/** One candidate, one sitting. The 1,500 XAF tier with AI correction is a
 *  later phase; this is the price of the product that exists. */
export const EXAM_SLOT_PRICE_XAF = 1_000;

/**
 * A ceiling, not a business rule.
 *
 * There is deliberately no minimum — a sitting for three candidates is an
 * ordinary thing a school does, which is why the ten-seat floor has no
 * business here. But without a ceiling a mistyped quantity becomes an amount
 * the column cannot hold, and the refusal a center sees is Postgres saying
 * "integer out of range".
 */
export const MAX_EXAM_SLOTS_PER_ORDER = 5_000;

export interface ExamSlotQuote {
  quantity: number;
  unitPriceXaf: number;
  totalXaf: number;
}

export interface ExamSlotPaymentView {
  id: string;
  kind: 'EXAM_SLOTS';
  quantity: number;
  unitPriceXaf: number;
  amountXaf: number;
  status: PaymentStatus;
  createdAt: Date;
}

/**
 * Buying the right to run an exam.
 *
 * Deliberately thin beside the seat path: a quantity times a constant. No
 * floor, no pricing context, no grandfathering — none of which apply to a
 * fee paid per candidate. When a third center product arrives, these two
 * collapse into one catalogue of `kind -> {price, min, max, grant}`; a thick
 * second path is what would stop that.
 *
 * The purchase rides on `payments`, so checkout, the provider registry and
 * the webhook need to know nothing about exam slots.
 */
@Injectable()
export class ExamSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  /** What the center currently holds. */
  async balance(identity: SignedCenterIdentity): Promise<number> {
    const center = await this.prisma.center.findUniqueOrThrow({
      where: { id: identity.centerId },
      select: { exam_slots_remaining: true },
    });
    return center.exam_slots_remaining;
  }

  quote(quantity: number): ExamSlotQuote {
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('EXAM_SLOTS_INVALID');
    }
    if (quantity > MAX_EXAM_SLOTS_PER_ORDER) {
      throw new BadRequestException({
        message: 'EXAM_SLOTS_ABOVE_MAXIMUM',
        maximumQuantity: MAX_EXAM_SLOTS_PER_ORDER,
      });
    }

    return {
      quantity,
      unitPriceXaf: EXAM_SLOT_PRICE_XAF,
      totalXaf: quantity * EXAM_SLOT_PRICE_XAF,
    };
  }

  /**
   * Records the intention to buy. Grants nothing: only a verified provider
   * event credits the balance, in `PaymentActivationService`.
   */
  async purchase(
    identity: SignedCenterIdentity,
    quantity: number,
    idempotencyKey: string,
  ): Promise<ExamSlotPaymentView> {
    // Shape-checked before anything is read: an unusable order should not
    // reach the database, and the refusal depends on no row.
    const quote = this.quote(quantity);
    const requestHash = this.fingerprintFor(identity.centerId, quantity);

    // The same gate as seats. Taking money needs a country for the currency,
    // a city for support and a phone to chase an unpaid invoice.
    await assertCenterProfileComplete(this.prisma, identity);

    try {
      const created = await this.prisma.payment.create({
        data: {
          center_id: identity.centerId,
          kind: 'EXAM_SLOTS',
          quantity: quote.quantity,
          unit_price_xaf: quote.unitPriceXaf,
          amount_xaf: quote.totalXaf,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          // Left to the column default. Written here only to say plainly
          // that buying grants nothing.
          status: undefined,
        },
      });
      return this.toView(created);
    } catch (error) {
      if (!isIdempotencyViolation(error)) throw error;

      // Lost the insert race, or an ordinary retry. Either way the row that
      // won is the answer — provided it was the same intent.
      return this.reconcileReplay(
        identity.centerId,
        idempotencyKey,
        requestHash,
      );
    }
  }

  /**
   * What the key was first used for.
   *
   * Carries the kind as well as the quantity, so one key cannot match a seat
   * payment and a slot payment of the same number: ten seats is 45,000 XAF
   * and ten slots is 10,000, and handing back either for the other would bill
   * a center for a product it did not buy.
   *
   * The price is deliberately absent. A fingerprint identifies the caller's
   * intent, and the price is the server's answer to it.
   *
   * Public because the tests assert against it rather than against a hash
   * literal that would have to be recomputed by hand.
   */
  fingerprintFor(centerId: string, quantity: number): string {
    return createHash('sha256')
      .update(JSON.stringify({ centerId, kind: 'EXAM_SLOTS', quantity }))
      .digest('hex');
  }

  private async reconcileReplay(
    centerId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<ExamSlotPaymentView> {
    const existing = await this.prisma.payment.findUnique({
      where: {
        center_id_idempotency_key: {
          center_id: centerId,
          idempotency_key: idempotencyKey,
        },
      },
    });

    // Only reachable if the row disappeared between the failed insert and
    // this read. Rethrowing is safer than retrying into a loop.
    if (!existing || existing.request_hash !== requestHash) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }

    return this.toView(existing);
  }

  /** Built field by field, so a column added later cannot leak into a
   *  response. */
  private toView(row: {
    id: string;
    quantity: number;
    unit_price_xaf: number;
    amount_xaf: number;
    status: PaymentStatus;
    created_at: Date;
  }): ExamSlotPaymentView {
    return {
      id: row.id,
      kind: 'EXAM_SLOTS',
      quantity: row.quantity,
      unitPriceXaf: row.unit_price_xaf,
      amountXaf: row.amount_xaf,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
