import { FirebasePushService } from '../src/modules/notifications/push/firebase-push.service';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';
jest.mock('firebase-admin/app', () => ({
  applicationDefault: jest.fn(),
  cert: jest.fn(),
  getApps: () => [],
  initializeApp: jest.fn(),
}));
describe('push activation gate', () => {
  const keys = [
    'PUSH_ENABLED',
    'FIREBASE_PROJECT_ID',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'PUSH_TOKEN_ENCRYPTION_KEY',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  beforeEach(() => keys.forEach((k) => delete process.env[k]));
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  it('leaves the inbox usable without credentials while sending is disabled', () => {
    expect(() =>
      new FirebasePushService(new PushCryptoService()).onModuleInit(),
    ).not.toThrow();
  });
  it('disables delivery clearly without taking the inbox offline when credentials are missing', () => {
    process.env.PUSH_ENABLED = 'true';
    const service = new FirebasePushService(new PushCryptoService());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.status).toMatchObject({ enabled: false, configured: false });
  });
  it('refuses credentials from another environment without leaking the key', () => {
    process.env.PUSH_ENABLED = 'true';
    process.env.PUSH_TOKEN_ENCRYPTION_KEY = 'ab'.repeat(32);
    process.env.FIREBASE_PROJECT_ID = 'prod';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      project_id: 'dev',
      private_key: 'private-key-marker',
    });
    const service = new FirebasePushService(new PushCryptoService());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.status).toMatchObject({ enabled: false, configured: false });
  });
});
