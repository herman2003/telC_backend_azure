import { Injectable, NotFoundException } from '@nestjs/common';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  SubscriptionPolicyService,
  type CenterSubscriptionStatus,
} from './subscription-policy.service';
import { PricingService, type Quote } from './pricing.service';
import { CenterSeatsService } from './center-seats.service';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

export interface CenterSubscriptionView {
  status: CenterSubscriptionStatus;
  plan: string;
  /**
   * Seats this center holds, read from `center_seats`.
   *
   * Replaces `CenterSubscription.seats`, which was a second number claiming
   * the same thing. Two authorities meant nobody reading the code could say
   * which was true, and a stale one that still looks authoritative eventually
   * reaches an invoice.
   */
  seatsHeld: number;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  graceEndsAt: Date | null;
  studentsMayLearn: boolean;
}

export interface CenterUsageView {
  seatsUsed: number;
  seatsLimit: number;
  seatsAvailable: number;
  status: CenterSubscriptionStatus;
}

@Injectable()
export class CenterSubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SubscriptionPolicyService,
    private readonly pricing: PricingService,
    private readonly seats: CenterSeatsService,
  ) {}

  async getSubscription(
    identity: SignedCenterIdentity,
  ): Promise<CenterSubscriptionView> {
    const subscription = await this.loadSubscription(identity);
    const decision = this.policy.evaluate(subscription);

    // Built field by field rather than by spreading the row, so a column added
    // to the schema later cannot leak into an API response by default.
    return {
      status: decision.status,
      plan: subscription.plan,
      seatsHeld: await this.countSeatsHeld(identity),
      trialStartedAt: subscription.trial_started_at,
      trialEndsAt: subscription.trial_ends_at,
      paidUntil: subscription.paid_until,
      graceEndsAt: decision.graceEndsAt,
      studentsMayLearn: decision.studentsMayLearn,
    };
  }

  async getUsage(identity: SignedCenterIdentity): Promise<CenterUsageView> {
    const where = { center_id: identity.centerId };

    const [subscription, seat, seatsUsed] = await Promise.all([
      this.loadSubscription(identity),
      this.prisma.centerSeat.findUnique({
        where: { center_id: identity.centerId },
        select: { quantity: true },
      }),
      // A seat is the existence of a student row carrying this center's id.
      // Counting rather than storing means there is no counter to drift away
      // from the rows it claims to describe.
      this.prisma.student.count({ where }),
    ]);

    const seatsLimit = seat?.quantity ?? 0;

    return {
      seatsUsed,
      seatsLimit,
      // Clamped at zero. A center can legitimately sit over its limit — after
      // dropping to fewer seats — and that blocks new provisioning without
      // evicting anyone, so the number to report is "none left", not a deficit.
      seatsAvailable: Math.max(0, seatsLimit - seatsUsed),
      status: this.policy.evaluate(subscription).status,
    };
  }

  /** Seats held. The seat row is the only authority. */
  private async countSeatsHeld(
    identity: SignedCenterIdentity,
  ): Promise<number> {
    const seat = await this.prisma.centerSeat.findUnique({
      where: { center_id: identity.centerId },
      select: { quantity: true },
    });

    return seat?.quantity ?? 0;
  }

  /**
   * What the signed-in center would owe for a given number of seats.
   *
   * The seat count is the only thing the caller contributes, and it is a total
   * rather than an increment. The price comes from what this center has
   * already agreed to, or today's list price if it holds none yet, and the
   * floors come from its own student count — so no request can talk the
   * number down.
   */
  async quote(identity: SignedCenterIdentity, seats: number): Promise<Quote> {
    return this.pricing.quote(
      seats,
      await this.seats.pricingContextFor(identity.centerId),
    );
  }

  /**
   * Every center receives a subscription inside its registration transaction,
   * and the migration backfilled the ones that predate that. A missing row is
   * therefore a fault to surface, not a state to accommodate — accommodating it
   * would mean carrying a "no subscription yet" branch through every phase that
   * follows.
   */
  private async loadSubscription(identity: SignedCenterIdentity) {
    const subscription = await this.prisma.centerSubscription.findUnique({
      where: { center_id: identity.centerId },
    });

    if (!subscription) {
      throw new NotFoundException('CENTER_SUBSCRIPTION_NOT_FOUND');
    }

    return subscription;
  }
}
