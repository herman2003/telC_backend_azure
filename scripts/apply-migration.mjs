/**
 * Apply one migration through the pg driver, and record it the way
 * `prisma migrate deploy` would.
 *
 * Only because the Prisma CLI's migration engine cannot reach Neon from this
 * machine while the pg driver can. The migration file stays the source of
 * truth; this just runs it and writes the same bookkeeping row, with the same
 * checksum, so a later `migrate deploy` sees it as applied rather than
 * pending.
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import pg from 'pg';
import { createRequire } from 'module';

const [, , name, path] = process.argv;
if (!name || !path) {
  console.error('usage: apply-migration.mjs <migration_name> <migration.sql>');
  process.exit(1);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error('No DIRECT_URL or DATABASE_URL');
// One shared definition of which endpoint is production, so a move does not
// silently disarm this guard and the two others that had their own copy.
const { isProduction, PRODUCTION_HOST } = createRequire(import.meta.url)(
  './production-endpoint.cjs',
);
if (isProduction(url)) {
  throw new Error(`REFUSING: that is the live database (${PRODUCTION_HOST}).`);
}

const sql = readFileSync(path, 'utf8');
const checksum = createHash('sha256').update(readFileSync(path)).digest('hex');

const client = new pg.Client({ connectionString: url });
await client.connect();

const already = await client.query(
  'SELECT 1 FROM _prisma_migrations WHERE migration_name = $1 AND finished_at IS NOT NULL',
  [name],
);
if (already.rowCount > 0) {
  console.log(`${name}: already applied, nothing to do`);
  await client.end();
  process.exit(0);
}

try {
  await client.query('BEGIN');
  await client.query(sql);
  await client.query(
    `INSERT INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
     VALUES ($1, $2, now(), $3, now(), 1)`,
    [randomUUID(), checksum, name],
  );
  await client.query('COMMIT');
  console.log(`${name}: applied`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`${name}: FAILED, rolled back`);
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
