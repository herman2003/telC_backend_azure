# Activation Suspend / Reactivate / Immediate Reset Wipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let managers pause a connected student and later restore the same seat/code/data, and make reset wipe seat learning data immediately.

**Architecture:** Add `SUSPENDED` to `ActivationCodeStatus` so paused seats still count toward paid pack holding (unlike terminal `DEACTIVATED`). Deactivate becomes `CONNECTED → SUSPENDED`; new reactivate becomes `SUSPENDED → CONNECTED` with the same code value and no data touch. Reset keeps minting a new value but calls an immediate hard-delete of the seat window instead of the 7-day hide path.

**Tech Stack:** NestJS, Prisma/PostgreSQL, existing Jest unit + integration suites, `SeatErasureService` / `hideSeatData`.

**Spec:** `docs/superpowers/specs/2026-10-05-activation-suspend-reactivate-design.md`

## Global Constraints

- Do not remint or change seat `quantity` on suspend/reactivate/reset.
- `SUSPENDED` must count as held for payment mint (`status not DEACTIVATED` already works if we never use `DEACTIVATED` for pause).
- Same code string on reactivate; never put a known value back via an “activate” of a terminal row.
- Reset deletes seat-window attempts/activities in the same transaction as the status change; no 7-day restore for that path.
- Preserve D39 reset limits (`code-reset-allowance.ts`).
- Center routes stay behind `CenterAuthGuard` + `CenterSubscriptionGuard` where reset/deactivate already are.
- Respond to managers with existing DTO shape plus new status value `suspended`.

## File map

| File | Responsibility |
|------|----------------|
| `prisma/schema.prisma` | Add `SUSPENDED` to enum |
| New migration under `prisma/migrations/` | Alter enum in Postgres |
| `src/modules/centers/center-activation-codes.service.ts` | Deactivate→suspend, reactivate, reset wipe |
| `src/modules/centers/center-activation-codes.controller.ts` | New reactivate route; docs |
| `src/modules/centers/activation-code-view.ts` | Map `SUSPENDED` → `suspended` |
| `src/modules/centers/dto/activation-code.dto.ts` | Enum + filter values |
| `src/modules/student-activity/seat-erasure.ts` | `eraseSeatDataNow` (immediate delete) |
| `src/shared/services/student-entitlement.service.ts` | Access reason for suspended |
| `src/modules/centers/code-redemption.service.ts` | Redeem behaviour for suspended |
| Tests under `test/` | Unit + integration coverage |
| `docs/CENTER_FRONTEND_SYNC_DECISIONS.md` | Patch D18/D39 notes (short) |

---

### Task 1: Schema — add `SUSPENDED`

**Files:**
- Modify: `prisma/schema.prisma` (`ActivationCodeStatus`)
- Create: `prisma/migrations/<timestamp>_add_suspended_status/migration.sql` (via project’s offline migrate-diff flow; never bare `prisma migrate` against prod `.env`)

**Interfaces:**
- Produces: Prisma enum value `ActivationCodeStatus.SUSPENDED`

- [ ] **Step 1: Update schema enum**

```prisma
enum ActivationCodeStatus {
  ACTIVATED
  CONNECTED
  SUSPENDED
  DEACTIVATED
}
```

- [ ] **Step 2: Generate / write migration SQL**

```sql
ALTER TYPE "ActivationCodeStatus" ADD VALUE 'SUSPENDED';
```

(Postgres: add enum value; place carefully relative to deploy process in `scripts/apply-migration.mjs`.)

- [ ] **Step 3: Apply migration in local/dev DB and regenerate client**

Run (project conventions):
```bash
node scripts/apply-migration.mjs
npx prisma generate
```

Expected: client exposes `SUSPENDED`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(codes): add SUSPENDED activation code status"
```

---

### Task 2: View + DTO — expose `suspended`

**Files:**
- Modify: `src/modules/centers/activation-code-view.ts`
- Modify: `src/modules/centers/dto/activation-code.dto.ts`
- Test: `test/center-activation-codes.controller.spec.ts` (status mapping if asserted)

**Interfaces:**
- Produces: wire status `'suspended'`; list filter `'suspended'`

- [ ] **Step 1: Write failing assertion** that list/view accepts `SUSPENDED` → `suspended`

In the view mapper test or controller spec, expect:

```ts
expect(toActivationCodeView({ ...row, status: 'SUSPENDED' }).status).toBe(
  'suspended',
);
```

- [ ] **Step 2: Implement mapper + DTO enums**

`activation-code-view.ts`:
```ts
SUSPENDED: 'suspended',
```

`activation-code.dto.ts`: extend `status` unions and `@IsIn` / `@ApiProperty` enums with `'suspended'`.

List filter `STATUS_FILTER` in service (Task 3) must include `suspended: ActivationCodeStatus.SUSPENDED`.

- [ ] **Step 3: Run targeted tests**

```bash
npx jest test/center-activation-codes.controller.spec.ts --no-cache
```

Expected: PASS for mapping; may still fail later routes until Task 3–4.

- [ ] **Step 4: Commit**

```bash
git add src/modules/centers/activation-code-view.ts src/modules/centers/dto/activation-code.dto.ts
git commit -m "feat(codes): expose suspended status on activation code API"
```

---

### Task 3: Deactivate becomes suspend (`CONNECTED` → `SUSPENDED`)

**Files:**
- Modify: `src/modules/centers/center-activation-codes.service.ts` (`DEACTIVATE` transition + `move` student unlink)
- Test: `test/center-activation-codes.spec.ts`

**Interfaces:**
- Consumes: `ActivationCodeStatus.SUSPENDED`
- Produces: `deactivate(identity, codeId)` → view with `status: 'suspended'`, `student_id` **retained** on row

- [ ] **Step 1: Write failing tests**

```ts
it('deactivates a connected code into suspended and keeps student_id', async () => {
  // arrange connected code with student_id + linked fields
  const view = await service.deactivate(identity, codeId);
  expect(view.status).toBe('suspended');
  const row = await prisma.activationCode.findUniqueOrThrow({ where: { id: codeId } });
  expect(row.status).toBe('SUSPENDED');
  expect(row.student_id).toBe(studentId);
  expect(row.linked_name).toBeTruthy();
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  expect(student.center_id).toBeNull();
});

it('refuses deactivate from activated with INVALID_CODE_TRANSITION', async () => {
  await expect(service.deactivate(identity, activatedOnlyId)).rejects.toMatchObject({
    response: expect.objectContaining({ message: 'INVALID_CODE_TRANSITION' }),
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest test/center-activation-codes.spec.ts -t "deactivates a connected" --no-cache
```

- [ ] **Step 3: Change `DEACTIVATE` transition**

```ts
const DEACTIVATE: Transition = {
  from: [ActivationCodeStatus.CONNECTED],
  to: ActivationCodeStatus.SUSPENDED,
  alsoWrite: {}, // keep student_id / linked_* / connected_at
};
```

In `move`, when transitioning **to `SUSPENDED`** (and previously for `DEACTIVATED`), clear `student.center_id` when `current.student_id` is set:

```ts
if (
  (transition.to === ActivationCodeStatus.SUSPENDED ||
    transition.to === ActivationCodeStatus.DEACTIVATED) &&
  current.student_id
) {
  await tx.student.updateMany({
    where: { id: current.student_id, center_id: identity.centerId },
    data: { center_id: null },
  });
}
```

Update `STATUS_FILTER` and list types for `suspended`.

Update controller Swagger text: pause access; progress kept; reactivate later.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest test/center-activation-codes.spec.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/centers/center-activation-codes.service.ts src/modules/centers/center-activation-codes.controller.ts test/center-activation-codes.spec.ts
git commit -m "feat(codes): deactivate pauses connected seats as SUSPENDED"
```

---

### Task 4: Reactivate endpoint

**Files:**
- Modify: `src/modules/centers/center-activation-codes.service.ts` — add `reactivate`
- Modify: `src/modules/centers/center-activation-codes.controller.ts` — `POST activation-codes/:id/reactivate`
- Test: `test/center-activation-codes.spec.ts`, `test/center-activation-codes.controller.spec.ts`

**Interfaces:**
- Produces: `reactivate(identity, codeId): Promise<ActivationCodeView>`
- Route: `POST /api/centers/me/activation-codes/:id/reactivate`

- [ ] **Step 1: Write failing service tests**

```ts
it('reactivates a suspended code to connected and restores center_id', async () => {
  const view = await service.reactivate(identity, suspendedCodeId);
  expect(view.status).toBe('connected');
  const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId } });
  expect(student.center_id).toBe(identity.centerId);
  const row = await prisma.activationCode.findUniqueOrThrow({ where: { id: suspendedCodeId } });
  expect(row.code).toBe(originalCodeValue); // unchanged
});

it('refuses reactivate when not suspended', async () => {
  await expect(service.reactivate(identity, connectedId)).rejects.toMatchObject({
    response: expect.objectContaining({ message: 'INVALID_CODE_TRANSITION' }),
  });
});
```

Also: student already holding another center → conflict (mirror redemption `STUDENT_ALREADY_ACTIVE` rules as applicable).

- [ ] **Step 2: Run — expect FAIL (method missing)**

- [ ] **Step 3: Implement `reactivate`**

Reuse `move` with:

```ts
const REACTIVATE: Transition = {
  from: [ActivationCodeStatus.SUSPENDED],
  to: ActivationCodeStatus.CONNECTED,
  alsoWrite: {},
};
```

After successful status update, restore membership:

```ts
if (
  transition.to === ActivationCodeStatus.CONNECTED &&
  current.student_id
) {
  await tx.student.updateMany({
    where: { id: current.student_id, center_id: null },
    data: { center_id: identity.centerId },
  });
}
```

Guard: if `!current.student_id` on suspended row → `ConflictException('CODE_HAS_NO_STUDENT')`.

Controller:

```ts
@Post('activation-codes/:id/reactivate')
@HttpCode(HttpStatus.OK)
@UseGuards(CenterSubscriptionGuard)
@ApiOperation({
  summary: 'Resume a paused student on the same code',
  description:
    'From `suspended` to `connected`. Same code value. Learning data was never removed. Restores the student to this center.',
})
async reactivate(...) {
  return this.codes.reactivate(centerUser, id);
}
```

- [ ] **Step 4: Controller spec** — auth + subscription guard same as deactivate/reset.

- [ ] **Step 5: Run tests**

```bash
npx jest test/center-activation-codes.spec.ts test/center-activation-codes.controller.spec.ts --no-cache
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/centers/center-activation-codes.service.ts src/modules/centers/center-activation-codes.controller.ts test/center-activation-codes.spec.ts test/center-activation-codes.controller.spec.ts
git commit -m "feat(codes): add reactivate for suspended activation codes"
```

---

### Task 5: Access + redeem for `SUSPENDED`

**Files:**
- Modify: `src/shared/services/student-entitlement.service.ts`
- Modify: `src/modules/centers/code-redemption.service.ts`
- Test: existing entitlement / redemption specs (extend)

**Interfaces:**
- Produces: denial reason `'CODE_SUSPENDED'`; redeem throws `CODE_SUSPENDED`

- [ ] **Step 1: Failing tests** — suspended student’s learning check returns `CODE_SUSPENDED`; redeem of that code value → `409 CODE_SUSPENDED`.

- [ ] **Step 2: Implement**

In entitlement reason resolution, treat `SUSPENDED` like a blocked code:

```ts
if (row.last_code_status === 'SUSPENDED') {
  return 'CODE_SUSPENDED';
}
```

In `code-redemption.service.ts`, after load:

```ts
if (code.status === ActivationCodeStatus.SUSPENDED) {
  throw new ConflictException('CODE_SUSPENDED');
}
```

Order: keep `DEACTIVATED` check; add `SUSPENDED` before success path.

- [ ] **Step 3: Run redemption + entitlement tests**

```bash
npx jest test/code-redemption-integration.spec.ts test/center-activation-codes.spec.ts --no-cache
```

(Adjust exact filenames to those present.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/student-entitlement.service.ts src/modules/centers/code-redemption.service.ts test
git commit -m "feat(codes): block learn/redeem while code is suspended"
```

---

### Task 6: Immediate wipe on reset

**Files:**
- Modify: `src/modules/student-activity/seat-erasure.ts` — add `eraseSeatDataNow`
- Modify: `src/modules/centers/center-activation-codes.service.ts` — call it instead of `hideSeatData`
- Modify: `src/modules/centers/center-activation-codes.service.ts` `seatWindowOf` — treat `SUSPENDED` like connected-for-window end (use now as until when leaving via reset)
- Test: `test/seat-erasure-integration.spec.ts`, `test/center-activation-codes.spec.ts`

**Interfaces:**
- Produces: `eraseSeatDataNow(tx, input, now): Promise<string>` — deletes attempts/activities in-window; records `DataErasure` with `erased_at = now` (no restore)

- [ ] **Step 1: Write failing integration test**

```ts
it('reset permanently deletes seat attempts in the same transaction', async () => {
  // student has listeningAttempt in window
  await service.reset(identity, codeId);
  const left = await prisma.listeningAttempt.count({
    where: { student_id: studentId, erasure_id: null },
  });
  expect(left).toBe(0);
  const erasure = await prisma.dataErasure.findFirst({
    where: { code_id: codeId },
    orderBy: { created_at: 'desc' },
  });
  expect(erasure?.erased_at).not.toBeNull();
});
```

- [ ] **Step 2: Implement `eraseSeatDataNow`**

Reuse the same window selection as `hideSeatData`, but:

1. Create `dataErasure` with `erase_after: now`, `erased_at: now`.
2. **Delete** matching attempts/activities (same tables as `purgeDue`), do not leave stamped rows.

```ts
export async function eraseSeatDataNow(
  tx: Prisma.TransactionClient,
  input: SeatErasureInput,
  now = new Date(),
): Promise<string> {
  const erasure = await tx.dataErasure.create({
    data: {
      student_id: input.studentId,
      center_id: input.centerId,
      code_id: input.codeId,
      center_user_id: input.centerUserId,
      since: input.since,
      until: input.until ?? now,
      erase_after: now,
      erased_at: now,
    },
  });
  const window = {
    student_id: input.studentId,
    erasure_id: null,
    created_at: {
      gte: input.since,
      ...(input.until ? { lte: input.until } : {}),
    },
  };
  // deleteMany on listening/sprachbausteine/writing/lesen/speaking attempts
  // delete student_activities tied to those attempts (same raw SQL pattern as hide, but DELETE)
  return erasure.id;
}
```

Wire `resetOnce` to call `eraseSeatDataNow` instead of `hideSeatData`.

Update `seatWindowOf` so `SUSPENDED` with `student_id` + `connected_at` returns a closed window ending at reset time (caller passes `until: now` via null-until semantics already used for connected — for suspended, treat like “left”: use `now` as until inside erase call).

Simplest approach in `resetOnce`:

```ts
const seatWindow = seatWindowOf(current, history);
// ...
if (seatWindow) {
  await eraseSeatDataNow(
    tx,
    {
      ...seatWindowFields,
      until:
        current.status === ActivationCodeStatus.CONNECTED ||
        current.status === ActivationCodeStatus.SUSPENDED
          ? now
          : seatWindow.until,
    },
    now,
  );
}
```

Remove obsolete comment “erase not here yet”.

Update controller Swagger: progress deleted **immediately**; no 7-day window.

- [ ] **Step 3: Update seat-erasure tests** that expected hide-then-purge for reset; point them at immediate delete. Keep `purgeDue` for any legacy hidden rows.

- [ ] **Step 4: Run**

```bash
npx jest test/seat-erasure-integration.spec.ts test/center-activation-codes.spec.ts --no-cache
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/student-activity/seat-erasure.ts src/modules/centers/center-activation-codes.service.ts src/modules/centers/center-activation-codes.controller.ts test
git commit -m "feat(codes): wipe seat learning data immediately on reset"
```

---

### Task 7: Payment / remove-student / shrink consistency check

**Files:**
- Read/verify: `src/modules/centers/payment-activation.service.ts` (mint counts `not DEACTIVATED` — `SUSPENDED` held ✓)
- Verify: `center-students.service.ts` `remove` still sets **`DEACTIVATED`** (terminal, not suspend)
- Test: extend `test/payment-activation-integration.spec.ts` — suspended code counts toward holding so renewing same quantity mints 0 extra

- [ ] **Step 1: Integration assertion**

```ts
// 10 seats, 1 SUSPENDED + 9 ACTIVATED → holding 10 → mint 0 on renew
```

- [ ] **Step 2: Fix only if mint formula wrongly excludes SUSPENDED** (it should not if filter is `not DEACTIVATED`).

- [ ] **Step 3: Confirm remove-student path remains `DEACTIVATED` + no reactivate.**

- [ ] **Step 4: Commit if any test/code changes**

```bash
git commit -m "test(codes): suspended seats still count toward paid holding"
```

---

### Task 8: Docs + Bruno for frontend

**Files:**
- Modify: `docs/CENTER_FRONTEND_SYNC_DECISIONS.md` — short D18/D39 amendment pointing at the new spec
- Create Bruno: `bruno/Center Activation Codes/01 List.bru`, `02 Deactivate.bru`, `03 Reactivate.bru`, `04 Reset.bru` (or under existing folder)
- Mark legacy `bruno/Center Students/05|06` activation-key stubs as deprecated in their `docs` block

- [ ] **Step 1: Write FE-facing amendment** (status table + three endpoints + errors `CODE_SUSPENDED`, `CODE_HAS_NO_STUDENT`).

- [ ] **Step 2: Add Bruno requests** matching controller paths.

- [ ] **Step 3: Commit**

```bash
git add docs bruno
git commit -m "docs(codes): document suspend, reactivate, and immediate reset wipe"
```

---

### Task 9: Full verification

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: exit 0

- [ ] **Step 2: Unit + integration**

```bash
npx jest
npm run test:integration
```

Expected: green (or only pre-existing failures unrelated to this change — do not ignore new failures in codes/erasure/payments).

- [ ] **Step 3: Manual smoke checklist**

1. Connect student → deactivate → student denied learn (`CODE_SUSPENDED`) → reactivate → learn works, attempts still present.  
2. Connect student with attempts → reset → attempts gone immediately; new code `activated`.  
3. Suspend one of N seats → pay renew same N → no extra code minted.

---

## Self-review

| Spec requirement | Task |
|------------------|------|
| Pause keeps data + same code | Task 3 |
| Reactivate restores same student | Task 4 |
| Suspended blocks learn/redeem | Task 5 |
| Reset deletes data immediately | Task 6 |
| Paid holding unchanged on suspend | Task 7 |
| FE/docs clarity | Task 8 |

No TBD placeholders. `SUSPENDED` chosen so mint maths stay correct without rewriting payment activation.
