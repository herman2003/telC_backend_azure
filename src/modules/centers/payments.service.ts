import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import type { PaymentKind, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { PricingService } from './pricing.service';
import { CenterSeatsService } from './center-seats.service';
import {
  assertCenterProfileComplete,
  isIdempotencyViolation,
  type SignedCenterIdentity,
} from './payment-shared';
import { amountWithVatXaf } from './vat';

export interface PaymentView {
  id: string;
  /**
   * What the money bought.
   *
   * A center's payment history holds seats and exam slots together, and the
   * two are priced differently — ten of one is 45,000 XAF, ten of the other
   * 10,000. An invoice that did not say which would be unreadable.
   */
  kind: PaymentKind;
  seats: number;
  /** Stamped at creation, so an invoice reads back exactly as it was agreed. */
  unitPriceXaf: number;
  amountXaf: number;
  status: PaymentStatus;
  createdAt: Date;
}

export interface PaymentPage {
  payments: PaymentView[];
  total: number;
  page: number;
  pageSize: number;
}

/** Prisma's unique-violation code. The insert race is decided by this. */
const UNIQUE_VIOLATION = 'P2002';

/** The column that makes a P2002 a replay rather than a bug. */
const IDEMPOTENCY_COLUMN = 'idempotency_key';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly seats: CenterSeatsService,
  ) {}

  /**
   * Records a center's intent to pay for seats.
   *
   * Grants nothing. `paid_until` and `seats` are not touched here and must not
   * be — only a verified provider event may move them, in Phase 7.
   *
   * The amount is computed from the center's own terms at the moment of
   * creation and copied onto the row. The caller contributes a seat count and
   * an idempotency key, and nothing else it sends can reach the price.
   */
  async create(
    identity: SignedCenterIdentity,
    seats: number,
    idempotencyKey: string,
  ): Promise<PaymentView> {
    // Shape-checked before a transaction is opened: an unusable order should
    // not hold a connection, and the refusal does not depend on any row.
    const wanted = this.pricing.requireSeats(seats);
    const requestHash = this.fingerprint(identity.centerId, wanted);

    // Before anything is priced or written. A center can run a trial on an
    // email address alone, but taking money needs a country for currency and
    // tax, a city for support, and a phone to chase an unpaid invoice — so the
    // gate sits here rather than at provisioning. Quoting stays open, because
    // looking at a price is not a commitment.
    await assertCenterProfileComplete(this.prisma, identity);

    try {
      // Priced and written in one transaction, so a refused quote leaves no
      // row.
      //
      // What this does NOT guarantee: the transaction is READ COMMITTED, so a
      // price stamp or a provisioning run committing between the reads and the
      // insert is not seen. That is accepted rather than fixed with
      // Serializable, which would turn the same-key insert race below into
      // serialization failures and 500s. Nothing here moves money or grants
      // access, and the guarantees that matter live in
      // PaymentActivationService: it stamps the payment's own price, sets
      // seats exactly once, and honours a payment even if students were added
      // in the meantime.
      const created = await this.prisma.$transaction(async (tx) => {
        // Replay first: a key that already bought this intent must return the
        // original row even if the seat pool has since been stamped (which
        // would make a fresh order look like NOTHING_TO_PAY).
        const existing = await tx.payment.findUnique({
          where: {
            center_id_idempotency_key: {
              center_id: identity.centerId,
              idempotency_key: idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.request_hash !== requestHash) {
            throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
          }
          return existing;
        }

        const quote = this.pricing.quote(
          wanted,
          await this.seats.pricingContextFor(identity.centerId, tx),
        );

        // `quantity` on the payment is the TARGET seat pool (activation sets
        // it). The amount charged is only seats added above an already-paid
        // pool — same rule as the dashboard upsell UI. A trial row (unit
        // price 0) is not a paid pool.
        const held = await tx.centerSeat.findUnique({
          where: { center_id: identity.centerId },
          select: { quantity: true, unit_price_xaf: true },
        });
        const paidSeats =
          held != null && held.unit_price_xaf > 0 ? held.quantity : 0;

        if (wanted < paidSeats) {
          throw new BadRequestException({
            message: 'SEATS_BELOW_PAID_FLOOR',
            requiredSeatsTotal: paidSeats,
          });
        }

        const billableSeats = wanted - paidSeats;
        if (billableSeats === 0) {
          throw new BadRequestException({ message: 'NOTHING_TO_PAY' });
        }

        return tx.payment.create({
          data: {
            center_id: identity.centerId,
            quantity: quote.seats,
            unit_price_xaf: quote.unitPriceXaf,
            amount_xaf: amountWithVatXaf(billableSeats * quote.unitPriceXaf),
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
          },
        });
      });
      return this.toView(created);
    } catch (error) {
      if (!isIdempotencyViolation(error)) {
        throw error;
      }

      // Lost the insert race, or this is a straightforward retry. Either way
      // the row that won is the answer — provided it was the same intent.
      return this.reconcileReplay(
        identity.centerId,
        idempotencyKey,
        requestHash,
      );
    }
  }

  async get(
    identity: SignedCenterIdentity,
    paymentId: string,
  ): Promise<PaymentView> {
    const payment = await this.prisma.payment.findFirst({
      // Scoped by center in the query itself. Fetching then comparing would
      // work too, and would be one refactor away from leaking.
      where: { id: paymentId, center_id: identity.centerId },
    });

    // 404 rather than 403 for another center's payment, matching the student
    // routes: a 403 confirms the id exists, which is itself an answer.
    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }

    return this.toView(payment);
  }

  async list(
    identity: SignedCenterIdentity,
    { page, pageSize }: { page: number; pageSize: number },
  ): Promise<PaymentPage> {
    const where = { center_id: identity.centerId };

    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        // Two keys, because `created_at` is TIMESTAMP(3) and two payments can
        // land in the same millisecond. A tie makes the sort unstable, and an
        // unstable sort across pages can show one row twice and another never.
        // The id is a uuid, so it says nothing about time — it is here only to
        // break the tie the same way on every request.
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments: rows.map((row) => this.toView(row)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Answers a request whose key was already used.
   *
   * Same intent, same answer: the original record, so a retried or
   * double-clicked request is harmless. Different intent, refusal: returning
   * the original would tell a client it had bought 20 seats when the row says
   * 10, and that disagreement would only surface at reconciliation.
   */
  private async reconcileReplay(
    centerId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<PaymentView> {
    const existing = await this.prisma.payment.findUnique({
      where: {
        center_id_idempotency_key: {
          center_id: centerId,
          idempotency_key: idempotencyKey,
        },
      },
    });

    // Only reachable if the row disappeared between the failed insert and this
    // read. Rethrowing the conflict is safer than retrying into a loop.
    if (!existing) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }

    if (existing.request_hash !== requestHash) {
      throw new ConflictException('IDEMPOTENCY_KEY_REUSED');
    }

    return this.toView(existing);
  }

  /**
   * What the key was first used for.
   *
   * Covers the center and the seat count, so a replay asking for a different
   * number of seats is a different intent wearing the same name.
   *
   * It covers the seats and NOT the price, because a fingerprint has to
   * identify the caller's intent and the price is the server's answer to it.
   * An earlier version hashed the priced lines, which meant a stamped price
   * changing between an attempt and its retry — the by-hand stamping workflow,
   * or the planned 4,500 to 4,800 move — turned a byte-identical retry into
   * IDEMPOTENCY_KEY_REUSED. A client following the documented contract answers
   * that with a fresh key, producing a second payment for one intent: exactly
   * what the unique index exists to prevent.
   *
   * The center is included so a hash can never be compared across centers by
   * accident.
   */
  private fingerprint(centerId: string, seats: number): string {
    return createHash('sha256')
      .update(JSON.stringify({ centerId, seats }))
      .digest('hex');
  }

  /** Built field by field, so a column added later cannot leak into a response. */
  private toView(row: {
    id: string;
    kind: PaymentKind;
    quantity: number;
    unit_price_xaf: number;
    amount_xaf: number;
    status: PaymentStatus;
    created_at: Date;
  }): PaymentView {
    return {
      id: row.id,
      kind: row.kind,
      seats: row.quantity,
      unitPriceXaf: row.unit_price_xaf,
      amountXaf: row.amount_xaf,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
