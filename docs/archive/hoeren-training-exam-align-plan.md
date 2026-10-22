# Implementation Plan: Align Hören training with exam audio contract

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Training Hören uses the same payload and counted play+proxy flow as exam; audio stays in Cloudflare R2.

**Architecture:** `getExercise` returns the same fields as `getExamTeil`. A new `training_audio_plays` table counts per student+audio. `POST /api/listening/audio/:audioId/play` signs a short-lived token; `GET /api/listening/audio?token=` proxies R2. Exam paths stay as they are.

**Tech Stack:** NestJS, Prisma, existing HMAC token pattern from `ExamAudioService`, Cloudflare R2 via `audio_url`.

**Source of truth:** `docs/domains/hoeren-training-exam-alignment.md`  
**Tracker:** `docs/things-to-do-after.md` (Align Hören training and exam payload structure)

## Global Constraints

- Exam is the reference shape; training catches up.
- Never return durable R2 audio URLs in student exercise JSON.
- Allowance = `listening_exercises.exam_plays_allowed`.
- Training counter = student + audioId; exam counter = attempt + audioId.
- Submit keeps `content_revision` snake_case in this PR.
- One PR preferred (payload + play + stream together — payload alone breaks training audio).

## Overview

```
Ops: MP3s on R2 + audio_url set
        │
Phase 1: GET exercise shape
        │
Phase 2: Prisma TrainingAudioPlay + training play service
        │
Phase 3: POST play + GET stream (+ shared proxy helper if cheap)
        │
Phase 4: tests, docs tracker, PR
```

## Architecture Decisions

- **Reuse exam token ideas** (HMAC, duration-based expiry, query token) but **separate claims** without `attemptId` — do not overload exam stream with training tokens unless claims are clearly versioned.
- **Extract proxy** (`fetch audio_url → buffer → response headers`) into a tiny shared helper used by exam and training stream controllers if both would otherwise duplicate the same 20 lines.
- **Conditional play increment** same as exam (`create` at 0, then `updateMany` where `plays_used < allowed`) to avoid double-tap races.
- **R2 upload is ops**, not Nest code: checklist task before/alongside QA.

---

## Task List

### Phase 0: Ops prerequisite (can run in parallel)

#### Task 0: Upload audio to R2 + backfill `audio_url`
**Description:** Put MP3s in bucket `lerniqo` under e.g. `hoeren/modelltest-{n}/teil-{p}.mp3`. Update each `listening_exercises.audio_url`. Prefer private objects if Cloudflare access allows server-side fetch; if bucket stays public, still never expose URL in GET exercise.

**Acceptance criteria:**
- [ ] Every seeded / production Hören row used in QA has non-empty `audio_url`
- [ ] Server can HTTP-fetch that URL (or via R2 credentials if private)
- [ ] Naming documented in a one-line note in the PR description

**Verification:** manual curl/fetch of one URL from the API host; SQL check `audio_url <> ''`

**Files:** R2 bucket; DB rows (migration seed update optional if content lives only in prod data)

**Scope:** Ops / data  
**Blocks:** meaningful QA of Task 4–5 (code can still land with tests using fake fetch)

---

### Phase 1: Exercise payload

#### Task 1: Failing tests for new `getExercise` shape
**Description:** Update / add unit tests so `getExercise` expects exam-aligned fields and forbids `audio_url` in the result.

**Acceptance criteria:**
- [ ] Spec asserts `audioId`, `playsAllowed`, `contentRevision`, `imagePath`, `questions`
- [ ] Spec asserts absence of `audio_url`, `bundled_audio_asset`, `content_revision`, `issued_at`
- [ ] Tests fail against current implementation

**Verification:**

```
npm test -- --testPathPatterns=listening.service.spec
```

Expected: FAIL on new expectations

**Files:** `test/listening.service.spec.ts`, `test/listening.controller.spec.ts`, `test/listening.e2e-spec.ts`

**Scope:** Small

---

#### Task 2: Implement `getExercise` + DTO + controller docs
**Description:** Make `ListeningService.getExercise` select `id`, `exam_plays_allowed`, etc., and return the exam-shaped object. Update `ListeningExerciseDto` and Swagger text on the controller. Prefer calling shared mapping with `getExamTeil` or duplicating the same return fields so they cannot drift (extract `toTeilPayload(exercise)` if both methods stay).

**Acceptance criteria:**
- [ ] Response matches `getExamTeil` field names
- [ ] Submit still validates `dto.content_revision` against DB (client sends `contentRevision` value)
- [ ] Task 1 tests pass

**Verification:**

```
npm test -- --testPathPatterns=listening.service.spec
npm test -- --testPathPatterns=listening.controller.spec
npm run build
```

**Files:**
- `src/modules/listening/listening.service.ts` (`getExercise`, optionally shared mapper with `getExamTeil`)
- `src/modules/listening/dto/listening-exercise.dto.ts`
- `src/modules/listening/listening.controller.ts`

**Scope:** Small  
**Depends:** Task 1

---

### Checkpoint: Payload
- [ ] Training GET shape locked
- [ ] No raw audio URL in exercise JSON

---

### Phase 2: Training play storage + service

#### Task 3: Prisma model `TrainingAudioPlay`
**Description:** Add model mapped to `training_audio_plays`:

```prisma
model TrainingAudioPlay {
  id         String @id @default(uuid())
  student_id String
  audio_id   String @db.Uuid
  plays_used Int    @default(0)

  student Student           @relation(fields: [student_id], references: [id], onDelete: Cascade)
  // audio_id references listening_exercises.id — add relation if schema style allows

  @@unique([student_id, audio_id])
  @@map("training_audio_plays")
}
```

Wire `Student` relation array. Create migration.

**Acceptance criteria:**
- [ ] `npx prisma migrate` / project migrate command succeeds locally
- [ ] Unique `(student_id, audio_id)`
- [ ] Cascade delete with student (same spirit as other student-owned rows)

**Verification:** `npx prisma validate` + migrate; `npm run build`

**Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_training_audio_plays/migration.sql`

**Scope:** Small  
**Depends:** none (can parallel Task 1–2)

---

#### Task 4: `TrainingAudioService.play` + unit tests
**Description:** New service mirroring exam play logic without attempt/block clocks:

1. Load exercise by `audioId` (`id`, `audio_url`, `duration_minutes`, `exam_plays_allowed`).
2. Create counter row at 0 if missing; conditional increment; throw `NO_PLAYS_LEFT` if none spent.
3. Sign token with claims `{ studentId, audioId, playNumber, expiresAt }` (or short keys like exam).
4. Return `{ audioId, url: '/api/listening/audio?token=…', playsRemaining, expiresAt }`.

Reuse `EXAM_AUDIO_SECRET` or a shared injection token already used by exam — do not invent a second secret unless required.

**Acceptance criteria:**
- [ ] First play returns URL and `playsRemaining = allowed - 1`
- [ ] Exhausted plays → `NO_PLAYS_LEFT`
- [ ] Missing exercise → `AUDIO_NOT_FOUND`
- [ ] Empty `audio_url` → `AUDIO_UNAVAILABLE`
- [ ] Missing/invalid duration → `AUDIO_DURATION_MISSING`
- [ ] Race-safe increment (same pattern as exam)

**Verification:**

```
npm test -- --testPathPatterns=training-audio
```

**Files:**
- Create: `src/modules/listening/training-audio.service.ts`
- Create: `test/training-audio.service.spec.ts`
- Modify: `src/modules/listening/listening.module.ts` (provider)

**Scope:** Medium  
**Depends:** Task 3

---

### Phase 3: HTTP routes

#### Task 5: Controller routes + stream proxy
**Description:**
- `POST /api/listening/audio/:audioId/play` → `TrainingAudioService.play(studentId, audioId)` under existing listening JWT guard.
- `GET /api/listening/audio?token=` → verify training token, proxy R2 (copy headers pattern from `ExamAudioController`: content-type, content-length, `Cache-Control: no-store, private`).
- Extract shared `proxyAudioResponse(fetcher, audioUrl, res)` if exam controller can call it without a large refactor; otherwise duplicate once and note follow-up.

**Acceptance criteria:**
- [ ] Play requires student JWT
- [ ] Stream works without JWT with valid token
- [ ] Bad/expired token → `AUDIO_TOKEN_INVALID` / `AUDIO_TOKEN_EXPIRED`
- [ ] Exam `GET /api/exams/audio` still green

**Verification:**

```
npm test -- --testPathPatterns=listening
npm test -- --testPathPatterns=exam-audio
npm run build
```

**Files:**
- `src/modules/listening/listening.controller.ts` (or `training-audio.controller.ts` if cleaner)
- Optionally small shared helper next to exam-audio controller
- Specs for controller / stream

**Scope:** Medium  
**Depends:** Task 4

---

### Checkpoint: End-to-end contract
- [ ] Manual: GET exercise → POST play → GET stream returns audio bytes (with real or fake R2)
- [ ] Second POST play fails when `playsAllowed` is 1

---

### Phase 4: Close out

#### Task 6: Docs tracker + Flutter note
**Description:** Mark the Hören align section in `things-to-do-after.md` with links to this spec/plan; status → in progress / done when merged. Short note in PR body for Flutter: stop using `audio_url`; use play URL.

**Acceptance criteria:**
- [ ] Tracker points at SPEC + PLAN
- [ ] Deleted obsolete frontend MD files remain deleted (already removed on this branch) or are not reintroduced

**Files:** `docs/things-to-do-after.md`, PR description

**Scope:** Tiny  
**Depends:** Tasks 2, 5

---

#### Task 7: PR to `dev`
**Description:** Ensure lint on touched files; open PR. Do not push directly to protected `dev`.

**Acceptance criteria:**
- [ ] CI green (or known baseline-only lint)
- [ ] PR lists Flutter follow-up and R2 ops checklist

**Verification:** CI on the PR

**Scope:** Process  
**Depends:** Tasks 0–6 (Task 0 may be “in progress” with staging URLs)

---

## Estimated effort

| Slice | Effort |
|-------|--------|
| Task 0 ops (files ready) | 0.5–1 d |
| Tasks 1–2 payload | ~0.5 d |
| Tasks 3–5 play + stream | ~1–1.5 d |
| Tasks 6–7 + CI | ~0.5 d |
| **Backend total** | **~2.5–3.5 d** |
| Flutter (separate) | ~1 d |

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| GET exercise exam shape | 1, 2 |
| No R2 URL in exercise JSON | 1, 2 |
| Training POST play + count | 3, 4, 5 |
| Stream proxy + token | 5 |
| `exam_plays_allowed` source | 4 |
| Exam unchanged | 5 regression |
| R2 storage prerequisite | 0 |
| Tracker / docs | 6 |

## Out of scope

- Flutter player rewrite (document only)
- Neon Object Storage
- Renaming submit `content_revision`
- Changing center modelltest preview `audioUrl` for managers
- Reset policy for training plays (ask product later)
