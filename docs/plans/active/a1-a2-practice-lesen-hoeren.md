# Implementation Plan: A1/A2 practice (Lesen + Hören)

**Status:** approved; implemented — awaiting review/PR  
**Weight:** standard  
**Design:** approved in conversation (Approach A; Hören+Lesen v1; UNRECOGNISED → 0 pts + show key; same routes, `aufgabentyp`-driven sections)

## Overview

A1 and A2 students practise Lesen and Hören on the existing skill routes
(`/api/reading/*`, `/api/listening/*`), loading content from the generic model
and scoring with `markGenericSection`. Attempts write `student_activities` so
readiness can move. Schreiben, Sprechen, and any examiner queue stay out of
scope.

## Architecture decisions (locked)

- Branch inside `LesenService` / `ListeningService` / `TrainingAudioService` on
  `GENERIC_MODEL_LEVELS`; read via `GenericExamContentService` only.
- No new `/api/generic/…` routes (rejects Approach B).
- **Lesen GET (A1/A2):** `{ contentRevision, issuedAt, sections[] }` with keys
  on items (ADR 0001). B1 `teil1|teil2|teil3` absent, not stubbed.
- **Hören GET (A1/A2):** authoritative `audioId` (= `exam_sections.id`),
  `playsAllowed`, `contentRevision`, `aufgabentyp`, `items` (+ `material` as
  needed). Do not fake B1 `questions`/`+/-` when the Teil is not RF-only.
- **Answers:** keyed by `itemNumber` as string — already what
  `markGenericSection` expects.
- **UNRECOGNISED:** 0 points, included in denominator; response carries
  `outcomes` + `review` (accepted answers / solution) — no examiner queue.
- **Training audio:** mirror `ExamAudioService.teilRecording` —
  `format.hoerenDelivery.recordings`, `playsAllowed: 1`.
- **No schema migration.** Reuse `exam_sections`, attempt tables;
  `listening_exercise_id` null for generic training (Break 9).

## What already exists

| Piece | Where |
|---|---|
| Content MT 8/9 | `exam_sections` / items / options |
| Generic reader | `GenericExamContentService` |
| Scoring | `markGenericSection`, `pointsOf` |
| Level + Prep Pass gate | `TrainingModelltestAccessService` on Lesen/Hören |
| Of-the-week generic content | `ModelltestsService.getOfTheWeekContent` |
| Exam Day audio for section ids | `ExamAudioService` |
| Readiness formula | level-aware; needs practice activities |

## Task list

### Phase 1 — Shared scoring feedback + training audio

#### Task 1: Training mark helper (outcomes + review)

**Description:** Small pure helper next to `generic-section-scoring.ts` that
turns a `GenericSectionMark` + section into per-item `outcomes` and a `review`
list for UNRECOGNISED (and optionally WRONG) items, exposing accepted answers /
solution for self-check. Reused by Lesen and Hören submit.

**Acceptance criteria:**
- [ ] Given a section and answers, returns `percent` consistent with
      `markGenericSection` (UNRECOGNISED → not correct, still in `total`)
- [ ] Every UNRECOGNISED item appears in `review` with enough of `solution` to
      show the key
- [ ] Unit tests cover closed WRONG vs free-text UNRECOGNISED

**Verification:** `npx jest` on the new/adjacent spec; exit code 0  
**Dependencies:** None  
**Files likely touched:**
- `src/modules/centers/generic-section-scoring.ts` (or sibling helper)
- `src/modules/centers/generic-section-scoring.spec.ts` (or sibling)
**Estimated scope:** S

#### Task 2: Training audio resolves generic Hören section ids

**Description:** `TrainingAudioService.play` looks up `listening_exercises`
first; on miss, resolves `exam_sections` with `skill = HOEREN`, reads recording
from `modelltest.format.hoerenDelivery` (same helper as Exam Day), asserts
access on that Modelltest number, meters with `training_audio_plays`, signs
the same token URL. Stream resolution for tokens must find the generic
recording URL (mirror exam path).

**Acceptance criteria:**
- [ ] Play with an A1/A2 Hören `exam_sections.id` returns `GrantedPlay`
- [ ] Missing upload → `HOEREN_AUDIO_NOT_READY` (or existing equivalent) before
      spending a play
- [ ] Wrong level / no access still denied via `assertMayAccess`
- [ ] B1 `listening_exercises` path unchanged

**Verification:** unit tests in `test/training-audio.service.spec.ts`; exit 0  
**Dependencies:** None (parallel with Task 1)  
**Files likely touched:**
- `src/modules/listening/training-audio.service.ts`
- `src/modules/centers/exam-audio.service.ts` (share `teilRecordingOf` if not
  already exported)
- `test/training-audio.service.spec.ts`
**Estimated scope:** M

### Checkpoint: Phase 1
- [ ] Jest for scoring helper + training audio exit 0
- [ ] No behaviour change on B1 play path

---

### Phase 2 — Hören practice (vertical slice)

#### Task 3: `GET /api/listening/exercise` for A1/A2

**Description:** When the Modelltest level is in `GENERIC_MODEL_LEVELS`, load
the Hören Teil via `genericContent.sectionFor`, return
`audioId`, `playsAllowed: 1`, `contentRevision`, `aufgabentyp`, `sectionId`,
`material`, `items` (with solutions for training). Keep B1 path untouched.

**Acceptance criteria:**
- [ ] `?modelltest=8&teil=1` (A2 student) returns 200 with `items` and
      `audioId` = section id
- [ ] `?modelltest=9&teil=2` (A1) same
- [ ] Cross-level still `LEVEL_MISMATCH`
- [ ] B1 `?modelltest=1&teil=1` byte-stable shape (existing tests green)

**Verification:** unit tests on `listening.service`; exit 0  
**Dependencies:** None (uses existing generic reader)  
**Files likely touched:**
- `src/modules/listening/listening.service.ts`
- `src/modules/listening/dto/listening-exercise.dto.ts`
- `src/modules/listening/listening.service.spec.ts` (or equivalent)
**Estimated scope:** M

#### Task 4: `POST /api/listening/submit` for A1/A2

**Description:** Generic path: validate `content_revision` against the
section; `markGenericSection`; persist `listening_attempts` with
`listening_exercise_id: null`, `modelltest_id` set, `answers` Json optional but
useful; `recordActivity(HOEREN)`; response includes `score`, `outcomes`,
`review` (Task 1). Relax answer-value validation so non `+/-` answers are
allowed when the Teil is generic (DTO: accept `Record<string, unknown>` or
string values without RF-only enum).

**Acceptance criteria:**
- [ ] Correct A2 Kurzantwort / choice answers produce expected percent
- [ ] Unrecognised free text → 0 for that item, listed in `review`, no throw
- [ ] Stale `content_revision` → existing stale-revision error
- [ ] Guest: score (+ outcomes) without persist
- [ ] B1 submit still requires `+/-` and returns `answerKey` as today

**Verification:** unit tests; exit 0  
**Dependencies:** Task 1, Task 3  
**Files likely touched:**
- `src/modules/listening/listening.service.ts`
- `src/modules/listening/dto/submit-listening.dto.ts`
- listening submit specs
**Estimated scope:** M

### Checkpoint: Phase 2
- [ ] Hören GET → play → submit works in unit tests for MT 8 or 9
- [ ] `npx tsc --noEmit` exit 0 (after these files)

---

### Phase 3 — Lesen practice (vertical slice)

#### Task 5: `GET /api/reading/exercise` for A1/A2

**Description:** Generic path returns `{ contentRevision, issuedAt, sections }`
for all LESEN Teile of the paper (keys on). Derive `contentRevision` from a
stable rule (e.g. Teil 1’s revision, or a join — document the choice in code
comment; prefer one section’s revision listed in the response and require
submit to use that Teil’s own revision if we add a check later). Omit
`teil1|teil2|teil3`.

**Acceptance criteria:**
- [ ] A1/A2 GET returns three Lesen sections with `aufgabentyp` + keyed items
- [ ] B1 GET unchanged (`teil1` present, no `sections`)
- [ ] Level gate unchanged

**Verification:** lesen service unit tests; exit 0  
**Dependencies:** None  
**Files likely touched:**
- `src/modules/lesen/lesen.service.ts`
- `src/modules/lesen/dto/*`
- lesen specs
**Estimated scope:** M

#### Task 6: `POST /api/reading/submit` for A1/A2

**Description:** On generic level, score the Teil named by `teil_id` with
`markGenericSection` + Task 1 helper; persist `lesen_attempts` +
`recordActivity(LESEN)`; response `{ attemptId?, score, outcomes?, review? }`.

**Acceptance criteria:**
- [ ] Submit Teil `"1"|"2"|"3"` scores against the matching LESEN section
- [ ] UNRECOGNISED policy as design
- [ ] B1 submit path unchanged

**Verification:** unit tests; exit 0  
**Dependencies:** Task 1, Task 5  
**Files likely touched:**
- `src/modules/lesen/lesen.service.ts`
- lesen submit DTO/response types
- lesen specs
**Estimated scope:** M

### Checkpoint: Phase 3
- [ ] Lesen GET + submit unit tests green for A1 or A2
- [ ] `npx tsc --noEmit` and `npx jest` exit 0

---

### Phase 4 — Docs, Bruno, gates

#### Task 7: Permanent docs + checklist

**Description:** Update `docs/architecture/multi-level.md` checklist item 5
for A1/A2 to reflect practice skill GETs (Lesen+Hören). Short note in an
existing domain doc (answer-key or exam-simulator “training vs exam” — **do
not** create a new `*-v2`) that A1/A2 training auto-scores with
`markGenericSection` and UNRECOGNISED shows the key. Index unchanged unless a
new file is truly needed (prefer not).

**Acceptance criteria:**
- [ ] Checklist 5 text matches code behaviour
- [ ] No duplicate plan marked as “implemented” without code
- [ ] Linked from existing docs only

**Verification:** manual read of the edited sections  
**Dependencies:** Tasks 3–6  
**Files likely touched:**
- `docs/architecture/multi-level.md`
- one of `docs/domains/answer-key-with-exercise.md` or related
**Estimated scope:** S

#### Task 8: Bruno practice scenarios

**Description:** Extend `bruno/A1 Level` and `bruno/A2 Level` (or a clearly
named practice subfolder under them) with: login as A-level student → GET
reading exercise for 9/8 → GET listening exercise → play (if audio ready in
`.env.test`) → submit with known keys from content → assert score / outcomes.
Keep Exam Day requests intact. If audio not uploaded in test DB, assert GET
shape and submit scoring; report play as blocked rather than skipping silently.

**Acceptance criteria:**
- [ ] At least one success path per level for Lesen submit
- [ ] At least one success path per level for Hören submit (or documented
      blocked if no recording)
- [ ] LEVEL_MISMATCH request remains

**Verification:** run from Bruno app against `npm run start:testdb`
(`ep-misty-sea`); report table with exit/assertion results  
**Dependencies:** Tasks 2–6  
**Files likely touched:**
- `bruno/A1 Level/*.bru`
- `bruno/A2 Level/*.bru`
**Estimated scope:** M

#### Task 9: Five gates

**Description:** Run all CI gates; read **exit codes** only.

**Acceptance criteria:**
- [ ] `npx tsc --noEmit` → 0
- [ ] `npm run build` → 0
- [ ] `npx jest` → 0
- [ ] `npm run test:integration` → 0 (`.env.test` only)
- [ ] `npm run test:e2e` → 0
- [ ] Lint error count ≤ baseline in `.github/workflows/test.yml`

**Verification:** each command’s exit code recorded in the PR notes  
**Dependencies:** Tasks 1–8  
**Estimated scope:** S (run only)

### Checkpoint: Complete
- [ ] Design behaviour covered by tests + Bruno (or play blocked, reported)
- [ ] Docs updated in the same change set as the code
- [ ] Ready for `mattpocock-skills:code-review` (fresh context) then PR skill

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hören DTO growth breaks a strict Flutter client | Med | Additive fields only; B1 path untouched; document discriminator (`sections` / `items`+`aufgabentyp`) |
| No R2 audio on MT 8/9 in `.env.test` | Med | Bruno asserts GET/submit; play reported blocked |
| Answer key shape varies by `aufgabentyp` in `review` | Low | Return `solution` blob + `acceptedAnswers` when present |
| Lesen `contentRevision` ambiguity (3 sections) | Low | Document single rule in Task 5; Hören already per-Teil |
| Accidental production DB use | High | Never `prisma migrate`; only `.env.test` / `start:testdb`; refuse `ep-wandering-hall` |

## Out of scope (explicit)

- Schreiben / Sprechen practice
- Approach B (parallel generic API)
- Examiner queue for training UNRECOGNISED
- Writing/speaking LEVEL_MISMATCH backlog
- Flutter app changes
- Schema migrations

## Skills for implementation (after plan approval)

`incremental-implementation` + `test-driven-development`  
Then gates → Bruno → `mattpocock-skills:code-review` → `mattpocock-skills:pr`

## Open questions

None blocking — Hören authoritative `items`+`aufgabentyp` was accepted with the
design. If Bruno audio is unavailable, implementation reports play blocked
rather than inventing a skip.
