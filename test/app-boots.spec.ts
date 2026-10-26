import { Test } from '@nestjs/testing';

/**
 * The application actually starts.
 *
 * Every other test builds its services by hand, so a provider missing from a
 * module passes all of them and fails on the first real boot — which in this
 * project means on a deploy. Compiling the whole graph is the only thing that
 * catches it, and it caught exactly that when the exam scorer gained a
 * dependency no module provided.
 *
 * The secrets are throwaway and only long enough to satisfy the checks at
 * startup: nothing here connects to anything.
 */
describe('AppModule', () => {
  const FAKE = 'x'.repeat(64);

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET ??= FAKE;
    process.env.JWT_REFRESH_SECRET ??= FAKE;
    process.env.TOKEN_HMAC_SECRET ??= FAKE;
    process.env.DATABASE_URL ??= 'postgresql://user:pass@localhost:5432/db';
  });

  it('resolves every dependency', async () => {
    // require, not import: the secrets above have to be in place before the
    // module is loaded, and an import statement is hoisted above them.

    const { AppModule } = require('../src/app.module') as {
      AppModule: new () => unknown;
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    await moduleRef.close();
  }, 60_000);
});
