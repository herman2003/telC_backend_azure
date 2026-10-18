# Content Level Gate Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag every Modelltest with a CEFR `level` and filter training access so a student only sees / opens MT matching `student.level` (Option A), including Prep Pass holders.

**Architecture:** Add `Modelltest.level`. Extend `TrainingModelltestAccessService` so level is checked before Prep Pass / weekly rules. Filter `ModelltestsService` list and of-the-week pools by the same level. Existing Lesen/Hören/SB paths that call `assertMayAccess` inherit the gate.

**Tech Stack:** NestJS, Prisma, Jest  
**Spec:** `docs/superpowers/specs/2026-10-18-content-level-gate-option-a-design.md`

## Global Constraints

- Exact match only: `modelltest.level === student.level`
- `student.level === null` → `LEVEL_REQUIRED` (no silent B1 default)
- Prep Pass must NOT skip the level check
- Backfill all existing MT to `B1`
- Guests unchanged in Phase 1
- No new A1/A2/B2 content seeds in this plan
- Writing / Speaking / Vocab / Grammar / Exam centre = out of scope (Phase 1b / 2)
- Branch from latest `origin/dev`; PR targets `dev`

---

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | `Modelltest.level` |
| `prisma/migrations/..._modelltest_level/` | ADD COLUMN + backfill B1 |
| `src/shared/services/training-modelltest-access.service.ts` | Resolve level; filter weekly; assert level |
| `src/shared/guards/prep-pass.guard.ts` | Ensure Prep Pass path still hits level (via access service) |
| `src/modules/modelltests/modelltests.service.ts` | List / detail / of-the-week filtered by level |
| DTOs modelltests (if any) | Expose `level` on catalogue items |
| `test/training-modelltest-access*.spec.ts` (+ existing modelltests specs) | Unit coverage |
| `docs/ACTIVATION_CODES_SUSPEND_REACTIVATE_FE.md` or short FE note | Client contract one-liner |

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (`model Modelltest`)
- Create: `prisma/migrations/20261018120000_modelltest_level/migration.sql`

**Acceptance criteria:**
- [ ] `Modelltest.level CefrLevel @default(B1)` exists
- [ ] Index `@@index([level, exam_only])` (or equivalent)
- [ ] SQL backfills existing rows to `B1`

- [ ] **Step 1: Add to schema**

```prisma
  /// CEFR exam this Modelltest prepares for (Option A gate).
  level CefrLevel @default(B1)

  @@index([level, exam_only])
```

- [ ] **Step 2: Migration SQL**

```sql
ALTER TABLE "modelltests" ADD COLUMN "level" "CefrLevel" NOT NULL DEFAULT 'B1';
CREATE INDEX "modelltests_level_exam_only_idx" ON "modelltests"("level", "exam_only");
```

- [ ] **Step 3:** `npx prisma generate` and `npx prisma validate`

**Verification:** schema validates; client knows `level`  
**Dependencies:** None  
**Estimated scope:** Small

---

### Task 2: Access service — level resolve + assert + weekly

**Files:**
- Modify: `src/shared/services/training-modelltest-access.service.ts`
- Test: `test/` or colocated `*.spec.ts` for this service (create if missing; else extend existing)

**Interfaces:**
- Produces: `requireStudentLevel(studentId): Promise<CefrLevel>` throws `LEVEL_REQUIRED`
- Produces: weekly / assert filtered by that level
- Prep Pass allowed still requires MT.level match

- [ ] **Step 1: Failing tests**
  - B1 student + B1 MT → assertMayAccess OK
  - A2 student + only B1 MT in DB → weekly NotFound or empty; assertMayAccess → `LEVEL_MISMATCH`
  - null level → `LEVEL_REQUIRED`
  - Prep Pass active + wrong-level MT → still `LEVEL_MISMATCH`

- [ ] **Step 2: Implement**

Pseudo:

```typescript
async requireStudentLevel(studentId: string): Promise<CefrLevel> {
  const s = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { level: true },
  });
  if (!s?.level) throw new ForbiddenException({ message: 'LEVEL_REQUIRED' });
  return s.level;
}

// weeklyModelltestNumber(studentId, now):
//   level = await requireStudentLevel(studentId)
//   rows = findMany({ where: { exam_only: false, level }, orderBy: number asc })
//   same rotation as today

// assertMayAccess(studentId, modelltestNumber, now):
//   level = await requireStudentLevel(studentId)
//   mt = findFirst({ where: { number, exam_only: false } })
//   if !mt or mt.level !== level → LEVEL_MISMATCH
//   then existing Prep Pass / weekly logic
```

Update all callers of `weeklyModelltestNumber()` that run for a signed-in student to pass `studentId` (breaking change — fix call sites in modelltests.service, grammar if any, etc.).

- [ ] **Step 3:** Fix `PrepPassGuard` so a Prep Pass holder still cannot open wrong-level MT (level checked inside `assertMayAccess` always; when Prep Pass active and request names a MT number, still call assert — or call a dedicated `assertLevelAllows` before the Prep Pass early return).

**Recommended guard change:**

```typescript
// After studentId known, before Prep Pass short-circuit:
const modelltestNumber = extractModelltestNumber(request);
if (modelltestNumber !== null) {
  await this.access.assertLevelAllows(studentId, modelltestNumber);
}
if (await this.access.isPrepPassActive(studentId)) return true;
// ... rest weekly assertMayAccess
```

Or fold level into `assertMayAccess` and **always** call it when a number is present (even if Prep Pass).

**Verification:**  
`npx jest` on access + prep-pass.guard specs  
**Dependencies:** Task 1  
**Estimated scope:** Medium

---

### Task 3: Catalogue + of-the-week filtered by level

**Files:**
- Modify: `src/modules/modelltests/modelltests.service.ts`
- Modify: DTOs if catalogue should return `level`
- Test: `test` / `modelltests.service.spec.ts`

**Acceptance criteria:**
- [ ] `list` for studentId uses `where: { exam_only: false, level: student.level }`
- [ ] of-the-week pool same filter
- [ ] A2 student with only B1 rows → empty list / clear of-the-week error

- [ ] **Step 1: Failing tests** for list + of-the-week with level
- [ ] **Step 2: Implement** filters + pass studentId into weekly helper
- [ ] **Step 3: Run** `npx jest` modelltests specs

**Dependencies:** Task 2  
**Estimated scope:** Medium

---

### Task 4: Docs + Bruno note (optional)

**Files:**
- Short addition to an existing FE doc (activation or Flutter prompt): level gate + `LEVEL_REQUIRED` / `LEVEL_MISMATCH`
- Bruno: only if a training list request already exists — document query expectations

**Dependencies:** Task 3  
**Estimated scope:** Small

---

### Checkpoint: Phase 1 complete

- [ ] Migration applied on a local/dev DB
- [ ] B1 student still trains as today
- [ ] A2 student blocked from B1 MT
- [ ] Prep Pass cannot bypass level
- [ ] Known gap documented: Writing/Speaking/Vocab/Grammar/Exam = Phase 1b
- [ ] PR to `dev`

## Risks (from spec)

| Risk | Plan mitigation |
|------|-----------------|
| Prep Pass early return | Task 2 guard change |
| Call sites of weekly without studentId | Grep + fix in Task 2–3 |
| Grammar uses weekly | Must pass studentId |

## Open (locked for Phase 1)

- Guest: no CEFR gate  
- Empty A2 catalogue: accepted  
- Content seeds: Phase 2  
