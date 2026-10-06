/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { EntitlementsService } from '../src/modules/centers/entitlements.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

/**
 * What a centre holds, and who may draw on it.
 *
 * The rules, with a mocked Prisma. What a mock cannot prove — that assign and
 * spend move stock atomically under FOR UPDATE — is in the integration specs.
 */
describe('EntitlementsService', () => {
  const identity = { centerId: 'center-1', centerUserId: 'user-1' } as never;

  let prisma: any;
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = {
      centerEntitlementPool: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      codeEntitlementCap: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ cap: 12, used: 0 }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      codeEntitlement: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([{ cap: 0, used: 0 }]),
      activationCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'code-1',
          code: 'LQ-TEST',
          linked_name: null,
          center_id: 'center-1',
          status: 'CONNECTED',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue({
          plan: 'PAID',
          paid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trial_started_at: null,
          trial_ends_at: null,
        }),
      },
      $transaction: jest.fn((work: any) => work(prisma)),
    };
    service = new EntitlementsService(prisma, new SubscriptionPolicyService());
  });

  describe('assigning credits', () => {
    it('locks the seat, then moves stock from the unallocated pool', async () => {
      const view = await service.setCap(
        identity,
        'code-1',
        'AI_SPEAKING_CREDIT',
        12,
      );

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.centerEntitlementPool.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            center_id: 'center-1',
            product: 'AI_SPEAKING_CREDIT',
            balance: { gte: 12 },
          }),
          data: { balance: { decrement: 12 } },
        }),
      );
      expect(prisma.codeEntitlementCap.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cap: 12 } }),
      );
      expect(view).toMatchObject({ cap: 12, used: 0 });
    });

    it('returns unused credits when the absolute assignment is lowered', async () => {
      prisma.$queryRaw.mockResolvedValue([{ cap: 12, used: 2 }]);

      await service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 5);

      expect(prisma.centerEntitlementPool.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ balance: 7 }),
          update: { balance: { increment: 7 } },
        }),
      );
      expect(prisma.codeEntitlementCap.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cap: 5 } }),
      );
    });

    it('refuses when the unallocated pool cannot cover the increase', async () => {
      prisma.centerEntitlementPool.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12),
      ).rejects.toThrow('NOT_ENOUGH_ENTITLEMENTS');
    });

    it('allows zero, which returns unused to the pool', async () => {
      prisma.$queryRaw.mockResolvedValue([{ cap: 8, used: 2 }]);

      await expect(
        service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 0),
      ).resolves.toMatchObject({ cap: 0, used: 2 });
      expect(prisma.centerEntitlementPool.upsert).toHaveBeenCalled();
    });

    it('refuses a code belonging to another centre', async () => {
      prisma.activationCode.findFirst.mockResolvedValue(null);

      await expect(
        service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12),
      ).rejects.toThrow('CODE_NOT_IN_CENTER');
    });

    it('refuses a cap on a product that is a period, not a balance', async () => {
      await expect(
        service.setCap(identity, 'code-1', 'PREP_PASS', 12),
      ).rejects.toThrow('PRODUCT_HAS_NO_CAP');
    });
  });

  describe('revoke', () => {
    it('locks the seat, then returns remaining assigned credits to the pool', async () => {
      prisma.$queryRaw.mockResolvedValue([{ cap: 4 }]);

      const result = await service.revoke(
        identity,
        'code-1',
        'AI_SPEAKING_CREDIT',
      );

      expect(result).toEqual({ revoked: true });
      expect(prisma.centerEntitlementPool.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ balance: 4 }),
          update: { balance: { increment: 4 } },
        }),
      );
      expect(prisma.codeEntitlementCap.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { cap: 0 } }),
      );
    });
  });

  describe('granting a period', () => {
    it('takes one from the pool and grants thirty days', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { expires_at: new Date('2026-12-04') },
      ]);

      await service.grantPeriod(identity, 'code-1', 'PREP_PASS');

      expect(prisma.centerEntitlementPool.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            center_id: 'center-1',
            product: 'PREP_PASS',
            balance: { gte: 1 },
          }),
          data: { balance: { decrement: 1 } },
        }),
      );
    });

    it('refuses when the pool is empty, and grants nothing', async () => {
      prisma.centerEntitlementPool.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.grantPeriod(identity, 'code-1', 'PREP_PASS'),
      ).rejects.toThrow('NOT_ENOUGH_ENTITLEMENTS');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('spends from the pool before writing the period', async () => {
      const order: string[] = [];
      prisma.centerEntitlementPool.updateMany.mockImplementation(() => {
        order.push('pool');
        return Promise.resolve({ count: 1 });
      });
      prisma.$queryRaw.mockImplementation(() => {
        order.push('period');
        return Promise.resolve([{ expires_at: new Date() }]);
      });

      await service.grantPeriod(identity, 'code-1', 'PREP_PASS');

      expect(order).toEqual(['pool', 'period']);
    });

    it('writes the expiry in one statement, in the database', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { expires_at: new Date('2026-12-04') },
      ]);

      await service.grantPeriod(identity, 'code-1', 'PREP_PASS');

      const [fragment, ...values] = prisma.$queryRaw.mock.calls[0];
      expect(String(fragment.join('?'))).toContain('code_entitlements');
      expect(values).toContain(30);
    });

    it('refuses a period on a product that is a balance', async () => {
      await expect(
        service.grantPeriod(identity, 'code-1', 'AI_SPEAKING_CREDIT'),
      ).rejects.toThrow('PRODUCT_HAS_NO_PERIOD');
    });
  });

  describe('what the centre sees', () => {
    it('reports every pool, and whether it is frozen', async () => {
      prisma.centerEntitlementPool.findMany.mockResolvedValue([
        { product: 'AI_SPEAKING_CREDIT', balance: 140 },
      ]);

      const view = await service.overview(identity);

      expect(view.pools).toEqual([
        { product: 'AI_SPEAKING_CREDIT', balance: 140, frozen: false },
      ]);
    });

    it('marks the pools frozen when Start has lapsed', async () => {
      prisma.centerSubscription.findUnique.mockResolvedValue({
        plan: 'PAID',
        paid_until: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        trial_started_at: null,
        trial_ends_at: null,
      });
      prisma.centerEntitlementPool.findMany.mockResolvedValue([
        { product: 'AI_SPEAKING_CREDIT', balance: 60 },
      ]);

      const view = await service.overview(identity);

      expect(view.pools[0]).toMatchObject({ balance: 60, frozen: true });
    });
  });
});
