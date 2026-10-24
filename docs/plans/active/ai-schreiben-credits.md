# Plan: AI Schreiben credits (`AI_SCHREIBEN_CREDIT`)

**Status:** priced and for sale (200 HT). Bruno added. Archive when centre UI ships + PR merges.  
**Weight:** high risk (payments + AI)  
**Spec:** [../../domains/ai-schreiben-credits.md](../../domains/ai-schreiben-credits.md)  
**ADR:** [../../adr/0006-ai-schreiben-assign-from-stock.md](../../adr/0006-ai-schreiben-assign-from-stock.md)

Do **not** expose checkout in UI or billing smoke until founders set HT price.

---

## Dependency graph

```
Prisma enum + PaymentKind
    → price map + purchase/activation (same as speaking)
        → EntitlementSpendService mayUse/spend for AI_SCHREIBEN_CREDIT
            → WritingDailyQuota / submit gate (free then credit)
                → GET /api/me/entitlements + center overview
                    → Bruno + integration tests
                        → offres price line when priced
```

---

## Task 1: Schema enums

**Description:** Add `AI_SCHREIBEN_CREDIT` to `EntitlementProduct` and
`PaymentKind`. Apply via `scripts/apply-migration.mjs` against `.env.test`
only.

**Acceptance criteria:**
- [ ] Migration applied on test DB; Prisma client generates the new enum value
- [ ] Existing speaking / prep / assisted rows unchanged

**Files likely touched:** `prisma/schema.prisma`, new migration under
`prisma/migrations/`

**Estimated scope:** Small

**Dependencies:** None

---

## Task 2: Buy / assign / revoke plumbing

**Description:** Wire product into purchase price map (placeholder constant
`TBD` or a temporary test-only price behind a flag — **prefer constant with
comment “not for sale until priced”** and refuse purchase in controller if
price unset / `FOR_SALE = false`, mirroring `EXAM_AI_SLOTS_FOR_SALE`).
Extend `PaymentActivationService` assign-from-stock path (today speaking-only)
to treat Schreiben credits like speaking. `setCap` / `revoke` already product-
generic for caps.

**Acceptance criteria:**
- [ ] Purchase refused or not listed while `AI_SCHREIBEN_CREDITS_FOR_SALE`
      is false
- [ ] When sale flag true: buy → pool; PUT cap moves stock; DELETE returns unused
- [ ] Integration test mirrors speaking money journey for this product

**Files likely touched:**
- `entitlement-purchase.service.ts`
- `payment-activation.service.ts`
- `entitlements.service.ts` / controller docs
- `test/money-journey-integration.spec.ts` or sibling

**Estimated scope:** Medium

**Dependencies:** Task 1

---

## Task 3: Spend on training submit

**Description:** Extend `EntitlementSpendService` so `AI_SCHREIBEN_CREDIT`
uses the same cap decrement as speaking (no Elena free-session logic). Change
`WritingDailyQuotaService` / `WritingService.submit` to: if free 2 left →
allow; else `mayUse` + `spend` Schreiben credit; else existing 429.

**Acceptance criteria:**
- [ ] Day with 0 prior attempts: submit free (no cap change)
- [ ] Third submit same UTC day with cap ≥ 1: succeeds, cap − 1
- [ ] Third with cap 0: `writingDailyLimit`
- [ ] Exam `storeWriting` path never calls Schreiben spend
- [ ] Guest path unchanged (no spend)

**Files likely touched:**
- `entitlement-spend.service.ts`
- `writing-daily-quota.service.ts`
- `writing.service.ts`
- unit + integration specs under `test/`

**Estimated scope:** Medium

**Dependencies:** Task 2

---

## Task 4: Student + centre read models

**Description:** Surface `aiSchreiben` on `GET /api/me/entitlements` and
centre entitlement overview pools/caps. Plans catalog only if/when sold.

**Acceptance criteria:**
- [ ] Student sees freeRemaining (writing day) + creditsAvailable
- [ ] Frozen centre shows frozen flag; balances not deleted

**Files likely touched:**
- `entitlement-spend.service.ts` (`forStudent`)
- `my-entitlements.dto.ts`
- centre entitlements DTOs as needed

**Estimated scope:** Small

**Dependencies:** Task 3

---

## Task 5: Bruno + docs sync at ship

**Description:** Add Bruno requests under Center Entitlements when sale is
enabled. Update `billing-smoke.md` and `offres-lerniqo.md` price cell when
founders set HT. Archive this plan.

**Acceptance criteria:**
- [ ] Bruno path documented or marked blocked if no sale env
- [ ] Five gates exit 0
- [ ] Permanent docs match code; plan archived

**Dependencies:** Tasks 1–4 + price decision

---

## Checkpoint after Tasks 1–3

- [ ] `npx tsc --noEmit` exit 0  
- [ ] `npm run build` exit 0  
- [ ] unit + integration covering free→credit→deny  

## Out of scope

- AI Assisted Learning behaviour  
- Exam Day AI sale  
- Flutter / centre dashboard UI (separate change request once priced)  
- Guest credits  

## Skills for implement phase

`incremental-implementation` + `test-driven-development`; review with
`mattpocock-skills:code-review` before PR.
