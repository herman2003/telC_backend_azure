import { ValidationPipe } from '@nestjs/common';
import {
  RegisterPushDto,
  PushPreferencesDto,
} from '../src/modules/notifications/push/push.dto';
describe('push request validation', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const dto = {
    transport: 'FCM',
    platform: 'ANDROID',
    fcmToken: 'a'.repeat(80),
    firebaseProjectId: 'test',
    locale: 'fr',
    timezone: 'Europe/Berlin',
    appVersion: '1',
    permission: 'GRANTED',
    backgroundCapable: true,
  };
  it('rejects caller-supplied account or session ownership', async () => {
    await expect(
      pipe.transform(
        { ...dto, studentId: 'another-student' },
        { type: 'body', metatype: RegisterPushDto },
      ),
    ).rejects.toThrow();
  });
  it('requires an IANA timezone and a supported platform', async () => {
    await expect(
      pipe.transform(
        { ...dto, timezone: 'UTC+2' },
        { type: 'body', metatype: RegisterPushDto },
      ),
    ).rejects.toThrow();
    await expect(
      pipe.transform(
        { ...dto, platform: 'LINUX' },
        { type: 'body', metatype: RegisterPushDto },
      ),
    ).rejects.toThrow();
  });
  it('accepts explicit account preference false and rejects malformed hours', async () => {
    expect(
      await pipe.transform(
        { transactionalEnabled: false },
        { type: 'body', metatype: PushPreferencesDto },
      ),
    ).toMatchObject({ transactionalEnabled: false });
    await expect(
      pipe.transform(
        { quietStart: '25:00' },
        { type: 'body', metatype: PushPreferencesDto },
      ),
    ).rejects.toThrow();
  });
});
