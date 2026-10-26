# Lerniqo backend

API for Lerniqo, a preparation product for the **telc Deutsch** exams.

Language schools ("centres") buy seats and hand students activation codes.
A student redeems one and practises the five exam skills — Hören, Lesen,
Sprachbausteine, Schreiben, Sprechen — against real Modelltests, with AI
feedback on the two that cannot be machine-marked. Centres also run **Exam
Day**: a timed sitting their candidates take and their trainers mark.

Levels B1 and B2 ship today; A1 and A2 are planned.

Clients: a Flutter app for students (web and mobile) and a web dashboard for
centres. Neither lives in this repository.

## Stack

NestJS 11 · TypeScript · Prisma 7 (driver adapter + `pg`) · PostgreSQL on Neon
· Jest · Bruno for manual API runs.

## Setup

Node 20+ and a PostgreSQL database.

```bash
npm install
cp .env.example .env          # fill in the connection strings
npx prisma generate
```

Two env files matter: `.env` points at **production**, `.env.test` at a
disposable branch. Scripts that write data load `.env.test` first and refuse
the production endpoint.

## Running

```bash
npm run start:testdb     # against .env.test — use this for manual testing
npm run start:dev        # whatever .env says
```

Swagger: `http://localhost:3001/api-docs`.

After running the integration suites, rebuild the manual-testing fixture:
`node scripts/seed-b2-bruno-fixture.mjs`.

## Tests

```bash
npx tsc --noEmit          # the only gate that type-checks test files
npm run build
npx jest                  # unit
npm run test:integration  # needs .env.test
npm run test:e2e
```

CI runs the same five plus a lint ratchet. Read each by exit code, not by
grepping its output.

## Migrations

**Never run a bare `prisma migrate`** — the CLI reads `.env`, which is
production. Use `scripts/apply-migration.mjs`, which targets `.env.test` and
refuses the production host.

`prisma/schema.prisma` and the files in `prisma/migrations/` are the source of
truth for the database. No document restates them.

## Branching

Branch from `dev`, never `main` — `main` auto-deploys on merge. `dev` is
protected, so changes arrive by pull request.
See [docs/guides/branching.md](docs/guides/branching.md).

## Documentation

**[docs/README.md](docs/README.md)** is the index.

[Glossary](docs/glossary.md) · [Architecture](docs/architecture/) ·
[ADRs](docs/adr/) · [Domain rules](docs/domains/) ·
[Client contracts](docs/contracts/) · [Backlog](docs/backlog.md)

Working with an AI agent on this repository? `CLAUDE.md` and
`.claude/rules/documentation.md` are the conventions it must follow.
