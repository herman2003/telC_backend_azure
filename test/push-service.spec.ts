/* Test doubles intentionally expose Prisma mock calls for ownership assertions. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { PushService } from '../src/modules/notifications/push/push.service';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';
import type { RegisterPushDto } from '../src/modules/notifications/push/push.dto';
describe('push endpoint identity', () => {
  const user = {
    type: 'access' as const,
    studentId: 'student-1',
    deviceId: 'device-1',
    sessionId: 'session-1',
  };
  const dto: RegisterPushDto = {
    transport: 'FCM',
    platform: 'ANDROID',
    fcmToken: 'secret-token-'.repeat(5),
    firebaseProjectId: 'test-project',
    locale: 'fr',
    timezone: 'Europe/Berlin',
    appVersion: '1',
    permission: 'GRANTED',
    backgroundCapable: true,
  };
  let tx: any, prisma: any, service: PushService;
  const savedProject = process.env.FIREBASE_PROJECT_ID,
    savedKey = process.env.TOKEN_HMAC_SECRET;
  beforeEach(() => {
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.TOKEN_HMAC_SECRET = '12'.repeat(32);
    tx = {
      deviceSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'session-1' }),
      },
      pushEndpoint: {
        deleteMany: jest.fn(),
        upsert: jest.fn().mockResolvedValue({
          id: 'endpoint',
          platform: 'ANDROID',
          permission: 'GRANTED',
        }),
      },
      notificationPreference: { upsert: jest.fn() },
    };
    prisma = { $transaction: jest.fn(async (fn) => fn(tx)) };
    service = new PushService(prisma, new PushCryptoService());
  });
  afterAll(() => {
    for (const [k, v] of Object.entries({
      FIREBASE_PROJECT_ID: savedProject,
      TOKEN_HMAC_SECRET: savedKey,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  it('rejects guests and JWTs without an installation-bound session', async () => {
    await expect(
      service.register({ ...user, isGuest: true }, dto),
    ).rejects.toThrow('PUSH_REQUIRES_ACCOUNT_SESSION');
    await expect(
      service.register({ ...user, sessionId: undefined }, dto),
    ).rejects.toThrow('PUSH_REQUIRES_ACCOUNT_SESSION');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a different Firebase environment before writing', async () => {
    await expect(
      service.register(user, { ...dto, firebaseProjectId: 'production' }),
    ).rejects.toThrow('PUSH_PROJECT_MISMATCH');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('never binds a revoked or other-account session', async () => {
    tx.deviceSession.findFirst.mockResolvedValue(null);
    await expect(service.register(user, dto)).rejects.toThrow(
      'SESSION_REVOKED',
    );
    expect(tx.pushEndpoint.upsert).not.toHaveBeenCalled();
  });
  it('encrypts the token and returns only non-secret registration metadata', async () => {
    expect(await service.register(user, dto)).toEqual({
      id: 'endpoint',
      platform: 'ANDROID',
      permission: 'GRANTED',
    });
    const call = tx.pushEndpoint.upsert.mock.calls[0][0];
    expect(call.create.student_id).toBe(user.studentId);
    expect(call.create.session_id).toBe(user.sessionId);
    expect(JSON.stringify(call)).not.toContain(dto.fcmToken);
  });
});
