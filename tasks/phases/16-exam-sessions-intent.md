# Phase 16 — Exam sittings: create, publish, admit: intent

**Written:** 2026-09-24
**Branch base:** `dev` @ `2961109` (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md` — read the assumptions table first

## Why

A center runs its exams by hand: telling students when to come, which test
they sit, collecting papers, marking, typing results into a spreadsheet. The
simulator replaces that, and this phase is the half the manager touches —
creating a sitting, choosing who may take it, and publishing it so it opens by
itself at the chosen minute.

Nothing a student can reach is in this phase. That is deliberate: publishing
is where the money is spent and where the access rule is written, and both
should be provably right before anyone sits an exam.

## What we intend to build

1. **Schema** — three tables, two enums, four column changes:
   - `exam_sessions`, `exam_session_participants`, `exam_block_durations`
   - `ExamGradingTier { MANUAL, AI }`, `ExamBlock { LESEN_SPRACHBAUSTEINE,
     HOEREN, SCHREIBEN }`
   - `centers.exam_slots_remaining`, `payments.kind`, `modelltests.exam_only`
   - B1 durations seeded: 90 / 30 / 30, in that order
2. **Derived status**, the way `deriveAccountState` works — `DRAFT`,
   `SCHEDULED`, `OPEN`, `CLOSED`, `CANCELLED`, computed from timestamps on
   every read, never stored.
3. **Session CRUD** for the wizard: create a draft, edit it, list with counts
   and status, read one. Level fixed to B1 while that is all the content we
   have.
4. **Participants**: the eligible list (this center's students only), setting
   the list, and the "already trained on this Modelltest" warning — counted
   from `student_activity`, so the manager can pick another one.
5. **Publish**: computes `closes_at` from a 24/48/72h window, spends one slot
   per participant **in the same transaction**, refuses when there are not
   enough, and is idempotent — a double-clicked publish must not spend twice.
6. **Cancel, close early, reopen** — a center's decisions about its own exam.

## Not in this phase

- Anything a student can call. Attempts, blocks, timers, Hören plays: phase 3.
- Buying slots. Phase 2 — until then a slot balance is set in the database by
  hand, which is enough to test publishing.
- Results, grading, export, notifications: phases 4 and 5.
- The AI tier. The column ships now; nothing reads it until phase 6.

## Decisions this phase makes concrete

| | |
|---|---|
| Access window ≠ exam timer | `closes_at` is when starting stops being allowed; the telc clock is per block, later |
| A participant row is the access rule | not the seat, not the account |
| Slots have no minimum | a sitting for three candidates is a real thing; seats keep their floor of ten |
| A slot is spent at publish | not at start, and never returned |
| 404, never 403 | for a session belonging to another center — a 403 confirms the id exists |

## How we will work

Branch from `dev`. Tests before the service where the rule is interesting —
the status derivation and the publish transaction especially, because both are
about ordering rather than output. Publish gets an integration test against
real Postgres: spending slots under a concurrent double publish is a claim
about a transaction, and a mock has no transaction.

Migration generated with `migrate diff`, applied only to the `.env.test`
branch, never with a bare `prisma migrate`. All four suites green before the
merge: `npx jest`, `npm run test:e2e`, `npm run test:integration`, `npm run
build`.

## Done when

A manager can create a draft, pick a Modelltest and be warned if the class has
already trained on it, choose participants, publish, watch the status become
`SCHEDULED` and then `OPEN` without anything having run, and see the slot
balance fall by exactly one per candidate — with a second publish spending
nothing.
