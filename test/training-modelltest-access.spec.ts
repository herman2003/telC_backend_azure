import { ForbiddenException } from '@nestjs/common';
import { TrainingModelltestAccessService } from '../src/shared/services/training-modelltest-access.service';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../src/modules/modelltests/seven-day-period';

describe('TrainingModelltestAccessService', () => {
  const entitlements = { mayUse: jest.fn() };
  const prisma = {
    modelltest: { findMany: jest.fn() },
  };

  const service = new TrainingModelltestAccessService(
    entitlements as never,
    prisma as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.modelltest.findMany.mockResolvedValue([
      { number: 1 },
      { number: 2 },
      { number: 3 },
    ]);
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

  it('assertMayAccess allows any Modelltest when Prep Pass is active', async () => {
    entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });

    await expect(service.assertMayAccess('s1', 99)).resolves.toBeUndefined();
    expect(prisma.modelltest.findMany).not.toHaveBeenCalled();
  });

  it('assertMayAccess allows the weekly Modelltest without Prep Pass', async () => {
    entitlements.mayUse.mockResolvedValue({
      allowed: false,
      reason: 'NOT_HELD',
    });
    // periodIndex 0 → first training MT (number 1)
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
});
