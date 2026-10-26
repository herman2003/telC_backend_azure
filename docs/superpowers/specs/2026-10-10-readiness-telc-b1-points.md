# Spec: Readiness barème officiel telc Deutsch B1 (+ affichage /300)

## Objective

Replace the **provisional equal weights** for written skills with the **official telc Deutsch B1 / Zertifikat Deutsch** points grid, and expose estimated points **out of 300** alongside the existing percentages so students and centers see the same language as the real exam.

**Users:** student (Flutter progress) and center manager (dashboard readiness).

**Success looks like:**
- Written readiness uses Lesen 75, Sprachbausteine 30, Hören 75, Schreiben 45 (of 225 written / 300 total).
- Oral uses Sprechen 75 (of 300).
- `ready === true` only when written ≥ **135** points **and** oral ≥ **45** points (60 % of each half) — equivalent to ≥ 60 % on each part when scores are expressed as percent of that half.
- API returns both percent fields (compat) and `/300` point fields.
- Unit tests lock the official weights; the old equal-weight behaviour fails those tests.
- Flutter shows `/300` (and can keep % as secondary).

## ASSUMPTIONS (confirm before implement)

1. **Exam format = telc Deutsch B1 (Zertifikat Deutsch)**, not B1+ Beruf and not A2·B1 — even though `MyProgressDto` copy currently says “target is always telc B1+ Beruf”.
2. Skill % scores already mean “% of that skill’s max”; we convert to points with the official caps (e.g. Lesen 72 % → `0.72 * 75 = 54` points).
3. Unpractised skills still count as **0 points** inside readiness (existing option C), and skill display stays `null` when never practised.
4. **Pass decision uses exact points before rounding** (same spirit as today’s exact % compare).
5. Overall readiness `score` (0–100) remains the weighted blend of written/oral **percents of each half** (or of /300) for weeklyChange continuity — **plus** we add explicit `points` /300 fields; we do **not** remove existing % fields in this slice.
6. Flutter work is a thin display follow-up; backend can ship first with OpenAPI docs updated.
7. Exam Day scoring / marking is **out of scope** (no Schreiben/Sprechen on Exam Day per product decision).

→ Correct these now or implementation proceeds with them.

## Tech Stack

- NestJS 11 + TypeScript
- Existing pure functions in `src/modules/progress/progress-formula.ts`
- Prisma-backed `ProgressService` (no schema change expected)
- Flutter: progress UI consuming `GET /api/progress/me` (follow-up)

## Commands

```
Build:   npm run build
Test:    npm test -- --testPathPattern=progress-formula
Lint:    npm run lint
Dev:     npm run start:dev
```

## Project Structure

```
src/modules/progress/
  progress-formula.ts      → weights, readiness(), points helpers
  progress-formula.spec.ts → unit tests (TDD)
  progress.dto.ts          → ReadinessDto (+ points fields)
  progress.service.ts      → maps formula → DTO
  progress.controller.ts   → unchanged routes

docs/superpowers/specs/
  2026-10-10-readiness-telc-b1-points.md  → this file

docs/superpowers/plans/
  2026-10-10-readiness-telc-b1-points.md  → implementation plan (next)
```

## Official grid (source of truth)

| Subtest | Max points | Share of 300 |
|---------|------------|--------------|
| Lesen | 75 | 25 % |
| Sprachbausteine | 30 | 10 % |
| Hören | 75 | 25 % |
| Schreiben | 45 | 15 % |
| **Written total** | **225** | **75 %** |
| Sprechen | 75 | 25 % |
| **Grand total** | **300** | **100 %** |

Pass thresholds: **135** written + **45** oral.

## Code Style

Follow existing progress module: pure functions in `progress-formula.ts`, English “why” comments, camelCase JSON DTOs, round only for display.

Example target shape (additive fields):

```ts
export interface Readiness {
  score: number | null;       // 0–100 overall estimate (existing)
  written: number | null;     // 0–100 of written half (existing)
  oral: number | null;        // 0–100 of oral half (existing)
  ready: boolean;
  // NEW — telc points
  pointsTotal: number | null;    // 0–300
  pointsWritten: number | null;  // 0–225
  pointsOral: number | null;     // 0–75
}
```

Weights become:

```ts
export const SKILL_MAX_POINTS: Record<Skill, number> = {
  LESEN: 75,
  SPRACHBAUSTEINE: 30,
  HOEREN: 75,
  SCHREIBEN: 45,
  SPRECHEN: 75,
};
export const WRITTEN_MAX = 225;
export const ORAL_MAX = 75;
export const TOTAL_MAX = 300;
export const PASS_WRITTEN_POINTS = 135;
export const PASS_ORAL_POINTS = 45;
```

## Testing Strategy

| Level | Where | What |
|-------|--------|------|
| Unit | `progress-formula.spec.ts` | Equal weights no longer produce “ready” when only Sprachbausteine is strong; official grid: e.g. all skills 60 % → written 135, oral 45, ready true; 59.9 % written half → not ready |
| Unit | DTO / service mapping if needed | New fields present; null under `MIN_ATTEMPTS_FOR_READINESS` |
| Regression | existing progress integration | Still returns 200; weeklyChange still defined |

Coverage: happy path + not ready on weak Lesen/Hören + D=null under 5 attempts.

## Boundaries

**Always:**
- Change weights only in `progress-formula.ts`.
- Keep `PASS_MARK = 60` semantics via points thresholds (135/45).
- Add/extend unit tests before considering done.
- Preserve existing % fields for backward compatibility.

**Ask first:**
- Removing % fields or changing `weeklyChange` definition.
- Switching target copy from “B1+ Beruf” to “Deutsch B1” in DTOs/docs product-wide.
- Flutter UI copy / layout beyond showing `/300`.

**Never:**
- Silently keep equal written weights.
- Decide pass on rounded display values.
- Change Exam Day block content or scoring in this work.

## Success Criteria

- [ ] `WRITTEN_SKILL_WEIGHTS` equal weights removed / replaced by point caps.
- [ ] `ready` iff `pointsWritten >= 135 && pointsOral >= 45` (with enough attempts).
- [ ] `GET /api/progress/me` and center summary path expose `pointsTotal`, `pointsWritten`, `pointsOral` (null when readiness score is null).
- [ ] `progress-formula.spec.ts` green and encodes the official grid.
- [ ] OpenAPI / DTO descriptions mention telc Deutsch B1 /300.
- [ ] Flutter follow-up ticket or slice: display `/300` (can be same PR if capacity).

## Open Questions

1. Confirm **Deutsch B1** vs **B1+ Beruf** as the readiness target (DTO text currently says B1+ Beruf).
2. Should center `averageReadiness` stay 0–100 only, or also average `/300`?
3. Band labels (sehr gut / gut / …) out of scope for this slice — yes/no?

## Out of scope

- Coach exam-date / daily plan (things-to-do-after)
- Spaced repetition
- Schreiben A–D / Sprechen M10 feedback
- Probeprüfung / Exam Day changes
