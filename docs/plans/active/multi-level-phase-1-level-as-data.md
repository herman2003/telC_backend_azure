# Implementation Plan: Multi-level Phase 1 — level becomes data

**Status:** plan, not yet approved to implement.
**Parent design:** `docs/architecture/multi-level.md`, Part 7 Phase 1.
**Safety net:** `test/golden/modelltest-golden-integration.spec.ts` and
`test/golden/generator-fidelity.spec.ts` already exist and pass (verified
2026-10-22). Every task below must leave both green.

## Overview

`docs/architecture/multi-level.md` lists six "breaks" to fix in Phase 1
(constants that encode a level's rule instead of reading it as a row).
Re-checked against the current code before writing this plan — **four of the
six are already fixed**, and the B2 rows for `exam_block_durations` /
`exam_section_weights` are already seeded (migration
`20261020120000_seed_b2_exam_rules`). The doc was written 2026-10-20 and the
repo has moved since.

Already fixed, no work needed:

| Break | Where | Evidence |
|---|---|---|
| `EXAM_LEVEL` constant | `exam-sessions.service.ts` | No `EXAM_LEVEL` symbol in `src/`; session level is read from `modelltest.level` (lines 96, 106, 174-180), with a comment explaining why |
| Exam Modelltest picker exposes level | `exam-modelltests.service.ts:62` | `select: { number: true, title: true, level: true }` |
| Sprechen evaluation context/points by level | `evaluation.service.ts:334-347`, `m10MaxPoints` | `getTeilContext(level, teilNumber)` already branches B1 vs B2; `m10MaxPoints` already takes `level` |
| `SpeakingLevel` / Live Room DTO | `speaking-topics.data.ts:14`, `find-partner.dto.ts:37` | `type SpeakingLevel = CefrLevel`; DTO field is `level?: CefrLevel`, no `@IsIn(['B1'])` |
| B2 `exam_block_durations` / `exam_section_weights` seed | migration `20261020120000_seed_b2_exam_rules` | 3 + 10 rows already inserted for B2, `ON CONFLICT DO NOTHING` |

Only two breaks remain, and they're the two the architecture doc flags as
needed for **A-level readiness**, not for B2 (B1/B2 both already work
correctly under the current hardcoded behavior):

1. **Exam pass verdict** (`exam-result.service.ts`) — `PASS_RATIO = 0.6`
   applied to written and oral independently (`written.passed && oral.passed`,
   line 346). Correct for B1/B2 (`PART_PERCENT 60/60`), wrong for A1/A2
   (`TOTAL_PERCENT 60`). No `exam_pass_rules` table exists yet.
2. **Exam block composition** (`exam-scoring.service.ts`) — `BLOCK_SECTIONS`
   is a hardcoded `Record<ExamBlock, ...>` with 3 entries. A1/A2 need a 4th
   block, `LESEN_SCHREIBEN`, which doesn't exist in `enum ExamBlock`. No
   `block` column exists on `exam_section_weights` to derive it from.

Because B1 and B2 already pass under the current constants, every task below
carries an **equality test**: the row-derived value must equal today's
hardcoded value for B1 and B2, so this phase is provably a no-op for existing
levels and only adds capability for levels not yet sold.

## Architecture decisions

- Follow `docs/architecture/multi-level.md` Part 7 Principle 2 exactly: ship
  the migration and the equality test in the same task, never the code change
  without it.
- `exam_pass_rules` is keyed `@id` on `level` (one row per level, per the
  design doc's `ExamPassRule` model) — no surrogate id needed.
- `block` on `exam_section_weights` is backfilled from the *existing*
  `BLOCK_SECTIONS` map (not re-derived), so the migration is a faithful
  snapshot of current behavior before any code reads it.
- `LESEN_SCHREIBEN` is added to `enum ExamBlock` but never referenced by any
  B1/B2 row or any code path in this phase — it exists only so Phase 3 (A2)
  doesn't need another enum migration.

## Task list

### Task 1: Add `exam_pass_rules` table and seed all four levels

**Description:** New Prisma model `ExamPassRule` (per
`docs/architecture/multi-level.md` Part 4) with `PassRuleType` enum
(`TOTAL_PERCENT`, `PART_PERCENT`). Seed B1/B2 as `PART_PERCENT` 60/60 and
A1/A2 as `TOTAL_PERCENT` 60. Purely additive — no existing table touched.

**Acceptance criteria:**
- [ ] `exam_pass_rules` table exists with one row per `CefrLevel`
- [ ] B1 and B2 rows are `PART_PERCENT`, `written_percent: 60`, `oral_percent: 60`
- [ ] A1 and A2 rows are `TOTAL_PERCENT`, `minimum_percent: 60`
- [ ] Migration applies cleanly against `.env.test` via `scripts/apply-migration.mjs` (never a bare `prisma migrate` — `.env` is production)

**Verification:**
- [ ] `npm run test:integration` (golden suite stays green)
- [ ] `npx tsc --noEmit` — exit code 0
- [ ] Manual check: query the seeded rows against `.env.test` and confirm the 4 values match the table above

**Dependencies:** None.

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_exam_pass_rules/migration.sql`

**Estimated scope:** XS — one additive migration, no code.

---

### Task 2: `exam-result.service.ts` reads `exam_pass_rules`

**Description:** Replace the hardcoded `PASS_RATIO = 0.6` / `written.passed
&& oral.passed` logic in `outcomeOf` with a read of the sitting's level's
`exam_pass_rules` row, branching on `PassRuleType`. For `PART_PERCENT`,
behavior must be identical to today. For `TOTAL_PERCENT`, combine written +
oral points over written + oral max before comparing to the threshold (new
code path, exercised only once A-level content exists — but the branch must
exist and be tested now so Phase 3 doesn't touch this file again).

**Acceptance criteria:**
- [ ] `PASS_RATIO` constant deleted; no hardcoded `0.6` remains in `exam-result.service.ts`
- [ ] `outcomeOf` (or its replacement) reads `exam_pass_rules` keyed by the sitting's level
- [ ] Equality test: for every B1 and B2 fixture in the golden suite, the new pass/fail verdict equals what `written.passed && oral.passed` with `PASS_RATIO = 0.6` would have produced
- [ ] A `TOTAL_PERCENT` unit test exists (synthetic level or test-only row) proving a candidate passing 100% written / 50% oral under a `TOTAL_PERCENT 60` rule is marked `PASSED`, which `PART_PERCENT` logic would wrongly fail

**Verification:**
- [ ] `npx jest src/modules/centers/exam-result.service.spec.ts` (or wherever its unit tests live) — exit code 0
- [ ] `npm run test:integration` — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** Task 1.

**Files likely touched:**
- `src/modules/centers/exam-result.service.ts`
- its existing unit/integration test file(s)

**Estimated scope:** S — one service, well-isolated `outcomeOf`/`half` functions.

---

### Task 3: Add `block` column to `exam_section_weights`; add `LESEN_SCHREIBEN` to `enum ExamBlock`

**Description:** Widening migration: add `block ExamBlock` to
`ExamSectionWeight`, backfill existing B1 and B2 rows from the current
`BLOCK_SECTIONS` map in `exam-scoring.service.ts` (so the migration is a
snapshot, not a redesign). Add `LESEN_SCHREIBEN` to `enum ExamBlock` —
additive, unused until Phase 3.

**Acceptance criteria:**
- [ ] `exam_section_weights.block` is non-null for every existing B1 and B2 row
- [ ] Backfilled value for each `(level, skill, teil)` matches exactly what `BLOCK_SECTIONS` maps it to today (`LESEN`/`SPRACHBAUSTEINE` teile → `LESEN_SPRACHBAUSTEINE`, `HOEREN` teile → `HOEREN`, `SCHREIBEN` → `SCHREIBEN`)
- [ ] `enum ExamBlock` has 4 values; `LESEN_SCHREIBEN` is not referenced by any seeded row

**Verification:**
- [ ] `npm run test:integration` — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0
- [ ] Manual check: `SELECT level, skill, teil, block FROM exam_section_weights` against `.env.test`, diffed by eye against `BLOCK_SECTIONS`

**Dependencies:** None (independent of Tasks 1-2; can land in parallel).

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_add_exam_section_weight_block/migration.sql`

**Estimated scope:** XS — one additive+backfill migration, no code yet.

---

### Task 4: `exam-scoring.service.ts` derives `BLOCK_SECTIONS` from rows

**Description:** Replace the hardcoded `BLOCK_SECTIONS` `Record` with a query
over `exam_section_weights` grouped by `block`, for the sitting's level. Route
stays level-generic; B1/B2 composition must come out identical to the
constant it replaces.

**Acceptance criteria:**
- [ ] `BLOCK_SECTIONS` constant deleted from `exam-scoring.service.ts`
- [ ] Block composition is read from `exam_section_weights` rows
- [ ] Equality test: for B1 and B2, the derived section list for every `ExamBlock` equals today's hardcoded `BLOCK_SECTIONS` entry, section-for-section

**Verification:**
- [ ] `npx jest` on `exam-scoring.service`'s existing test file — exit code 0
- [ ] `npm run test:integration` — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** Task 3.

**Files likely touched:**
- `src/modules/centers/exam-scoring.service.ts`
- its existing unit test file

**Estimated scope:** S — one function, `BLOCK_SECTIONS` usage is localized (per the earlier research, line ~99).

---

## Checkpoint: after Tasks 1-4

- [ ] `npx tsc --noEmit` — exit code 0
- [ ] `npm run build` — exit code 0
- [ ] `npx jest` (unit) — exit code 0
- [ ] `npm run test:integration` (includes the golden suite) — exit code 0
- [ ] `npm run test:e2e` — exit code 0
- [ ] No hardcoded `PASS_RATIO` or `BLOCK_SECTIONS` constant remains anywhere in `src/`
- [ ] A B1 and a B2 exam sitting still time, mark, and verdict exactly as before (golden fixtures prove this)
- [ ] Review with user before Phase 2 (B2 content — already shipped per the seeded migration, so this may actually mean Phase 3 / the generic model for A2)

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Backfilling `block` by hand-copying `BLOCK_SECTIONS` introduces a typo, silently changing B1/B2 block timing | High | Task 3's acceptance criteria require the backfill to be generated from the literal `BLOCK_SECTIONS` map (script or copy-paste checked against it line by line), not retyped from memory |
| `TOTAL_PERCENT` branch in Task 2 is unexercised by real traffic until A-level ships | Medium | Explicit unit test with a synthetic `TOTAL_PERCENT` row proves the branch works before it's needed, per the design doc's Principle 2 |
| Scope creep into Phase 3 (generic content model) since two of six "breaks" are gone | Low | This plan stops at Task 4; Phase 3 is out of scope here |

## Open questions

- Doc Part 7 calls this "Phase 1," with Phase 2 being "B2 content." B2 content
  is already live (migrations exist for MT 7+). Worth confirming with the
  user whether the next phase after this one is "Phase 3: the generic model
  and A2" directly, skipping a Phase 2 that already happened — or whether
  there's remaining Phase-2-shaped work (e.g. the `writing_exercises`
  `choice_group_id` widening) not yet verified. Not re-checked in this pass;
  scoped out to keep this plan to Phase 1 only.
