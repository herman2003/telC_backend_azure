# Spec: AI Speaking credits — buy, assign, remove (new logic)

## Status

Proposed — replaces the **cap-as-permission** spend model for
`AI_SPEAKING_CREDIT` with **assign-from-stock / remove-returns-unused**.

Related: unused-credits policy is **part of this flow**, not a separate product.
Supersedes ADR 0002 **only for AI Speaking credits** (Prep Pass / AI Assisted
Learning stay pool → period grants).

## Product intent

1. Manager **buys** credits into the school stock.  
2. Manager **assigns** N credits to student A, M to student B, …  
3. Students spend from **what was assigned to them**.  
4. Manager **removes** a student → **unused** assigned credits go **back to
   school stock** (not deleted, not auto-refunded to card).  
5. Already used credits are never taken back.

## Why change

Today (`cap`):

- Buy 40 → pool 40.  
- Cap Marie 10 → pool still 40 (caps can oversubscribe the pool).  
- “Assign 10” does not move stock; “remove” only sets cap 0.

Desired:

- Buy 40 → unallocated **40**.  
- Assign Marie 10 → unallocated **30**, Marie **holds 10**.  
- Marie uses 6 → Marie holds **4**.  
- Remove Marie → unallocated **34** (her 4 return); used 6 stay spent.

## Model

| Bucket | Meaning |
|--------|---------|
| **Unallocated pool** | Credits bought and not currently assigned to a seat |
| **Assigned balance** | Credits on one activation code (seat), not yet spent |
| **Spent** | Already consumed by successful AI speaking sessions |

Invariant (always):

`unallocated + sum(assigned balances) + accounting of spent since purchase`
must stay consistent with money taken in. Practically enforce:

`unallocated + Σ(assigned) = purchased − spent_total`  
(or equivalent ledger checks in tests).

**Free monthly Elena sessions** stay first and do **not** touch assigned
balances (unchanged).

## Flows

### Buy

`POST /api/centers/me/entitlements/purchase`  
`{ product: "AI_SPEAKING_CREDIT", quantity }` → checkout → webhook  

→ **unallocated += quantity**. No student gets credits until assign.

Optional `codeIds` + amounts at purchase time may auto-assign after pay
(same semantics as assign).

### Assign

Manager chooses a seat (activation code) and amount `n > 0`.

- Require `unallocated >= n`.  
- `unallocated -= n`.  
- That seat’s `assigned += n` (additive assign; or “set total assigned” — see
  open question; **default: additive** so “give 5 more” is natural).  
- Does not spend; does not start a session.

API shape (target):

```
PUT /api/centers/me/codes/{codeId}/entitlements/AI_SPEAKING_CREDIT
Body: { "assign": 10 }          // add 10 from unallocated
// or { "assigned": 10 }        // if product chooses set-absolute later
```

(Exact DTO chosen in implementation; must not keep silent “cap replaces” if
that would break the new invariant.)

### Spend (student)

After free allowance is exhausted:

- Require seat `assigned >= 1` and center not frozen.  
- On success: `assigned -= 1` (spent).  
- Unallocated unchanged.

### Remove

```
DELETE /api/centers/me/codes/{codeId}/entitlements/AI_SPEAKING_CREDIT
```

- `unallocated += assigned` (return unused).  
- `assigned = 0`.  
- Spent history stays spent.  
- No payment refund.

Partial remove (optional v1.1): return `k` unused where `k <= assigned`.

### Unused policy (inside this flow)

| Situation | Rule |
|-----------|------|
| Assigned but not used | Stay on the seat until spent or removed |
| Removed / student stopped | Unused → **unallocated** school stock |
| Short expiry | **None** in v1 |
| Lapsed Start | **Freeze** spend; keep unallocated + assigned |
| Refund to card | Manual support only, not self-serve |

## Non-goals

- Changing Prep Pass / AI Assisted Learning (still grant period from pool).  
- Auto-refunds.  
- Letting sum of “wishful caps” exceed stock (old oversubscribe behavior).

## Errors (target)

| Case | Error |
|------|--------|
| Assign more than unallocated | `NOT_ENOUGH_ENTITLEMENTS` |
| Spend with assigned 0 (and no free left) | `POOL_EMPTY` or `NOT_ASSIGNED` (pick one code, document) |
| Center lapsed | `FROZEN` |
| No seat | `NO_CODE` |

## Acceptance

- [ ] Buy increases unallocated only.  
- [ ] Assign moves unallocated → seat assigned.  
- [ ] Spend decreases seat assigned only.  
- [ ] Remove returns remaining assigned → unallocated.  
- [ ] Freeze blocks spend; balances intact.  
- [ ] Dashboard can show: unallocated, per-student assigned, used.  
- [ ] Migration path from existing `cap`/`used`/`pool` rows defined in plan.

## Open questions

1. Assign **additive** (`+10`) vs **set absolute** (`assigned = 10`)?  
   **Recommend additive** for “give more”; absolute can be a second endpoint.  
2. Rename student-facing `creditsAvailable` to mean assigned remaining only
   (yes — it becomes the seat balance, not min(pool, cap−used)).

## References

- Current impl: `entitlements.service.ts`, `entitlement-spend.service.ts`  
- ADR 0002 (to supersede for credits only)  
- `docs/architecture/entitlements-interface.md`
