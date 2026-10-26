# Activation Code Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le centre fixe un niveau CEFR optionnel sur un code `ACTIVATED` ; à la rédemption ce niveau est appliqué sur l’étudiant.

**Architecture:** Colonne `level` sur `activation_codes`. `PATCH` centre pour la poser. `CodeRedemptionService` copie `code.level` → `student.level` quand non null. View/DTO exposent `level`.

**Tech Stack:** NestJS, Prisma, Jest, Bruno

## Global Constraints

- Niveau **optionnel** (`null` OK)
- PATCH level seulement sur codes `ACTIVATED`
- Reset **conserve** le niveau
- Mint/trial laissent `level` null
- Pas de changement Flutter dans ce plan
- Suivre patterns existants (`toActivationCodeView`, guards, DTOs CEFR)

---

## File map

| File | Role |
|------|------|
| `prisma/schema.prisma` | `ActivationCode.level CefrLevel?` |
| `prisma/migrations/..._activation_code_level/migration.sql` | `ADD COLUMN level` |
| `src/modules/centers/activation-code-view.ts` | Exposer `level` |
| `src/modules/centers/dto/activation-code.dto.ts` | `level` + `SetActivationCodeLevelDto` |
| `src/modules/centers/center-activation-codes.service.ts` | `setLevel()` |
| `src/modules/centers/center-activation-codes.controller.ts` | `PATCH :id` |
| `src/modules/centers/code-redemption.service.ts` | Copier level au redeem |
| `test/center-activation-codes.spec.ts` | Unit setLevel |
| `test/activation-code-view.spec.ts` | View level |
| `bruno/Center Activation Codes/05 Set level.bru` | Manuel |

---

### Task 1: Schema + migration

**Files:**
- Modify: `prisma/schema.prisma` (`ActivationCode`)
- Create: `prisma/migrations/20261017150000_activation_code_level/migration.sql`

- [ ] **Step 1: Add field to schema**

On `model ActivationCode`, after `expires_at`:

```prisma
  /// CEFR level for this seat, set by the center before handout (optional).
  /// Copied onto the student at redemption when non-null.
  level CefrLevel?
```

- [ ] **Step 2: Migration SQL**

```sql
-- AlterTable
ALTER TABLE "activation_codes" ADD COLUMN "level" "CefrLevel";
```

- [ ] **Step 3: Generate client**

Run: `npx prisma generate`  
Expected: success

- [ ] **Step 4: Verify**

Run: `npx prisma validate`  
Expected: success

---

### Task 2: View + DTO + PATCH setLevel

**Files:**
- Modify: `activation-code-view.ts`, `dto/activation-code.dto.ts`, `center-activation-codes.service.ts`, `center-activation-codes.controller.ts`
- Test: `test/activation-code-view.spec.ts`, `test/center-activation-codes.spec.ts`, `test/center-activation-codes.controller.spec.ts`

**Interfaces:**
- Produces: `setLevel(identity, id, level: CefrLevel | null): Promise<ActivationCodeView>`
- Produces: `ActivationCodeView.level: CefrLevel | null`

- [ ] **Step 1: Failing unit tests**

In `center-activation-codes.spec.ts`:
- `setLevel` updates `level` on `ACTIVATED` code owned by center
- `setLevel` with `null` clears level
- `setLevel` on `CONNECTED` throws conflict (`INVALID_CODE_TRANSITION`)
- `setLevel` on unknown/other center → NotFound

Update `codeRow()` helper to include `level: null`.

In `activation-code-view.spec.ts`: map `level` through.

- [ ] **Step 2: Run tests — expect fail**

Run: `npx jest test/center-activation-codes.spec.ts test/activation-code-view.spec.ts --no-coverage`

- [ ] **Step 3: Implement view + DTO**

`ActivationCodeView.level: CefrLevel | null`  
`ActivationCodeDto.level` optional nullable enum  
`SetActivationCodeLevelDto` with `@IsEnum(CefrLevel)` and allow `null` via `@ValidateIf` / `@IsOptional` + `@IsEnum` — use pattern:

```typescript
export class SetActivationCodeLevelDto {
  @ApiPropertyOptional({ enum: CefrLevel, nullable: true })
  @IsEnum(CefrLevel)
  @ValidateIf((_, v) => v !== null)
  @IsOptional()
  level?: CefrLevel | null;
}
```

Prefer explicit required body field that accepts null:

```typescript
@ApiProperty({ enum: CefrLevel, nullable: true })
@ValidateIf((_, v) => v !== null)
@IsEnum(CefrLevel)
level: CefrLevel | null;
```

- [ ] **Step 4: Implement `setLevel` in service**

Mirror `deactivate` ownership checks + finalized account. Only `ACTIVATED`. `updateMany` where id+center+status ACTIVATED. Return refreshed view. Log nothing new in events (level is not a status transition) — YAGNI.

- [ ] **Step 5: Controller PATCH**

```typescript
@Patch('activation-codes/:id')
@UseGuards(CenterSubscriptionGuard)
async setLevel(..., @Body() dto: SetActivationCodeLevelDto)
```

- [ ] **Step 6: Tests pass**

Run: `npx jest test/center-activation-codes.spec.ts test/center-activation-codes.controller.spec.ts test/activation-code-view.spec.ts --no-coverage`

---

### Task 3: Apply level on redeem

**Files:**
- Modify: `src/modules/centers/code-redemption.service.ts` (student.update in transaction)
- Test: existing redemption unit/integration if present; else extend unit mock test

- [ ] **Step 1: Change student.update in redeem transaction**

```typescript
await tx.student.update({
  where: { id: student.studentId },
  data: {
    center_id: code.center_id,
    ...(code.level != null ? { level: code.level } : {}),
  },
});
```

- [ ] **Step 2: Test**

Add/adjust test: when redeeming a code with `level: 'A2'`, student update includes `level: 'A2'`. When `level` null, student update has only `center_id`.

- [ ] **Step 3: Run**

Run: `npx jest test/code-redemption --no-coverage` (and any related)

---

### Task 4: Bruno + docs touch

**Files:**
- Create: `bruno/Center Activation Codes/05 Set level.bru`
- Modify: comment on `Student.level` in schema if needed (center can set via code)

- [ ] Bruno PATCH with body `{ "level": "A2" }`
- [ ] Manual note in FE doc optional — skip unless existing ACTIVATION_CODES_* doc; add one line to `docs/ACTIVATION_CODES_SUSPEND_REACTIVATE_FE.md` listing the new PATCH

---

### Checkpoint: Complete

- [ ] Schema migrated / generate OK
- [ ] Unit tests green for view, setLevel, redeem
- [ ] Code review (addy five axes)
- [ ] Ready for human

## Risks

| Risk | Mitigation |
|------|------------|
| Codes CONNECTED without level | Center uses existing student PATCH |
| Reset clearing level by mistake | Explicitly do not touch `level` in reset data |
| Student register still sends level | Overwritten on redeem when code.level set |

## Open questions (locked)

- Level obligatoire avant redeem? **Non** (this plan)
