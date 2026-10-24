# Engineering workflow

How a change gets from a sentence to production. The gates and git rules in
`CLAUDE.md` are not restated here — they still apply, and this file never
relaxes them.

---

## Three weights

Match the process to the risk. Most work is **standard**.

| Weight | What it is | Process |
|---|---|---|
| **Small** | a wrong string, a validation message, a stale doc link | investigate → implement → gates → PR. No spec, no research, no ADR |
| **Standard** | a new endpoint, a business-rule change | the full table below, research only if something is unfamiliar |
| **High risk** | auth, authorization, payments, exam results, AI grading, personal data, a schema change | everything, plus external research, independent review in a fresh context, and staging |

Arguing about the weight costs less than using the wrong one. When unsure,
say which you picked and why.

## The stages

| # | Stage | Use | Writes |
|---|---|---|---|
| 1 | ROUTE | `using-agent-skills` | no |
| 2 | UNDERSTAND | `mattpocock-skills:grilling` | no |
| 3 | INVESTIGATE | `Explore` agent, `docs/README.md`, `docs/glossary.md` | no |
| 4 | RESEARCH | `source-driven-development` | no |
| 5 | DESIGN | `api-and-interface-design`; `documentation-and-adrs` only for an architectural decision | ADR |
| 6 | **APPROVAL** | **a human** | — |
| 7 | PLAN | `planning-and-task-breakdown` | plan file |
| 8 | IMPLEMENT | `incremental-implementation` + `test-driven-development` | code, tests |
| 9 | GATES | the five in `CLAUDE.md` | no |
| 10 | API TESTING | Bruno — see below | `.bru` files |
| 11 | REVIEW | `mattpocock-skills:code-review`, fresh context | no |
| 12 | PR | `mattpocock-skills:pr` + `git-workflow-and-versioning` | branch, PR |
| 13 | STAGING | CI plus non-destructive Bruno | no |
| 14 | **PRODUCTION** | **a human** — merging to `main` deploys | — |

Specialists, when the subject calls for them — not in addition to the stage
skill, in place of it: `mattpocock-skills:domain-modeling` for vocabulary,
`mattpocock-skills:diagnosing-bugs` for a reproducible defect,
`security-and-hardening` for anything touching auth or money,
`performance-optimization` for a measured regression,
`frontend-ui-engineering` for client work.

**One skill per stage.** Two planning skills, or two implementation skills,
produce two plans that disagree.

## Four approvals

Nothing past these happens on an agent's own judgement:

1. **Design** — before any code is written.
2. **Plan** — for standard and high-risk work.
3. **Merge** — a PR is opened, never merged, without a human.
4. **Production** — merging to `main` deploys. Always asked, never assumed.

## When a feature is requested

Do not open an editor. In order:

1. State the business objective in one sentence and have it corrected.
2. Read the code and tests that already touch the area.
3. Read `docs/domains/` and `docs/adr/` for the approved rule.
4. Say whether the functionality already exists — it often half does.
5. Research only what is genuinely unfamiliar.
6. Offer two or three approaches when they meaningfully differ, and
   recommend one.
7. Name the skills the work will use.
8. Stop for approval.

**Three different things, never conflated:**

| | |
|---|---|
| What the code does | read `src/` — this is behaviour, not intent |
| What the product promises | `docs/domains/`, `docs/adr/` — this is the rule |
| What someone once planned | `docs/archive/` — this is history, not a requirement |

An archived plan is not a to-do list. A requirement that is missing may have
been replaced, descoped or deliberately dropped. Establish which before
building anything, and say so.

## Skills that write files

`research` writes a Markdown file into the repo by default. `planning-and-task-breakdown`
writes a plan. Both are subject to `.claude/rules/documentation.md`: ask
before creating a permanent document, keep temporary plans out of `docs/`, and
report findings in the conversation unless an artifact was requested.

Sixteen of Matt Pocock's skills carry `disable-model-invocation: true` — an
agent cannot call them, and that is deliberate. They are yours to type:
`/mattpocock-skills:<name>`. Check the available-skills list before claiming a
skill exists.

---

## Bruno

111 `.bru` requests across 14 collections. They test HTTP behaviour against a
running server, which unit tests and `tsc` cannot: guards, status codes,
real payloads, and the order endpoints must be called in.

### Before changing an API

1. Find the collection that already covers the area — `bruno/<Area>/`.
2. Read its requests and assertions.
3. Note which ones mutate data.
4. Extend the existing collection. Do not start a parallel one.

### What a scenario set covers

Pick what the endpoint actually has, not the whole list:

- **Success** — status, shape, and the business effect
- **Validation** — missing field, malformed id, bad query parameter
- **Authentication** — absent token, invalid token, expired token
- **Authorization** — wrong role, wrong centre, wrong CEFR level, missing
  entitlement
- **Business rules** — only those in `docs/domains/`, never one taken from an
  archived plan
- **Failure** — not found, conflict, repeat request, exhausted credits

### Running them

The **`bru` CLI is not installed** and Bruno is not in CI. Today collections
run from the Bruno app against `bruno/environments/local.bru`
(`http://localhost:3001`). Scripted or CI runs would need `@usebruno/cli`,
which is a new dependency and needs approval — do not assume a command that
does not exist.

Start the server with `npm run start:testdb`, which loads `.env.test` and
prints the host it reached.

### Safety

- Confirm the base URL before running anything. `.env.test` is
  `ep-misty-sea`; production is `ep-wandering-hall`.
- The integration suites delete centre and student rows. Never point them at
  real data, and rebuild the fixture afterwards with
  `node scripts/seed-b2-bruno-fixture.mjs`.
- If a safe environment is not available, report the tests **blocked**. Do not
  substitute a guess.

### Reporting

A 200 is not a pass — the assertions have to pass too, and a failing
assertion is reported as a failure. Never edit an expected value to match
behaviour you have not confirmed is correct.

| Collection | Environment | Result | Exit code |
|---|---|---|---|

State which scenarios ran, which failed, which were not executed, and where
coverage is still missing.

---

## Evidence

A gate counts when its command was run and its **exit code** read. "Tests
should pass" is not a result. "I ran X, it exited 0" is.

This repository has twice reported a clean build that was not: `nest build`
puts ANSI escapes between `error` and `TS`, so a grep never matched, and a
suite piped to `tail` returns `tail`'s exit code. Read the code, not the
output.

A skill counts as used only when it was actually invoked.
