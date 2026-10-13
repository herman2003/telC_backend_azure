# Weekly MT Full Content Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Start students can load the full weekly Modelltest (all skills, with keys) via one authenticated endpoint.

**Architecture:** Extend `ModelltestOfTheWeekController` with `GET of-the-week/content`. Service resolves weekly MT like `getOfTheWeek`, then assembles skill payloads (same builders as training / center preview) without stripping keys; Hören merges `answerKey`.

**Tech Stack:** NestJS 11, Prisma, existing skill services.

## Global Constraints

- JWT + StudentSubscriptionGuard; no PrepPassGuard on this surface.
- Guests forbidden on content.
- No durable Hören audio URLs.
- Do not change metadata `of-the-week` contract.

---

### Task 1: DTO + service assembly

**Files:**
- Modify: `src/modules/modelltests/dto/modelltest.dto.ts`
- Modify: `src/modules/modelltests/modelltests.service.ts`
- Modify: `src/modules/modelltests/modelltests.module.ts`
- Modify: `src/modules/modelltests/modelltests.service.spec.ts`

- [ ] Add `ModelltestOfTheWeekContentDto`
- [ ] Implement `getOfTheWeekContent(now, { isGuest })`
- [ ] Wire WritingModule, SpeakingModule, ListeningModule + LesenService + SprachbausteineService
- [ ] Unit tests: happy path sections; guest forbidden; uses weekly number

### Task 2: Controller route

**Files:**
- Modify: `src/modules/modelltests/modelltest-of-the-week.controller.ts`
- Modify: `src/modules/modelltests/modelltest-of-the-week.controller.spec.ts`

- [ ] `@Get('of-the-week/content')` → `getOfTheWeekContent`
- [ ] Controller tests for wiring + guest flag

### Task 3: Verify

- [ ] `npm test -- --testPathPattern=modelltest-of-the-week`
- [ ] `npm test -- --testPathPattern=modelltests.service`
