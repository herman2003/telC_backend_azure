# Phase 26 — B2 as a second CEFR level

**Spec:** `docs/archive/spec-b2-level.md` · **Block:** `docs/archive/build-block-b2-level.md`
**Branch:** `feat/b2-level` off `dev` (created; two doc commits on it)
**Status:** plan awaiting approval. No code written.

## Intent

B2 behaves exactly as B1 does, with B2 content. Thirteen tasks, two hard
checkpoints, one PR.

---

## Dependency graph

```
T1  golden master  ─────────────────────────────── blocks everything
      │
T2  seed B2 rules  ──► 🛑 CHECKPOINT A
      │
      ├──► T3  EXAM_LEVEL + picker level
      ├──► T4  M10_B2 table ──────────► T6  Sprechen prompt
      ├──► T5  capTaskFulfilment
      ├──► T7  SpeakingLevel enum
      ├──► T13 activity guard
      └──► T9  writing_exercises key ──┬► T8  exam records the Aufgabe
                                        └► T10 v2 importer
                                              │
                                   🛑 CHECKPOINT B
                                              │
                                        T11 import MT 7
                                              │
                                        T12 vocab extraction
                                              │
                              /review ──► Bruno ──► PR
```

### Waves

| Wave | Tasks | Notes |
|---|---|---|
| 0 | **T1** | strictly alone — nothing is provably safe before it |
| 1 | **T2** | additive rows, then 🛑 A |
| 2 | **T3 · T4 · T5 · T7 · T9 · T13** | independent of one another, may be built in any order |
| 3 | **T6** (needs T4) · **T8**, **T10** (need T9) | |
| 4 | 🛑 B, then **T11** | the only task that writes content |
| 5 | **T12** | needs MT 7 to exist |
| close | `/review` · Bruno · PR | |

Wave 2 is where most of the work is and none of it blocks the rest.

---

## Risks

| | Risk | Mitigation |
|---|---|---|
| 1 | **T3–T8 touch scoring code B1 uses in production** | each carries an equality test with B1's old constant as the expected value, kept in the test file, never in the production path. T1's golden master is the backstop |
| 2 | **T9 is the only schema change to a B1 content table** | widening only: `part` defaults to 1 and backfills existing rows, so every current row stays valid. Existing DTO fields keep their shape; the two-task read is a new field |
| 3 | **T11 is the only task that writes content** | 🛑 B precedes it. Applied against `.env.test` only; the SQL and verify output are reviewed before the migration is committed |
| 4 | T4's `normalizeTeilNumber` silently coerces 0 → 1 | T4 rejects part 0 rather than normalising it; a test asserts the throw |
| 5 | T10 could hard-code MT 7 and make MT 8 cost code | the five importer rules are acceptance criteria, and T10's verify imports a synthetic second paper |
| 6 | Revision collisions — `listening_exercises.content_revision` and `speaking_exercises.content_revision` are globally unique | T10 derives revisions from `(level, paper, skill, teil)`; a test asserts two papers at the same level produce no collision |

---

## Tasks

### T1 — Golden master and generator fidelity

- **Acceptance:** `test/golden/` holds a committed snapshot of every skill
  service's output for Modelltests 1–6 — Lesen (`getExercise`), Sprachbausteine
  (`getExercise`), Hören (all three Teile), Schreiben
  (`getExerciseByModelltest`), Sprechen (`getTeils`). A separate test re-runs
  `scripts/generate-modelltest-seed.mjs` for MT 3–6 and asserts its SQL is
  byte-identical to the committed migrations. Snapshots are taken at the
  **service** layer, not over HTTP, so no auth or entitlement setup is needed
  and mapper changes are still caught; the existing e2e suite remains the
  HTTP-level guard.
- **Verify:** `npm.cmd test -- --runInBand`. Then change one character in a
  B1-facing mapper and confirm the suite goes red. Revert.
- **Files:** `test/golden/*.snapshot.json`, `test/golden/modelltest-golden.spec.ts`,
  `test/golden/generator-fidelity.spec.ts`

### T2 — Seed B2 exam rules

- **Acceptance:** one migration inserts the three `exam_block_durations` rows
  (90 / **20** / 30) and the ten `exam_section_weights` rows from the spec,
  both `ON CONFLICT ... DO NOTHING`. B1's rows are untouched. A test asserts
  B2's written rows sum to 225, oral to 75, and that `weightsFor('B2')` returns
  ten rows.
- **Verify:** apply against `.env.test`; `npm.cmd run test:integration -- --runInBand`
- **Files:** `prisma/migrations/<ts>_seed_b2_exam_rules/migration.sql`,
  `src/modules/centers/exam-result.service.spec.ts`

### 🛑 CHECKPOINT A

The human confirms all thirteen values against the telc booklet before any
code reads them. Wrong here is wrong for every B2 candidate permanently.

### T3 — Session level from the Modelltest; level on the picker

- **Acceptance:** `EXAM_LEVEL` is deleted. `createSession` selects
  `modelltest.level` and stores it. `ExamModelltestDto` carries `level`, and
  the list filters by it. A B1 Modelltest still produces a `level: 'B1'`
  session (equality test).
- **Verify:** `npm.cmd test -- --runInBand`; `npm.cmd run test:e2e -- --runInBand`
- **Files:** `src/modules/centers/exam-sessions.service.ts`,
  `src/modules/centers/exam-modelltests.service.ts`,
  `src/modules/centers/dto/exam-modelltests.dto.ts`, their specs

### T4 — `M10_B2` and level threading

- **Acceptance:** `M10_B2` exists with criteria 1–3 at A7/B5/C3/D0 and
  criterion 4 at A4/B2/C1/D0, max 25, uniform across parts.
  `tableForTeil(teil)` becomes `tableFor(level, teil)`; `level` is threaded
  through `buildTelcSprechenRating`, `m10MaxPoints`, `criterionMax` and
  `criterionPercent`. **Part 0 throws** rather than normalising to Teil 1. No
  caller defaults an unknown level to `'B1'`. Equality test: `tableFor('B1', 1)`
  and `tableFor('B1', 2)` equal the legacy tables.
- **Verify:** `npm.cmd test -- --runInBand`
- **Files:** `src/modules/speaking/speaking-telc-rating.ts`, its spec,
  `src/modules/speaking/services/evaluation.service.ts` (call sites only)

### T5 — `capTaskFulfilment` derived from `requiredPoints`

- **Acceptance:** the cap follows one rule —
  `>= requiredPoints → A`, `== requiredPoints - 1 → B`,
  `== requiredPoints - 2 → C`, else `D`. Equality test: with
  `requiredPoints: 4` the behaviour is identical to today (4→A, 3→B, 2→C,
  ≤1→D); with `requiredPoints: 3` it gives 3→A, 2→B, 1→C, 0→D.
- **Verify:** `npm.cmd test -- --runInBand`
- **Files:** `src/modules/writing/writing-telc-rating.ts`, its spec

### T6 — Both AI rating prompts keyed on level

Widened from "the Sprechen prompt" after T5. Two prompts name B1 to the
model, not one, and the Schreiben one is the more dangerous of the pair.

**Sprechen** (`evaluation.service.ts:268`) opens *"expert rater for telc
Deutsch B1 Mündlicher Ausdruck (Bewertungsbogen M10), Teil N"* with B1's Teil
names and `maxPts = teil === 1 ? 15 : 30`. At B2 the Teil numbers mean
different tasks, so a B2 candidate practising Teil 1 is rated against B1's
*Einander kennenlernen* out of 15 instead of *Über Erfahrungen sprechen* out
of 25.

**Schreiben** (`writing-correction.service.ts:228`) opens *"expert rater for
telc Deutsch B1 Schriftlicher Ausdruck (Zertifikat Deutsch)"*. The spec had
this as a watch item because B2's rubric and 45 points are already
implemented — the arithmetic is right. The booklet shows why that is not
enough: B2's criterion II bands are A *B2 gut erfüllt*, B *B2 erfüllt*,
**C *B1***, D *A2 oder darunter*. At B2, solidly-B1 writing is a **C**.
Telling the model it is rating B1 anchors it to the wrong standard and returns
A or B for that same text, and the correct conversion then produces a
confidently wrong mark.

- **Acceptance:** both prompts name the level being rated. The Sprechen Teil
  context comes from `(level, teil)` — B2 Teil 1 *Über Erfahrungen sprechen*,
  Teil 2 *Diskussion*, Teil 3 *Gemeinsam etwas planen* — and max points from
  `m10MaxPoints(level, teil)`. The Schreiben prompt carries the level and its
  criterion II banding. The unscored intro cannot be evaluated. **A B1 request
  produces byte-identical prompts to today**, asserted by string equality on
  both.
- **Verify:** `npm.cmd test -- --runInBand`
- **Files:** `src/modules/speaking/services/evaluation.service.ts`,
  `src/modules/writing/writing-correction.service.ts`, their specs

### T7 — `SpeakingLevel` → `CefrLevel`

- **Acceptance:** `type SpeakingLevel = 'B1'` is replaced by `CefrLevel`;
  `@IsIn(['B1'])` and the `enum: ['B1']` API properties are widened. Live Room
  topics carry a level and are selected by it. The lobby still refuses to pair
  across levels. A B2 student can open a room; with no B2 topics seeded the
  response is an explicit empty-topic state, **not** a B1 topic and not a 500.
- **Verify:** `npm.cmd test -- --runInBand`; `npm.cmd run test:e2e -- --runInBand`
- **Files:** `src/modules/speaking/room/speaking-topics.data.ts`,
  `src/modules/speaking/room/dto/find-partner.dto.ts`,
  `src/modules/speaking/room/dto/topic.dto.ts`,
  `src/modules/speaking/room/dto/create-room-query.dto.ts`, their specs

### T9 — `writing_exercises` keyed by part *(wave 2, before T8 and T10)*

- **Acceptance:** `@@unique([modelltest_id])` becomes
  `@@unique([modelltest_id, part])`; `part Int @default(1)` backfills existing
  rows; `choice_group_id String?` added. `writing.service.ts` returns every
  task of the Modelltest. **Existing DTO fields keep their shape** — the list
  is a new field, so a B1 response is unchanged apart from the addition.
- **Verify:** apply against `.env.test`; `npm.cmd test -- --runInBand`;
  golden master still green
- **Files:** `prisma/schema.prisma`,
  `prisma/migrations/<ts>_writing_exercise_part/migration.sql`,
  `src/modules/writing/writing.service.ts`,
  `src/modules/writing/dto/*.ts`, their specs

### T8 — Exam Schreiben records the chosen Aufgabe

- **Acceptance:** when a candidate submits the Schreiben block, the task they
  answered is recorded. **Resolution of the spec's open question:** store the
  chosen task's `content_revision` in `writing_attempts.exercise_id` — already
  a free string, already unique, meaningful to a trainer, no schema change. The
  center-facing read exposes it. A B1 sitting, which has one task, records that
  task's revision and nothing else changes.
- **Verify:** `npm.cmd test -- --runInBand`; `npm.cmd run test:e2e -- --runInBand`
- **Files:** `src/modules/centers/exam-scoring.service.ts`,
  `src/modules/centers/exam-result.service.ts`, their specs

### T13 — Activity writer ignores unscored sections

- **Acceptance:** no `student_activities` row is written for an unscored
  section. The `teil >= 1` guard stays — the caller must not reach it. A test
  asserts an unscored B2 Sprechen intro submission writes no activity and does
  not throw.
- **Verify:** `npm.cmd test -- --runInBand`
- **Files:** `src/modules/student-activity/student-activity.writer.ts`,
  its spec, the Sprechen submit path

### T10 — v2 importer and parameterised verify

- **Acceptance:** `scripts/import-modelltest-v2.mjs` is a **new file**;
  `scripts/generate-modelltest-seed.mjs` is **not edited**. It reads `level`
  and `number` from the JSON, derives every `content_revision` from
  `(level, paper, skill, teil)`, accepts `part: 0` Sprechen and two Schreiben
  tasks, reads `media.audioUrl` and `media.durationSeconds`, emits `level` on
  the Modelltest insert, carries no repair block, and is idempotent.
  `scripts/verify-modelltest.mjs` takes level and number as arguments.
- **Verify:** import a synthetic second B2 paper into `.env.test` and confirm
  **no code change was needed** and no revision collided. Generator-fidelity
  test still green.
- **Files:** `scripts/import-modelltest-v2.mjs`,
  `scripts/verify-modelltest.mjs`, `package.json` (two scripts)

### 🛑 CHECKPOINT B

The human sees the generated migration SQL and the verify output before it
becomes a committed migration. Applied against `.env.test` only.

### T11 — Import the B2 paper as Modelltest 7

- **Acceptance:** `content/b2-modelltest-1-source.json` has `number: 7` and
  `transcript: null` throughout. The generated migration creates MT 7 with
  `level: 'B2'` and all five skills. B1's Modelltests 1–6 are untouched —
  golden master byte-identical.
- **Verify:** `npm.cmd run verify:modelltest -- --level B2 --number 7`; all
  four suites
- **Files:** `content/b2-modelltest-1-source.json`,
  `prisma/migrations/<ts>_seed_modelltest7/migration.sql`

### T12 — Vocab occurrences for MT 7

- **Acceptance:** `vocab_occurrences` rows exist for MT 7 with
  `in_weekly_pack` set, so a B2 student's weekly pack is not empty.
- **Verify:** `npm.cmd run vocab:analyze-extract`, then
  `npm.cmd run vocab:curate-weekly-pack`; confirm
  `GET /api/vocab/of-the-week` returns cards for a B2 seat
- **Files:** generated migration or seed output only — no source changes

---

## Closing work

| | Step | Gate |
|---|---|---|
| 1 | `/review` over the whole diff — five axes, attention on the exam and scoring paths. Findings reported before any fix | 🛑 the human approves which are fixed |
| 2 | `bruno/B2 Level/` — the 14 numbered requests in the block doc | 🛑 the human runs the collection against local |
| 3 | PR into `dev`, referencing `docs/archive/spec-b2-level.md` | four suites green |

---

## Done when

Every success criterion in `docs/archive/spec-b2-level.md` is met, Modelltests 1–6 are
byte-identical to T1's snapshot, and the four suites are green.

**And the real finish line:** importing a second B2 paper costs one JSON file,
one audio upload and one vocab run. No code. T10's verify step is what proves
it before the PR, not after.
