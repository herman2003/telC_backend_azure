import { cert, initializeApp } from 'firebase-admin/app';
import { FirebasePushService } from '../src/modules/notifications/push/firebase-push.service';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: () => [],
  initializeApp: jest.fn(),
}));
describe('three-variable push configuration', () => {
  const keys = [
    'FIREBASE_SERVICE_ACCOUNT_JSON',
    'FIREBASE_PROJECT_ID',
    'PUSH_DEBUG_LOGS',
    'TOKEN_HMAC_SECRET',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const account = {
    type: 'service_account',
    project_id: 'prod',
    client_email: 'sender@prod.iam.gserviceaccount.com',
    private_key: 'private-key-marker',
  };
  beforeEach(() => {
    keys.forEach((k) => delete process.env[k]);
    jest.clearAllMocks();
    process.env.TOKEN_HMAC_SECRET = 'ab'.repeat(32);
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const configure = () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(account);
    process.env.FIREBASE_PROJECT_ID = 'prod';
  };
  it('leaves the inbox usable and delivery disabled when no JSON secret is configured', () => {
    const service = new FirebasePushService(new PushCryptoService());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.enabled).toBe(false);
  });
  it('starts automatically with the pasted account JSON and project, without further push variables', () => {
    configure();
    const service = new FirebasePushService(new PushCryptoService());
    service.onModuleInit();
    expect(service.status).toEqual({
      enabled: true,
      configured: true,
      dryRun: false,
    });
    expect(cert).toHaveBeenCalledWith({
      projectId: 'prod',
      clientEmail: account.client_email,
      privateKey: account.private_key,
    });
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
  it('refuses a project mismatch without taking the inbox offline', () => {
    configure();
    process.env.FIREBASE_PROJECT_ID = 'other-project';
    const service = new FirebasePushService(new PushCryptoService());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.enabled).toBe(false);
    expect(initializeApp).not.toHaveBeenCalled();
  });
  it.each([
    'invalid-json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...account, private_key: 123 }),
  ])(
    'disables sending without crashing for malformed or incomplete JSON (%#)',
    (value) => {
      configure();
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = value;
      const service = new FirebasePushService(new PushCryptoService());
      expect(() => service.onModuleInit()).not.toThrow();
      expect(service.enabled).toBe(false);
      expect(initializeApp).not.toHaveBeenCalled();
    },
  );
  it('preserves the escaped private-key newlines from the downloaded JSON', () => {
    configure();
    const privateKey =
      '-----BEGIN PRIVATE KEY-----\nkey-marker\n-----END PRIVATE KEY-----\n';
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify(
      { ...account, private_key: privateKey },
      null,
      2,
    );
    const service = new FirebasePushService(new PushCryptoService());
    service.onModuleInit();
    expect(service.enabled).toBe(true);
    expect(cert).toHaveBeenCalledWith(expect.objectContaining({ privateKey }));
  });
  it('requires the existing authentication secret to keep provider addresses encrypted', () => {
    configure();
    delete process.env.TOKEN_HMAC_SECRET;
    const service = new FirebasePushService(new PushCryptoService());
    service.onModuleInit();
    expect(service.enabled).toBe(false);
    expect(initializeApp).not.toHaveBeenCalled();
  });
});
