# Adopting the migration baseline on a database that already exists

Read this before `dev` reaches `main`. It is three SQL statements, but the order
matters and getting it wrong costs a failed deploy.

## What changed

73 migrations were replaced by two:

- `00000000000000_baseline` — the whole schema, from `migrate diff --from-empty`
- `00000000000001_exam_content` — Modelltest 1 and 2, 325 rows

A **new** database runs both and ends up correct. An **existing** database must
record them as applied without running them: the baseline creates tables that are
already there, and it would fail on the first `CREATE TYPE`.

## Which databases need this

- **production** (DigitalOcean / Neon `ep-wandering-hall`)
- the **test branch** in `.env.test` (`ep-misty-sea`)

Any other copy anyone is holding.

## The danger

`main` auto-deploys, and the deploy runs `prisma migrate deploy` on start. So on
production the bookkeeping must happen **before** `dev` is merged into `main`,
not after. If it is merged first, the deploy fails — loudly, before the app
starts, with `type "CenterPlan" already exists`. Nothing is corrupted, but the
service does not come up until the bookkeeping is done.

There is no staging to rehearse on, so the order is the safeguard.

## The steps, per database

Run against the **direct** connection, not the pooled one.

**1. Confirm you are where you think you are.**

```sql
SELECT current_database(), count(*) AS applied_migrations FROM _prisma_migrations;
```

Expect 73 or more. If it is 0, this is a fresh database — do nothing here and let
`migrate deploy` run normally.

**2. Clear the old history and record the two new ones as applied.**

```sql
BEGIN;

DELETE FROM _prisma_migrations;

INSERT INTO _prisma_migrations
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES
  (gen_random_uuid()::text, '', now(), '00000000000000_baseline',     NULL, NULL, now(), 1),
  (gen_random_uuid()::text, '', now(), '00000000000001_exam_content', NULL, NULL, now(), 1);

COMMIT;
```

The empty checksum is deliberate. `migrate deploy` only checks the checksum of
migrations it is about to apply; a row that is already finished is skipped on the
name alone. `prisma migrate resolve --applied <name>` does the same thing and
computes a real checksum — use it instead if the CLI can reach the database from
where you are. It could not reach Neon from this machine, which is why
`scripts/apply-migration.mjs` exists.

**3. Check.**

```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY migration_name;
```

Two rows, both with a `finished_at`.

**4. Then, and only then, merge `dev` into `main`.**

The deploy will report both migrations as already applied and start the app.

## If it goes wrong

Nothing here drops a table or touches a row of real data — the only table
modified is `_prisma_migrations`, which is Prisma's own bookkeeping. If the
deploy still tries to apply the baseline, the symptom is
`type "CenterPlan" already exists` and the fix is to run step 2 and redeploy.

## Afterwards

The repository can build a database again. The CI job added in the same change
does exactly that on every run — an empty Postgres, `migrate deploy`, then the
full integration suite. If the chain ever breaks again, it breaks there instead
of five months later.
