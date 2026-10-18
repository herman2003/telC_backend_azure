import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrainingModelltestAccessService } from '../src/shared/services/training-modelltest-access.service';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../src/modules/modelltests/seven-day-period';

describe('TrainingModelltestAccessService', () => {
  const entitlements = { mayUse: jest.fn() };
  const prisma = {
    modelltest: { findMany: jest.fn(), findFirst: jest.fn() },
    student: { findUnique: jest.fn() },
  };

  const service = new TrainingModelltestAccessService(
    entitlements as never,
    prisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.student.findUnique.mockResolvedValue({ level: 'B1' });
    prisma.modelltest.findMany.mockResolvedValue([
      { number: 1 },
      { number: 2 },
      { number: 3 },
    ]);
    prisma.modelltest.findFirst.mockResolvedValue({ level: 'B1' });
  });

  it('isPrepPassActive is true when mayUse allows PREP_PASS', async () => {
    entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });

    await expect(service.isPrepPassActive('s1')).resolves.toBe(true);
    expect(entitlements.mayUse).toHaveBeenCalledWith(
      's1',
      'PREP_PASS',
      expect.any(Date),
    );
  });

  it('isPrepPassActive is false when the pass is not held', async () => {
    entitlements.mayUse.mockResolvedValue({
      allowed: false,
      reason: 'NOT_HELD',
    });

    await expect(service.isPrepPassActive('s1')).resolves.toBe(false);
  });

  it('requireStudentLevel refuses when level is null', async () => {
    prisma.student.findUnique.mockResolvedValue({ level: null });

    await expect(service.requireStudentLevel('s1')).rejects.toMatchObject({
      response: { message: 'LEVEL_REQUIRED' },
    });
  });

  it('assertLevelAllows refuses a Modelltest of another CEFR level', async () => {
    prisma.modelltest.findFirst.mockResolvedValue({ level: 'A2' });

    await expect(service.assertLevelAllows('s1', 1)).rejects.toMatchObject({
      response: { message: 'LEVEL_MISMATCH' },
    });
  });

  it('assertMayAccess refuses wrong level even when Prep Pass is active', async () => {
    entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });
    prisma.modelltest.findFirst.mockResolvedValue({ level: 'A2' });

    await expect(service.assertMayAccess('s1', 2)).rejects.toMatchObject({
      response: { message: 'LEVEL_MISMATCH' },
    });
  });

  it('assertMayAccess allows a matching-level MT when Prep Pass is active', async () => {
    entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });

    await expect(service.assertMayAccess('s1', 99)).resolves.toBeUndefined();
    expect(prisma.modelltest.findMany).not.toHaveBeenCalled();
  });

  it('assertMayAccess allows the weekly Modelltest without Prep Pass', async () => {
    entitlements.mayUse.mockResolvedValue({
      allowed: false,
      reason: 'NOT_HELD',
    });
    const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);

    await expect(
      service.assertMayAccess('s1', 1, now),
    ).resolves.toBeUndefined();
  });

  it('assertMayAccess refuses a non-weekly Modelltest without Prep Pass', async () => {
    entitlements.mayUse.mockResolvedValue({
      allowed: false,
      reason: 'NOT_HELD',
    });
    const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);

    await expect(service.assertMayAccess('s1', 2, now)).rejects.toMatchObject({
      response: {
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
        reason: 'NOT_HELD',
      },
    });
    await expect(service.assertMayAccess('s1', 2, now)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('weeklyModelltestNumber scopes the pool to the student level', async () => {
    prisma.student.findUnique.mockResolvedValue({ level: 'A2' });
    prisma.modelltest.findMany.mockResolvedValue([]);

    await expect(
      service.weeklyModelltestNumber('s1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.modelltest.findMany).toHaveBeenCalledWith({
      where: { exam_only: false, level: 'A2' },
      orderBy: { number: 'asc' },
      select: { number: true },
    });
  });

  it('weeklyModelltestNumber for guests ignores CEFR', async () => {
    await service.weeklyModelltestNumber('guest', new Date(), { isGuest: true });

    expect(prisma.student.findUnique).not.toHaveBeenCalled();
    expect(prisma.modelltest.findMany).toHaveBeenCalledWith({
      where: { exam_only: false },
      orderBy: { number: 'asc' },
      select: { number: true },
    });
  });
});
