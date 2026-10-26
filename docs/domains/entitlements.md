# Spec: Block 23 — the entitlement foundation

**Written:** 2026-09-25
**Design:** [ENTITLEMENTS_INTERFACE_DESIGN.md](../architecture/entitlements-interface.md)
**Decision:** [ADR 0002](../adr/0002-the-centre-pays-the-code-holds.md)
**Block:** 23 (with 22b folded in) of [BUILD_BLOCKS_22_27.md](../archive/build-blocks-22-27.md)
**Status:** implemented. The marker below said "awaiting review" long after
the fact — the tables (`center_entitlement_pools`, `code_entitlement_caps`,
`code_entitlements`), the `/api/centers/me/entitlements` routes and the
entitlement integration suites are all in place.

---

## 1. Two things the design did not know

Both found while reading the code for this spec. Each changes what gets built.

### 1.1 A payment cannot carry what it was for

The purchase screen lets a manager choose **which codes** get a cap and **how
big**. Nothing may be granted until money moves, so those choices have to
survive from the purchase request to the webhook — minutes or hours later.

`payments` has no column for it. There is no metadata field anywhere in the
schema.

**Proposed:** add `payments.metadata Json?`, holding only what the webhook
needs to apply the grant:

```json
{ "codeIds": ["…", "…"], "capPerCode": 10 }
```

Re-validated at activation, never trusted: a code may have been deactivated, or
moved to another centre's… nothing, since codes cannot move between centres —
but it may have been deactivated, and a cap for a dead code is silently
dropped rather than failing the activation. **Money has already moved; a grant
that cannot be fully applied must still credit the pool.**

It also joins the fingerprint (`request_hash`), so replaying one idempotency
key with different codes is refused rather than answered from the first record.

### 1.2 "5 sessions a month" and the existing AI quota are different counters

There are two, and the offer means one of them:

| | counts | today | is this the offer's "session"? |
|---|---|---|---|
| `LiveSessionLimitService` | an **Elena conversation** | 2 per identity per 24 h, in Valkey | **yes** |
| `AiQuotaService` / `ai_usage` | a **transcript evaluation** after the fact | 2 per student per 24 h, in Postgres | no |

«5 sessions IA par mois» and «1 crédit = 1 session IA de 5 minutes» are both
Elena. So 22b replaces the *Elena* counter, not the grading one.

**Proposed:** the Elena session becomes a row, not a Valkey counter.

- add `SPEAKING_LIVE_SESSION` to the `AiOperation` enum
- write one row per granted session, in the table that already exists
- the monthly allowance is then **derived**: count rows since
  `quotaWindowStart(now)`. No stored counter, nothing to reset — the same
  reasoning as everywhere else in this codebase
- past 5, spend a credit: pool **and** cap, atomically
- **guests are untouched.** They have no `students` row, cannot be metered, and
  keep the IP cap they have today

**And the grading stops having an allowance of its own.** A student who paid
for a session must not be refused by a second counter when the transcript is
graded — that is exactly the bug fixed in phase 21, where a telc exam of three
Teile met an allowance of two. Transcript evaluation keeps the burst limit
(`checkAiEvaluationLimit`, which is about our bill) and loses
`assertWithinQuota`.

> **The unit we sell is the conversation. It is charged once, when it starts.**

---

## 2. Assumptions

1. Charging happens **when the session is granted**, not when it ends. The
   backend never learns that a browser-to-Google conversation succeeded, and
   today's Valkey counter already charges at mint. It differs from
   `recordDelivered` for grading, and that difference is deliberate.
2. A manager picks **students** on screen; the backend stores **code ids**. The
   dashboard resolves names.
3. A cap is a **ceiling on total use**, not per month. Nothing resets it; a
   manager raises it. *(A monthly-resetting cap is a different feature and
   nobody has asked for one.)*
4. Prep Pass is **30 days from assignment**, not from purchase. (60 at the
   time of writing; launch pricing cut it — `PREP_PASS_DAYS` is the source of
   truth.)
5. AI Assisted Learning is specced here as a table shape only. Its billing
   cycle is block 26.
6. Exam slots stay as they are.

→ Correct these now or the task split proceeds on them.

---

## 3. Objective

One shape three products reuse, so that blocks 24, 25 and 26 are products
rather than plumbing.

Done when a centre can buy an add-on for named seats, a verified webhook grants
it, a student can spend it, the spend is atomic, an unpaid centre freezes
rather than loses, and nothing in the design is specific to any one product.

---

## 4. The schema

```prisma
enum EntitlementProduct {
  PREP_PASS
  AI_SPEAKING_CREDIT
  AI_ASSISTED_LEARNING
}

/// What a centre bought and has not handed out. The money.
model CenterEntitlementPool {
  center_id String
  product   EntitlementProduct
  balance   Int      @default(0)
  @@id([center_id, product])
}

/// Who may draw on the pool, and how much. The permission.
/// A ceiling, not a wallet: unused allowance is never stranded on a seat.
model CodeEntitlementCap {
  code_id String
  product EntitlementProduct
  cap     Int @default(0)
  used    Int @default(0)
  @@id([code_id, product])
}

/// A period granted to one seat. Left the pool; does not come back.
model CodeEntitlement {
  code_id    String
  product    EntitlementProduct
  expires_at DateTime
  @@id([code_id, product])
}
```

Plus `payments.metadata Json?`, and three values on `PaymentKind` matching
`EntitlementProduct` name for name.

`used` sits beside `cap` rather than being counted from `ai_usage`, because a
cap is per **seat** and a seat can change hands: counting rows would charge Paul
for Marie's sessions. It is incremented in the same statement that checks it.

---

## 5. The three operations, and why each is one statement

```sql
-- grant, on the webhook
UPDATE center_entitlement_pools SET balance = balance + :quantity …

-- spend a credit: the pool and the cap together, or neither
UPDATE center_entitlement_pools SET balance = balance - 1
  WHERE center_id = :c AND product = :p AND balance >= 1;
UPDATE code_entitlement_caps SET used = used + 1
  WHERE code_id = :k AND product = :p AND used < cap;
-- both inside one transaction; either affecting 0 rows rolls the other back

-- assign a period
UPDATE code_entitlements SET expires_at = GREATEST(now(), expires_at) + 60 days
```

Conditional updates, not read-then-write. Two students spending the last credit
at the same instant: one wins. This is the exam-slot pattern, and the race it
prevents is the one review caught in block 22a.

---

## 6. The interface everything else calls

```ts
interface EntitlementDecision {
  allowed: boolean;
  reason: 'OK' | 'FROZEN' | 'NO_CAP' | 'POOL_EMPTY' | 'CAP_REACHED'
        | 'NOT_HELD' | 'NO_CODE';
  /** Free allowance left, for products that have one. */
  freeRemaining: number;
  /** Assigned remaining on this seat (ADR 0003). */
  creditsAvailable: number;
  resetsAt: Date | null;
}

mayUse(studentId, product): Promise<EntitlementDecision>
spend(studentId, product, quantity?): Promise<void>   // atomic, or throws
```

`reason` is a closed set so the app can say seven different true things. The
three that must never be confused:

| | means | the student can |
|---|---|---|
| `SUBSCRIPTION_INACTIVE` | the centre stopped paying; no learning at all | nothing |
| `FROZEN` | the centre stopped paying; credits are waiting | nothing, but nothing is lost |
| `NO_CAP` | the centre has credits and has not given this seat any | ask their centre |

## 7. The freeze

One check, reusing `StudentEntitlementService.forStudent`. A centre whose Start
has lapsed makes every code `CENTER_UNPAID`, so:

- nothing can be spent
- nothing is deleted
- `GET /api/centers/me/entitlements` returns `frozen: true` per pool, so the
  dashboard can say «Vous avez 60 crédits en attente. Réglez votre abonnement
  Start pour les utiliser.»

Paying restores exactly what was there. Credits never expire.

---

## 8. Endpoints

Full shapes are in the design doc §8. Summary:

| | |
|---|---|
| `GET /api/centers/me/entitlements` | pools, caps, assignments, `frozen` |
| `POST /api/centers/me/entitlements/purchase` | `Idempotency-Key`; `{product, quantity, capPerCode?, codeIds?}` → PENDING payment |
| `PUT /api/centers/me/codes/{codeId}/entitlements/{product}` | set a cap, or grant a period from the pool |
| `DELETE …` | cap to 0, or stop a renewal. **Never refunds, never cuts short a paid period** |
| `GET /api/centers/me/entitlements/{product}/codes` | paged, searchable — the manager's screen |
| `GET /api/me/entitlements` | one call, everything the app renders |

Checkout is unchanged: `POST /api/payments/{id}/checkout`, the existing
providers, the existing webhook.

---

## 9. What breaks, and who has to be told

**`GET /api/plans` changes shape.**

```diff
- aiSpeaking: { limit: 2, window: "per_24h" }
+ aiSpeaking: { limit: 5, window: "per_month" }
```

`window` is a public field and a client matching `per_24h` will stop
recognising it. Both frontends need telling before this merges — it goes in the
same change request as block 22a's, not a separate one.

**Elena's refusal changes for registered students.** `elenaDailyLimit` ("you
have used your 2 sessions today") becomes a monthly message, and a new one for
a student out of free sessions whose centre has credits they cannot draw on.
Guests keep the current wording.

---

## 10. Commands, structure, testing

```
Build        npm run build
Typecheck    npx tsc --noEmit -p tsconfig.json
Unit         npx jest
E2E          npm run test:e2e
Integration  npm run test:integration
Lint         npx eslint <files>
```

```
src/modules/centers/entitlements.service.ts        pools, caps, assignment
src/modules/centers/entitlements.controller.ts     the centre's routes
src/shared/services/entitlement-spend.service.ts   mayUse / spend
src/modules/me/entitlements.controller.ts          GET /api/me/entitlements
prisma/migrations/<ts>_entitlements/               generated offline
test/entitlement-*.spec.ts                         unit
test/entitlements-integration.spec.ts              real Postgres
```

**Unit** for the decision rules — frozen, no cap, cap reached, free before
credits, the seven reasons.

**Integration, against real Postgres**, for the three things a mocked Prisma
cannot prove:

1. two concurrent spends of the last credit — exactly one wins
2. pool and cap move together or not at all
3. a webhook applied twice grants once

**A boot test already exists** (`test/app-boots.spec.ts`) and will catch a
missing provider; nothing extra needed there.

### Migrations

Generated offline with `migrate diff --from-schema … --to-schema … --script`.
**Never a bare `prisma migrate`** — `.env` is production. Export `.env.test`
and refuse `ep-wandering-hall` before any migrate.

## 11. Boundaries

- **Always:** four suites green before merge; conditional updates for anything
  countable; the centre's id inside the query, never a check after the read.
- **Ask first:** any change to what `GET /api/plans` returns beyond §9; adding a
  dependency; anything that would let a student pay.
- **Never:** grant before a verified webhook; delete a paid-for balance; add a
  scheduled job to reset a counter.

## 12. Success criteria

- [ ] A centre buys 40 credits for four seats at 10 each; the pool reads 40 and
      four caps read 10 only **after** the webhook.
- [ ] A fifth student, with no cap, is refused `NO_CAP` while the pool has 40.
- [ ] A student uses their 5 free sessions, then spends credits — free first,
      always.
- [ ] Raising one cap from 10 to 12 lets that student continue; nobody else is
      affected and nothing is purchased.
- [ ] Two students spending the last credit at the same instant: one succeeds,
      the pool lands on 0, never −1.
- [ ] A lapsed centre: every spend refused `FROZEN`, balance unchanged; paying
      restores it exactly.
- [ ] A Prep Pass assigned in November expires `PREP_PASS_DAYS` later, not
      `PREP_PASS_DAYS` after the September purchase.
- [ ] The same webhook delivered twice grants once.
- [ ] `GET /api/me/entitlements` returns `creditsAvailable` as assigned
      remaining on the seat (ADR 0003).

## 13. Open questions

1. **§1.1 — `payments.metadata`.** A JSON column on payments, or a separate
   `payment_targets` table? JSON is one migration and one field; a table is
   stricter and queryable. My recommendation is **JSON**: nothing queries it,
   it is read once at activation, and it is validated on the way out anyway.
2. **§1.2 — grading loses its own allowance.** Confirm: a transcript evaluation
   after a paid session should not be refused by a separate counter. The burst
   limit stays.
3. **A cap has no time dimension.** Marie's cap of 12 is 12 sessions ever, not
   12 a month. Correct for now?
