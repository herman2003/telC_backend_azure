# ADR 0003 — AI Speaking: assign from stock

**Status:** accepted
**Date:** 2026-10-04
**Supersedes:** ADR 0002 **only for** `AI_SPEAKING_CREDIT`
**Spec:** [AI_SPEAKING_CREDITS_ASSIGN_SPEC.md](../AI_SPEAKING_CREDITS_ASSIGN_SPEC.md)

---

## Context

ADR 0002 made AI Speaking a **shared pool** with a per-seat **cap**
(permission to draw). Managers experienced “assign 10 credits” as moving stock;
the system only set a ceiling. Remove set cap to 0 and left unused units in the
pool already — but assign never reserved them, so caps could oversubscribe the
pool.

Product now wants: buy → assign real amounts → remove returns unused to school.

## Decision

For `AI_SPEAKING_CREDIT` only:

| Field | Meaning |
|-------|---------|
| `center_entitlement_pools.balance` | **Unallocated** stock |
| `code_entitlement_caps.cap` | **Assigned remaining** on that seat |
| `code_entitlement_caps.used` | Lifetime spent (reporting) |

- **Assign** (PUT): move `n` from unallocated → seat (absolute set moves a
  delta; purchase `capPerCode` increments).
- **Spend**: decrement seat `cap`, increment `used`; **do not** touch the pool.
- **Remove** (DELETE): `unallocated += cap`, `cap = 0`; used stays.
- Prep Pass / AI Assisted Learning unchanged (pool → period grant).

## Consequences

- Cap oversubscription is impossible after assign.
- `creditsAvailable` = seat `cap` (not `min(pool, cap − used)`).
- Existing rows need a one-shot migration: remaining = `cap − used`, then set
  `cap` to that remaining; reduce pool by Σ(remaining) where possible (audit
  if oversubscribed).
- Free Elena sessions unchanged (still first).

## Deploy

**Migrate then release.** Apply
`20261004120000_ai_speaking_assign_from_stock` before the new binary. New
spend decrements `cap` as remaining; old rows still store a ceiling.
