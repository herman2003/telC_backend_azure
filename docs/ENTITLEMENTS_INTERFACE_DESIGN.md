# Block 23 — the entitlement shape

**Written:** 2026-09-25
**Status:** 🛑 awaiting review. Nothing is specced or built until this is agreed.
**Serves:** Prep Pass, AI Speaking credits, AI Assisted Learning, and block 22b.

Read section 1 and section 5. The rest is detail.

---

## 1. The shape, in one picture

Two tables, because a centre buys two genuinely different things.

```
  a POOL is counted            an ASSIGNMENT is timed
  ─────────────────            ──────────────────────
  center_entitlement_pools     student_entitlements
  (center_id, product)         (student_id, product)
   balance: 40                  expires_at: 2026-12-04
```

| product | lives where | why |
|---|---|---|
| **AI Speaking credits** | pool only | your offer says the centre buys 100 credits, «utilisables par les étudiants autorisés». Students draw from the centre's pot |
| **Prep Pass** | pool → assignment | the centre buys 20, hands them out over the term. Each one becomes 60 days on a named student |
| **AI Assisted Learning** | pool → assignment | same, but the assignment is a month at a time |
| **Start's 5 free sessions** | **neither** | derived, see §4 |

One column each. No table where half the columns are null depending on what the row is.

---

## 2. Why not one table

The obvious design is a single `entitlements` table with `balance` and
`expires_at` both nullable, and a product that decides which one matters. I am
recommending against it:

- every read has to know which column is meaningful for which product, so the
  rule lives in application code instead of the schema
- a bug that writes `balance` on a Prep Pass is invisible — no constraint
  catches it
- the two are spent differently: a balance is `decrement where balance >= 1`, a
  date is `expires_at > now()`. One table would not make that one operation

The two-table split costs one extra table and buys a schema that cannot hold a
nonsense row.

---

## 3. One row per student and product, not one per purchase

Buying 100 credits twice gives **one row with 200**, not two rows.
A second Prep Pass while one is live **extends** the date; it does not open a
parallel pass.

The audit trail is already built: `payments` records who bought what, when, how
much, and which provider reference settled it. A second history in the
entitlement table would be a second thing to keep true.

```
grant credits:    balance = balance + quantity
grant a pass:     expires_at = max(now, expires_at) + 60 days
spend a credit:   UPDATE … SET balance = balance - 1
                  WHERE center_id = ? AND product = ? AND balance >= 1
```

That last one is the exam-slot pattern exactly — a conditional update, so two
students spending the last credit at the same moment cannot both win.

---

## 4. Start's 5 free sessions stay derived

Not a row. Counted the way they are counted today: `ai_usage` rows newer than
the start of the month.

```ts
quotaWindowStart(now)   // today: the start of the UTC month
```

There is no stored counter, so there is nothing to reset on a schedule and
nothing that can drift from the rows it claims to describe. It is the same
reasoning that left subscription status derived from timestamps.

**Spend order, stated once and only once:** the free five first, then credits.
A student never spends money they did not have to.

---

## 5. The endpoints

### The centre buys

```http
GET /api/centers/me/entitlements
→ { pools: [ { product: "AI_SPEAKING_CREDIT", balance: 140 },
             { product: "PREP_PASS",          balance: 6 } ],
    assigned: [ { product: "PREP_PASS", students: 14 },
                { product: "AI_ASSISTED_LEARNING", students: 9 } ] }
```

```http
POST /api/centers/me/entitlements/purchase
Idempotency-Key: <uuid>
{ "product": "PREP_PASS", "quantity": 20 }
→ 201 { id, kind, quantity, unitPriceXaf, amountXaf, status: "PENDING", createdAt }
```

Then `POST /api/payments/{id}/checkout` — **the existing flow, unchanged.**
Notch Pay and Stripe, the same idempotency rules, the same webhook. Nothing new
is invented for money.

### The centre hands one out

```http
PUT    /api/centers/me/students/{studentId}/entitlements/{product}
DELETE /api/centers/me/students/{studentId}/entitlements/{product}
GET    /api/centers/me/entitlements/{product}/students?page=1&pageSize=20&search=
```

`PUT` spends one from the pool and grants it to that student, in one
transaction — the same shape as publishing an exam sitting. Refused with
`NOT_ENOUGH_ENTITLEMENTS` when the pool is empty.

`DELETE` stops a *renewal*; it does not refund and does not cut short a pass
already paid for. A student keeps the 60 days the centre bought them.

### The student reads what they hold

```http
GET /api/me/entitlements
→ { prepPass:   { active: true,  expiresAt: "2026-12-04T00:00:00Z" },
    aiAssisted: { active: false, expiresAt: null },
    aiSpeaking: { freeRemaining: 3,
                  resetsAt: "2026-11-01T00:00:00Z",
                  creditsAvailable: 140 } }
```

One call, one shape, everything the app needs to decide what to show. No
student-facing purchase endpoint exists, and none should — see §7.

### What the rest of the backend calls

The part that actually matters, because every product goes through it:

```ts
mayUse(studentId, product): Promise<EntitlementDecision>
spend(studentId, product, quantity = 1): Promise<void>   // atomic, or throws
```

Two functions. A guard asks the first, the paid operation calls the second
after it has succeeded — never before, for the same reason the AI quota is
written after the model answers: a failure on our side must not cost a student
something they paid for.

---

## 6. Naming and error codes

```
EntitlementProduct:  PREP_PASS | AI_SPEAKING_CREDIT | AI_ASSISTED_LEARNING
PaymentKind, added:  PREP_PASS | AI_SPEAKING_CREDIT | AI_ASSISTED_LEARNING
```

Same words in both enums, deliberately: an invoice line and an entitlement row
should say the same thing.

| code | when |
|---|---|
| `NOT_ENOUGH_ENTITLEMENTS` | assigning from an empty pool |
| `ENTITLEMENT_REQUIRED` | a student reaching a feature they do not hold |
| `NO_CREDITS_REMAINING` | free allowance spent and the centre's pot is empty |
| `STUDENT_NOT_IN_CENTER` | assigning to somebody else's student — existing code, reused |

`ENTITLEMENT_REQUIRED` is deliberately distinct from `SUBSCRIPTION_INACTIVE`. A
student whose school stopped paying and a student who simply has no Prep Pass
need different sentences, and only one of them is something they can fix.

---

## 7. Decisions this locks in

| | |
|---|---|
| **The centre always pays** | `payments.center_id` stays required. No student checkout, no `student_id` on a payment. The app-store billing rules alone are a reason, and the schema is B2B2C already |
| **A pool is the centre's, an assignment is the student's** | so a credit can be drawn by whoever needs it and a pass cannot be silently moved between people |
| **Buying twice accumulates** | the purchase history lives in `payments`; the entitlement is a current balance, not a ledger |
| **The free allowance is never a row** | nothing to reset, nothing to drift |
| **Assignments survive leaving a centre** | 60 days were paid for. Releasing a student does not take them back |
| **Exam slots stay where they are** | two columns on `centers` today. Moving them into the pool table is an expand/contract migration for later, not part of this block |

---

## 8. What I need from you

**One question, and it is commercial.**

Your offer sheet says the centre buys credits «utilisables par les étudiants
autorisés» — authorised by whom?

| option | what it means | my recommendation |
|---|---|---|
| **A. Any student of the centre draws freely** | simplest. The pot empties in the order people use it | ✅ **start here** |
| **B. The centre names who may draw** | a fourth screen, an assignment table for credits, and a support call every time somebody is left off the list | later, only if a centre asks |

A is not a one-way door: adding an allow-list later is additive, and nothing
designed above prevents it.

**Two things I have assumed** — correct me now:

1. A Prep Pass is **60 days from assignment**, not from purchase. A centre that
   buys 20 in September and hands one out in November gives that student 60
   days from November. *(The alternative punishes a centre for buying early.)*
2. AI Assisted Learning renews **monthly while assigned**, and the centre is
   billed for the students assigned at the start of each month. This is the
   only recurring per-student product and it is the one I would build **last**,
   because it needs a billing cycle the other two do not.
