# Lerniqo backend — working agreement

NestJS 11 + Prisma 7 + PostgreSQL (Neon). Prepares students for telc Deutsch
exams; language schools ("centres") buy seats and hand out activation codes.

`docs/README.md` is the documentation index. `docs/glossary.md` defines the
domain words — read it before naming anything.

---

## Before you change code

**Branch from `dev`, never from `main`.** `main` auto-deploys to DigitalOcean
on merge. `dev` is protected: direct pushes are rejected, so every change
arrives by pull request.

**Never run a bare `prisma migrate`.** `.env` holds the **production**
connection string, and the Prisma CLI reads it. Apply migrations against
`.env.test` only — `scripts/apply-migration.mjs` does this and refuses the
production endpoint. `scripts/production-endpoint.cjs` is the single
definition of which host that is.

**Run the server against the test database** with `npm run start:testdb`. It
loads `.env.test` and prints the host it connected to.

## Before you open a pull request

Five gates. Run all of them; CI runs the same ones.

```
npx tsc --noEmit          # CI baseline 0 — the ONLY gate that type-checks tests
npm run build             # tsconfig.build.json EXCLUDES test files
npx jest                  # unit
npm run test:integration  # needs .env.test
npm run test:e2e
```

Read every gate by **exit code**. Grepping output has silently passed broken
builds here twice: `nest build` puts ANSI escapes between `error` and `TS`, and
a suite piped to `tail` reports `tail`'s exit code.

`npx tsc --noEmit` matters most: `npm run build` excludes `test/` and
`**/*spec.ts`, and ts-jest transpiles without failing on type errors — so tests
can pass over code that does not compile.

Lint is a ratchet: CI fails if the eslint **error** count rises above the
baseline in `.github/workflows/test.yml`.

## Integration tests delete shared data

The integration suites remove centre and student rows from the scratch
database. After running them, rebuild the manual-testing fixture with
`node scripts/seed-b2-bruno-fixture.mjs`.

---

## How work gets done

The full lifecycle, the skill for each stage and the Bruno policy are in
`.claude/rules/engineering-workflow.md`. The short version:

**Do not start coding when a feature is described.** Understand the
objective, read the code and the approved rule in `docs/domains/` and
`docs/adr/`, say whether it already exists, propose an approach, and stop.

**Four approvals, none of them assumed:** the design, the plan, the merge,
and production. Merging to `main` deploys.

**One skill per stage** — two planning skills produce two plans that
disagree. Check the available-skills list rather than assuming a skill
exists; sixteen of Matt Pocock's are deliberately manual-only and must be
typed as `/mattpocock-skills:<name>`.

| | |
|---|---|
| understand | `mattpocock-skills:grilling` |
| investigate | `Explore`, `docs/README.md`, `docs/glossary.md` |
| research | `source-driven-development` |
| design | `api-and-interface-design` (+ `documentation-and-adrs` for an ADR) |
| plan | `planning-and-task-breakdown` |
| implement | `incremental-implementation` + `test-driven-development` |
| review | `mattpocock-skills:code-review`, fresh context |
| PR | `mattpocock-skills:pr` |

**Current code is behaviour, not policy.** The approved rule lives in
`docs/domains/` and `docs/adr/`. A plan in `docs/archive/` is history — a
requirement it describes may have been replaced or dropped on purpose.
Establish which before building it.

**API changes are verified over HTTP**, not only by unit tests and `tsc`.
`bruno/` holds 111 requests across 14 collections; extend the one that
covers the area. The `bru` CLI is not installed, so they run from the Bruno
app against `.env.test` — if no safe environment is available, report the
tests blocked rather than skipping them silently.

**A gate counts when its exit code was read.** "Tests should pass" is not a
result.

---

## Documentation

The full policy is in `.claude/rules/documentation.md`. The short version:

1. **Search before creating.** Check `docs/README.md` and grep `docs/` for the
   topic. Prefer updating the authoritative document over adding a new one.
2. **Never create `*-v2.md`, `*-final.md`, `*-complete.md`, or a summary of
   work just finished.** Report completed work in the conversation.
3. **One authoritative source per topic.** Link to it; do not restate it.
4. **A plan is not a specification.** A plan describes work to do and is
   temporary. A spec describes approved behaviour and is permanent. Never mark
   something implemented without reading the code.
5. **Do not duplicate what the code already states.** The Prisma schema defines
   the database; the controllers and DTOs define the API. Documentation
   explains meaning, rules and reasons.
6. **Permanent documents are indexed.** A new file under `docs/` that is not
   linked from `docs/README.md` does not exist.
7. Write engineering documentation in English. Commercial and customer-facing
   documents stay in French where that is their audience.

A new permanent document needs an answer to: who reads it, why an existing
document cannot hold it, and what keeps it true.
