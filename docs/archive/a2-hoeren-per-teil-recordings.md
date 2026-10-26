# Implementation Plan: A1/A2 Hören as one recording per Teil

**Status:** archived — implemented in #118 (Bruno cases in #119). History, not a to-do list; the rule lives in `docs/domains/exam-simulator.md`.
**Weight:** High risk — schema change (drop a column) and a data migration.
Full gates, independent review in a fresh context, Bruno replay.
**Supersedes:** the "one whole-block recording" mechanism of #115/#116,
which is on `dev` only and has never served a real play.

## Why

The A2 Modelltest 1 recording was split into three files, one per Teil, now
in R2 (`a2-hoeren-mt/a2-mt-1-hoeren/a2-modelltest-1-hoeren-teil{1,2,3}.mp3`,
`audio/mpeg`, measured 400.4 s / 303.5 s / 398.8 s, stored rounded up as 401 / 304 / 399 so a link never expires before its recording ends). The Flutter app already plays exactly
this shape for B1/B2 (`exam_day/domain/exam_hoeren_playback.dart`): each Teil
names its own `audioId`, the app spends one play per Teil, in order, with its
own reading pauses between them. Matching that shape means **no Flutter
change** for A2 Hören.

The rule is unchanged: one play per file. telc's repeats ("Sie hören jeden
Text zweimal", Teil 1 and 3) are inside the file; Teil 2 is heard once.

## Design (approved)

- **URLs and durations** live in `modelltests.format.hoerenDelivery`, one
  entry per Teil — never in `exam_sections.material`, which is served to the
  candidate and would leak the address.
- **`audioId`** for an A1/A2 Teil is that Teil's own `exam_sections.id`
  (a UUID, so the `ParseUUIDPipe` on the play route is satisfied).
- **Play counting** uses `exam_audio_plays`, the same per-recording counter
  B1/B2 use, one play allowed.
- **Removed:** the block-level `recording` field (#116) and
  `exam_attempt_blocks.hoeren_played_at` (#115). Both are unused by any
  client and have never held data outside tests.

## Tasks

### 1. Content shape and data

- `scripts/generic-modelltest-schemas.mjs`: `HOEREN_DELIVERY` becomes
  `deliveryMode: 'PER_TEIL_RECORDINGS'` with `recordings: [{ teil,
  audioAssetKey, audioUrl|null, durationSeconds|null }]` (Teil 1..n, unique),
  plays still literal 1, no pause/seek/restart.
- `content/a2-modelltest-1-source.json`: the three recordings, with real
  URLs and durations.
- Migration `…_a2_mt1_hoeren_recordings`: set `modelltests.format` for
  catalogue number 8 to the new shape (data only).
- Migration `…_drop_exam_attempt_block_hoeren_played_at`: drop the column.
- Importer test (`test/golden/…`) and the A2 content golden test updated to
  the new shape.

### 2. Serving the content

- `GenericExamContentService`: expose each section's database id.
- `ExamBlockContentService`: each A1/A2 Hören Teil carries `audioId`
  (its section id) and `playsAllowed: 1`; the block-level `recording` is
  removed. Still no URL in the response.

### 3. Playing

- `ExamAudioService.play()` (A1/A2 branch): `audioId` must be a HOEREN
  section of this sitting's Modelltest, else `AUDIO_NOT_IN_EXAM`; missing
  URL/duration → `HOEREN_AUDIO_NOT_READY` before spending; spend via
  `exam_audio_plays` with the same create-then-conditional-claim as B1/B2.
- `wholeBlockRecordingUrl` → `generic recording URL for a section id`, used
  by the stream controller's fallback.

### 4. Docs and Bruno

- `docs/domains/exam-simulator.md`: A1/A2 rule rewritten (one recording per
  Teil, once each, repeats inside).
- `docs/architecture/multi-level.md` Break 13 / readiness row 7.
- `bruno/A2 Level/09`–`10`: each Teil names its own recording; play Teil 1
  → 200 with a link, a second play → 400 `NO_PLAYS_LEFT`.

## Acceptance

- [ ] All existing B1/B2 audio, block-content and scoring tests pass with
      their assertions unchanged (equality)
- [ ] A2 Hören block content: three Teile, each with its own `audioId` and
      `playsAllowed: 1`, no URL, no answers, no block-level `recording`
- [ ] Play: first play of a Teil granted, second `NO_PLAYS_LEFT`, two at
      once grant one, another Modelltest's section refused, missing
      recording refused without spending
- [ ] Stream proxies the Teil's R2 URL; never redirects
- [ ] Migrations apply to `.env.test` via `scripts/apply-migration.mjs`
- [ ] Gates: tsc, build, unit, integration, e2e, lint at or under 942 with
      CI's exact command
- [ ] Bruno `A2 Level` replayed over HTTP: all pass, including a real
      Teil 1 play from R2
- [ ] Independent review (fresh context) before the PR

## Non-goals

- Flutter changes (none needed for Hören).
- B1/B2's own play counts — a separate discrepancy (domain doc says 1/2/2,
  database default and Flutter assume 1) to be checked against a B1 paper.
