# Implementation Plan: Multi-level Phase 3 — the generic model and A2

**Status:** archived — implemented. All 8 tasks (0-7) merged to `dev`.
Current state is documented in `docs/architecture/multi-level.md` Part 7
("Phase 3"), not here — this file is history, not a to-do list. Task 7's
scope turned out wider than its own description below ("Schreiben routed by
`aufgabentyp`"); see the architecture doc's Break 10 for what actually
shipped, and Break 13's "open gap" note for what Phase 3 did not cover
(`ExamBlockContentService` still has no generic-model branch).
**Parent design:** `docs/architecture/multi-level.md`, Part 7 Phase 3.
**Depends on:** Phase 1 (merged to `dev`, commit `dfa140a`) — `exam_pass_rules`,
`exam_section_weights.block`, `LESEN_SCHREIBEN` all exist and are seeded.
**Safety net:** `test/golden/modelltest-golden-integration.spec.ts` and
`test/golden/generator-fidelity.spec.ts` must stay green through every task.

## Overview

Phase 3 is much bigger than Phase 1 — it adds a whole new storage model, not
just data tables for an existing one. Verified against the current code
(not assumed from the doc, which was stale for Phase 1) before writing this:

**Not started, exactly as the doc describes:**
- Break 5 — `progress-formula.ts:24-41` hardcodes `SKILL_MAX_POINTS`,
  `WRITTEN_MAX`, `TOTAL_MAX`. The doc says this **must land before any
  A-level content** ships, or an A-level student can never reach "ready".
- Break 8 — `TrainingAudioPlay.audio_id` (`schema.prisma:1045-1057`) is a
  non-nullable FK to `listening_exercises`, `onDelete: Cascade`. A2 Hören
  has no `listening_exercises` row to point at.
- Break 11 — `exam-modelltests.service.ts:27-42`'s
  `COMPLETE_EXAM_MODELLTEST_WHERE` is one flat `AND` of 12 B1-specific
  `some {}` checks, no level discrimination.
- Break 13 — `modelltests.service.ts:149-161` unconditionally calls the 5
  B1 skill services; `.level` is used for catalogue filtering elsewhere in
  that file, never to branch content assembly.
- No `Aufgabentyp` enum, `ExamSection`, `ExamItem`, or `ExamItemOption`
  exist anywhere in the schema. No Zod dependency, no content-import
  validation anywhere.

**Partially done (Phase 1 touched this, didn't finish it):**
- Break 10 — `exam-scoring.service.ts`'s block composition already reads
  `exam_section_weights` (Phase 1 Task 4). `scoreSection()` still
  unconditionally routes `skill === 'SCHREIBEN'` to grading — nothing
  branches on `aufgabentyp`, because the concept doesn't exist in code yet.

**Already fine, not a break (the doc's own Part 6 says so — don't re-flag):**
- Break 9 — `ListeningAttempt.listening_exercise_id` is already nullable
  (`schema.prisma:692-693`), `onDelete: Restrict`. The doc already proposes
  "accept null deliberately" for generic-model levels. Nothing to fix; just
  needs confirming when A2 Hören attempts start writing rows.

**Two existing importers, neither usable for A2 content:**
- `scripts/generate-modelltest-seed.mjs` — the original B1 generator,
  byte-tested against committed MT3-6 migrations
  (`test/golden/generator-fidelity.spec.ts`). Never touch it.
- `scripts/import-modelltest-v2.mjs` — the importer actually used for B2
  (MT7+). Reads a `--number <globalNumber>` flag separate from the paper's
  own per-level number, derives `content_revision` from
  `(level, paper, skill, teil)` and *checks* rather than trusts a
  file-supplied revision, idempotent `ON CONFLICT` inserts, deliberately no
  repair block. Writes to the **same 18 B1-shared tables** — not usable for
  A2, which needs `KURZANTWORT`/`FORMULAR_AUSFUELLEN` with no table there.
  Good conventions to mirror in a new importer; wrong target tables.

## Resolved — contract shape

`docs/ideas/modelltest-content-contract.md`'s `sections: {HOEREN:[],...}`
tree is authoritative, **with the corrections below folded in**. Its
`Status` line is updated from "Proposal only" to reflect this. The
`docs/architecture/multi-level.md` Part 3 `ExamSection.material` design is
superseded for the written description of what goes in `material` — the
table schema (`ExamSection`/`ExamItem`/`ExamItemOption`, `material: Json`)
stays, but `material`'s *shape* per `aufgabentyp` follows the content-
contract doc's `content` shapes, not Part 3's sketch.

These corrections surfaced from a review of the extraction prompt against
the actual telc A2 PDF, and apply to the contract doc, the extraction
prompt, and — critically — **the schema itself**, since one of them is a
pre-existing bug, not an A2-only gap:

1. **telc uses fractional points — 0.5 and 1.5 — in every Bewertungsbogen
   M10 (Sprechen) and the Schreiben rubric, at every level, not just A2.**
   B1 Sprechen Teil 1 (`Vorstellen` 1/0.5/0 + `Zusatzfragen` 2/1/0) can sum
   to 1.5 or 2.5. **`exam_section_results.points` is `Int`
   (`schema.prisma:1598`) and `exam-grading.service.ts:50` rejects any
   non-integer mark today** — this is a live bug affecting B1/B2 marking
   right now, not something Phase 3 introduces. See Task 0, below.
2. `Schreiben Teil 2` and all `Sprechen` sections must not carry
   `scoring.mode: "AUTO"` — they're `MANUAL` or
   `MANUAL_WITH_AI_SUGGESTION`. The common-fields template in the content
   contract doc defaults to `AUTO`; every section's actual mode must be set
   explicitly, never inherited from a template default.
3. Hören is **one continuous official recording** during Exam Day, not
   separate per-Teil clips — cannot be paused, sought, or restarted; one
   play. Teil 1 and Teil 3's "heard twice" is already inside the single
   recording, not a user-controlled repeat. Per-Teil clips may exist later
   for Training, but are not the Exam Day contract.
4. Grade bands (`SEHR_GUT` 54-60 … `TEILGENOMMEN` 0-35.5) belong in
   `format`, not left implicit.
5. Visual/image assets need an explicit asset-record shape per task-
   relevant page (directory pages, ad cards, forms, prompt sheets, per-
   participant Sprechen cards) — not folded into section `content` as a
   bare `imageUrl`.
6. `modelltest.number` is the paper's **own** per-level number (A2
   Übungstest 1 → `number: 1`), never the global catalogue number. Mapping
   to the global number (`8`, or whatever it ends up being) is the
   importer's job — exactly the split `scripts/import-modelltest-v2.mjs`
   already uses (`--number <globalNumber>` as a separate CLI argument from
   the file's own `modelltest.number`). The extraction prompt must not
   hardcode a global number.
7. The extraction prompt's rule 7 (schema file reference) is replaced:
   preserve every fractional score exactly, 0.5/1.5, never round or
   convert to an integer.

`docs/plans/active/a2-modelltest-1-extraction-prompt.md` is updated to
match (this commit).

## Resolved — Exam Day is in scope

You'll insert the A2 content yourself and want the exam-day-eligible paper
precisely identified — that only works if the existing `exam_only` /
completeness mechanism correctly recognizes generic-model content, which is
Task 6 below. Tasks 6-7 stay in this phase's scope, not deferred.

## Architecture decisions

- Follow Part 7 Principle 2 exactly, as in Phase 1: every B1/B2-affecting
  change ships with an equality test against the golden-master fixtures.
- `progress-formula.ts` stays pure (its own stated invariant: "nothing here
  reads the database"). The fix is to **parametrize** it with
  `(skillMaxPoints, writtenMax, oralMax, totalMax)` read by the caller
  (`progress.service.ts`) from `exam_section_weights`, not to give the
  formula module a Prisma dependency.
- The generic model (`exam_sections`/`exam_items`/`exam_item_options`) is
  additive only; B1/B2 never read it, confirmed by Task 4's branch living
  entirely in the DTO-assembly layer, never in a shared helper the old path
  also calls.

## Task list

### Task 0: `exam_section_results.points` supports telc's half-points

**Description:** Pre-existing bug, not A2-specific — fix it first,
independent of everything else in this phase. `points Int` and
`exam-grading.service.ts:50`'s `Number.isInteger` check make a legitimate
telc mark (e.g. B1 Sprechen Teil 1 = 1.5) unrepresentable today. Change the
column to `Decimal @db.Decimal(4,1)` (exact at 0.5 increments, no float
drift) and convert to a JS `number` at the one write site and the read
sites that need it — every DTO/interface in `exam-result.service.ts` is
already typed `number`, not `Int`, so this is a narrow, contained change.

**Acceptance criteria:**
- [ ] `exam_section_results.points` is `Decimal @db.Decimal(4,1)`
- [ ] `exam-grading.service.ts`'s validation accepts any non-negative
      multiple of `0.5` up to `max_points`, rejects anything else
      (`2.3`, negative, more than one decimal place)
- [ ] Existing whole-number marks round-trip unchanged (equality test:
      every B1/B2 fixture in `exam-result.service.spec.ts` still passes
      with integer marks exactly as before)
- [ ] A new test: a `1.5` mark is accepted, stored, read back as `1.5`,
      and contributes correctly to `written`/`oral`/combined totals and
      the pass verdict

**Verification:**
- [ ] Migration applies cleanly against `.env.test`
- [ ] `npx jest src/modules/centers` / `test/exam-grading*`,
      `test/exam-result*` — exit code 0
- [ ] `npm run test:integration` (golden suite) — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** None.

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_exam_section_results_half_points/migration.sql`
- `src/modules/centers/exam-grading.service.ts`
- its test file
- `src/modules/centers/exam-result.service.ts` (only if the `Decimal` ->
  `number` conversion needs to happen on read here rather than at the ORM
  boundary — check Prisma's `Decimal` return type before assuming)

**Estimated scope:** S — one column, one validation rule, narrow blast
radius already confirmed by grep (only 2 files touch `points` as `Int`
beyond this one).

---

### Task 1: `progress-formula` reads weights instead of constants

**Description:** `progress.service.ts` fetches the student's level's
`exam_section_weights` rows and derives `skillMaxPoints`/`writtenMax`/
`oralMax`/`totalMax` from them, passing the result into the (still pure)
functions in `progress-formula.ts` as parameters instead of those functions
reading the module-level constants directly. **Blocking: must land before
any A-level content exists**, or an A2 student can never be marked ready.

**Acceptance criteria:**
- [ ] `progress-formula.ts`'s readiness functions take weights as a
      parameter; the hardcoded `SKILL_MAX_POINTS`/`WRITTEN_MAX`/
      `ORAL_MAX`/`TOTAL_MAX` constants are deleted (or kept only as the
      equality test's expected value, not in the production path)
- [ ] `progress.service.ts` reads `exam_section_weights` for the student's
      level and builds the weights object
- [ ] Equality test: for B1, the row-derived weights equal today's deleted
      constants exactly (`LESEN: 75, SPRACHBAUSTEINE: 30, HOEREN: 75,
      SCHREIBEN: 45, SPRECHEN: 75`, `WRITTEN_MAX: 225`, `ORAL_MAX: 75`,
      `TOTAL_MAX: 300`)

**Verification:**
- [ ] `npx jest src/modules/progress` — exit code 0
- [ ] `npm run test:integration` (golden suite) — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** None — `exam_section_weights` already has B1/B2 rows from
before Phase 1.

**Files likely touched:**
- `src/modules/progress/progress-formula.ts`
- `src/modules/progress/progress-formula.spec.ts`
- `src/modules/progress/progress.service.ts`

**Estimated scope:** M — one pure module's signature changes, one caller
updates, tests for both.

---

### Task 2: Generic content schema (additive)

**Description:** Add `enum Aufgabentyp` (17 values, per Part 2 of the
architecture doc), `ExamSection`/`ExamItem`/`ExamItemOption` models (per
Part 3), and drop the FK on `TrainingAudioPlay.audio_id` (break 8) — plain
column, `ON DELETE` semantics removed, matching the precedent already set
by `ExamAudioPlay.audio_id` in the same schema.

**Blocked on the contract-shape open question above** — `material`'s
intended content (and therefore whether any columns beyond the ones Part 3
lists are needed) depends on which JSON contract is authoritative.

**Acceptance criteria:**
- [ ] `exam_sections`, `exam_items`, `exam_item_options` tables exist,
      matching Part 3's schema (or its approved revision, if the contract
      question changes it)
- [ ] `TrainingAudioPlay.audio_id` is a plain `@db.Uuid` column, no FK,
      `@@unique([student_id, audio_id])` preserved
- [ ] B1/B2 read paths are untouched — no existing table altered beyond
      the FK drop

**Verification:**
- [ ] Migration applies cleanly against `.env.test` via
      `scripts/apply-migration.mjs`
- [ ] `npm run test:integration` (golden suite) — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** The open contract question above.

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_generic_content_model/migration.sql`

**Estimated scope:** M — additive only, but touches 3 new tables + 1
constraint drop in one migration.

---

### Task 3: Zod validation + generic-model importer

**Description:** New importer script (mirrors
`import-modelltest-v2.mjs`'s conventions — idempotent `ON CONFLICT`
inserts, children deleted before parents, `content_revision` derived and
checked not trusted, no repair block, `--number` flag separate from the
paper's own number) that writes to `exam_sections`/`exam_items`/
`exam_item_options` instead of the 18 B1 tables. One Zod schema per
`aufgabentyp`, validated once at import time — never on read, per Part 3's
explicit rule ("never write a `WHERE` that reaches inside `material`").

**Acceptance criteria:**
- [ ] A Zod schema exists for each of the 8 written `aufgabentyp` values
      A2 needs (`EINZELAUSWAHL`, `RICHTIG_FALSCH`, `ZUORDNUNG`,
      `KURZANTWORT`, `FORMULAR_AUSFUELLEN`, `TEXT_SCHREIBEN`) plus the 3
      oral ones A2 uses (`SICH_VORSTELLEN`, `ALLTAGSGESPRAECH`,
      `ETWAS_AUSHANDELN`) — not all 17, just what A2 actually uses; the
      rest follow when B-family-style content needs the generic model, if
      ever
- [ ] A bad fixture (wrong shape for its declared `aufgabentyp`) fails the
      import loudly, before any SQL is written
- [ ] A valid synthetic fixture (not real A2 content yet) round-trips:
      import produces a migration, applying it produces rows matching the
      fixture

**Verification:**
- [ ] A new test (unit, no DB) asserts each Zod schema accepts its own
      valid fixture and rejects a mismatched one
- [ ] A new integration test applies a synthetic migration against
      `.env.test` and reads it back
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** Task 2.

**Files likely touched:**
- `scripts/import-generic-modelltest.mjs` (new)
- `package.json` (new `zod` dependency)
- a new test file

**Estimated scope:** L — this is the biggest single task in the phase;
consider splitting further (schema validation vs. SQL generation) if it
grows past ~2 hours of focused work.

---

### Task 4: DTO assembly branches on `modelltest.level` (break 13)

**Description:** `modelltests.service.ts`'s content-assembly path reads
the generic model for levels that have no B1-style tables, and the
existing 5 skill services otherwise. The DTO shape returned to clients
does not change — this is the one place the doc says a level branch is
allowed to live (Part 7 Principle 1's corollary).

**Acceptance criteria:**
- [ ] A new private helper (not a shared one the B1/B2 path also calls)
      reads `exam_sections`/`exam_items`/`exam_item_options` for a
      generic-model level and maps to the same DTO shape the B1/B2 path
      produces
- [ ] B1/B2 requests never execute the new helper — equality test: golden
      fixtures for MT1-6 still byte-identical
- [ ] A synthetic A2-shaped Modelltest (Task 3's fixture) round-trips
      through this endpoint and returns a well-formed DTO

**Verification:**
- [ ] `npm run test:integration` (golden suite) — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0
- [ ] `npm run build` — exit code 0

**Dependencies:** Tasks 2, 3.

**Files likely touched:**
- `src/modules/modelltests/modelltests.service.ts`
- its test file

---

## Checkpoint: after Tasks 1-4

- [ ] All 5 PR gates green (tsc, build, jest, integration, e2e)
- [ ] B1/B2 golden fixtures byte-identical
- [ ] A synthetic (non-real) A2-shaped Modelltest round-trips end to end:
      imported, readable via the content endpoint, contributes to
      readiness via Task 1's weight-reading path
- [ ] **Review with user** — decide here whether Tasks 6-7 (Exam Day) are
      in scope for this phase or a later one, now that Training-path
      plumbing is proven

---

### Task 5: A2 Modelltest 1 — real content

**Description:** Run Task 3's importer against the real A2 content (the
telc PDF you already have, via the extraction prompt in
`docs/plans/active/a2-modelltest-1-extraction-prompt.md` — contingent on
that prompt being updated to match whichever contract Task 3 settled on).
Apply the generated migration against `.env.test`.

**Acceptance criteria:**
- [ ] A2 Modelltest 1 imports cleanly, all 11 sections present
      (`HOEREN_1-3`, `LESEN_1-3`, `SCHREIBEN_1-2`, `SPRECHEN_1-3`)
- [ ] Points sum to 60 (15 Hören + 30 Lesen/Schreiben + 15 Sprechen)
- [ ] Every answer matches the PDF's own Lösungsschlüssel
- [ ] A real (not synthetic) A2 student can see the paper in the Training
      catalogue and is refused a B1/B2 paper (`403 LEVEL_MISMATCH` — this
      gate already exists per Phase-5's "already correct" table, just
      needs confirming it still fires for a real row)

**Verification:**
- [ ] Manual check against `.env.test` content, cross-referenced with the
      PDF's Lösungsschlüssel page by page
- [ ] `npm run test:integration` — exit code 0

**Dependencies:** Tasks 1-4, and the extraction prompt re-aligned to the
settled contract.

**Files likely touched:**
- `content/a2-modelltest-1-source.json` (new)
- `prisma/migrations/<timestamp>_seed_a2_modelltest1/migration.sql` (new)

---

### Task 6 (scope TBD — see open question above): exam completeness per-level (break 11)

**Description:** `COMPLETE_EXAM_MODELLTEST_WHERE` becomes a per-level
check: every section the level's `exam_section_weights` rows name must
have content, in whichever track holds it (B1-style tables or the generic
model).

**Acceptance criteria:**
- [ ] B1/B2 completeness check unchanged (equality test)
- [ ] A2 Modelltest 1 (Task 5) appears in a B2-selling centre's exam
      picker once A2 is sold as an Exam Day product — or is deliberately
      excluded if Training-only is the launch choice

**Dependencies:** Task 5, the Exam Day scope decision.

**Files likely touched:**
- `src/modules/centers/exam-modelltests.service.ts`

---

### Task 7 (scope TBD — see open question above): Schreiben routed by `aufgabentyp` (break 10 remainder)

**Description:** `exam-scoring.service.ts`'s `scoreSection()` routes to
auto-scoring or human/AI grading based on the section's `aufgabentyp`
(`FORMULAR_AUSFUELLEN` auto-scores; `TEXT_SCHREIBEN` goes to a person),
not on `skill === 'SCHREIBEN'` — because A2's Schreiben Teil 1 is
`FORMULAR_AUSFUELLEN` (auto-scorable) while Teil 2 is `TEXT_SCHREIBEN`
(human-marked), both under the `SCHREIBEN` skill.

**Acceptance criteria:**
- [ ] B1/B2 Schreiben routing unchanged (equality test — `SCHREIBEN` skill
      still always routes to human/AI grading for those levels, since
      their only Schreiben `aufgabentyp` is `TEXT_SCHREIBEN`)
- [ ] An A2-shaped `FORMULAR_AUSFUELLEN` section auto-scores like any other
      written Teil

**Dependencies:** Tasks 2-4, the Exam Day scope decision.

**Files likely touched:**
- `src/modules/centers/exam-scoring.service.ts`

---

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Contract-shape question left unresolved blocks Tasks 2-5 indefinitely | High | Surfaced explicitly above; nothing past Task 1 starts without an answer |
| Task 3 (importer) is sized L — real risk of scope creep mid-task | Medium | Flagged in its own estimate; split into schema-validation and SQL-generation sub-tasks if it grows |
| A2 content (Task 5) ships before Task 1 lands, repeating the exact bug the doc warns about | High | Task 1 is explicitly ordered first and is independent of everything else in this phase — no reason to defer it |
| Exam Day scope (Tasks 6-7) gets built speculatively for a product tier nobody's committed to selling yet | Medium | Explicit checkpoint after Task 4 asks before starting either |

## Open questions

Both prior open questions (contract shape, Exam Day scope) are resolved
above. Remaining:

1. Carried from Phase 1, still open: is A1 in the offer at all (business
   decision, needs the founder + Herman)?
