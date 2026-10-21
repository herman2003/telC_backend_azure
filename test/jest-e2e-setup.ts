/**
 * Point the E2E suites at the disposable database, then refuse production.
 *
 * This file used to load `.env` alone. Two suites boot the real `AppModule`
 * with no Prisma override — `app.e2e-spec.ts` and `writing-flow.e2e-spec.ts` —
 * so `PrismaService.onModuleInit` connected to whatever `.env` names, which is
 * production. `writing-flow` then creates a student row per test and deletes
 * it afterwards, so every run of `npm run test:e2e` was writing to the live
 * database, and a failure mid-test left the row behind. Its socket test has a
 * fifteen-second timeout, so that was not hypothetical.
 *
 * `.env.test` first, `.env` second. `dotenv` does not overwrite a variable
 * that is already set, so the database comes from the disposable branch while
 * GEMINI_API_KEY and the other third-party settings still come from `.env` —
 * which is what this file needed `.env` for in the first place.
 *
 * The integration setup has had this right from the beginning. The order is
 * the whole of it: the same two `config` calls the other way round reach
 * production instead, and nothing says so at the call site.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

// DIRECT_URL over the pooled endpoint, as the integration setup does: these
// suites hold a connection across several statements and the `-pooler` host
// multiplexes underneath that.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { isProduction, PRODUCTION_HOST } = require(
  '../scripts/production-endpoint.cjs',
) as { isProduction: (url: string) => boolean; PRODUCTION_HOST: string };

const target = process.env.DATABASE_URL ?? '';

if (!target) {
  throw new Error(
    'E2E tests need DATABASE_URL or DIRECT_URL. Create .env.test from a ' +
      'disposable database branch.',
  );
}

// A suite that creates and deletes student rows must not be able to reach the
// live database, whatever anyone's local `.env` happens to say.
if (isProduction(target)) {
  throw new Error(
    `E2E tests must not run against production (${PRODUCTION_HOST}). ` +
      'Point .env.test at a disposable branch.',
  );
}

// AppModule validates production-strength JWT secrets during startup. Unit-style
// E2E suites must not depend on a developer's local .env file to boot.
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-'.padEnd(64, 'a');
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-'.padEnd(64, 'b');
process.env.TOKEN_HMAC_SECRET ??= 'e2e-hmac-secret-'.padEnd(64, 'c');
