# Spec: Align Hören training with exam audio contract

## Objective

Training mode and exam mode must expose the **same Hören Teil structure** and
the **same playback flow**, so Flutter can share one model and one player.

Audio files live in **Cloudflare R2** (bucket `lerniqo`). The client never
receives a durable R2 URL for counted playback. Bytes are streamed through the
API after a counted `play`.

**Users**
- Primary: students (training `JwtAuthGuard` + exam sitting)
- Explicitly out of scope: changing center modelltest preview (managers may
  still get `audioUrl` for preview — separate product surface)

**Success**
- `GET /api/listening/exercise` matches exam Teil fields: `audioId`,
  `playsAllowed`, `contentRevision`, `imagePath`, `questions` — no
  `audio_url` / `bundled_audio_asset` in the response.
- Training play: `POST /api/listening/audio/:audioId/play` returns a short-lived
  stream URL (same delivery idea as exam). Training does **not** hard-cap
  plays — free vs timed is enforced in the app; the API may re-grant after TTL.
- Stream URL loads audio via API proxy from R2; raw R2 URL never goes to the
  client in training or exam exercise payloads.
- `playsAllowed` on GET remains `exam_plays_allowed` (usually 1) as the
  strict-mode hint (timed training + Exam Day). “Zweimal” lives in the MP3.
- Exam sitting play path stays behaviourally unchanged (once per attempt).

## Tech Stack

- NestJS: `src/modules/listening/*`, `src/modules/exams/exam-audio.controller.ts`,
  `src/modules/centers/exam-audio.service.ts`
- Prisma: `ListeningExercise.audio_url`, `exam_plays_allowed`; Exam Day
  counter `exam_audio_plays`. Legacy `training_audio_plays` is unused by the
  training play path (optional drop later).
- Storage: Cloudflare R2 (existing `audio_url` on the row; server fetch only)
- Auth: student JWT on exercise + play; stream authenticated by signed token
  (no JWT on `<audio>` / Flutter `UrlSource`)

## Commands

```
Build:     npm run build
Unit:      npm test -- --testPathPatterns=listening
           npm test -- --testPathPatterns=exam-audio
Lint:      npx eslint "src/modules/listening/**/*.ts" "src/modules/exams/exam-audio*.ts" "test/listening*.ts" "test/exam-audio*.ts"
Dev:       npm run start:dev
```

## Project Structure

```
src/modules/listening/
  listening.service.ts           getExercise → exam-shaped payload
  dto/listening-exercise.dto.ts  Swagger / response shape
  listening.controller.ts        GET exercise + POST play
  training-audio.service.ts      short-lived training stream grant (no hard-cap)
src/modules/exams/
  exam-audio.controller.ts       exam stream
src/modules/centers/
  exam-audio.service.ts          exam play (once per attempt)
docs/domains/
  hoeren-training-exam-alignment.md   this file
```

## Product decisions (locked)

| Knob | Value |
|------|--------|
| Storage | Cloudflare R2 (same bucket as images; prefix e.g. `hoeren/…`) |
| Neon Object Storage | Not used for Hören audio |
| Exercise payload | Exam shape is the reference (`getExamTeil`) |
| Durable R2 URL in student exercise JSON | **Never** (training and exam) |
| Play allowance (GET hint) | `listening_exercises.exam_plays_allowed` (usually 1) |
| Training hard-cap | **None** — Flutter owns free (unlimited) vs timed (once) |
| Exam counter scope | Unchanged: per **attempt + audioId** (`exam_audio_plays`) |
| Stream delivery | API proxy with short-lived signed token (existing exam pattern) |
| Submit body `content_revision` | Keep snake_case for this PR (avoid breaking submit) |
| Flutter | Separate follow-up; API ships the contract |

## Behaviour

### Ops / data (prerequisite)

1. Upload MP3s to R2 under a clear prefix (e.g. `hoeren/modelltest-N/teil-P.mp3`).
2. Set `listening_exercises.audio_url` to the R2 object URL (or private fetch URL
   the server can read). Empty `audio_url` → play returns `AUDIO_UNAVAILABLE`.
3. Images may stay public on R2; audio should preferably be private or only
   reachable via server credentials. If the bucket stays public, the API still
   must not expose the URL in exercise JSON (defence in depth: privacy of the
   bucket is recommended, not a substitute for the play gate).

### Training — get exercise

`GET /api/listening/exercise?teil=1&modelltest=1` (JWT)

**Response (aligned with exam Teil):**

```json
{
  "audioId": "uuid",
  "playsAllowed": 1,
  "contentRevision": "modelltest-1-hoeren-teil1-v1",
  "imagePath": "https://….r2.dev/hoerverstehen_teil1.png",
  "questions": [{ "id": "q41", "prompt": "…" }]
}
```

Removed from response: `audio_url`, `bundled_audio_asset`, `issued_at`,
`content_revision` (replaced by `contentRevision`).

`POST /api/listening/submit` still accepts `content_revision` as today; clients
send the string from `contentRevision`.

### Training — play

`POST /api/listening/audio/:audioId/play` (JWT)

1. Resolve exercise by id; refuse unknown ids.
2. Ensure `audio_url` and `duration_minutes` are usable.
3. Sign a short-lived token (lifetime ≈ recording duration × same factor as
   exam). No training play hard-cap — each call may mint a new link.
4. Return:

```json
{
  "audioId": "uuid",
  "url": "/api/listening/audio?token=…",
  "playsRemaining": 1,
  "expiresAt": "…"
}
```

`playsRemaining` mirrors `playsAllowed` (advisory for timed UI). It does not
deplete. Free training re-requests after TTL; timed training is client-limited
to one play; Exam Day still uses `exam_audio_plays`.

Errors (stable codes, same spirit as exam):

| Code | When |
|------|------|
| `AUDIO_NOT_FOUND` | Unknown id |
| `AUDIO_UNAVAILABLE` | Missing / empty `audio_url` or upstream fetch fail on stream |
| `AUDIO_DURATION_MISSING` | Cannot size token lifetime |
| `HOEREN_AUDIO_NOT_READY` | A1/A2 recording not uploaded yet |

### Training — stream

`GET /api/listening/audio?token=…` — **no JWT** (player cannot send it).

1. Verify signature + expiry.
2. Load `audio_url` for `audioId` in the token.
3. Proxy bytes from R2; `Cache-Control: no-store, private`.
4. Do **not** redirect to R2.

Exam keeps `GET /api/exams/audio?token=…`. Prefer a small shared proxy helper so
both routes do not drift; do not force training tokens through the exam route
if claims differ (training has no `attemptId`).

### Exam

No intentional behaviour change. Still:

1. Teil payload: `audioId` + `playsAllowed` (no R2 URL).
2. `POST .../attempts/:attemptId/audio/:audioId/play`.
3. `GET /api/exams/audio?token=…`.

### Frontend (contract)

```
GET exercise  →  audioId, playsAllowed
POST play     →  url
player.src    =  absolute API origin + url
```

## Testing Strategy

| Level | Focus |
|-------|--------|
| Unit — `getExercise` | Shape matches exam fields; no `audio_url` in JSON |
| Unit — training play | First grant URL; second grant still succeeds; missing audio |
| Unit — stream | Invalid/expired token refused; valid token proxies body |
| Regression | Exam audio play + stream specs still green |
| e2e listening | Update fixtures to new GET shape |

## Boundaries

**Always**
- Server owns the play count in **Exam Day** (`exam_audio_plays`).
- Training: short-lived links only; no hard-cap (Flutter: free unlimited, timed once).
- Proxy R2; never put durable R2 audio URLs in student exercise payloads.
- Keep exam attempt-scoped counting separate from training (training does not meter).

**Ask first**
- Server-enforced timed training (would need a mode flag or timed session).
- Making the R2 bucket private (ops) vs code-only hide.

**Never**
- Put MP3 bytes in Postgres / Neon as the primary store.
- Return public R2 audio URLs from `GET /exercise` “for convenience”.
- Rely on hiding the Play button alone.

## Success Criteria

- [ ] Training GET exercise matches exam Teil field names and meanings
- [ ] No `audio_url` / `bundled_audio_asset` in that response
- [ ] Training POST play re-grants without `NO_PLAYS_LEFT`; Exam Day still once
- [ ] Stream serves audio only with a valid token
- [ ] Exam play/stream tests still pass
- [ ] Spec + plan linked from `things-to-do-after.md`
- [ ] Ops note: R2 upload + `audio_url` backfill listed as prerequisite

## Open Questions

- None blocking.
- Optional later: private R2 + server credentials instead of public bucket URLs
  fetched by the API.
- Optional later: rename submit `content_revision` → `contentRevision` in a
  dedicated breaking change.
- Optional later: drop unused `training_audio_plays` table if nothing else
  reads it.
