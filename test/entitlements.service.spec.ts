/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { EntitlementsService } from '../src/modules/centers/entitlements.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

/**
 * What a centre holds, and who may draw on it.
 *
 * The rules, with a mocked Prisma. What a mock cannot prove — that the pool
 * and the cap move together, and that two spends of the last credit cannot
 * both win — is in `entitlements-integration.spec.ts` against real Postgres.
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
      },
      codeEntitlementCap: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      codeEntitlement: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ expires_at: new Date('2026-12-04') }]),
      activationCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'code-1',
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

  describe('setting a cap', () => {
    it('writes the cap against the code', async () => {
      await service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12);

      expect(prisma.codeEntitlementCap.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            code_id_product: {
              code_id: 'code-1',
              product: 'AI_SPEAKING_CREDIT',
            },
          },
          create: expect.objectContaining({ cap: 12 }),
          update: { cap: 12 },
        }),
      );
    });

    it('replaces rather than adds, because a manager is stating a number', async () => {
      // The opposite of activation, which increments: buying more credit is
      // more allowance, but typing 12 into a box means twelve.
      await service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12);

      const call = prisma.codeEntitlementCap.upsert.mock.calls[0][0];
      expect(call.update).toEqual({ cap: 12 });
    });

    it('allows zero, which is how somebody is stopped', async () => {
      await expect(
        service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 0),
      ).resolves.toBeDefined();
    });

    it('spends nothing from the pool', async () => {
      // A cap is permission, not money. The pool is spent when a session runs.
      await service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12);

      expect(prisma.centerEntitlementPool.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a code belonging to another centre', async () => {
      // Scoped inside the query, so a 404 rather than a 403: a 403 would
      // confirm that somebody else's code exists.
      prisma.activationCode.findFirst.mockResolvedValue(null);

      await expect(
        service.setCap(identity, 'code-1', 'AI_SPEAKING_CREDIT', 12),
      ).rejects.toThrow('CODE_NOT_IN_CENTER');
    });

    it('refuses a cap on a product that is a period, not a balance', async () => {
      // A Prep Pass is sixty days, not an allowance of sixty. Capping one is
      // a client bug and silently doing nothing would hide it.
      await expect(
        service.setCap(identity, 'code-1', 'PREP_PASS', 12),
      ).rejects.toThrow('PRODUCT_HAS_NO_CAP');
    });
  });

  describe('granting a period', () => {
    it('takes one from the pool and grants sixty days', async () => {
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
      // Order matters: the conditional decrement is the gate. Writing the
      // period first would grant a pass the centre had not paid for whenever
      // the pool turned out to be empty.
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
      // Sixty days from now for a new pass, and from the existing expiry for
      // a live one — computed in Postgres rather than read and written back.
      // Two grants issued together would otherwise each measure from the same
      // starting point and lose sixty days somebody paid for.
      await service.grantPeriod(identity, 'code-1', 'PREP_PASS');

      // The interval is named in the statement, so a change to the product's
      // length cannot silently fail to reach the database.
      const [fragment, ...values] = prisma.$queryRaw.mock.calls[0];
      expect(String(fragment.join('?'))).toContain('code_entitlements');
      expect(values).toContain(60);
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
      // Not deleted, not hidden. The dashboard says "60 crédits en attente,
      // réglez votre abonnement" — which is the centre's own money arguing
      // for them to come back.
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
