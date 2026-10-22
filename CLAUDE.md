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
