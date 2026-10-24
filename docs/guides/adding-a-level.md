# Adding a CEFR level

**Written:** 2026-10-21, straight after B2 landed (phase 26).
**For:** whoever adds A1 or A2.
**Companion:** `docs/architecture/multi-level.md` holds the four exam
structures and the storage decision. This file is the procedure and the list
of things that actually went wrong.

Read the traps first. Every one of them cost real time on B2, and most are
invisible until you hit them.

---

## 0. Decide where the content lives

> **A level uses the existing B1 tables if every Aufgabenart it needs already
> has one. Otherwise it uses the generic model.**

| Level | Storage | Why |
|---|---|---|
| B1 | existing tables | it *is* those tables |
| B2 | existing tables | same Aufgabenarten as B1 — this is why B2 was cheap |
| **A2** | **generic model** | needs `KURZANTWORT`, `FORMULAR_AUSFUELLEN` |
| **A1** | **generic model** | needs `FORMULAR_AUSFUELLEN` |

**A1 and A2 are not B2.** B2 reused B1's tables and cost one schema change.
The A-family cannot: `FORMULAR_AUSFUELLEN` and `KURZANTWORT` have no table and
no analogue anywhere in the schema, A1/A2 have no Sprachbausteine, their exam
is 60 points rather than 300, and **every one of their Hören and Lesen Teile
uses a different Aufgabenart from its A-sibling**. Do not plan A1/A2 as a
repeat of B2.

---

## 1. What costs once per level, and what costs per paper

This is the distinction that tells you what you are buying with the first
paper of a new level.

| | When |
|---|---|
| `exam_block_durations` rows | once per level |
| `exam_section_weights` rows | once per level |
| `exam_pass_rules` row (A-family only, see trap 9) | once per level |
| Live Room topics | **once per level** — they are per level, not per paper |
| M10 speaking criterion table | once per level |
| Importer support for the level's Aufgabenarten | once per level |
| | |
| Source JSON | per paper |
| Audio uploaded to R2 | per paper |
| Generated seed migration | per paper |
| Vocab extraction + curation | per paper |

**The finish line for any level:** importing its *second* paper costs one JSON
file, one audio upload and one vocab run. No code. If it needs code, the
importer is not finished.

---

## 2. The traps

Ordered by how much time each cost on B2.

### Trap 1 — the schema has constraints Prisma does not show you

The single most expensive discovery. `speaking_exercises.part` is checked
`BETWEEN 1 AND 3` by a constraint added in hand-written SQL in the baseline.
`schema.prisma` shows a bare `part Int`. I asserted twice that B2's unscored
`part: 0` intro needed no migration. It did.

**Before importing anything, list them:**

```sql
SELECT rel.relname AS tbl, con.conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
 WHERE con.contype = 'c'
 ORDER BY rel.relname;
```

What that turned up, all invisible in the Prisma models:

| Constraint | Bites when |
|---|---|
| `speaking_exercises.part BETWEEN 1 AND 3` | an unscored intro is part 0 → widened to 0..3 |
| `listening_questions.correct_answer IN ('+','-')` | the source spells out RICHTIG/FALSCH |
| `listening_exercises.part BETWEEN 1 AND 3` | a level with four Hören Teile |
| `duration_minutes > 0` on listening and speaking | a part with no stated duration |
| `exam_plays_allowed >= 1` | a source that says 0 plays |
| `speaking_exercises.topic_points` must be a JSON array | emitting an object or null |
| `lesen_teil3_situations`: `noMatch` true ⟺ `correctAnnouncementId` NULL | a no-match option |

### Trap 2 — NOT NULL columns the source leaves empty

`lesen_teil3_announcements.title` is NOT NULL, and three of telc's twelve B2
announcements are untitled press snippets. The convention in this schema is an
empty string for a field that does not apply (see `VocabEntry.article`), not a
schema change.

Check every NOT NULL text column against the source before importing.

### Trap 3 — answer notation

`correct_answer` accepts `'+'` and `'-'` only, which is telc's own notation.
Source files spell the words out. Map them, and **throw on anything
unrecognised** — a spelling that silently became `'-'` marks correct work
wrong with nothing in the data to explain it.

### Trap 4 — the importer can destroy another level's paper

`modelltests.number` is unique across all levels and nothing says which level
owns which number. The upsert is `ON CONFLICT (number) DO UPDATE`, including
`level`, so a mistyped `--number` rewrites another paper's title and level and
then replaces its content through the scoped deletes. One wrong digit, one
transaction, no warning.

The importer now raises if the number belongs to another level. **Keep that
guard.** Verify it by generating a seed aimed at an existing paper of another
level and running it: it must refuse, and every Modelltest must be intact
afterwards.

### Trap 5 — stale parts survive a re-import

Parent rows are upserted by `(modelltest_id, part)` and child rows are deleted
by parent, so a corrected paper with fewer parts leaves the extra ones behind.
A phantom Schreiben task is worse than cosmetic: the exam resolves a
submission by task id, so a candidate can answer a task the paper no longer
contains.

The importer deletes parts not in the imported set. Note `listening_attempts`
is `ON DELETE RESTRICT`, so dropping a Hören part somebody has attempted fails
loudly rather than discarding their work — that is the right outcome.

### Trap 6 — content revisions must name their level

`listening_exercises.content_revision` and `speaking_exercises.content_revision`
are **globally unique**. Derive every revision from
`(level, paper number, skill, teil)`; a fallback that omits either collides the
moment a second level or paper exists. Where the file carries a revision, check
it against the derived value rather than trusting it.

Prove it: import two papers of the level and confirm zero shared revisions.

### Trap 7 — the content scripts used to default to production

Fixed, but know why. Fourteen `grammar:*`/`vocab:*` npm scripts ran
`-r dotenv/config`, which loads `.env` — production — before the script body's
own `.env.test` call, and `dotenv` never overwrites. They now preload
`scripts/env-test-first.cjs`, which loads `.env.test` first and refuses the
production host unless `LERNIQO_ALLOW_PRODUCTION=1`.

The same bug had three instances in one phase: those scripts, the e2e setup,
and this pattern generally. **The guard always existed; the load order
defeated it.** If you add a script that touches content, use the preload.

### Trap 8 — vocab is not in a migration

`vocab_occurrences` come from running two scripts per environment:

```
npm run vocab:analyze-extract -- --mt=<number>
npm run vocab:curate-weekly-pack -- --mt=<number>
```

Skip them and the student's weekly pack reads **empty with no error**. Deploy
is not done when the migration is applied.

Related: the extractor reads Hören vocabulary from **transcripts**. MT 7's are
deliberately null, so its pack has no listening vocabulary. If you withhold
transcripts, know that you are also withholding that.

### Trap 9 — rules that are still constants, and break for A1/A2

B2 escaped these because its grid is identical to B1's. **A1 and A2 will not.**

| Where | What breaks |
|---|---|
| `progress-formula.ts:24` | `SKILL_MAX_POINTS`, `WRITTEN_MAX = 225`, `TOTAL_MAX = 300` hard-coded, including `SPRACHBAUSTEINE: 30` — a skill A1/A2 do not have. Unpractised skills count zero, so **an A1 student can never be marked ready**. Read `exam_section_weights` instead |
| `exam-result.service.ts:6` | `PASS_RATIO 0.6` applied per half. Correct for B1/B2; A1/A2 use a single combined 60 %, so a candidate at 100 % written / 50 % oral passes under telc and is marked FAILED. Needs `exam_pass_rules` |
| `exam-scoring.service.ts:51` | `BLOCK_SECTIONS` hard-codes B1's block composition. A1/A2 put Lesen and Schreiben in one block |
| `enum ExamBlock` | has no `LESEN_SCHREIBEN` |
| `COMPLETE_EXAM_MODELLTEST_WHERE` | requires `some {}` on twelve B1 relations including `sprachbausteineExercises`. **An A1/A2 paper can never satisfy it**, so it never reaches the centre's exam picker |
| `TrainingAudioPlay.audio_id` | a non-nullable FK to `listening_exercises`. If A1/A2 Hören lives in the generic model there is no row to point at, so **audio play limits silently do not exist** for those students |

### Trap 10 — the level is not checked on exam admission

`eligible-students` filters on centre and name; `setParticipants` never
compares a student's level to the sitting's. The word `level` does not appear
in `exam-participants.service.ts`. A centre can admit a B1 student to a B2
sitting and they are marked against the wrong grid.

Pre-existing, newly reachable, logged as the first follow-up in
`docs/architecture/multi-level.md`. **Fix this before selling a third level**, or the
chance of a wrong admission only grows.

---

## 3. The procedure

### A. Rules first, no content

1. Seed `exam_block_durations` for the level.
2. Seed `exam_section_weights`. Mirror how B1 stores Sprechen — **one row for
   the whole oral**, not one per part — or the trainer's marking screen needs a
   different shape per level.
3. A-family only: `exam_pass_rules` (`TOTAL_PERCENT 60`), the `block` column on
   weights, and `LESEN_SCHREIBEN` on `ExamBlock`.
4. 🛑 **Have a human confirm every seeded value against the booklet** before
   anything reads them. Wrong here is wrong for every candidate of that level,
   permanently, and nothing will fail.

### B. Code, still no content

5. Add the level's M10 speaking table. Thread `level` as a **required**
   argument — never an optional with a B1 default, which is exactly how a
   candidate gets marked against the wrong grid.
6. Key both AI rating prompts on the level, including the criterion banding.
   Points conversion being right is not enough: telling the model it is rating
   B1 anchors it to B1's standard.
7. A-family only: fix trap 9's constants.
8. Every change that replaces a constant with a row carries a test asserting
   the row-derived value **equals the old constant for B1**, with the constant
   kept in the test file rather than the production path.

### C. Content

9. Source JSON per the v2 contract, level and paper number inside the file.
10. Generate the migration with `npm run modelltest:import -- <source> <out> --number <global>`.
11. 🛑 **Human reads the generated SQL** before it becomes a committed
    migration: every DELETE scoped, no reference to another paper, the level
    guard present.
12. Apply against `.env.test` only. Never a bare `prisma migrate`.
13. `npm run modelltest:verify -- --level <L> --number <N>`.
14. Run the vocab extraction and curation (trap 8).
15. Write the level's Live Room topics. Until they exist a room is refused with
    `NO_TOPICS_FOR_LEVEL` — correct, but not a working feature.

### D. Prove it

16. Golden master byte-identical for every existing paper.
17. All four suites: unit, integration, e2e, build. **Check the build by exit
    code** — a grep for `error TS` never matches, because the output carries
    ANSI escapes between those two words. That check silently passed over 57
    errors on this branch.
18. Boot the app. A clean compile does not prove Nest can wire it.
19. Copy `bruno/B2 Level/` and adapt. Run it against a live server.
20. Import a **second** paper of the level and confirm it took no code.

---

## 4. The level is not sellable until all of this is true

| | Check |
|---|---|
| 1 | `exam_block_durations` rows exist |
| 2 | `exam_section_weights` rows exist and sum to the level's total |
| 3 | pass rule correct for the family (part-wise for B, combined for A) |
| 4 | a paper imported and verified against the source |
| 5 | all five skill endpoints return a DTO |
| 6 | catalogue and `of-the-week` resolve; another level's student is refused |
| 7 | the centre's exam picker lists it, and a sitting times and marks by its rows |
| 8 | **readiness returns a number, and a perfect student reaches `ready`** |
| 9 | **Live Room opens, and training audio metering writes a play row** |
| 10 | the weekly vocab pack is not empty |

8, 9 and 10 are the ones that **fail silently**. Everything else errors
visibly. They are on this list for that reason.

---

## 5. What B2 actually cost, for estimating

| | |
|---|---|
| Tasks planned | 13 |
| Commits | 27 |
| Schema changes | 2 (a widened unique, a widened check constraint) |
| New tables | 0 |
| Pre-existing bugs found | 6, four of them affecting B1 |
| Faults found in the tests rather than the code, during the Bruno run | 6 |

B2 was the cheap level because it reuses B1's tables. **Budget A1 and A2
higher**: they need the generic content model, trap 9's constants fixed, and
their Aufgabenarten have no storage at all today.
