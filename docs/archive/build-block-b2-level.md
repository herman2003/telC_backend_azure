# Build block — B2 level

**Written:** 2026-10-20
**Branch:** `feat/b2-level` off `dev`. One PR.
**Reference:** `docs/architecture/multi-level.md` (the four structures, storage
decision, per-feature audit). This file is where the B2 work is tracked.

## Intent

**B2 behaves exactly as B1 does, with B2 content.** Nothing about the product
changes; a second level appears. Training, Exam Day, the weekly Modelltest,
history, readiness and the center dashboard all work for a B2 seat the way they
work for a B1 seat today.

Scope is B2 only. A1 and A2 come later and are out of this block.

---

## Settled before building

| | |
|---|---|
| **Identity** | the B2 paper is Modelltest **7**, `level: 'B2'`. `number` stays globally unique, so no service, URL or client changes |
| **Storage** | B2 uses the existing B1 content tables. Its Aufgabenarten are B1's, verified section by section |
| **Sprechen weight row** | **one row, teil 1, 75 points**, exactly as B1 stores it — not three rows of 25. Otherwise the grading screen needs three oral inputs for B2 and one for B1, which is dashboard work for nothing. telc marks the oral as one conversation against M10 criteria |
| **Points** | identical to B1 — Lesen 75, Sprachbausteine 30, Hören 75, Schreiben 45, Sprechen 75 = 300 (225 written + 75 oral) |
| **Pass rule** | written ≥135 **and** oral ≥45. `PASS_RATIO 0.6` is already applied per half, so **no `exam_pass_rules` table is needed for B2** |
| **Only duration that differs** | Hören **20** minutes, against B1's 30 |
| **Transcripts** | nulled for `b2-modelltest-1-v1`; added later as a new revision. Unverified cut positions must not ship under an immutable revision |

### Explicitly out of this block

| | Why |
|---|---|
| Grade bands (sehr gut / gut / befriedigend / ausreichend) | nothing implements them today, and B1 has the same bands. One feature for both levels, not a B2 task |
| `exam_pass_rules` table | B2's rule is identical to B1's |
| `block` column on `exam_section_weights`, `LESEN_SCHREIBEN` | A-family only |
| Decimal exam points | Lesen T3 and Hören T2 are 2.5/answer and Sprachbausteine 1.5, but `exam_section_results.points` is an `Int`. **B1 has identical counts and totals**, so this is pre-existing shared behaviour, not a B2 regression. Changing it is a change for both levels |
| AI-vs-human agreement measurement | real, worth doing, not this block |

---

## Exam Day — what this block changes

Exam Day is the paid product, so it gets its own section rather than being
assumed.

| Step | B2 behaviour | Work |
|---|---|---|
| Modelltest picker (`GET /centers/me/exam-modelltests`) | MT 7 **passes all twelve completeness checks** in `COMPLETE_EXAM_MODELLTEST_WHERE` | add `level` to `ExamModelltestDto` and filter — a manager currently picks a CEFR level blind (**task 3**) |
| Manager content preview (`getContent`) | assembles from the five skill services, which read the existing tables | none |
| Session create | today stamped `'B1'` whatever paper is chosen | level from `modelltest.level` (**task 3**) |
| Sitting / block timings | `scheduleFor('B2')` needs rows or `404 EXAM_TIMINGS_MISSING` | seed 90 / **20** / 30 (**task 2**) |
| Auto-marking Lesen / SB / Hören | `weightsFor('B2')` needs rows | seed ten rows (**task 2**) |
| Audio in the exam | no pause, no replay — `exam_plays_allowed = 1` + `exam_audio_plays` | none, already correct |
| **Schreiben marking** | the manager reads the text but **not which of Aufgabe A or B it answers** | record the chosen task (**task 8**) |
| Grading inputs / per-Teil ceilings | identical to B1, one oral mark of 75 | none — a consequence of the Sprechen row decision |
| Verdict, results, export, released result | identical to B1 | none |

**Exam Day done when** a manager creates a sitting from MT 7, it reports
`level: "B2"`, the candidate's Hören block is 20 minutes, the objective
sections auto-mark against B2 weights, the trainer sees which Aufgabe the
candidate answered, and the verdict applies 135/45.

---

## The weekly Modelltest — what this block changes

**No code.** The rotation pool is already scoped to the student's level
(`training-modelltest-access.service.ts`), so a B2 seat resolves
`of-the-week` to MT 7 and a B1 seat is unaffected. It is listed here because
"no code" is a claim that needs testing, not an omission.

| | |
|---|---|
| Catalogue | a B2 student sees MT 7 only; B1 students still see 1–6 |
| `of-the-week` | resolves to MT 7. With a pool of one it does not rotate — expected, and it resolves itself as more B2 papers land |
| Start training on the weekly MT | Lesen, Sprachbausteine, Hören, Sprechen all work from the existing tables |
| Prep Pass | widens the pool to all B2 papers — one, for now |
| **Vocab of the week** | reads `vocab_occurrences` for the weekly paper. **MT 7 has none, so the pack is empty and nothing errors.** Needs the extraction run (**task 12**) |
| Grammar | not level-filtered; a B2 student sees the same grammar as B1. Product call, not a task |

**Weekly MT done when** a B2 seat gets MT 7 from `of-the-week`, can train all
four skills on it, and its vocab pack is not empty.

---

## The tasks

| | Task | Why here |
|---|---|---|
| 1 | Golden-master snapshot of MT 1–6, every skill endpoint | nothing after this is *provably* safe to B1 without it |
| 2 | Seed migrations — `exam_block_durations` (90/20/30) + `exam_section_weights` (ten rows) | additive rows; cannot affect B1 |
| 3 | `EXAM_LEVEL` → `modelltest.level`; `level` on `ExamModelltestDto` + filter | B2 sittings become honest |
| 4 | `M10_B2` criterion table, `level` threaded through `speaking-telc-rating.ts` | the one real scoring difference |
| 5 | `capTaskFulfilment` derives its cap from `requiredPoints` | B2's task has 3 Leitpunkte, not 4; otherwise every B2 letter is under-marked |
| 6 | Sprechen evaluation prompt keyed on `(level, teil)`; `part 0` guarded | a B2 student on Teil 1 is currently graded as B1 Teil 1, out of 15 instead of 25 |
| 7 | `SpeakingLevel` literal → `CefrLevel` enum; `level` on Live Room topics | a B2 student gets a **400** on a Start feature sold as *illimité* |
| 8 | Exam Schreiben records which Aufgabe was answered | trainer marks blind otherwise |
| 9 | `writing_exercises` → `@@unique([modelltest_id, part])` + `choice_group_id`; service returns both tasks | the only schema change in this block |
| 10 | v2 importer, as a second script — the B1 generator stays untouched | **must make MT 8 cost zero code** |
| 11 | Import the B2 paper as MT 7 | the content |
| 12 | Vocab occurrence extraction for MT 7 | otherwise the weekly pack is silently empty |
| 13 | Activity-writer guard: never write an activity for an unscored section | `teil < 1` is rejected; B2's intro is `part 0` |

### The M10 B2 table (task 4)

| | Criteria 1–3 | Criterion 4 (Aussprache) | Max/part |
|---|---|---|---|
| B1 Teil 1 | A4 B3 C1 D0 | A3 B2 C1 D0 | 15 |
| B1 Teil 2/3 | A8 B6 C2 D0 | A6 B4 C2 D0 | 30 |
| **B2, all parts** | **A7 B5 C3 D0** | **A4 B2 C1 D0** | **25** |

C is 1 or 2 at B1 and **3** at B2, so this cannot be approximated by scaling.
`tableForTeil(teil)` becomes `tableFor(level, teil)`.

Schreiben needs no equivalent: `writing-telc-rating.ts` already implements
B2's rubric exactly — three criteria, A/B/C/D → 5/3/1/0, ×3 → 45.

### Importer rules (task 10)

So that MT 8, 9, 10 cost one JSON file each and no code:

1. Content revisions derived from `(level, paper number, skill, teil)` — never
   a fallback that omits the level. `listening_exercises.content_revision` and
   `speaking_exercises.content_revision` are **globally unique**.
2. `level` and `number` come from the JSON, never a filename or a constant.
3. Do **not** inherit the B1 generator's one-off repair block
   (`DELETE ... WHERE m.number = 1`).
4. Seed migrations stay idempotent — `ON CONFLICT (number) DO UPDATE`.
5. The verify script takes level and number as arguments.

---

## Skills, in order

| | Skill | Produces |
|---|---|---|
| 1 | `/spec` | `docs/archive/spec-b2-level.md` — one spec for the whole block, because the pieces are interdependent |
| 2 | `/plan` | `tasks/phases/<n>-b2-level-intent.md` (gitignored — `git add -f`) |
| 3 | `/build` | tasks 1–13, one at a time, TDD |
| 4 | `/review` | five axes over the whole diff, attention on the exam path |
| 5 | Bruno | `bruno/B2 Level/` collection |

### 🛑 Checkpoints

| | When | What the human decides |
|---|---|---|
| 1 | after `/spec` | the Sprechen-one-row decision and the out-of-scope list |
| 2 | after `/plan` | the task ordering |
| **A** | **after task 2, before anything reads the rows** | **the thirteen seeded values against the booklet.** Wrong here is wrong for every B2 candidate forever |
| **B** | **before task 11** | **the generated migration SQL and verify output**, applied against `.env.test` only |
| 3 | after `/review` | which findings get fixed before the PR |
| 4 | after Bruno | the collection run against local |

Tasks 3–8 each carry an equality test asserting B1's behaviour is unchanged,
with the old constant kept in the test as the expected value.

---

## Bruno collection

`bruno/B2 Level/`, matching the existing numbered convention.

```
01 Set code level B2.bru
02 Redeem code → student.level B2.bru
03 Catalogue returns only MT 7.bru
04 Of-the-week resolves to MT 7.bru
05 B1 student on MT 7 → 403 LEVEL_MISMATCH.bru
06 Lesen / SB / Hören on MT 7.bru
07 Schreiben returns both Aufgaben.bru
08 Sprechen teils returns 4 items.bru
09 Vocab of the week is not empty.bru
10 Live Room opens at B2.bru
11 Exam picker shows level.bru
12 Create B2 sitting → level B2.bru
13 Sitting schedule → Hören 20 minutes.bru
14 Exam Schreiben shows the chosen Aufgabe.bru
```

---

## Standing rules

- Branch from `dev`, never `main`. Direct pushes to `dev` are rejected — PR required.
- Never a bare `prisma migrate` — `.env` is production. Export `.env.test` and
  refuse `ep-wandering-hall`.
- All four suites green before merge: unit, e2e, integration, build.
- Plan file is gitignored; commit with `git add -f`.
- B1's content tables are not migrated. The only alteration is task 9's
  widening of `writing_exercises`.
- Content is immutable by `content_revision`; a correction is a new revision.

---

## Done when

A center sets a code to B2, a student redeems it, and that student has the
whole Start experience on MT 7 — catalogue, weekly Modelltest, all four
training skills, a non-empty vocab pack, Live Room, Sprechen with B2 scoring,
Schreiben with its A/B choice, history and readiness. A manager runs a B2 Exam
Day sitting that times Hören at 20 minutes, auto-marks against B2 weights,
shows which Aufgabe was answered, and applies 135/45.

And MT 1–6 snapshots are byte-identical to what task 1 captured.

### The real finish line

**Importing a second B2 paper costs one JSON file, one audio upload and one
vocab run — no code.** If MT 8 needs a code change, task 10 was not finished.

---

## Open before `/spec`

1. **MT number 7** — confirm.
2. **Transcripts nulled** for `v1` — confirm.
3. **60 B2 Live Room topics** — content you produce; task 7 ships the code that
   needs them, and without them a B2 room opens with no topic.
