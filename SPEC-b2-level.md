# Spec: telc Deutsch B2 as a second CEFR level

**Branch:** `feat/b2-level` off `dev` · **Block:** `docs/BUILD_BLOCK_B2_LEVEL.md`
**Reference:** `docs/MULTI_LEVEL_ARCHITECTURE.md`
**Status:** awaiting approval. No code written yet.

---

## Objective

**B2 behaves exactly as B1 does, with B2 content.** A center sets an activation
code to `B2`; the student who redeems it gets the whole Lerniqo Start
experience on B2 material, and a manager can run a B2 Exam Day sitting that
times and marks to telc's B2 grid.

Nothing about the product changes. A second level appears.

**Users:** the student on a B2 seat (Flutter, web and mobile), and the center
manager running B2 sittings from the dashboard.

**Scope:** B2 only. A1 and A2 are out — their Aufgabenarten have no tables and
arrive in a later block.

### Why this is small

B2's scoring grid is B1's. Of the five modules, three need nothing (Lesen,
Sprachbausteine, Hören — identical point distributions), Schreiben needs
nothing (`writing-telc-rating.ts` already implements B2's rubric), and only
Sprechen needs a new criterion table. The rest of the work is removing
constants that should have been rows.

---

## Assumptions

Settled in conversation and in the block doc. **Not to be re-litigated during
implementation** — if one turns out wrong, update this spec first.

| | Decision |
|---|---|
| 1 | The B2 paper is **Modelltest number 7**, `level: 'B2'`. `modelltests.number` stays globally unique, so no service, URL or client changes |
| 2 | B2 uses the **existing B1 content tables**. Its Aufgabenarten are B1's, verified section by section |
| 3 | `exam_section_weights` for B2 = **ten rows, B1's exact values**, with Sprechen as **one row** (`teil 1`, 75 points) exactly as B1 stores it — not three rows of 25 |
| 4 | `exam_block_durations` for B2 = **90 / 20 / 30**. Only Hören differs from B1's 30 |
| 5 | **No pass-rule change.** `PASS_RATIO 0.6` is already applied per half (`written.passed && oral.passed`), which is telc's written ≥135 **and** oral ≥45 |
| 6 | **Transcripts are `null`** for revision `b2-modelltest-1-v1`. The cut positions are unverified and must not ship under an immutable revision; they arrive later as a new revision |
| 7 | The **60 B2 Live Room topics** are content the founder supplies. Task 7 ships the code that needs them |

### Explicitly out of scope

| | Why |
|---|---|
| Grade bands (sehr gut / gut / befriedigend / ausreichend) | nothing implements them today and B1 has the same bands — one feature for both levels, not a B2 task |
| `exam_pass_rules` table | B2's rule is identical to B1's (assumption 5) |
| `block` column on `exam_section_weights`, `LESEN_SCHREIBEN` enum value | A-family only |
| Decimal exam points | Lesen T3 and Hören T2 are 2.5/answer and Sprachbausteine 1.5, but `exam_section_results.points` is an `Int`. **B1 has identical counts and totals**, so this is pre-existing shared behaviour, not a B2 regression. Changing it changes both levels |
| AI-vs-human agreement measurement | real and worth doing; not this block |
| A1 / A2, and the generic content model | later block |

---

## Tech stack

NestJS 11 · TypeScript · Prisma · PostgreSQL (Neon) · Jest · Bruno for API
collections. No new dependencies.

---

## Commands

```
Build:              npm.cmd run build
Unit tests:         npm.cmd test -- --runInBand
End-to-end tests:   npm.cmd run test:e2e -- --runInBand
Integration tests:  npm.cmd run test:integration -- --runInBand
Lint:               npm.cmd run lint
Prisma client:      npm.cmd run prisma:generate
Dev server:         npm.cmd run start:dev
Vocab extraction:   npm.cmd run vocab:analyze-extract
Weekly pack:        npm.cmd run vocab:curate-weekly-pack
```

**Migrations are never run bare.** `.env` is production. Every migration in
this block is applied against `.env.test` only, by exporting its variables
first, and any connection string naming `ep-wandering-hall` is refused.

---

## Project structure

Files this block touches. Nothing outside this list changes.

```
prisma/
  schema.prisma                                  writing_exercises key + choice_group_id
  migrations/<ts>_seed_b2_exam_rules/            durations + weights (additive)
  migrations/<ts>_writing_exercise_part/         widening
  migrations/<ts>_seed_modelltest7/              generated B2 content

src/modules/centers/
  exam-sessions.service.ts                       EXAM_LEVEL deleted
  exam-modelltests.service.ts                    level filter
  dto/exam-modelltests.dto.ts                    + level
  exam-scoring.service.ts                        records the chosen Aufgabe

src/modules/speaking/
  speaking-telc-rating.ts                        + M10_B2, tableFor(level, teil)
  services/evaluation.service.ts                 prompt keyed on (level, teil)
  room/speaking-topics.data.ts                   SpeakingLevel → CefrLevel, + level
  room/dto/find-partner.dto.ts                   @IsIn(['B1']) → CefrLevel
  room/dto/{topic,create-room-query}.dto.ts      enum widened

src/modules/writing/
  writing.service.ts                             returns every task
  writing-telc-rating.ts                         capTaskFulfilment derivation

src/modules/student-activity/
  student-activity.writer.ts                     unscored sections write nothing

scripts/
  import-modelltest-v2.mjs                       NEW — the B1 generator is untouched
  verify-modelltest.mjs                          NEW — parameterised by level + number

content/
  b2-modelltest-1-source.json                    number: 7, transcripts null

test/
  golden/modelltest-*.snapshot.json              NEW — the non-regression net

bruno/B2 Level/                                  NEW — 14 requests
```

---

## The data, value by value

### `exam_block_durations` — three rows

| level | block | minutes | position |
|---|---|---|---|
| B2 | `LESEN_SPRACHBAUSTEINE` | 90 | 1 |
| B2 | `HOEREN` | **20** | 2 |
| B2 | `SCHREIBEN` | 30 | 3 |

`ON CONFLICT ("level","block") DO NOTHING`.

### `exam_section_weights` — ten rows

| level | skill | teil | max_points | part |
|---|---|---|---|---|
| B2 | `LESEN` | 1 | 25 | WRITTEN |
| B2 | `LESEN` | 2 | 25 | WRITTEN |
| B2 | `LESEN` | 3 | 25 | WRITTEN |
| B2 | `SPRACHBAUSTEINE` | 1 | 15 | WRITTEN |
| B2 | `SPRACHBAUSTEINE` | 2 | 15 | WRITTEN |
| B2 | `HOEREN` | 1 | 25 | WRITTEN |
| B2 | `HOEREN` | 2 | 25 | WRITTEN |
| B2 | `HOEREN` | 3 | 25 | WRITTEN |
| B2 | `SCHREIBEN` | 1 | 45 | WRITTEN |
| B2 | `SPRECHEN` | 1 | **75** | ORAL |

`ON CONFLICT ("level","skill","teil") DO NOTHING`.

Written sums to 225 (75 + 30 + 75 + 45), oral 75, total 300.

**Why Sprechen is one row.** B1 stores its three oral Teile (15/30/30) as a
single row of 75, and telc marks the oral as one conversation against M10
criteria. Three rows of 25 would give the trainer three oral inputs for B2 and
one for B1 — dashboard work for no gain. The per-part breakdown lives in the
M10 table below, which is where it belongs.

### `M10_B2` — speaking criterion points

Uniform across all three scored parts, max 25 each, 75 total.

| Criterion | A | B | C | D |
|---|---|---|---|---|
| 1 Ausdrucksfähigkeit | 7 | 5 | 3 | 0 |
| 2 Aufgabenbewältigung | 7 | 5 | 3 | 0 |
| 3 Formale Richtigkeit | 7 | 5 | 3 | 0 |
| 4 Aussprache und Intonation | 4 | 2 | 1 | 0 |

For contrast, B1 as implemented today:

| | Criteria 1–3 | Criterion 4 | Max |
|---|---|---|---|
| B1 Teil 1 | A4 B3 C1 D0 | A3 B2 C1 D0 | 15 |
| B1 Teil 2/3 | A8 B6 C2 D0 | A6 B4 C2 D0 | 30 |

C is 1 or 2 at B1 and **3** at B2, so B2 cannot be derived by scaling B1. It is
a third table.

**The unscored intro.** B2's `Einander kennenlernen` is `part 0` and carries no
points. `normalizeTeilNumber` returns `1 | 2 | 3` and would silently coerce 0
to 1, scoring the intro as Teil 1. Part 0 must be rejected before it reaches
the rating code, not normalised.

### `capTaskFulfilment` — derived, not hard-coded

Criterion I is capped by how many Leitpunkte the candidate addressed. The
current thresholds (`≤1→D, 2→C, 3→B`) are B1's four-point calibration written
as literals. B2's task has **three** required points.

The general rule, from the booklet's wording at both levels:

```
addressed >= requiredPoints      → A
addressed == requiredPoints - 1   → B
addressed == requiredPoints - 2   → C
otherwise                         → D
```

This reproduces B1 exactly (`requiredPoints: 4` → 4→A, 3→B, 2→C, ≤1→D) and
gives B2 the right ceiling (`requiredPoints: 3` → 3→A, 2→B, 1→C, 0→D). Because
it reproduces B1, the equality test for this change is a pure refactor check.

---

## Code style

Match the surrounding code: explanatory comments that say *why*, not *what*;
level-dependent behaviour read from data or keyed on an enum, never a literal.

The shape of the Sprechen change:

```ts
/**
 * telc Mündlicher Ausdruck — Bewertungsbogen M10, per level.
 *
 * B1 weights Teil 1 lighter than Teil 2/3 (15/30/30). B2 weights all three
 * equally (25/25/25) and maps the letters differently — a C is worth 3 at B2
 * and 1 or 2 at B1 — so B2 is a third table rather than a scaling of B1.
 */
const M10_B2: Record<CriterionKey, Record<TelcLetter, number>> = {
  expression: { A: 7, B: 5, C: 3, D: 0 },
  taskFulfilment: { A: 7, B: 5, C: 3, D: 0 },
  formalAccuracy: { A: 7, B: 5, C: 3, D: 0 },
  pronunciation: { A: 4, B: 2, C: 1, D: 0 },
};

function tableFor(level: CefrLevel, teilNumber: number) {
  if (level === 'B2') return M10_B2;
  return normalizeTeilNumber(teilNumber) === 1 ? M10_TEIL1 : M10_TEIL23;
}
```

`level` is threaded through `buildTelcSprechenRating`, `m10MaxPoints`,
`criterionMax` and `criterionPercent`. No caller may default it to `'B1'` —
an unknown level is a programming error, not a fallback.

---

## Testing strategy

Jest. Unit tests beside the code, e2e under `test/`, integration under its own
config. Four suites green before merge.

### The non-regression net, built first

**Golden master.** Before any change, snapshot every skill endpoint's response
for Modelltests 1–6 into `test/golden/`. Every later task must keep those
byte-identical. Verified working by making a one-character change to a
B1-facing mapper and confirming the suite goes red.

**Generator fidelity.** Re-run `scripts/generate-modelltest-seed.mjs` for MT
3–6 and diff its output against the committed migration SQL. Byte-identical.
This proves the B1 importer was not touched.

### Equality tests

Every change that replaces a constant with data carries a test asserting the
new path produces B1's old value. The old constant lives in the test file as
the expected value, never in the production path.

```ts
it('B1 behaviour is unchanged by the B2 work', async () => {
  expect(tableFor('B1', 1)).toEqual(M10_TEIL1_LEGACY);
  expect(tableFor('B1', 2)).toEqual(M10_TEIL23_LEGACY);
  expect(capTaskFulfilment('A', 2, 4)).toBe('C');   // B1, unchanged
  expect(capTaskFulfilment('A', 2, 3)).toBe('B');   // B2
});
```

### Coverage expectations

Every B2-specific branch is covered: the M10_B2 table at all four letters, the
`part 0` rejection, the two-task Schreiben read, the level filter on the exam
picker, the session level derivation, and the unscored-section activity guard.

### Bruno

`bruno/B2 Level/`, 14 numbered requests, matching the existing convention.
Run against local before the PR opens. Full list in the block doc.

---

## Boundaries

### Always

- Branch from `dev`. One PR. Direct pushes to `dev` are rejected.
- Export `.env.test` before any migration, and refuse `ep-wandering-hall`.
- Four suites green before merge: unit, e2e, integration, build.
- Keep the golden master byte-identical for Modelltests 1–6.
- Carry an equality test with every constant-to-data change.
- Strip answer keys from exercise `GET` responses, as the B1 readers do.
- Commit the gitignored plan file with `git add -f`.

### Ask first

- **Checkpoint A** — the thirteen seeded values, confirmed against the booklet
  before anything reads them. Wrong here is wrong for every B2 candidate
  permanently.
- **Checkpoint B** — the generated content migration SQL and its verify output,
  before it becomes a committed migration.
- Any change to a B1 content table beyond task 9's widening.
- Any new dependency, or any change to the public DTO shape of an existing
  field.
- Anything that would alter a B1 student's experience.

### Never

- A bare `prisma migrate`.
- Migrate or alter B1's 18 content tables (task 9's `writing_exercises`
  widening is the single exception, and it preserves existing rows).
- Change `scripts/generate-modelltest-seed.mjs` — the v2 importer is a new
  file.
- Default an unknown `CefrLevel` to `'B1'`.
- Import transcripts under `b2-modelltest-1-v1`.
- Score the B2 Sprechen intro.
- Reuse B2's point configuration for another level, or vice versa.

---

## The importer contract

So that Modelltest 8, 9 and 10 cost one JSON file each and no code:

1. **Content revisions are derived** from `(level, paper number, skill, teil)`.
   `listening_exercises.content_revision` and
   `speaking_exercises.content_revision` are **globally unique**; a fallback
   that omits the level will collide.
2. **`level` and `number` come from the JSON**, never from a filename or a
   constant in the importer.
3. **No inheritance of the B1 generator's one-off repair block**
   (`DELETE ... WHERE m.number = 1`), which exists for a historic incident.
4. **Seed migrations stay idempotent** — `ON CONFLICT (number) DO UPDATE`,
   re-runnable without duplicating.
5. **The verify script takes level and number as arguments.**

---

## Success criteria

### Student, on a B2 seat

- [ ] A center sets a code to `B2`; redeeming it sets `student.level = 'B2'`
- [ ] The catalogue returns **only** MT 7; a B1 student still sees 1–6
- [ ] `of-the-week` resolves to MT 7
- [ ] A B1 student calling MT 7 gets `403 LEVEL_MISMATCH`
- [ ] Lesen (3 Teile), Sprachbausteine (2), Hören (3) all return B2 content
- [ ] Hören audio plays from `cdn.lerniqo.tech` and the play allowance is metered
- [ ] Schreiben returns **both** Aufgaben with a shared `choice_group_id`
- [ ] Sprechen returns **4** items; the intro is marked unscored
- [ ] A Sprechen evaluation on B2 Teil 1 scores out of **25** against `M10_B2`
- [ ] The intro can never be scored
- [ ] The weekly vocab pack is **not empty**
- [ ] A Live Room opens at B2
- [ ] History and readiness show B2 attempts correctly

### Center, running a B2 Exam Day

- [ ] The exam picker lists MT 7 **with its level**
- [ ] A session created from MT 7 reports `level: "B2"`
- [ ] The sitting times Hören at **20 minutes**
- [ ] Objective sections auto-mark against B2 weights
- [ ] The Schreiben marking screen shows **which Aufgabe** was answered
- [ ] Grading inputs are identical to B1 — one oral mark out of 75
- [ ] The verdict applies written ≥135 and oral ≥45

### Non-regression

- [ ] Modelltests 1–6 snapshots byte-identical to the golden master
- [ ] `generate-modelltest-seed.mjs` output for MT 3–6 unchanged
- [ ] Every equality test green
- [ ] Four suites green

### The real finish line

- [ ] **Importing a second B2 paper costs one JSON file, one audio upload and
      one vocab run — no code.** If it needs code, the importer is not done.

---

## Open questions

1. **Which Aufgabe identifier does the exam store?** `writing_attempts.exercise_id`
   is a free string holding `exam-<modelltestId>` today. Proposal: store the
   chosen task's `content_revision`, which is already unique and meaningful to
   a trainer. Needs confirming during `/plan`.
2. **B2 grammar tagging.** `grammar_topics.cefr_levels` is stored but never
   filtered, so a B2 student sees B1 grammar. Product call, not a blocker.
3. **Guest demo scope.** `GUEST_ALLOWED_MODELLTEST_NUMBERS` is `{1, 2}`, so
   guests never see B2. Assumed deliberate.
