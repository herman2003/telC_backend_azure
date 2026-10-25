import { TurnCredentialsService } from '../src/modules/speaking/room/turn-credentials.service';

// Mock ConfigService: get(key) returns the mapped value.
function makeConfig(map: Record<string, string | undefined>) {
  return { get: jest.fn((k: string) => map[k]) } as any;
}

describe('TurnCredentialsService', () => {
  // 1_700_000_000_000 ms → 1_700_000_000 s; +3600 ttl → expiry 1_700_003_600
  const NOW_MS = 1_700_000_000_000;
  const SECRET = 'test-secret-123';
  // Independently computed: base64(HMAC_SHA1(SECRET, "1700003600:student-42"))
  const KNOWN_CREDENTIAL = 'LE8aOHNDVWy52ClV9vpQYE5Aq2I=';

  let nowSpy: jest.SpyInstance;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW_MS);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    nowSpy.mockRestore();
    fetchSpy.mockRestore();
    jest.clearAllMocks();
  });

  it('returns STUN-only when TURN_ENABLED is not "true"', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({
        TURN_ENABLED: 'false',
        TURN_URLS: 'turn:1.2.3.4:3478?transport=udp',
        TURN_STATIC_AUTH_SECRET: SECRET,
      }),
    );

    const res = await svc.getIceServers('student-42');

    expect(res.iceServers.length).toBeGreaterThan(0);
    expect(res.iceServers.every((s) => s.urls.startsWith('stun:'))).toBe(true);
    expect(res.iceServers.some((s) => s.urls.startsWith('turn:'))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns STUN-only when the secret is missing even if enabled (coturn)', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({
        TURN_ENABLED: 'true',
        TURN_PROVIDER: 'coturn',
        TURN_URLS: 'turn:1.2.3.4:3478?transport=udp',
        TURN_STATIC_AUTH_SECRET: undefined,
      }),
    );

    const res = await svc.getIceServers('student-42');

    expect(res.iceServers.some((s) => s.urls.startsWith('turn:'))).toBe(false);
  });

  it('mints ephemeral TURN credentials when enabled (one entry per URL)', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({
        TURN_ENABLED: 'true',
        TURN_URLS:
          'turn:64.226.72.102:3478?transport=udp,turn:64.226.72.102:3478?transport=tcp',
        TURN_STATIC_AUTH_SECRET: SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: '3600',
      }),
    );

    const res = await svc.getIceServers('student-42');
    const turns = res.iceServers.filter((s) => s.urls.startsWith('turn:'));

    expect(turns).toHaveLength(2);
    expect(turns[0].username).toBe('1700003600:student-42');
    expect(turns[0].credential).toBe(KNOWN_CREDENTIAL);
    expect(turns[0].credentialType).toBe('password');
    expect(res.ttlSeconds).toBe(3600);
  });

  it('username is "<expiry>:<studentId>" with expiry = now + ttl', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({
        TURN_ENABLED: 'true',
        TURN_URLS: 'turn:x:3478',
        TURN_STATIC_AUTH_SECRET: SECRET,
        TURN_CREDENTIAL_TTL_SECONDS: '3600',
      }),
    );

    const res = await svc.getIceServers('abc');
    const turn = res.iceServers.find((s) => s.urls.startsWith('turn:'))!;

    expect(turn.username).toBe(`${1_700_000_000 + 3600}:abc`);
  });

  it('defaults TTL to 3600 when not configured', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({ TURN_ENABLED: 'false' }),
    );

    const res = await svc.getIceServers('abc');

    expect(res.ttlSeconds).toBe(3600);
  });

  it('always includes at least one STUN server', async () => {
    const svc = new TurnCredentialsService(
      makeConfig({ TURN_ENABLED: 'false' }),
    );

    const res = await svc.getIceServers('abc');

    expect(res.iceServers.some((s) => s.urls.startsWith('stun:'))).toBe(true);
  });

  describe('TURN_PROVIDER=cloudflare', () => {
    it('mints via Cloudflare and flattens urls arrays', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          iceServers: [
            { urls: ['stun:stun.cloudflare.com:3478'] },
            {
              urls: [
                'turn:turn.cloudflare.com:3478?transport=udp',
                'turns:turn.cloudflare.com:443?transport=tcp',
                'turn:turn.cloudflare.com:53?transport=udp',
              ],
              username: 'cf-user',
              credential: 'cf-pass',
            },
          ],
        }),
      } as Response);

      const svc = new TurnCredentialsService(
        makeConfig({
          TURN_ENABLED: 'true',
          TURN_PROVIDER: 'cloudflare',
          CLOUDFLARE_TURN_KEY_ID: 'key-id',
          CLOUDFLARE_TURN_API_TOKEN: 'api-token',
          TURN_CREDENTIAL_TTL_SECONDS: '7200',
        }),
      );

      const res = await svc.getIceServers('student-42');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://rtc.live.cloudflare.com/v1/turn/keys/key-id/credentials/generate-ice-servers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer api-token',
          }),
          body: JSON.stringify({ ttl: 7200 }),
        }),
      );
      expect(res.iceServers).toEqual([
        { urls: 'stun:stun.cloudflare.com:3478' },
        {
          urls: 'turn:turn.cloudflare.com:3478?transport=udp',
          username: 'cf-user',
          credential: 'cf-pass',
          credentialType: 'password',
        },
        {
          urls: 'turns:turn.cloudflare.com:443?transport=tcp',
          username: 'cf-user',
          credential: 'cf-pass',
          credentialType: 'password',
        },
      ]);
      expect(res.ttlSeconds).toBe(7200);
    });

    it('falls back to STUN-only when Cloudflare keys are missing', async () => {
      const svc = new TurnCredentialsService(
        makeConfig({
          TURN_ENABLED: 'true',
          TURN_PROVIDER: 'cloudflare',
        }),
      );

      const res = await svc.getIceServers('student-42');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(res.iceServers.every((s) => s.urls.startsWith('stun:'))).toBe(true);
    });

    it('falls back to STUN-only when Cloudflare returns a non-OK status', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      } as Response);

      const svc = new TurnCredentialsService(
        makeConfig({
          TURN_ENABLED: 'true',
          TURN_PROVIDER: 'cloudflare',
          CLOUDFLARE_TURN_KEY_ID: 'key-id',
          CLOUDFLARE_TURN_API_TOKEN: 'api-token',
        }),
      );

      const res = await svc.getIceServers('student-42');

      expect(res.iceServers.every((s) => s.urls.startsWith('stun:'))).toBe(true);
      expect(res.iceServers.some((s) => s.urls.startsWith('turn:'))).toBe(false);
    });
  });
});
