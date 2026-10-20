import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { FirebasePushService } from '../src/modules/notifications/push/firebase-push.service';
import { PushCryptoService } from '../src/modules/notifications/push/push-crypto.service';
jest.mock('fs', () => ({ readFileSync: jest.fn() }));
jest.mock('firebase-admin/app', () => ({
  cert: jest.fn(),
  getApps: () => [],
  initializeApp: jest.fn(),
}));
describe('three-variable push configuration', () => {
  const keys = [
    'FIREBASE_SERVICE_ACCOUNT_PATH',
    'FIREBASE_PROJECT_ID',
    'PUSH_DEBUG_LOGS',
    'TOKEN_HMAC_SECRET',
  ];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const account = {
    project_id: 'prod',
    client_email: 'sender@prod.iam.gserviceaccount.com',
    private_key: 'private-key-marker',
  };
  beforeEach(() => {
    keys.forEach((k) => delete process.env[k]);
    jest.clearAllMocks();
    process.env.TOKEN_HMAC_SECRET = 'ab'.repeat(32);
    jest.mocked(readFileSync).mockReturnValue(JSON.stringify(account));
  });
  afterAll(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  const configure = () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH = '/secrets/firebase.json';
    process.env.FIREBASE_PROJECT_ID = 'prod';
  };
  it('leaves the inbox usable and delivery disabled when no file path is configured', () => {
    const service = new FirebasePushService(new PushCryptoService());
    expect(() => service.onModuleInit()).not.toThrow();
    expect(service.enabled).toBe(false);
    expect(readFileSync).not.toHaveBeenCalled();
  });
  it('starts automatically with a valid account file and project, without further push variables', () => {
    configure();
    const service = new FirebasePushService(new PushCryptoService());
    service.onModuleInit();
    expect(service.status).toEqual({
      enabled: true,
      configured: true,
      dryRun: false,
    });
    expect(readFileSync).toHaveBeenCalledWith('/secrets/firebase.json', 'utf8');
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
  it('disables sending for a missing file or invalid JSON', () => {
    configure();
    jest.mocked(readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    const missing = new FirebasePushService(new PushCryptoService());
    expect(() => missing.onModuleInit()).not.toThrow();
    expect(missing.enabled).toBe(false);
    jest.mocked(readFileSync).mockReturnValue('invalid-json');
    const invalid = new FirebasePushService(new PushCryptoService());
    expect(() => invalid.onModuleInit()).not.toThrow();
    expect(invalid.enabled).toBe(false);
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
