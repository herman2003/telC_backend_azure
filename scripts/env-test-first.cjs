/**
 * Preload for the content scripts: load `.env.test`, then refuse production.
 *
 * Replaces `-r dotenv/config` in the npm scripts, which was a live foot-gun.
 * That preload loads `.env` — the production connection string — before the
 * script body runs, and `dotenv` never overwrites a variable that is already
 * set. So the `config({ path: '.env.test' })` several of these scripts call
 * first thing, written precisely as a guard, could not take effect. Every
 * `grammar:*` and `vocab:*` script pointed at production by default, and most
 * of them exist to write.
 *
 * It was not visible from either side: the npm script says `dotenv/config`
 * and the script says `.env.test`, and only the order decides.
 *
 * Order here is the other way round. `.env.test` wins for everything it
 * defines; `.env` then fills the gaps, so API keys and other non-database
 * settings still come from the one place that has them.
 *
 * Then the refusal. `apply-migration.mjs` and the integration setup already
 * refuse the production endpoint by name, and a script that can write content
 * deserves the same. Escaping it is deliberate and loud:
 *
 *   LERNIQO_ALLOW_PRODUCTION=1
 *
 * Usage, from an npm script:
 *   ts-node -r ./scripts/env-test-first.cjs scripts/whatever.ts
 */
const { config } = require('dotenv');
const { resolve } = require('path');
const { PRODUCTION_HOST, isProduction, hostOf } = require('./production-endpoint.cjs');

config({ path: resolve(process.cwd(), '.env.test') });
config({ path: resolve(process.cwd(), '.env') });

// Interactive transactions hold one connection across several statements, and
// Neon's `-pooler` endpoint multiplexes underneath that. The direct endpoint
// is the one to use, as the integration suite does for the same reason.
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const target = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
const host = hostOf(target);

if (isProduction(target)) {
  if (process.env.LERNIQO_ALLOW_PRODUCTION !== '1') {
    console.error(
      `\nREFUSING: that connection is production (${PRODUCTION_HOST}).\n` +
        '\nThese scripts write content. If you genuinely mean to run this\n' +
        'against production, say so out loud:\n' +
        '\n  LERNIQO_ALLOW_PRODUCTION=1 npm run <script>\n' +
        '\nOtherwise check that .env.test exists and carries DATABASE_URL\n' +
        'and DIRECT_URL for a disposable branch.\n',
    );
    process.exit(1);
  }
  console.error(`\n!! RUNNING AGAINST PRODUCTION (${host}) — explicitly allowed.\n`);
} else {
  console.error(`[env] ${host}`);
}
