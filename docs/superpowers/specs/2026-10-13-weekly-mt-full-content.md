# Spec: Weekly Modelltest full content (Start)

## Objective

Give a **Start student** (JWT + active subscription) one authenticated endpoint that returns the **entire current weekly training Modelltest** — Lesen, Sprachbausteine, Hören, Schreiben, and Sprechen — **including answer keys** where the training skill APIs already expose them (and Hören `answerKey` merged in).

**User:** registered student on Start (not center manager; not Prep-Pass-only gate).

**Success looks like:**
- `GET /api/modelltests/of-the-week/content` returns weekly metadata + all five skill sections.
- Guards: `JwtAuthGuard` + `StudentSubscriptionGuard` (no `PrepPassGuard`).
- Guests are refused (keys must not ship on demo tokens).
- Lesen / Sprachbausteine include per-item correct answers (ADR 0001).
- Hören Teile include `answerKey` maps; durable `audioUrl` is **not** embedded (training play flow stays).
- Schreiben / Sprechen use the same training builders as their skill GETs.
- Existing `GET /api/modelltests/of-the-week` stays metadata-only.

## Tech Stack

- NestJS 11 + TypeScript
- Prisma + PostgreSQL
- Auth: `JwtAuthGuard`, `StudentSubscriptionGuard`, `@CurrentStudent()`
- Skill builders: `LesenService`, `SprachbausteineService`, `ListeningService`, `WritingService`, `SpeakingService`

## Commands

```
Build:  npm run build
Test:   npm test -- --testPathPattern=modelltest-of-the-week
Lint:   npm run lint
Dev:    npm run start:dev
```

## Project Structure

```
src/modules/modelltests/
  modelltest-of-the-week.controller.ts  → add GET of-the-week/content
  modelltests.service.ts                → add getOfTheWeekContent()
  modelltests.module.ts                 → wire skill services / modules
  dto/modelltest.dto.ts                 → ModelltestOfTheWeekContentDto
  modelltest-of-the-week.controller.spec.ts
  modelltests.service.spec.ts           → content assembly + guest refuse

docs/superpowers/specs/2026-10-13-weekly-mt-full-content.md  → this file
docs/superpowers/plans/2026-10-13-weekly-mt-full-content.md
```

## Code Style

Follow existing modelltests / center preview patterns: short English *why* comments, camelCase JSON, reuse skill services — do not invent a second content pipeline. Do **not** call `withoutAnswerKey`.

## Testing Strategy

| Level | What |
|-------|------|
| Controller | Guards = JWT + StudentSubscription; no PrepPass; wires to `getOfTheWeekContent` |
| Service | Resolves weekly number; assembles five sections; guest → Forbidden; missing MT → NotFound |
| Keys | Lesen/Sprachbausteine correct fields present; Hören `answerKey` present; no durable Hören `audioUrl` |

## Boundaries

**Always:**
- Same weekly rotation as `getOfTheWeek` (training pool, guest pool only for metadata endpoint).
- Refuse `isGuest === true` on the content endpoint.
- Keep metadata `of-the-week` unchanged.

**Ask first:**
- Changing ADR 0001 / removing keys from per-skill GETs.
- Embedding durable R2 audio URLs in training payloads.

**Never:**
- Put this behind `PrepPassGuard` only (Start must reach it).
- Strip keys with `withoutAnswerKey` on this route.
- Commit secrets.

## Assumptions

1. Route: `GET /api/modelltests/of-the-week/content` (approach B).
2. Audience: Start students with JWT + subscription entitlement.
3. Guests: **403** on content (keys).
4. All five skills in one response.
5. Keys: reuse training builders; enrich Hören with `getAnswerKey` per Teil.
6. Hören: no durable `audioUrl` in this payload (play+proxy stays).
7. No new DB tables or migrations.
