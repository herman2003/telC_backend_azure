/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CenterTrialService,
  TRIAL_DURATION_DAYS,
} from '../src/modules/centers/center-trial.service';
import { ACTIVATION_CODE_PATTERN } from '../src/modules/centers/activation-code-format';
import {
  TRIAL_ELENA_CREDITS,
  TRIAL_EXAM_SLOTS,
  TRIAL_PACKAGE_SEATS,
  TRIAL_SCHREIBEN_CREDITS,
} from '../src/modules/centers/trial-package';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starting Pilote Exam Day.
 *
 * The clock starts when the manager presses the button, not when a student
 * first redeems: a school should know when its trial ends the moment it has
 * codes to hand out, and each code's expiry is that same date.
 */
describe('CenterTrialService.start', () => {
  const identity = { centerUserId: 'owner-1', centerId: 'center-1' } as never;

  let prisma: any;
  let service: CenterTrialService;
  let codeSeq: number;

  const subscription = (over: Record<string, unknown> = {}) => ({
    trial_started_at: null,
    trial_ends_at: null,
    paid_until: null,
    ...over,
  });

  beforeEach(() => {
    codeSeq = 0;
    prisma = {
      centerSubscription: {
        findUnique: jest.fn().mockResolvedValue(subscription()),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      centerSeat: {
        upsert: jest.fn().mockResolvedValue({ quantity: TRIAL_PACKAGE_SEATS }),
      },
      center: {
        update: jest.fn().mockResolvedValue({}),
      },
      centerEntitlementPool: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      activationCode: {
        create: jest.fn(async ({ data }: any) => {
          codeSeq += 1;
          return {
            id: `code-${codeSeq}`,
            status: 'ACTIVATED',
            student_id: null,
            linked_name: null,
            linked_email: null,
            connected_at: null,
            level: null,
            created_at: new Date(),
            ...data,
          };
        }),
      },
      $transaction: jest.fn(async (work: any) => work(prisma)),
    };
    service = new CenterTrialService(prisma);
  });

  it('starts a 14-day clock, sets 3 seats, and issues 3 codes ending with it', async () => {
    const before = Date.now();

    const result = await service.start(identity);

    const write = prisma.centerSubscription.updateMany.mock.calls[0][0];
    const started = write.data.trial_started_at as Date;
    const ends = write.data.trial_ends_at as Date;

    expect(TRIAL_DURATION_DAYS).toBe(14);
    expect(TRIAL_PACKAGE_SEATS).toBe(3);
    expect(started.getTime()).toBeGreaterThanOrEqual(before);
    expect(ends.getTime() - started.getTime()).toBe(14 * DAY_MS);

    expect(prisma.centerSeat.upsert).toHaveBeenCalledWith({
      where: { center_id: 'center-1' },
      create: {
        center_id: 'center-1',
        quantity: 3,
        unit_price_xaf: 0,
      },
      update: { quantity: 3 },
    });

    expect(prisma.activationCode.create).toHaveBeenCalledTimes(3);
    for (const call of prisma.activationCode.create.mock.calls) {
      expect(call[0].data).toEqual(
        expect.objectContaining({
          center_id: 'center-1',
          expires_at: ends,
        }),
      );
      expect(call[0].data.code).toMatch(ACTIVATION_CODE_PATTERN);
    }

    expect(result.trialEndsAt).toEqual(ends);
    expect(result.codes).toHaveLength(3);
    expect(result.codes[0]).toEqual(
      expect.objectContaining({
        status: 'activated',
        planId: 'start',
        expiresAt: ends,
      }),
    );
  });

  it('grants 6 Exam Day slots and Elena / Schreiben pools', async () => {
    await service.start(identity);

    expect(prisma.center.update).toHaveBeenCalledWith({
      where: { id: 'center-1' },
      data: { exam_slots_remaining: { increment: TRIAL_EXAM_SLOTS } },
    });
    expect(TRIAL_EXAM_SLOTS).toBe(6);

    expect(prisma.centerEntitlementPool.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          product: 'AI_SPEAKING_CREDIT',
          balance: TRIAL_ELENA_CREDITS,
        }),
      }),
    );
    expect(TRIAL_ELENA_CREDITS).toBe(9);

    expect(prisma.centerEntitlementPool.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          product: 'AI_SCHREIBEN_CREDIT',
          balance: TRIAL_SCHREIBEN_CREDITS,
        }),
      }),
    );
    expect(TRIAL_SCHREIBEN_CREDITS).toBe(6);
  });

  it('claims the trial with a predicate, so two presses cannot start two', async () => {
    await service.start(identity);

    expect(prisma.centerSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          center_id: 'center-1',
          trial_started_at: null,
          paid_until: null,
        },
      }),
    );
  });

  it('refuses a second trial, and leaves the running clock alone', async () => {
    prisma.centerSubscription.findUnique.mockResolvedValue(
      subscription({ trial_started_at: new Date('2027-01-01T00:00:00.000Z') }),
    );

    await expect(service.start(identity)).rejects.toThrow(
      new ConflictException('TRIAL_ALREADY_USED'),
    );
    expect(prisma.centerSubscription.updateMany).not.toHaveBeenCalled();
    expect(prisma.activationCode.create).not.toHaveBeenCalled();
  });

  it('refuses a center that has already paid', async () => {
    prisma.centerSubscription.findUnique.mockResolvedValue(
      subscription({ paid_until: new Date('2027-02-01T00:00:00.000Z') }),
    );

    await expect(service.start(identity)).rejects.toThrow(
      new ConflictException('ALREADY_PAID'),
    );
  });

  it('answers the loser of a race as already used, and issues nothing', async () => {
    prisma.centerSubscription.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.start(identity)).rejects.toThrow(
      new ConflictException('TRIAL_ALREADY_USED'),
    );
    expect(prisma.activationCode.create).not.toHaveBeenCalled();
  });

  it('draws new codes when a random one is already taken', async () => {
    let attempts = 0;
    prisma.$transaction.mockImplementation(async (work: any) => {
      attempts += 1;
      if (attempts === 1) {
        throw new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed',
          {
            code: 'P2002',
            clientVersion: 'test',
            meta: {
              modelName: 'ActivationCode',
              driverAdapterError: {
                cause: {
                  originalMessage:
                    'duplicate key value violates unique constraint "activation_codes_code_key"',
                  constraint: { fields: ['code'] },
                },
              },
            },
          },
        );
      }
      return work(prisma);
    });

    const result = await service.start(identity);

    expect(attempts).toBe(2);
    expect(result.codes).toHaveLength(3);
    expect(result.codes[0].code).toMatch(ACTIVATION_CODE_PATTERN);
  });

  it('refuses a center with no subscription, which is a fault not a state', async () => {
    prisma.centerSubscription.findUnique.mockResolvedValue(null);

    await expect(service.start(identity)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
