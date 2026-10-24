# Implementation Plan: `ExamBlockContentService` serves the generic model (A1/A2)

**Status:** archived — implemented in #114. History, not a to-do list;
current state is `docs/architecture/multi-level.md` Break 13.
**Weight:** Standard — new behavior on an existing endpoint; not auth,
payment, schema, or AI-grading, but exam-content-adjacent, so full gates,
no shortcut.
**Parent:** `docs/architecture/multi-level.md` Part 6, Break 13's "open gap"
note (added when Phase 3 Task 7 found this while fixing exam scoring).
**Depends on:** Phase 3 (merged to `dev`) — `GenericExamContentService`,
`GENERIC_MODEL_LEVELS`, `exam_sections`/`exam_items`/`exam_item_options`,
and `exam-content.ts`'s `withoutAnswerKey` (already denies `solution`).

## Overview

A live Exam Day sitting calls `GET /exams/attempts/:attemptId/blocks/:block`
to be served that block's questions. `ExamBlockContentService.sectionsFor()`
switches on `block`: `LESEN_SPRACHBAUSTEINE` → Lesen+Sprachbausteine,
`HOEREN` → the three Hören Teile, anything else → Schreiben only. A2's block
is `LESEN_SCHREIBEN`, which falls into the `else` branch today — a candidate
would be served *only* the Schreiben task, Lesen silently missing, and that
one Schreiben call would throw (`WritingExercise.findFirst` 404s — no such
row exists for a generic-model Modelltest). Same bug class Phase 3 Task 7
already fixed in `exam-scoring.service.ts`; this is its mirror on the
content-serving side.

This plan makes `getBlockContent()` branch once on
`GENERIC_MODEL_LEVELS.includes(level)`, reusing `GenericExamContentService`
exactly as `ModelltestsService`/`ExamModelltestsService`/`ExamScoringService`
already do. B1/B2 keep the exact code path that exists today
(equality-tested).

## Non-goal, explicitly deferred — not forgotten

**Hören audio playback for A1/A2 is out of scope here.** `ExamAudioService`
(`play()` and its `ExamAudioPlay` counter) is built entirely around a
`ListeningExercise` row per Teil, each with its own `audio_url` and
`exam_plays_allowed`. A2's Hören contract
(`modelltests.format.hoerenDelivery`) is a different shape — one continuous
recording for the whole block, one play total, no per-Teil row to hang a
counter off. Serving a fake per-Teil `audioId`/`playsAllowed` here to match
B1/B2's shape would misrepresent a play mechanism that does not exist yet.
This task serves the Hören block's *question content* (prompts/items, minus
solutions, grouped by Teil) with no audio-play affordance attached. A
candidate sitting A2 Hören today still cannot play the recording — that
needs its own design task (where the single-play-per-block state lives) —
and separately, the real A2 Modelltest 1's `hoerenDelivery.audioUrl` is
`null`: nobody has uploaded the actual recording yet. That is a content/ops
gap, not a code gap, and is not closed by this plan either.

## Architecture decisions

- Same branch point as every prior Phase 3 task: `GENERIC_MODEL_LEVELS`,
  checked once per request, never duplicated into a shared helper the B1/B2
  path also calls (Part 7 Principle 1's corollary).
- The generic branch reuses `GenericExamContentService.sectionsFor()` as-is
  — no new method needed, unlike `ExamScoringService` (Task 7), which
  needed per-section lookup (`sectionFor`) for scoring. Serving content is a
  whole-Modelltest read, same shape the training and exam-catalogue paths
  already use.
- `withoutAnswerKey()` is unchanged and already strips `solution` (Task 6) —
  no new answer-key field to add.

## Task list

### Task 1: `getBlockContent` branches on level for `LESEN_SCHREIBEN` and `HOEREN`

**Description:** Select `session.modelltest.level` and
`session.modelltest.id` alongside the existing `.number` in
`getBlockContent`'s Prisma query. Pass `level` and `modelltestId` into
`sectionsFor`. For a generic-model level: `LESEN_SCHREIBEN` returns
`{ LESEN: ..., SCHREIBEN: ... }` from `GenericExamContentService.sectionsFor(modelltestId)`
(stripped by `withoutAnswerKey`); `HOEREN` returns `{ HOEREN: ... }` from the
same call, grouped by Teil, with no `audioId`/`playsAllowed` fields. For
every other level, `sectionsFor` runs exactly the code that exists today
(the `if (block === 'LESEN_SPRACHBAUSTEINE')` / `if (block === 'HOEREN')` /
`else` structure, byte-for-byte).

**Acceptance criteria:**
- [ ] All 13 existing tests in `test/exam-block-content.spec.ts` pass with
      only `session.modelltest.level: 'B1'` added to the shared
      `attemptRow()` fixture — no assertion changed. This is the
      equality test: B1's served content is unchanged.
- [ ] A new test: for level `A2` and block `LESEN_SCHREIBEN`, the response's
      `sections` has exactly the keys `LESEN` and `SCHREIBEN`, sourced from
      `GenericExamContentService.sectionsFor`, and `LesenService`/
      `SprachbausteineService`/`WritingService` are never called.
- [ ] A new test: for level `A2` and block `HOEREN`, `sections.HOEREN` is
      the generic model's Hören Teile (answers stripped), and
      `ListeningService.getExamTeil` is never called.
- [ ] A new test: the generic-model `HOEREN` response contains no
      `audioId` or `playsAllowed` field — asserting the non-goal stays a
      non-goal, not an accidental half-shape nobody meant to ship.
- [ ] A new test: the generic-model response strips every item's
      `solution`, same claim the existing "carries no answers at all" test
      makes for B1/B2 (`JSON.stringify(content)` has no `solution` key).

**Verification:**
- [ ] `npx tsc --noEmit` — exit code 0
- [ ] `npm run build` — exit code 0
- [ ] `npx jest` (full unit suite) — exit code 0
- [ ] `npm run test:integration` — exit code 0 (rebuild the Bruno fixture
      afterward: `node scripts/seed-b2-bruno-fixture.mjs`)
- [ ] `npm run test:e2e` — exit code 0
- [ ] `npx eslint .` — error count at or below the baseline in
      `.github/workflows/test.yml`; this task's own files lint-clean

**Dependencies:** None (Phase 3 is already merged).

**Files likely touched:**
- `src/modules/centers/exam-block-content.service.ts`
- `test/exam-block-content.spec.ts`

**Estimated scope:** S — one file's logic change, one spec file extended,
no schema, no new shared service.

---

## Checkpoint: after Task 1

- [ ] All gates above green, read by exit code
- [ ] B1/B2 `exam-block-content.spec.ts` fixtures byte-identical in behavior
- [ ] A2's `LESEN_SCHREIBEN` and `HOEREN` blocks serve real content from the
      live sitting path, confirmed against the real A2 Modelltest 1 (number
      8) — either a targeted integration test or a manual Bruno check against
      `.env.test`, since this is a live-sitting endpoint `test:integration`'s
      golden suite does not otherwise exercise for A2
- [ ] PR opened, not merged, per the standing rule — a human merges

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Shipping this without the audio task lets someone believe A2 Exam Day is fully live | Medium | PR description states plainly that Hören playback is still blocked; the readiness checklist in `docs/architecture/multi-level.md` already carries this note under check 7 |
| The generic Hören response shape (grouped by Teil, no play affordance) doesn't match what the Flutter app currently expects for a Hören block | Medium | No client exists yet for A2 Exam Day — confirm with the user before this ships whether a Flutter-side contract is already assumed anywhere, since Part 7 Principle 1 says the DTO shape must not fork by level |

## Open questions

1. Does anything on the Flutter side already assume a Hören block response
   always carries `audioId`/`playsAllowed` per item, regardless of level? If
   so, the generic-model Hören shape needs to be designed to fit that
   contract rather than invented fresh here — worth a quick check before
   Task 1 starts, not after.
