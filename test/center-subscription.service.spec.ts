/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { CenterSubscriptionService } from '../src/modules/centers/center-subscription.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import {
  PricingService,
  START_PRICE_XAF,
} from '../src/modules/centers/pricing.service';
import { CenterSeatsService } from '../src/modules/centers/center-seats.service';

/**
 * What a center holds and what more would cost.
 *
 * One plan since 2026-09-23, so seats are a single number: the per-tier
 * breakdown this file used to pin is gone with the tiers.
 */
describe('CenterSubscriptionService', () => {
  const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;
  const DAY = 24 * 60 * 60 * 1000;

  const row = (over: Record<string, unknown> = {}) => ({
    plan: 'TRIAL',
    trial_started_at: null,
    trial_ends_at: null,
    paid_until: null,
    ...over,
  });

  let prisma: any;
  let service: CenterSubscriptionService;

  beforeEach(() => {
    prisma = {
      centerSubscription: { findUnique: jest.fn().mockResolvedValue(row()) },
      student: { count: jest.fn().mockResolvedValue(0) },
      centerSeat: { findUnique: jest.fn().mockResolvedValue(null) },
      center: {
        // Existence plus the student body, which is what sets the floor a
        // quote cannot go under.
        findUnique: jest.fn().mockResolvedValue({ _count: { students: 0 } }),
      },
      get deviceSession(): never {
        throw new Error('Student sessions must never be touched here');
      },
    };
    service = new CenterSubscriptionService(
      prisma,
      new SubscriptionPolicyService(),
      new PricingService(),
      // A real one over the mocked client, not a stub. `quote` is only
      // meaningful if the context it prices from is really loaded.
      new CenterSeatsService(prisma),
    );
  });

  describe('getSubscription', () => {
    it('reads only the signed center', async () => {
      await service.getSubscription(identity);

      expect(prisma.centerSubscription.findUnique).toHaveBeenCalledWith({
        where: { center_id: 'center-1' },
      });
    });

    it('returns the derived status alongside the stored facts', async () => {
      const result = await service.getSubscription(identity);

      expect(result).toEqual({
        status: 'TRIAL_PENDING',
        plan: 'TRIAL',
        seatsHeld: 0,
        trialStartedAt: null,
        trialEndsAt: null,
        paidUntil: null,
        graceEndsAt: null,
        studentsMayLearn: false,
      });
    });

    it('reports the seats held, from the seat row', async () => {
      prisma.centerSeat.findUnique.mockResolvedValue({ quantity: 12 });

      await expect(service.getSubscription(identity)).resolves.toMatchObject({
        seatsHeld: 12,
      });
    });

    it('exposes no database ids or raw column names', async () => {
      const result = await service.getSubscription(identity);

      const json = JSON.stringify(result);
      expect(json).not.toContain('center_id');
      expect(json).not.toContain('paid_until');
    });

    it('surfaces a missing subscription row as a fault, not a state', async () => {
      prisma.centerSubscription.findUnique.mockResolvedValue(null);

      await expect(service.getSubscription(identity)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUsage', () => {
    it('counts only students belonging to the signed center', async () => {
      await service.getUsage(identity);

      expect(prisma.student.count).toHaveBeenCalledWith({
        where: { center_id: 'center-1' },
      });
    });

    it('reports used, limit and available together', async () => {
      prisma.centerSeat.findUnique.mockResolvedValue({ quantity: 10 });
      prisma.student.count.mockResolvedValue(7);

      await expect(service.getUsage(identity)).resolves.toMatchObject({
        seatsUsed: 7,
        seatsLimit: 10,
        seatsAvailable: 3,
      });
    });

    it('reports zero available rather than a negative when over the limit', async () => {
      // Legitimate after dropping to fewer seats: it blocks new provisioning
      // without evicting anyone, so the number to report is "none left".
      prisma.centerSeat.findUnique.mockResolvedValue({ quantity: 2 });
      prisma.student.count.mockResolvedValue(5);

      await expect(service.getUsage(identity)).resolves.toMatchObject({
        seatsAvailable: 0,
        seatsUsed: 5,
      });
    });

    it('keeps reporting the seat limit while blocked', async () => {
      // A school that stopped paying still needs to see what it held.
      prisma.centerSubscription.findUnique.mockResolvedValue(
        row({ plan: 'PAID', paid_until: new Date(Date.now() - 30 * DAY) }),
      );
      prisma.centerSeat.findUnique.mockResolvedValue({ quantity: 10 });

      await expect(service.getUsage(identity)).resolves.toMatchObject({
        status: 'BLOCKED',
        seatsLimit: 10,
      });
    });
  });

  describe('quote', () => {
    it('prices the signed center own holdings, never a center named by the caller', async () => {
      await service.quote(identity, 10);

      expect(prisma.center.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'center-1' } }),
      );
    });

    it('charges list price to a center holding nothing yet', async () => {
      await expect(service.quote(identity, 10)).resolves.toEqual({
        seats: 10,
        unitPriceXaf: START_PRICE_XAF,
        totalXaf: 10 * START_PRICE_XAF,
      });
    });

    it('honours the price a center already agreed to', async () => {
      prisma.centerSeat.findUnique.mockResolvedValue({ unit_price_xaf: 4_000 });

      await expect(service.quote(identity, 10)).resolves.toMatchObject({
        unitPriceXaf: 4_000,
        totalXaf: 40_000,
      });
    });

    it('counts existing students, so an order cannot strand them', async () => {
      prisma.center.findUnique.mockResolvedValue({
        _count: { students: 14 },
      });

      await expect(service.quote(identity, 12)).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'SEATS_BELOW_STUDENT_COUNT',
          requiredSeatsTotal: 14,
        }),
      });
    });

    it('refuses a center that does not exist', async () => {
      prisma.center.findUnique.mockResolvedValue(null);

      await expect(service.quote(identity, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
