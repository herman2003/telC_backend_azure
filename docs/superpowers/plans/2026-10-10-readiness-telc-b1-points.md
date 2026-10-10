# Readiness telc B1 points Implementation Plan

> **For agentic workers:** Execute task-by-task with TDD. Steps use checkbox syntax.

**Goal:** Official telc Deutsch B1 point weights for readiness + expose /300 fields.

**Architecture:** Pure math in `progress-formula.ts`; DTO additive fields; no DB migration.

**Tech Stack:** NestJS, Jest, existing Progress module.

## Global Constraints

- Target: telc Deutsch B1 (Zertifikat Deutsch), not B1+ Beruf.
- Keep existing % fields; add `pointsTotal` / `pointsWritten` / `pointsOral`.
- Pass: exact `pointsWritten >= 135` and `pointsOral >= 45`.
- Exam Day out of scope.

---

### Task 1: Formula + unit tests

**Files:**
- Modify: `src/modules/progress/progress-formula.ts`
- Modify: `src/modules/progress/progress-formula.spec.ts`

- [ ] RED: update readiness tests for point weights + new null fields
- [ ] GREEN: implement `SKILL_MAX_POINTS`, readiness points, ready on 135/45
- [ ] Commit

### Task 2: DTO / OpenAPI

**Files:**
- Modify: `src/modules/progress/progress.dto.ts`

- [ ] Add optional nullable point fields on `ReadinessDto`
- [ ] Update descriptions (Deutsch B1 /300)
- [ ] Commit

### Task 3: Verify service + CI slice

**Files:** none if Readiness type flows through

- [ ] Run `npm test -- --testPathPattern=progress-formula`
- [ ] Run `npm test -- --testPathPattern=progress-integration` if present
- [ ] Commit if any mapping fix needed
