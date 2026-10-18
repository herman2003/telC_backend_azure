import { ForbiddenException } from '@nestjs/common';
import { PrepPassGuard } from '../src/shared/guards/prep-pass.guard';

describe('PrepPassGuard', () => {
  const access = {
    isPrepPassActive: jest.fn(),
    assertMayAccess: jest.fn(),
  };
  const guard = new PrepPassGuard(access as never);

  const contextOf = (
    student?: { studentId?: string; isGuest?: boolean },
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
  });

  it('allows a student when no MT is named (list/sessions)', async () => {
    await expect(
      guard.canActivate(contextOf({ studentId: 's1', isGuest: false })),
    ).resolves.toBe(true);
    expect(access.assertMayAccess).not.toHaveBeenCalled();
  });

  it('still checks assertMayAccess for Prep Pass holders when a MT is named', async () => {
    access.isPrepPassActive.mockResolvedValue(true);
    access.assertMayAccess.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(
        contextOf(
          { studentId: 's1', isGuest: false },
          { query: { modelltest: '2' } },
        ),
      ),
    ).resolves.toBe(true);
    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 2);
  });

  it('refuses Prep Pass holders on LEVEL_MISMATCH', async () => {
    access.assertMayAccess.mockRejectedValue(
      new ForbiddenException({ message: 'LEVEL_MISMATCH' }),
    );

    await expect(
      guard.canActivate(
        contextOf(
          { studentId: 's1', isGuest: false },
          { query: { modelltest: '2' } },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows Start-only when no Modelltest is on the request (list/sessions)', async () => {
    access.isPrepPassActive.mockResolvedValue(false);

    await expect(
      guard.canActivate(contextOf({ studentId: 's1', isGuest: false })),
    ).resolves.toBe(true);
    expect(access.assertMayAccess).not.toHaveBeenCalled();
  });

  it('allows Start-only when the requested Modelltest is allowed (weekly)', async () => {
    access.isPrepPassActive.mockResolvedValue(false);
    access.assertMayAccess.mockResolvedValue(undefined);

    await expect(
      guard.canActivate(
        contextOf(
          { studentId: 's1', isGuest: false },
          { query: { modelltest: '2' } },
        ),
      ),
    ).resolves.toBe(true);
    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 2);
  });

  it('reads Modelltest from body.modelltestNumber and params.number', async () => {
    access.isPrepPassActive.mockResolvedValue(false);
    access.assertMayAccess.mockResolvedValue(undefined);

    await guard.canActivate(
      contextOf(
        { studentId: 's1', isGuest: false },
        { body: { modelltestNumber: 3 } },
      ),
    );
    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 3);

    access.assertMayAccess.mockClear();
    await guard.canActivate(
      contextOf(
        { studentId: 's1', isGuest: false },
        { params: { number: '4' } },
      ),
    );
    expect(access.assertMayAccess).toHaveBeenCalledWith('s1', 4);
  });

  it('refuses when Start-only and assertMayAccess rejects (non-weekly)', async () => {
    access.isPrepPassActive.mockResolvedValue(false);
    access.assertMayAccess.mockRejectedValue(
      new ForbiddenException({
        message: 'PREP_PASS_REQUIRED',
        messageKey: 'prepPassRequired',
        reason: 'NOT_HELD',
      }),
    );

    await expect(
      guard.canActivate(
        contextOf(
          { studentId: 's1', isGuest: false },
          { query: { modelltest: '9' } },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows guests without checking Prep Pass (demo contract)', async () => {
    await expect(
      guard.canActivate(contextOf({ studentId: 'guest', isGuest: true })),
    ).resolves.toBe(true);
    expect(access.isPrepPassActive).not.toHaveBeenCalled();
  });

  it('refuses a token with no studentId', async () => {
    await expect(guard.canActivate(contextOf(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(access.isPrepPassActive).not.toHaveBeenCalled();
  });
});
