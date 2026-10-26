import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import type { CenterPricingContext } from './pricing.service';

/**
 * The part of the client this loader touches.
 *
 * Structural rather than `PrismaService` so a transaction client satisfies it
 * too. Pricing a payment has to read seats and students inside the same
 * transaction that writes the payment, or the price and the student floor are
 * decided against a snapshot that can move before the insert lands.
 */
export type SeatContextReader = Pick<
  PrismaService,
  'center' | 'centerSeat' | 'centerSubscription'
>;

/**
 * Loads what a center holds: the price it has already agreed to, and how many
 * students it has to seat.
 *
 * Its own service because two callers need exactly this — quoting and creating
 * a payment — and written twice the two copies would drift. `PricingService`
 * stays pure and takes the result as an argument, the same split as
 * `SubscriptionPolicyService` and `StudentEntitlementService`.
 */
@Injectable()
export class CenterSeatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Two reads: the center itself, which also yields the student count, and its
   * seat row, which carries the stamped price.
   *
   * `client` exists so a caller can read inside its own transaction. Quoting
   * passes nothing, because a quote is a question and a stale answer to it
   * costs nothing; creating a payment passes its transaction, because the
   * price it reads is the price the center is charged.
   */
  async pricingContextFor(
    centerId: string,
    client: SeatContextReader = this.prisma,
  ): Promise<CenterPricingContext> {
    const [center, seat, subscription] = await Promise.all([
      // Existence and the student body in one read. A center token can outlive
      // its center — the auth guard has a cache that does not recheck the row
      // — and without this the missing center surfaces as a foreign-key error
      // at insert, which reaches the client as a 500 instead of a 404.
      client.center.findUnique({
        where: { id: centerId },
        select: { _count: { select: { students: true } } },
      }),
      client.centerSeat.findUnique({
        where: { center_id: centerId },
        select: { quantity: true, unit_price_xaf: true },
      }),
      client.centerSubscription.findUnique({
        where: { center_id: centerId },
        select: { paid_until: true, anchor_day: true },
      }),
    ]);

    if (!center) {
      throw new NotFoundException('CENTER_NOT_FOUND');
    }

    // Trial seats are stamped at 0: converting from trial is a first purchase.
    const paidSeats =
      seat != null && seat.unit_price_xaf > 0 ? seat.quantity : 0;

    return {
      stampedPriceXaf: seat?.unit_price_xaf ?? null,
      totalStudents: center._count.students,
      paidSeats,
      paidUntil: subscription?.paid_until ?? null,
      anchorDay: subscription?.anchor_day ?? null,
    };
  }
}
