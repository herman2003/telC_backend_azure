import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { SubscriptionPolicyService } from './subscription-policy.service';

const TRIAL_GIFT_PRODUCTS = [
  'AI_SPEAKING_CREDIT',
  'AI_SCHREIBEN_CREDIT',
] as const;

/**
 * When an unpaid trial has ended, leftover Exam Day slots and AI credit
 * pools must not survive — otherwise a later seat payment would unfreeze
 * free gifts. Paid centres (even blocked after a lapsed period) are left
 * alone: their slots and pools were bought.
 *
 * Lazy: call from balance / spend / overview paths. No cron required.
 */
@Injectable()
export class TrialGiftVoidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: SubscriptionPolicyService,
  ) {}

  async voidIfExpiredUnpaidTrial(centerId: string): Promise<void> {
    const subscription = await this.prisma.centerSubscription.findUnique({
      where: { center_id: centerId },
      select: {
        plan: true,
        trial_started_at: true,
        trial_ends_at: true,
        paid_until: true,
      },
    });

    if (!subscription || subscription.paid_until !== null) {
      return;
    }

    const { status } = this.policy.evaluate(subscription);
    if (status !== 'BLOCKED') {
      return;
    }

    // No trial was ever started — nothing to void.
    if (!subscription.trial_started_at || !subscription.trial_ends_at) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.center.update({
        where: { id: centerId },
        data: { exam_slots_remaining: 0 },
      });

      for (const product of TRIAL_GIFT_PRODUCTS) {
        await tx.centerEntitlementPool.updateMany({
          where: { center_id: centerId, product },
          data: { balance: 0 },
        });

        await tx.codeEntitlementCap.updateMany({
          where: {
            product,
            code: { center_id: centerId },
          },
          data: { cap: 0, used: 0 },
        });
      }
    });
  }
}
