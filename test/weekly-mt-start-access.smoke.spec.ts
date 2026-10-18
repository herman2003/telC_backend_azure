import { ForbiddenException } from '@nestjs/common';
import { PrepPassGuard } from '../src/shared/guards/prep-pass.guard';
import { TrainingModelltestAccessService } from '../src/shared/services/training-modelltest-access.service';
import {
  getSevenDayPeriod,
  MODELLTEST_PERIOD_EPOCH_MS,
} from '../src/modules/modelltests/seven-day-period';
import { LesenController } from '../src/modules/lesen/lesen.controller';
import { ListeningController } from '../src/modules/listening/listening.controller';
import { SprachbausteineController } from '../src/modules/sprachbausteine/sprachbausteine.controller';

/**
 * Smoke suite for the product rule:
 * - Start → weekly Modelltest only (Hören / Lesen / Sprachbausteine)
 * - Prep Pass → full training pool
 *
 * Run:
 *   npm test -- --testPathPatterns=weekly-mt-start-access.smoke --no-coverage
 */
describe('weekly MT Start access (smoke)', () => {
  const trainingRows = [{ number: 1 }, { number: 2 }, { number: 3 }];
  const entitlements = { mayUse: jest.fn() };
  const prisma = {
    student: {
      findUnique: jest.fn().mockResolvedValue({ level: 'B1' }),
    },
    modelltest: {
      findMany: jest.fn().mockResolvedValue(trainingRows),
      findFirst: jest.fn().mockImplementation(
        ({ where }: { where: { number: number } }) =>
          Promise.resolve(
            trainingRows.some((r) => r.number === where.number) ||
              where.number === 99
              ? { level: 'B1' }
              : null,
          ),
      ),
    },
  };
  const access = new TrainingModelltestAccessService(
    entitlements as never,
    prisma as never,
  );
  const guard = new PrepPassGuard(access);

  /** Current weekly number for "now" against the training pool above. */
  function weeklyAt(now: Date): number {
    const { periodIndex } = getSevenDayPeriod(now);
    return trainingRows[periodIndex % trainingRows.length].number;
  }

  const contextOf = (
    student: { studentId?: string; isGuest?: boolean } | undefined,
    extras: {
      query?: Record<string, unknown>;
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
    } = {},
  ) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          student,
          query: extras.query ?? {},
          body: extras.body ?? {},
          params: extras.params ?? {},
        }),
      }),
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findUnique.mockResolvedValue({ level: 'B1' });
    prisma.modelltest.findMany.mockResolvedValue(trainingRows);
    prisma.modelltest.findFirst.mockImplementation(
      ({ where }: { where: { number: number } }) =>
        Promise.resolve(
          trainingRows.some((r) => r.number === where.number) ||
            where.number === 99
            ? { level: 'B1' }
            : null,
        ),
    );
  });

  describe('TrainingModelltestAccessService', () => {
    const epoch = new Date(MODELLTEST_PERIOD_EPOCH_MS); // period 0 → MT 1

    it('Start without Prep Pass: weekly MT allowed, other MT refused', async () => {
      entitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'NOT_HELD',
      });

      await expect(
        access.assertMayAccess('s1', 1, epoch),
      ).resolves.toBeUndefined();
      await expect(access.assertMayAccess('s1', 2, epoch)).rejects.toMatchObject(
        {
          response: { messageKey: 'prepPassRequired', reason: 'NOT_HELD' },
        },
      );
    });

    it('Prep Pass: any Modelltest allowed', async () => {
      entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });

      await expect(
        access.assertMayAccess('s1', 1, epoch),
      ).resolves.toBeUndefined();
      await expect(
        access.assertMayAccess('s1', 99, epoch),
      ).resolves.toBeUndefined();
    });
  });

  describe('PrepPassGuard', () => {
    it('allows Start list/sessions with no modelltest on the request', async () => {
      entitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'NOT_HELD',
      });

      await expect(
        guard.canActivate(contextOf({ studentId: 's1', isGuest: false })),
      ).resolves.toBe(true);
    });

    it('allows Start when query modelltest is the weekly one', async () => {
      entitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'NOT_HELD',
      });
      const weekly = weeklyAt(new Date());

      await expect(
        guard.canActivate(
          contextOf(
            { studentId: 's1', isGuest: false },
            { query: { modelltest: String(weekly) } },
          ),
        ),
      ).resolves.toBe(true);
    });

    it('refuses Start when query modelltest is not weekly', async () => {
      entitlements.mayUse.mockResolvedValue({
        allowed: false,
        reason: 'NOT_HELD',
      });
      const weekly = weeklyAt(new Date());
      const other = weekly === 1 ? 2 : 1;

      await expect(
        guard.canActivate(
          contextOf(
            { studentId: 's1', isGuest: false },
            { query: { modelltest: String(other) } },
          ),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('content handlers default to MT 1 and still assert', () => {
    const student = { studentId: 's1', isGuest: false } as never;
    const accessSpy = {
      assertMayAccess: jest.fn(),
    };

    beforeEach(() => {
      accessSpy.assertMayAccess.mockResolvedValue(undefined);
    });

    it('Lesen / Sprachbausteine / Listening getExercise without query assert MT 1', async () => {
      const lesen = new LesenController(
        { getExercise: jest.fn().mockResolvedValue({}) } as never,
        accessSpy as never,
      );
      const sprach = new SprachbausteineController(
        { getExercise: jest.fn().mockResolvedValue({}) } as never,
        accessSpy as never,
      );
      const listening = new ListeningController(
        { getExercise: jest.fn().mockResolvedValue({}) } as never,
        { play: jest.fn() } as never,
        accessSpy as never,
      );

      await lesen.getExercise(student);
      await sprach.getExercise(student);
      await listening.getExercise(student, undefined, '1', undefined);

      expect(accessSpy.assertMayAccess).toHaveBeenCalledWith('s1', 1);
      expect(accessSpy.assertMayAccess).toHaveBeenCalledTimes(3);
    });

    it('refuses default MT 1 content when assertMayAccess rejects', async () => {
      accessSpy.assertMayAccess.mockRejectedValue(
        new ForbiddenException({
          message: 'PREP_PASS_REQUIRED',
          messageKey: 'prepPassRequired',
          reason: 'NOT_HELD',
        }),
      );
      const lesenService = { getExercise: jest.fn() };
      const lesen = new LesenController(
        lesenService as never,
        accessSpy as never,
      );

      await expect(lesen.getExercise(student)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(lesenService.getExercise).not.toHaveBeenCalled();
    });
  });
});
