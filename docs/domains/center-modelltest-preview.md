# Spec: Center Modelltest content preview

## Objective

Give a **center manager** (dashboard) a way to inspect the **full exercise content** of a Modelltest they select for an exam sitting — **without answer keys** — so they can verify what candidates will face before publishing a session.

**User:** center manager authenticated with a center Bearer token.

**Success looks like:**
- Manager lists available Modelltests (existing).
- Manager opens one Modelltest and receives Lesen, Sprachbausteine, Hören, Schreiben, and Sprechen content in one response.
- No correct-answer / answer-key / transcript fields appear in the payload.
- Centers without exam slots cannot call the endpoint (same gate as the catalogue).
- Incomplete or unknown Modelltest numbers return 404.

**Decision (2026-10-04):** Option **B** — full content without keys (not light summary, not keys included).

## Tech Stack

- NestJS 11 + TypeScript
- Prisma + PostgreSQL (existing `modelltests` and skill exercise tables)
- Auth: `CenterAuthGuard` + `@CurrentCenterUser()`
- Content stripping: existing `withoutAnswerKey` / `ANSWER_KEY_FIELDS` in `src/modules/centers/exam-content.ts`
- Skill builders: `LesenService`, `SprachbausteineService`, `ListeningService`, `WritingService`, speaking catalog/`SpeakingService`

## Commands

```
Build:              npm run build
Unit / controller:  npm test -- --testPathPattern=exam-modelltests
Integration (opt):  npm run test:integration -- --testPathPattern=exam-modelltests
Lint:               npm run lint
Dev:                npm run start:dev
```

## Project Structure

```
src/modules/centers/
  exam-modelltests.controller.ts   → list + NEW get-by-number
  exam-modelltests.service.ts      → catalogue gate + NEW content assembly
  dto/exam-modelltests.dto.ts      → response DTOs / Swagger
  exam-content.ts                  → withoutAnswerKey (reuse, do not fork)
  exam-block-content.service.ts    → reference for how exam strips keys

test/
  exam-modelltests.controller.spec.ts
  exam-modelltests.service.spec.ts
  (+ optional integration under test/ if pattern exists)

docs/
  EXAM_SIMULATOR_SPEC.md           → optional note linking this preview
  (frontend sync docs only if dashboard work starts later)

SPEC.md                            → this file (source of truth)
tasks/plan.md                      → implementation plan
tasks/todo.md                      → checkbox task list
```

## Code Style

Follow existing center exam module patterns: short English comments that explain *why*, `CenterExceptionFilter` codes, 404 over 403 for unknown resources, camelCase JSON for API DTOs.

Example (target shape of the new handler):

```typescript
@Get(':number')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Full Modelltest content for manager preview (no answer keys)',
})
getContent(
  @CurrentCenterUser() user: CenterAccessTokenPayload,
  @Param('number', ParseIntPipe) number: number,
): Promise<ExamModelltestContentDto> {
  return this.catalogue.getContent(user, number);
}
```

Reuse skill services and strip with `withoutAnswerKey(...)` — do not invent a second content pipeline.

## Testing Strategy

| Level | Where | What |
|-------|--------|------|
| Unit (service) | `test/exam-modelltests.service.spec.ts` | Slot gate; 404 missing/incomplete; sections present; answer-key fields absent |
| Unit (controller) | `test/exam-modelltests.controller.spec.ts` | Auth guard; wires `GET :number` to service |
| Strip regression | reuse / assert via `exam-content` rules | No key matching answer-key deny-list in response JSON |

Coverage expectations for this feature: happy path + `EXAM_SLOTS_REQUIRED` + not found + stripped keys for at least Lesen and Hören.

## Boundaries

**Always:**
- Use `CenterAuthGuard` and scope by `centerId` from the token.
- Apply the same exam-slot gate as `GET .../exam-modelltests`.
- Strip answers with `withoutAnswerKey` (deny-list in `exam-content.ts`).
- Return only Modelltests that are **complete** (same completeness rules as the list).
- Add/extend unit tests before considering the feature done.

**Ask first:**
- Exposing raw Hören `audio_url` to managers (recommended below — confirm if product disagrees).
- Changing `ANSWER_KEY_FIELDS`.
- Dashboard/Next.js UI work (out of scope unless requested).
- Allowing preview without exam slots.

**Never:**
- Return `correctAnswer`, `answerKey`, `transcript`, or other `ANSWER_KEY_FIELDS` to the manager.
- Reuse student JWT routes (`/api/modelltests`) for the dashboard.
- Spend or mutate exam slots when previewing.
- Serve exam-only material through student training APIs as a shortcut.

## API contract

### Existing — catalogue (unchanged)

`GET /api/centers/me/exam-modelltests`  
Auth: center Bearer  
→ `[{ "number": 1, "title": "Modelltest 1" }, ...]`  
403 `EXAM_SLOTS_REQUIRED` if no MANUAL/AI slots remaining.

### New — content preview

`GET /api/centers/me/exam-modelltests/:number`  
Auth: center Bearer  

**200** example shape:

```json
{
  "number": 2,
  "title": "Modelltest 2",
  "sections": {
    "LESEN": { },
    "SPRACHBAUSTEINE": { },
    "HOEREN": [
      {
        "part": 1,
        "audioId": "...",
        "audioUrl": "https://...",
        "playsAllowed": 1,
        "imagePath": "...",
        "contentRevision": "...",
        "questions": [{ "id": "q41", "prompt": "..." }]
      }
    ],
    "SCHREIBEN": { },
    "SPRECHEN": [ ]
  }
}
```

Notes:
- `LESEN` / `SPRACHBAUSTEINE` / `SCHREIBEN`: same builders as exam block content, then `withoutAnswerKey`.
- `HOEREN`: exam Teil shape (`audioId`, `playsAllowed`, questions, image, revision) **plus** `audioUrl` so the manager can listen without an exam attempt / play counter. Still strip `transcript`.
- `SPRECHEN`: task metadata from speaking exercises for parts 1–3 (topics/instructions as catalogued) — included even though student exam block content does not yet serve oral paper digitally.
- **404** if number unknown or Modelltest fails completeness checks used by the list.
- **403** `EXAM_SLOTS_REQUIRED` if the center has no remaining exam slots.
- **401** if not a valid center session.

### Manager flow

```
1. GET /api/centers/me/exam-modelltests          → pick number
2. GET /api/centers/me/exam-modelltests/:number  → preview content (this spec)
3. POST /api/centers/me/exam-sessions            → create sitting with that Modelltest
4. … participants / publish (existing)
```

## Architecture approaches considered

| Approach | Pros | Cons |
|----------|------|------|
| **A. Compose in `ExamModelltestsService` via skill services + `withoutAnswerKey`** (chosen) | Matches `ExamBlockContentService`; one strip function; small surface | Hören needs a manager-only `audioUrl` addition |
| B. Duplicate content queries in a new preview module | Isolation | Second pipeline drifts from training/exam |
| C. Point dashboard at student `/api/modelltests/:number` | No new code | Wrong auth; IDs only; not option B |

## Success Criteria

- [x] `GET /api/centers/me/exam-modelltests/:number` exists and is center-authenticated.
- [x] Response includes all five skill sections with real prompts/structure (option B).
- [x] Serialized JSON contains none of `ANSWER_KEY_FIELDS`.
- [x] Same slot gate as the list endpoint.
- [x] Unknown / incomplete Modelltest → 404.
- [x] Unit tests cover gate, not-found, and key stripping.
- [x] Swagger documents the new operation on the Center Exam Modelltests tag.
- [x] Content is loaded from the real `modelltests` row (by `number` + completeness) and its linked exercises.

## Open Questions

- None blocking. Optional product follow-up: whether Hören `audioUrl` should instead be a short-lived signed URL (same idea as exam play links) rather than the stored CDN URL.
