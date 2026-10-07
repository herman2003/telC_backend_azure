import { ForbiddenException } from '@nestjs/common';
import { PrepPassGuard } from '../src/shared/guards/prep-pass.guard';

describe('PrepPassGuard', () => {
  const entitlements = { mayUse: jest.fn() };
  const guard = new PrepPassGuard(entitlements as never);

  const contextOf = (student?: { studentId?: string; isGuest?: boolean }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ student }),
      }),
    }) as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a student with an active Prep Pass', async () => {
    entitlements.mayUse.mockResolvedValue({ allowed: true, reason: null });

    await expect(
      guard.canActivate(contextOf({ studentId: 's1', isGuest: false })),
    ).resolves.toBe(true);
    expect(entitlements.mayUse).toHaveBeenCalledWith('s1', 'PREP_PASS');
  });

  it('refuses when the pass is not held', async () => {
    entitlements.mayUse.mockResolvedValue({
      allowed: false,
      reason: 'NOT_HELD',
    });

    await expect(
      guard.canActivate(contextOf({ studentId: 's1', isGuest: false })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows guests without checking Prep Pass (demo contract)', async () => {
    await expect(
      guard.canActivate(contextOf({ studentId: 'guest', isGuest: true })),
    ).resolves.toBe(true);
    expect(entitlements.mayUse).not.toHaveBeenCalled();
  });

  it('refuses a token with no studentId', async () => {
    await expect(guard.canActivate(contextOf(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(entitlements.mayUse).not.toHaveBeenCalled();
  });
});
