# The integration suite is not in CI, and that is the gate that matters

## Why this is the remaining hole

PR #16 reached `dev` with the integration suite red and lint red. Lint now has a
ratchet in `.github/workflows/test.yml`. Integration does not run at all, and it
is where the payment, period, renewal and activation rules are actually pinned —
26 suites, 335 tests. Every D4 rule written down in tests this week is protected
only by somebody remembering to run them.

## What it needs

Three things, none hard, one of them real work.

- [ ] A `postgres` service container in the workflow. Not a shared Neon branch:
      the suite deletes shared center and student rows, which is why it already
      runs `maxWorkers: 1`, and two concurrent CI runs on one database would
      remove each other's fixtures. `test/jest-integration-setup.ts` promotes
      `DIRECT_URL` to `DATABASE_URL` and refuses `ep-wandering-hall`, so a local
      container URL satisfies it as written.
- [ ] `npx prisma migrate deploy` against that container.
- [ ] **The Modelltest seeds.** This is the work. Migrations alone are not
      enough: `test/exam-sitting-integration.spec.ts:283` reads *"the Hören
      exercise of Modelltest 1, as seeded"*, and `exam-results`, `exam-sessions`,
      `exam-slots`, `seat-erasure` and `student-activity` do the same. The seeds
      live at the repo root as `002_seed_modelltest1.sql` through
      `007_seed_modelltest1_parent.sql`.

## The question to settle first

`001_schema.sql` at the repo root is a **schema**, not a seed, and it predates
Prisma owning the schema — it came from the Supabase migration. Applying it after
`migrate deploy` may conflict, and applying it instead of the migrations would
leave Prisma's `_prisma_migrations` bookkeeping empty.

So decide: are the seed files `002`–`007` applicable on their own against a
Prisma-migrated database? If not, the seeds need a loader that works from the
Prisma schema — which is a small task of its own, and the right place for it is
before this one.

## Do not

- Do not land a job that is red on arrival. A gate that is always red is a gate
  people learn to scroll past, which is worse than one that honestly says what it
  does not cover. The workflow comment says so, and it should stay true.
- Do not point CI at the `.env.test` Neon branch to get this done quickly.
  Concurrent runs would make the suite flaky, and a flaky gate is re-run rather
  than read.
