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
- [x] ~~**The Modelltest seeds.**~~ Done on 2026-10-03: folded into
      `20261003170000_seed_modelltest1_lesen_sprachbausteine`, and the six root
      SQL files deleted. `migrate deploy` now builds a complete database, so
      this job no longer needs a seed step of its own.

## The question that was settled

`001_schema.sql` created tables Prisma already owns, with `IF NOT EXISTS`, so it
was a no-op against any migrated database — deleted rather than folded in.

Two things turned up while folding the rest, neither of them visible from
reading the files:

1. **They could no longer be replayed at all.** `modelltest_id` became NOT NULL
   on 2026-08-21, and the old files inserted the content with a null and filled
   it afterwards. So the parent row now goes first and every exercise insert
   carries its `modelltest_id`.
2. **Two child tables generate their ids in the database**, so `ON CONFLICT`
   never fires for them and a rerun simply inserted second copies — observed on
   the test branch, which gained 30 duplicate `sprachbausteine_gap_options`
   before it was caught. They are guarded with NOT EXISTS on the parent id.

Verified by applying the migration twice to the already-populated test branch and
comparing measured counts across all 16 tables: unchanged.

**Still unproven:** that it seeds correctly on an *empty* database. Every
statement parsed and ran against real Postgres, and the guards are trivially true
when nothing is there, so the argument is strong — but the proof is this very
task. When CI builds a database from `migrate deploy` alone and the exam suites
pass against it, that is the evidence.

## Do not

- Do not land a job that is red on arrival. A gate that is always red is a gate
  people learn to scroll past, which is worse than one that honestly says what it
  does not cover. The workflow comment says so, and it should stay true.
- Do not point CI at the `.env.test` Neon branch to get this done quickly.
  Concurrent runs would make the suite flaky, and a flaky gate is re-run rather
  than read.
