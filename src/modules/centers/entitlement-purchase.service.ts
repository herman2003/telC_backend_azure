import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  Prisma,
  type EntitlementProduct,
  type PaymentStatus,
} from '@prisma/client';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  assertCenterProfileComplete,
  isIdempotencyViolation,
} from './payment-shared';
import { amountWithVatXaf, splitVatXaf } from './vat';

// Both halves: the profile gate reads the signed manager's phone, and
// scoping it by centre as well as id is what stops a manager id from
// elsewhere answering the question.
type SignedCenterIdentity = Pick<
  CenterAccessTokenPayload,
  'centerId' | 'centerUserId'
>;

/** What each add-on costs, per unit, in XAF. The offer sheet in one place. */
export const ENTITLEMENT_PRICE_XAF: Record<EntitlementProduct, number> = {
  AI_SPEAKING_CREDIT: 300,
  PREP_PASS: 1_000,
  AI_ASSISTED_LEARNING: 2_000,
};

/**
 * A ceiling on one order, not on what a center may hold.
 *
 * Generous enough for the largest school and small enough that a fat finger
 * is a refusal rather than an invoice.
 */
export const MAX_ENTITLEMENTS_PER_ORDER = 5_000;

/** Enough seats for a large school in one go; a longer list is a client bug. */
const MAX_CODES_PER_ORDER = 500;

export interface EntitlementOrder {
  product: EntitlementProduct;
  quantity: number;
  /** The seats the manager picked, if any. Applied by the webhook. */
  codeIds?: string[];
  /** How much of the pool each of those seats may draw. */
  capPerCode?: number;
}

export interface EntitlementPaymentView {
  id: string;
  kind: EntitlementProduct;
  quantity: number;
  unitPriceXaf: number;
  amountXaf: number;
  status: PaymentStatus;
  createdAt: Date;
}

/**
 * Recording the intention to buy an add-on.
 *
 * There is no checkout here, and no granting. A purchase is an ordinary
 * payment, opened at `POST /api/payments/:paymentId/checkout` like seats and
 * exam slots, and only a verified provider event turns it into anything — in
 * `PaymentActivationService`, which is the single writer.
 *
 * The seats and the cap the manager chose travel on the payment's `metadata`,
 * because hours can pass before the webhook arrives and nothing may be granted
 * before money moves. They are checked here so a manager is told now, and
 * checked again there because that is the moment they are acted on.
 */
@Injectable()
export class EntitlementPurchaseService {
  constructor(private readonly prisma: PrismaService) {}

  async purchase(
    identity: SignedCenterIdentity,
    idempotencyKey: string,
    order: EntitlementOrder,
  ): Promise<EntitlementPaymentView> {
    // Shape first, so an unusable order is refused without reading a row.
    const quote = this.quote(order);
    const metadata = this.metadataFor(order);
    const requestHash = this.fingerprintFor(identity.centerId, order);

    // Told now rather than after paying. The webhook checks again, because a
    // code can be deactivated in between — but a manager picking a seat that
    // was never theirs should hear about it before the invoice.
    await this.requireOwnCodes(identity, order.codeIds);

    // The same gate as seats and exam slots: taking money needs a country for
    // the currency, a city for support and a phone to chase an unpaid invoice.
    await assertCenterProfileComplete(this.prisma, identity);

    try {
      const amounts = splitVatXaf(quote.quantity * quote.unitPriceXaf);

      const created = await this.prisma.payment.create({
        data: {
          center_id: identity.centerId,
          kind: order.product,
          quantity: quote.quantity,
          unit_price_xaf: quote.unitPriceXaf,
          amount_xaf: amounts.grossXaf,
          amount_net_xaf: amounts.netXaf,
          vat_amount_xaf: amounts.vatXaf,
          idempotency_key: idempotencyKey,
          request_hash: requestHash,
          ...(metadata ? { metadata } : {}),
        },
      });
      return this.toView(created, order.product);
    } catch (error) {
      if (!isIdempotencyViolation(error)) throw error;

      // Lost the insert race, or an ordinary retry. The row that won is the
      // answer — provided it was the same intent.
      return this.reconcileReplay(
        identity.centerId,
        idempotencyKey,
        requestHash,
        order.product,
      );
    }
  }

  quote(order: EntitlementOrder): {
    quantity: number;
    unitPriceXaf: number;
    amountXaf: number;
  } {
    if (!Number.isInteger(order.quantity) || order.quantity < 1) {
      throw new BadRequestException('ENTITLEMENT_QUANTITY_INVALID');
    }
    if (order.quantity > MAX_ENTITLEMENTS_PER_ORDER) {
      throw new BadRequestException({
        message: 'ENTITLEMENT_QUANTITY_ABOVE_MAXIMUM',
        maximumQuantity: MAX_ENTITLEMENTS_PER_ORDER,
      });
    }
    if (order.codeIds && order.codeIds.length > MAX_CODES_PER_ORDER) {
      throw new BadRequestException('TOO_MANY_CODES');
    }
    if (
      order.capPerCode !== undefined &&
      (!Number.isInteger(order.capPerCode) || order.capPerCode < 1)
    ) {
      throw new BadRequestException('ENTITLEMENT_CAP_INVALID');
    }

    const unitPriceXaf = ENTITLEMENT_PRICE_XAF[order.product];
    // unitPrice HT; amountXaf TTC (providers have no VAT parameter).
    return {
      quantity: order.quantity,
      unitPriceXaf,
      amountXaf: amountWithVatXaf(order.quantity * unitPriceXaf),
    };
  }

  /**
   * What the key was first used for.
   *
   * Carries the product, the quantity AND the seats, because all three are the
   * caller's intent. Forty credits is 12,000 XAF and forty passes is 120,000,
   * so a key matching either would bill a center for something it did not buy
   * — and a replay carrying the same key with a different seat list would move
   * somebody else's cap.
   *
   * The price is deliberately absent: a fingerprint identifies the request,
   * and the price is the server's answer to it.
   *
   * Public because the tests assert against it rather than against a hash
   * literal nobody could recompute by hand.
   */
  fingerprintFor(centerId: string, order: EntitlementOrder): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          centerId,
          kind: order.product,
          quantity: order.quantity,
          // Sorted, so the same seats chosen in a different order are the same
          // intent rather than a refused replay.
          codeIds: [...(order.codeIds ?? [])].sort(),
          capPerCode: order.capPerCode ?? null,
        }),
      )
      .digest('hex');
  }

  /** Null when the manager bought a plain top-up and picked nobody. */
  private metadataFor(order: EntitlementOrder): Prisma.InputJsonValue | null {
    if (!order.codeIds?.length || !order.capPerCode) return null;
    return { codeIds: order.codeIds, capPerCode: order.capPerCode };
  }

  /** Scoped in the query: a code from elsewhere is a 404, never a 403. */
  private async requireOwnCodes(
    identity: SignedCenterIdentity,
    codeIds: string[] | undefined,
  ): Promise<void> {
    if (!codeIds?.length) return;

    const unique = [...new Set(codeIds)];
    const mine = await this.prisma.activationCode.count({
      where: {
        id: { in: unique },
        center_id: identity.centerId,
        // A deactivated seat is refused here, and that is not pedantry. The
        // webhook skips deactivated codes when it applies the caps, so a
        // purchase naming one would take the money, credit the pool and drop
        // the cap without a word — the school pays and the student it paid
        // for cannot spend a session.
        //
        // It is reachable through the ordinary flow: paying for seats retires
        // the trial code and issues a new one, so any screen loaded before
        // the payment is holding a dead id.
        status: { not: 'DEACTIVATED' },
      },
    });
    if (mine !== unique.length) {
      throw new NotFoundException('CODE_NOT_IN_CENTER');
    }
  }

  private async reconcileReplay(
    centerId: string,
    idempotencyKey: string,
    requestHash: string,
    product: EntitlementProduct,
  ): Promise<EntitlementPaymentView> {
    const existing = await this.prisma.payment.findUnique({
      where: {
        center_id_idempotency_key: {
          center_id: centerId,
          idempotency_key: idempotencyKey,
        },
      },
    });

    if (!existing || existing.request_hash !== requestHash) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }

    return this.toView(existing, product);
  }

  /** Built field by field, so a column added later cannot leak into a
   *  response. */
  private toView(
    row: {
      id: string;
      quantity: number;
      unit_price_xaf: number;
      amount_xaf: number;
      status: PaymentStatus;
      created_at: Date;
    },
    product: EntitlementProduct,
  ): EntitlementPaymentView {
    return {
      id: row.id,
      kind: product,
      quantity: row.quantity,
      unitPriceXaf: row.unit_price_xaf,
      amountXaf: row.amount_xaf,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
