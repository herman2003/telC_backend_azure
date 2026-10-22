# Plan: AI Speaking credits — assign-from-stock

Spec: [AI_SPEAKING_CREDITS_ASSIGN_SPEC.md](../domains/ai-speaking-credits.md)

## Goal

Change AI Speaking from **pool + per-code cap** to **unallocated pool +
per-code assigned balance**, with remove returning unused to the school.

## Current → target

| Concept today | Target |
|---------------|--------|
| `center_entitlement_pools.quantity` | **Unallocated** stock |
| `code_entitlement_caps.cap` | **Assigned** balance (rename semantics) |
| `code_entitlement_caps.used` | Keep as lifetime/spend counter for reporting **or** derive from ledger; spend decreases assigned |
| Spend: `min(pool, cap−used)` then pool−1, used+1 | Spend: assigned−1 only; unallocated unchanged |
| DELETE → cap=0 | DELETE → unallocated += assigned, assigned=0 |
| PUT `{ cap }` replaces | PUT `{ assign: n }` moves n from unallocated |

## Tasks

### 1. Decision lock (short)

- [ ] Confirm additive assign (`assign: n`) as v1.  
- [ ] Confirm error code when assigned=0 on spend.  
- [ ] Confirm migration: existing seats with `cap > used` → assigned =
  `cap − used`; pool becomes unallocated =
  `pool − Σ(assigned)` **or** keep pool as-is and set assigned =
  `min(cap−used, …)` — prefer **assigned = cap−used**, then
  `unallocated = max(0, pool − Σ(assigned))` with a one-time audit log if
  oversubscribed.

### 2. Domain / schema

- [ ] Document field rename in code comments + OpenAPI: for
  `AI_SPEAKING_CREDIT`, `cap` column means **assigned remaining** (or add
  `assigned` column and migrate). Prefer **reuse `cap` as assigned
  remaining** to avoid migration drama: after change, `used` only for
  history; spend does `cap -= 1` and optional `used += 1`, pool untouched.  
- [ ] Assign: `pool -= n`, `cap += n` (or set).  
- [ ] Remove: `pool += cap`, `cap = 0`.  
- [ ] ADR: new short ADR or amend 0002 “AI Speaking exception”.

### 3. Service changes

Files (expected):

- `entitlements.service.ts` — setCap / delete / purchase apply  
- `entitlement-spend.service.ts` — creditsAvailable + spend  
- DTOs / controller OpenAPI  
- Dashboard / me entitlements views if they expose pool vs cap

Rules:

- [ ] `setCap` → `assignCredits(codeId, n)` requiring pool ≥ n.  
- [ ] Keep or deprecate absolute `{ cap }` — if kept, redefine as “set
  assigned to X” with delta applied against pool (increase needs stock;
  decrease returns to pool). Spec default prefers `{ assign }` additive.  
- [ ] DELETE returns unused.  
- [ ] Spend: check assigned (`cap`) ≥ 1; decrement assigned; **do not**
  decrement pool.  
- [ ] Free Elena path unchanged.  
- [ ] Freeze unchanged.

### 4. Tests (TDD)

- [ ] Assign moves pool → seat.  
- [ ] Assign fails when unallocated < n.  
- [ ] Spend decreases seat only.  
- [ ] Two students cannot both spend the same unallocated unit (only their
  assigned).  
- [ ] Remove returns remaining; used not restored.  
- [ ] Freeze blocks spend.  
- [ ] Migration fixture: oversubscribed caps → audited resolution.

### 5. Docs & API contract

- [ ] Update `docs/architecture/entitlements-interface.md` AI Speaking section.  
- [ ] Supersede/point
  `docs/domains/ai-speaking-credits-unused.md` → this assign spec.  
- [ ] Swagger examples for assign / remove / dashboard.  
- [ ] Note for frontend: stop treating cap as soft limit over shared pool.

### 6. Ship

- [ ] Feature branch from `dev`.  
- [ ] Implement + tests green.  
- [ ] PR → `dev`, then promote.  
- [ ] Frontend: assign UI shows unallocated; remove confirms “return X to
  school”.

## Out of scope

- Card refunds.  
- Expiry of unused credits.  
- Changing Prep Pass / AI Assisted Learning.

## Suggested commit sequence

1. Spec + ADR note (docs only).  
2. RED tests for assign/spend/remove.  
3. GREEN service + migration helper.  
4. OpenAPI + design doc sync.
