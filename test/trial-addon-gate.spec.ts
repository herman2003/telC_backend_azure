import { ConflictException } from '@nestjs/common';
import { TrialAddonGate } from '../src/modules/centers/trial-addon-gate';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

describe('TrialAddonGate', () => {
  const policy = new SubscriptionPolicyService();

  it('refuses TRIAL_PENDING and TRIAL', async () => {
    const prisma = {
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'TRIAL',
          trial_started_at: null,
          trial_ends_at: null,
          paid_until: null,
        }),
      },
    };
    const gate = new TrialAddonGate(prisma as never, policy);

    await expect(gate.assertMayBuyAddons('c1')).rejects.toThrow(
      new ConflictException('TRIAL_ADDONS_NOT_FOR_SALE'),
    );
  });

  it('allows a paid centre', async () => {
    const prisma = {
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'PAID',
          trial_started_at: new Date('2026-01-01'),
          trial_ends_at: new Date('2026-01-15'),
          paid_until: new Date('2099-01-01'),
        }),
      },
    };
    const gate = new TrialAddonGate(prisma as never, policy);

    await expect(gate.assertMayBuyAddons('c1')).resolves.toBeUndefined();
  });
});
