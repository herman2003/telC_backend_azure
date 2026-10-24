/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { TrialGiftVoidService } from '../src/modules/centers/trial-gift-void.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

const DAY = 24 * 60 * 60 * 1000;

describe('TrialGiftVoidService', () => {
  const policy = new SubscriptionPolicyService();

  it('zeros slots and AI pools when an unpaid trial has expired', async () => {
    const prisma: any = {
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'TRIAL',
          trial_started_at: new Date(Date.now() - 20 * DAY),
          trial_ends_at: new Date(Date.now() - DAY),
          paid_until: null,
        }),
      },
      center: { update: jest.fn() },
      centerEntitlementPool: { updateMany: jest.fn() },
      codeEntitlementCap: { updateMany: jest.fn() },
      $transaction: jest.fn(async (work: any) => work(prisma)),
    };

    await new TrialGiftVoidService(prisma, policy).voidIfExpiredUnpaidTrial(
      'c1',
    );

    expect(prisma.center.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { exam_slots_remaining: 0 },
    });
    expect(prisma.centerEntitlementPool.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.codeEntitlementCap.updateMany).toHaveBeenCalledTimes(2);
  });

  it('does not touch a paid centre that is blocked after a lapse', async () => {
    const prisma: any = {
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'PAID',
          trial_started_at: new Date(Date.now() - 60 * DAY),
          trial_ends_at: new Date(Date.now() - 40 * DAY),
          paid_until: new Date(Date.now() - 20 * DAY),
        }),
      },
      center: { update: jest.fn() },
      $transaction: jest.fn(),
    };

    await new TrialGiftVoidService(prisma, policy).voidIfExpiredUnpaidTrial(
      'c1',
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
