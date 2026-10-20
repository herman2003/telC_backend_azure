import {
  quietHoursEnd,
  retryDelay,
  INVALID_TOKEN_CODES,
  PROVIDER_CONFIG_CODES,
} from '../src/modules/notifications/push/push-policy';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';
describe('push policy', () => {
  it('delays Berlin quiet hours to 08:00 after the spring DST transition', () => {
    expect(
      quietHoursEnd(
        new Date('2026-03-28T20:30:00Z'),
        'Europe/Berlin',
      )?.toISOString(),
    ).toBe('2026-03-29T06:00:00.000Z');
  });
  it('delays Berlin quiet hours across the repeated autumn hour', () => {
    expect(
      quietHoursEnd(
        new Date('2026-10-24T20:00:00Z'),
        'Europe/Berlin',
      )?.toISOString(),
    ).toBe('2026-10-25T07:00:00.000Z');
  });
  it('allows exactly 08:00 and blocks exactly 21:00', () => {
    expect(
      quietHoursEnd(new Date('2026-10-20T06:00:00Z'), 'Europe/Berlin'),
    ).toBeNull();
    expect(
      quietHoursEnd(
        new Date('2026-10-20T19:00:00Z'),
        'Europe/Berlin',
      )?.toISOString(),
    ).toBe('2026-10-21T06:00:00.000Z');
  });
  it('supports daytime quiet hours and disabled quiet hours', () => {
    expect(
      quietHoursEnd(
        new Date('2026-10-20T10:30:00Z'),
        'UTC',
        '10:00',
        '12:00',
      )?.toISOString(),
    ).toBe('2026-10-20T12:00:00.000Z');
    expect(quietHoursEnd(new Date(), 'UTC', '08:00', '08:00')).toBeNull();
  });
  it('does not invalidate every token when the server credential is wrong', () => {
    expect(PROVIDER_CONFIG_CODES.has('messaging/mismatched-credential')).toBe(
      true,
    );
    expect(INVALID_TOKEN_CODES.has('messaging/mismatched-credential')).toBe(
      false,
    );
    expect(
      INVALID_TOKEN_CODES.has('messaging/registration-token-not-registered'),
    ).toBe(true);
    expect([1, 2, 3, 4, 5].map(retryDelay)).toEqual([
      60000, 300000, 900000, 3600000, 3600000,
    ]);
  });
});
describe('encrypted provider addresses', () => {
  const original = process.env.PUSH_TOKEN_ENCRYPTION_KEY;
  beforeEach(() => {
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
  });
  afterAll(() => {
    if (original === undefined) delete process.env.PUSH_TOKEN_ENCRYPTION_KEY;
    else process.env.PUSH_TOKEN_ENCRYPTION_KEY = original;
  });
  it('randomizes ciphertext, preserves equality through HMAC, and rejects tampering', () => {
    const service = new PushCryptoService();
    const value = 'a-private-device-provider-address';
    const first = service.encrypt(value),
      second = service.encrypt(value);
    expect(first).not.toBe(second);
    expect(first).not.toContain(value);
    expect(service.decrypt(first)).toBe(value);
    expect(service.hash(value)).toBe(service.hash(value));
    const pieces = first.split('.');
    pieces[1] = Buffer.alloc(16).toString('base64url');
    expect(() => service.decrypt(pieces.join('.'))).toThrow();
  });
  it('refuses registration without a real encryption key', () => {
    delete process.env.PUSH_TOKEN_ENCRYPTION_KEY;
    expect(() => new PushCryptoService().encrypt('token')).toThrow(
      'PUSH_ENCRYPTION_NOT_CONFIGURED',
    );
  });
});
