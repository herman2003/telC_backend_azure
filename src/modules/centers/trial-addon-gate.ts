import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { SubscriptionPolicyService } from './subscription-policy.service';

/**
 * Centres on an unpaid trial may convert (buy seats) but may not top up
 * Exam Day or entitlement add-ons — that is the commercial rule for
 * Pilote Exam Day.
 */
@Injectable()
export class TrialAddonGate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SubscriptionPolicyService,
  ) {}

  async assertMayBuyAddons(centerId: string): Promise<void> {
    const subscription = await this.prisma.centerSubscription.findUnique({
      where: { center_id: centerId },
      select: {
        plan: true,
        trial_started_at: true,
        trial_ends_at: true,
        paid_until: true,
      },
    });

    if (!subscription) {
      return;
    }

    const { status } = this.policy.evaluate(subscription);
    if (status === 'TRIAL' || status === 'TRIAL_PENDING') {
      throw new ConflictException('TRIAL_ADDONS_NOT_FOR_SALE');
    }
  }
}
