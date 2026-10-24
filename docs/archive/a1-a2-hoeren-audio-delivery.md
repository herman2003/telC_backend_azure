# Implementation Plan: A1/A2 Hören audio delivery (one play, whole block)

**Status:** archived — implemented in #115. The approved rule lives in
`docs/domains/exam-simulator.md` ("Hören plays are counted"); this file is
history, not a to-do list.
**Weight:** High risk — schema change. Per `CLAUDE.md`'s weight table this
needs independent review in a fresh context and staging verification before
a PR is opened, on top of the standard gates.
**Parent:** `docs/architecture/multi-level.md` Break 13's "open gap" note,
and PR #114's own non-goal — the generic model's Hören block content now
serves question text, but a candidate still cannot play the recording.
**Depends on:** PR #114 (merged) — `ExamBlockContentService`'s generic-model
branch; `modelltests.format.hoerenDelivery` (Task 4b, already stored, shape
validated at import by `scripts/generic-modelltest-schemas.mjs`'s
`HOEREN_DELIVERY` schema).

## Design, as discussed and approved

A1/A2's Hören is **one continuous official recording for the whole block** —
`modelltests.format.hoerenDelivery: { audioAssetKey, audioUrl, durationSeconds,
playsAllowed: 1, pauseAllowed: false, seekAllowed: false, restartAllowed: false,
teilOrder }` — not a `ListeningExercise` row per Teil with its own play
counter, which is what `ExamAudioService`/`ExamAudioPlay` are built around
today. "One play for an audio id" (B1/B2) does not map onto "one play for a
block" (A1/A2).

**Where the single-play state lives:** a nullable timestamp column on
`ExamAttemptBlock`, `hoeren_played_at`. `ExamAttemptBlock` already has exactly
one row per `(attempt_id, block)` (`@@unique([attempt_id, block])`), so "has
this attempt's Hören play been spent" is a null check on a field already
scoped correctly — no new table. Rejected: a dedicated one-row-per-attempt
table (unnecessary, the row already exists) and reusing `ExamAudioPlay` with
a synthetic `audio_id` (borrows a table whose unique key means "many
independently-countable assets," which this isn't — a future reader could
mistake it for the real thing).

**The `audioId` route parameter, for the generic model, is the Modelltest's
own id.** `POST /attempts/:attemptId/audio/:audioId/play` already validates
`audioId` with `ParseUUIDPipe`, and `Modelltest.id` is a UUID — no controller
or route change needed. The signed-token mechanism, the proxy-not-redirect
endpoint, and the HMAC verification are all unchanged and reused as-is; only
*which table `play()` and `stream()` read from* changes, branched on level.

## Non-goals

- **No audio file exists yet for the real A2 Modelltest 1**
  (`hoerenDelivery.audioUrl` is `null`). This plan builds the mechanism; it
  does not and cannot make A2 Hören actually playable until that URL is set
  — a content/ops task for the user, tracked separately, not blocking this
  plan's implementation or review.
- **No change to `pauseAllowed`/`seekAllowed`/`restartAllowed` enforcement.**
  Those are client-side playback constraints (disable the player's seek bar,
  etc.) — out of scope for a backend plan; noted here so nobody assumes the
  server enforces them (it can't: once the file is streamed to an `<audio>`
  element, the server has no visibility into pause/seek).

## Task list

### Task 1: schema — `ExamAttemptBlock.hoeren_played_at`

**Description:** Add `hoeren_played_at DateTime?` to `ExamAttemptBlock`.
Additive, nullable, no default — every existing row reads as "not played,"
which is correct for both every past B1/B2 attempt (this field is simply
never read on that path) and any in-flight A1/A2 attempt.

**Acceptance criteria:**
- [ ] Column exists, nullable, no FK, no change to `@@unique([attempt_id, block])`
- [ ] Existing `ExamAttemptBlock` rows unaffected (additive migration only)

**Verification:**
- [ ] Migration applies cleanly against `.env.test` via
      `scripts/apply-migration.mjs` (never a bare `prisma migrate`)
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** None.

**Files likely touched:**
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_exam_attempt_block_hoeren_played_at/migration.sql`

**Estimated scope:** XS.

---

### Task 2: `ExamAudioService.play()` branches on the generic model

**Description:** `play()` selects `session.modelltest.{id, level, format}`
alongside what it already selects. For a generic-model level: validate
`audioId === modelltest.id` (else `AUDIO_NOT_IN_EXAM`, same claim the
existing cross-exam check makes); read `format.hoerenDelivery` (trusted, not
re-validated — it was checked once at import, per Part 3's rule); if
`audioUrl` or `durationSeconds` is missing, throw a clear, distinct error
(`HOEREN_AUDIO_NOT_READY`) rather than sign a token for a file that may not
exist — this is exactly the state the real A2 Modelltest 1 is in today, and
it must fail loudly, not silently sign a dead link. Otherwise: a conditional
update (`examAttemptBlock.updateMany` with `hoeren_played_at: null` in the
`where`, same "claim via conditional update, not read-then-write" pattern
`ExamAudioPlay` already uses) spends the one play; `count !== 1` is
`NO_PLAYS_LEFT`. Sign the same `AudioTokenClaims` shape, `playNumber` always
`1`, `audioId` the modelltest id.

For every other level: the existing code path, untouched (equality test).

**Acceptance criteria:**
- [ ] All existing tests in `test/exam-audio.service.spec.ts` pass unmodified
      (equality test — B1/B2 behavior unchanged)
- [ ] A new test: a generic-model level's first play succeeds, spends the
      block's one play, returns `playsRemaining: 0`
- [ ] A new test: a second play attempt on the same block returns
      `NO_PLAYS_LEFT`
- [ ] A new test: two concurrent first-play requests result in exactly one
      grant (same concurrency claim the existing "two presses arriving
      together" B1/B2 test makes, mirrored for the generic path)
- [ ] A new test: a generic-model Modelltest with `hoerenDelivery.audioUrl`
      (or `durationSeconds`) null throws `HOEREN_AUDIO_NOT_READY`, not a
      signed link
- [ ] A new test: `audioId` not matching the attempt's own Modelltest throws
      `AUDIO_NOT_IN_EXAM`, same as the existing cross-exam B1/B2 claim

**Verification:**
- [ ] `npx jest test/exam-audio.service.spec.ts` — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** Task 1.

**Files likely touched:**
- `src/modules/centers/exam-audio.service.ts`
- `test/exam-audio.service.spec.ts`

**Estimated scope:** M.

---

### Task 3: `ExamAudioController.stream()` resolves either source

**Description:** After verifying the token, try `listeningExercise.findUnique`
first (existing B1/B2 path, unchanged); if not found, treat `claims.audioId`
as a Modelltest id and read `format.hoerenDelivery.audioUrl` from it instead.
Proxy exactly as today either way — no change to the "proxied, never
redirected" rule.

**Acceptance criteria:**
- [ ] All existing tests in `test/exam-audio.controller.spec.ts` pass
      unmodified (equality test)
- [ ] A new test: a token whose `audioId` is a generic-model Modelltest id
      proxies from `format.hoerenDelivery.audioUrl`
- [ ] A new test: a token naming neither a `ListeningExercise` nor a
      Modelltest with Hören delivery data is refused with the existing
      `400 AUDIO_UNAVAILABLE` (what a missing recording already returned
      before this change — not a 404), not a crash

**Verification:**
- [ ] `npx jest test/exam-audio.controller.spec.ts` — exit code 0
- [ ] `npx tsc --noEmit` — exit code 0

**Dependencies:** Task 2 (shares the claims shape).

**Files likely touched:**
- `src/modules/exams/exam-audio.controller.ts`
- `test/exam-audio.controller.spec.ts`

**Estimated scope:** S.

---

## Checkpoint: after Tasks 1-3

- [ ] All 5 CLAUDE.md gates + the eslint ratchet green, read by exit code —
      use the exact CI command (`npx eslint "{src,apps,libs,test}/**/*.ts" -f
      json`), not `npx eslint .` (a prior session's lint figures were wrong
      for exactly this reason — see memory `run-lint-gate-too`)
- [ ] B1/B2 `exam-audio.service.spec.ts` and `exam-audio.controller.spec.ts`
      fixtures byte-identical in behavior
- [ ] Bruno: extend the collection already covering exam audio (find it under
      `bruno/`, per the Bruno policy — don't start a parallel one) with a
      scenario for `HOEREN_AUDIO_NOT_READY` against the real A2 Modelltest 1,
      since its `audioUrl` is genuinely null today — this is the one gate
      that can be exercised for real without the actual recording existing.
      **Blocked:** the Bruno fixture (`scripts/seed-b2-bruno-fixture.mjs`)
      seeds B1/B2 students and sittings only, with no A2 student or A2 exam
      sitting, and the `bru` CLI is not installed. Not added rather than
      added unrun; needs an A2 fixture first
- [ ] **Independent review, fresh context** (`mattpocock-skills:code-review`)
      — required for high-risk work, per `CLAUDE.md`
- [ ] PR opened, not merged — a human merges
- [ ] **Staging verification** before `main` — per the no-staging-until-VPS
      constraint, this means the local suites plus a Neon-branch migration
      dry run, not a second deployed environment

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Nobody can test real playback end-to-end — no audio file exists for A2 Modelltest 1 | Medium | `HOEREN_AUDIO_NOT_READY` is itself a tested, correct outcome; the mechanism is fully verifiable without a real file, same way the existing B1/B2 tests use a fixture URL rather than a real recording |
| A future generic-model level's `hoerenDelivery` shape drifts from what `play()` trusts (e.g. `durationSeconds` present but wrong) | Low | `format` is validated once at import (Task 4b); this plan does not re-validate on read, matching Part 3's established rule — if that rule is ever wrong, it is wrong for every other read of `format` too, not newly introduced here |
| `ExamAttemptBlock.hoeren_played_at` gets confused with `ListeningAttempt`/`ExamAudioPlay`'s per-recording counters by a future reader | Low | Named specifically (`hoeren_` prefix, not a generic `played_at`), and this plan's own Design section states the rejected alternatives and why |

## Open questions

None — contract shape, state location, and route-parameter reuse were all
settled in conversation before this plan was written. The only outstanding
item is the real audio file itself, which is explicitly a non-goal here, not
an open question for this plan.
