// Config for the Prisma CLI only. The running app does not read this: it
// builds its own client in PrismaService with the pg driver adapter.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Migrations go over the DIRECT connection when there is one.
 *
 * Prisma 7's `Datasource` is `{ url, shadowDatabaseUrl }` and nothing else.
 * This file used to pass `directUrl` beside `url`, which type-checks as an
 * error and is ignored at runtime — so every migration since has actually run
 * over the pooled endpoint. It worked, but it was not what the file claimed,
 * and a pooler in transaction mode is exactly where migrations are documented
 * to come apart.
 *
 * The falsy fallback is deliberate: an empty DIRECT_URL should behave like a
 * missing one rather than produce a connection string of nothing.
 */
const migrationUrl =
  process.env['DIRECT_URL'] || process.env['DATABASE_URL'];

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: migrationUrl,
  },
});
