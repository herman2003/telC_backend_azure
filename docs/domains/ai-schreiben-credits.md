# Spec: AI Schreiben credits — buy, assign, spend, remove

**Status:** sold — **200 FCFA HT** / credit (ADR 0006).  
**Product enum:** `AI_SCHREIBEN_CREDIT`  
**Commercial name (FR):** Corrections Schreiben IA  

Related: Start’s free writing quota stays in
`WritingDailyQuotaService` (`FREE_WRITING_CORRECTIONS_PER_DAY = 2`). This
product only covers corrections **after** that free allowance.

Do **not** confuse with:

| Product | Role |
|---------|------|
| `AI_SPEAKING_CREDIT` | Mit Elena / oral live sessions |
| `AI_ASSISTED_LEARNING` | Block 26 — accompaniment while learning (not letter packs) |
| Exam Day AI tier | Trainer suggestions on a sitting — separate, not sold |

## Product intent

1. Manager **buys** credits into school unallocated stock.  
2. Manager **assigns** amounts to activation codes (seats).  
3. Student submits training Schreiben; after the day’s free two, each
   successful enqueue **spends one** assigned credit.  
4. Manager **removes** entitlement from a seat → unused assigned credits
   return to unallocated. Spent credits stay spent.  
5. Lapsed Start → spend **frozen**; balances kept.

## Model

Identical to AI Speaking assign-from-stock (ADR 0005 / 0006):

| Bucket | Meaning |
|--------|---------|
| Unallocated pool | Bought, not on a seat |
| Assigned remaining (`cap`) | On one activation code, not yet spent |
| Spent (`used`) | Lifetime consumed on that seat |

Invariant: `unallocated + Σ(assigned) = purchased − spent_total` (same checks
as speaking).

## Spend order (training submit)

```
guest?           → IP rate limit only (no product spend)
centre frozen?   → refuse (FROZEN)
free 2/UTC day left? → allow, no credit
seat cap >= 1?   → allow, decrement cap (+ used)
else             → writingDailyLimit (429)
```

Exam-linked attempts (`exam_attempt_id` set) never touch this product.

## Flows

### Buy

`POST /api/centers/me/entitlements/purchase`  
`{ product: "AI_SCHREIBEN_CREDIT", quantity }` → checkout → webhook  

→ `unallocated += quantity`. Optional purchase-time auto-assign mirrors
speaking (`codeIds` + `capPerCode`) once priced.

### Assign / remove

Same HTTP shape as speaking:

```
PUT    /api/centers/me/codes/{codeId}/entitlements/AI_SCHREIBEN_CREDIT
       Body: { "cap": N }   // absolute assigned remaining
DELETE /api/centers/me/codes/{codeId}/entitlements/AI_SCHREIBEN_CREDIT
```

### Student view

`GET /api/me/entitlements` gains e.g.:

```
aiSchreiben: { freeRemaining, resetsAt, creditsAvailable }
```

(`freeRemaining` = Start’s writing free quota left today, not Elena’s.)

## Errors

| Case | Code / key |
|------|------------|
| Free exhausted, assigned 0 | `writingDailyLimit` (existing) or product-specific if UX needs it |
| Centre unpaid | `FROZEN` |
| Assign more than unallocated | `NOT_ENOUGH_ENTITLEMENTS` |

## Non-goals

- Changing Prep Pass / AI Assisted Learning semantics.  
- Selling Exam Day AI via these credits.  
- Guest credit wallets.  
- Auto-refunds to card.

## Acceptance (implementation)

- [ ] Buy increases unallocated only.  
- [ ] Assign moves unallocated → seat.  
- [ ] Training submit: free 2 first, then credit, else 429.  
- [ ] Exam Day submit never decrements Schreiben credits.  
- [ ] Remove returns remaining → unallocated.  
- [ ] Freeze blocks spend; balances intact.  
- [x] Unit price 200 HT; `AI_SCHREIBEN_CREDITS_FOR_SALE = true`.  

## Open

1. Centre dashboard UI for purchase/assign (HTTP + Bruno ready).  
2. Whether `ai_usage` should record Schreiben credit spends for reporting
   (speaking does via `SPEAKING_LIVE_SESSION`; writing may reuse attempt rows).
