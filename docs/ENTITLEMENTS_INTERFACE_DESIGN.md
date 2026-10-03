# Block 23 — the entitlement shape

**Written:** 2026-09-25
**Status:** agreed with the founder. Next: the ADR, then the spec.
**Serves:** Prep Pass, AI Speaking credits, AI Assisted Learning, and block 22b.

Read §1 and §2. The rest is detail.

---

## 0. The three rules everything below obeys

| | |
|---|---|
| **Start is the door** | An add-on only works behind a paid Start subscription. A centre that stops paying loses its add-ons too — it does not lose what it bought |
| **The centre always pays** | No student checkout. `payments.center_id` stays required |
| **A centre's students are its codes** | Verified in the code, not assumed. See §6 |

---

## 1. The shape, in one picture

```
  a POOL is counted              a CAP is permission        an ASSIGNMENT is timed
  ───────────────────            ───────────────────        ──────────────────────
  center_entitlement_pools       code_entitlement_caps      code_entitlements
  (center_id, product)           (code_id, product)         (code_id, product)
   balance: 40                    cap: 10, used: 6           expires_at: 2026-12-04
```

| product | how it is held | why |
|---|---|---|
| **AI Speaking credits** | pool + cap | the pot is the money, the cap is who may draw on it |
| **Prep Pass** | pool → assignment | bought in bulk, handed out as 60 days on one seat |
| **AI Assisted Learning** | pool → assignment | same, a month at a time |
| **Start's 5 free sessions** | **nothing stored** | derived, see §5 |

---

## 2. The pool and the cap, worked through

**Centre Douala.** 10 students, 10 codes, Start paid. AI Speaking for four of them.

### The purchase

```
Add-on:    AI Speaking
Seats:     Marie, Paul, Awa, Jean      (the manager picks people; we store codes)
Credits:   40                          →  12 000 FCFA
```

### What the webhook writes

```
POOL                         CAPS
ai_speaking_credits: 40      Marie's code 10   Paul's 10   Awa's 10   Jean's 10
                             every other code: 0
```

**The pool is the money. The cap is the permission.** A session takes one from
each.

### Week 1

| | Marie | Paul | Awa | Jean | pool |
|---|---|---|---|---|---|
| start | 0/10 | 0/10 | 0/10 | 0/10 | 40 |
| Marie × 6 | **6/10** | 0/10 | 0/10 | 0/10 | **34** |
| Paul × 2 | 6/10 | **2/10** | 0/10 | 0/10 | **32** |

### Week 2 — the case that decides the design

Marie has used her 10 and needs 2 more before Friday.

**If credits were wallets** — 40 split into four purses:

```
Marie: 0 left → REFUSED
Paul 8 unused, Awa 10, Jean 9 → 27 credits exist and cannot reach her
The centre buys more while holding 27 it cannot use. It will call us.
```

**With pool + cap:**

```
The manager changes Marie's cap from 10 to 12. One number.
Pool 22 → Marie runs 2 → pool 20. Nothing bought, nothing stranded.
```

### End of month

```
POOL: 20        CAPS: Marie 12/12, Paul 3/10, Awa 0/10, Jean 5/10
```

The 20 stay. Next month the manager points the caps at five different
candidates without buying anything, because the credits were never locked to a
person.

### Why a cap, not a wallet

| | wallet | cap |
|---|---|---|
| what it is | money moved onto a person | a ceiling on a shared pot |
| a student needs 2 more | buy again, or move money | change one number |
| unused credit | stranded on whoever did not use it | already back in the pot |
| **cap 0** | — | **this is "authorised"**: nobody spends by default |

---

## 3. Why the cap sits on the code, not on the student

Three facts from the existing code, not from preference:

1. **A code exists before any student.** `status: ACTIVATED, student_id: null`,
   created when a payment succeeds. So a centre can buy an add-on for a seat it
   has not handed out yet, and there is a real row to attach it to.
2. **A seat rotates.** Deactivating a code releases the student
   ([center-activation-codes.service.ts:265](src/modules/centers/center-activation-codes.service.ts#L265));
   the code can go to somebody else. The add-on should follow the seat, because
   the seat is what the centre bought — not Marie personally.
3. **One student holds at most one connected code** — a partial unique index
   from migration `20260918200000`. So "cap per code" and "cap per student" are
   the same number whenever somebody holds it. No ambiguity to resolve.

A manager still thinks in students. The dashboard shows names. The row says
`code_id`.

---

## 4. Two tables would have been one, and why they are not

The obvious design is a single `entitlements` table with a nullable `balance`
and a nullable `expires_at`, and a product that decides which one matters.
Rejected:

- the rule about which column is meaningful would live in application code
  rather than in the schema
- a row that carries the wrong one is invisible — no constraint catches it
- they are spent by different statements: a balance is
  `decrement … WHERE balance >= 1`, a date is `expires_at > now()`

Three tables, one column each, and no row can be nonsense.

### One row per code and product, not one per purchase

Buying 100 credits twice gives **one pool row with 200**. A second Prep Pass on
a live one **extends** the date.

The history already exists: `payments` records who bought what, when, for how
much, and which provider reference settled it. A second ledger in the
entitlement tables would be a second thing to keep true.

```sql
grant credits:  balance = balance + quantity
grant a pass:   expires_at = max(now, expires_at) + 60 days
spend a credit: UPDATE … SET balance = balance - 1
                WHERE center_id = ? AND product = ? AND balance >= 1
```

That last one is the exam-slot pattern exactly — a conditional update, so two
students spending the last credit at the same instant cannot both win.

---

## 5. Start's 5 free sessions stay derived

Not a row. Counted as they are counted today: `ai_usage` rows newer than the
start of the month, behind one function.

```ts
quotaWindowStart(now)   // today: the start of the UTC month
```

No stored counter means nothing to reset on a schedule and nothing that can
drift from the rows it describes — the same reasoning that leaves subscription
status derived from timestamps.

**Spend order, stated once:** the free five first, then credits. A student
never spends money they did not have to.

---

## 6. A centre's students are exactly its connected codes

Verified rather than assumed, because the whole "who may hold an add-on"
question rests on it:

- a student's `center_id` is set in **one** place — redeeming a code
  ([code-redemption.service.ts:193](src/modules/centers/code-redemption.service.ts#L193)),
  in the same transaction that flips the code to `CONNECTED`
- deactivating a code clears `center_id`; removing a student from the roster
  deactivates their code. Both transactional, so the two cannot disagree
- the centre's roster query is literally `where: { center_id: centerId }`

So 25 codes means 25 students **in Lerniqo**. People in the classroom without a
code are not in the system at all — there is nothing to assign to them, which
is the correct answer rather than a limitation.

---

## 7. Freezing, which is the same rule as Start being the door

When a centre stops paying, every code reads `CENTER_UNPAID` through
`StudentEntitlementService`. Nothing needs a second mechanism:

```
March, unpaid:  60 credits still in the pool, nobody can spend one
April, paid:    the same 60 are spendable again
```

Credits are **never** deleted. They were paid for.

**And show it.** The dashboard says «Vous avez 60 crédits en attente. Réglez
votre abonnement Start pour les utiliser.» That is 18 000 FCFA of the centre's
own money arguing for them to come back.

Credits **never expire**.

---

## 8. The endpoints

### The centre buys

```http
GET /api/centers/me/entitlements
→ { pools:  [ { product: "AI_SPEAKING_CREDIT", balance: 140, frozen: false },
              { product: "PREP_PASS",          balance: 6,   frozen: false } ],
    caps:   [ { codeId, code: "LQ-4F2A-9C31", holder: "Marie Ngono",
                product: "AI_SPEAKING_CREDIT", cap: 12, used: 12 } ],
    assigned: [ { product: "PREP_PASS", seats: 14 } ] }
```

`frozen: true` when Start is unpaid — one flag, so the dashboard can explain
itself without re-deriving the subscription rule.

```http
POST /api/centers/me/entitlements/purchase
Idempotency-Key: <uuid>
{ "product": "AI_SPEAKING_CREDIT", "quantity": 40,
  "capPerCode": 10, "codeIds": ["…", "…", "…", "…"] }
→ 201 { id, kind, quantity, unitPriceXaf, amountXaf, status: "PENDING", createdAt }
```

`capPerCode` and `codeIds` are what the manager chose on the screen; they are
applied **by the webhook, with the pool**, never at request time — nothing is
granted before money moves. Both optional: a centre may top up the pool alone
and hand out caps later.

Then `POST /api/payments/{id}/checkout` — **the existing flow, unchanged.**
Notch Pay and Stripe, the same idempotency rules, the same webhook. Nothing
about money is reinvented.

### The centre hands things out

```http
PUT    /api/centers/me/codes/{codeId}/entitlements/{product}     { cap: 12 }
DELETE /api/centers/me/codes/{codeId}/entitlements/{product}
GET    /api/centers/me/entitlements/{product}/codes?page=1&pageSize=20&search=
```

- for **credits**, `PUT` sets the cap. It spends nothing — the pool is spent
  when a session runs.
- for **Prep Pass** and **AI Assisted Learning**, `PUT` takes one from the pool
  and grants the period, in one transaction. Refused with
  `NOT_ENOUGH_ENTITLEMENTS` on an empty pool.
- `DELETE` sets a cap to 0, or stops a renewal. It **never refunds and never
  cuts short a period already paid for** — a student keeps the 60 days bought
  for them.

### The student reads what they hold

```http
GET /api/me/entitlements
→ { prepPass:   { active: true,  expiresAt: "2026-12-04T00:00:00Z" },
    aiAssisted: { active: false, expiresAt: null },
    aiSpeaking: { freeRemaining: 3,
                  resetsAt: "2026-11-01T00:00:00Z",
                  creditsAvailable: 8 } }
```

`creditsAvailable` is **the smaller of** what is left in the pool and what is
left of this seat's cap — the number the student can actually use, not two
numbers for the app to reason about.

No student-facing purchase endpoint exists, and none should.

### What the rest of the backend calls

The part that matters, because every product goes through it:

```ts
mayUse(studentId, product): Promise<EntitlementDecision>
spend(studentId, product, quantity = 1): Promise<void>   // atomic, or throws
```

A guard asks the first; the paid operation calls the second **after** it has
succeeded — never before, for the same reason the AI quota is written after the
model answers: a failure on our side must not cost a student something their
centre paid for.

---

## 9. Naming and error codes

```
EntitlementProduct:  PREP_PASS | AI_SPEAKING_CREDIT | AI_ASSISTED_LEARNING
PaymentKind, added:  PREP_PASS | AI_SPEAKING_CREDIT | AI_ASSISTED_LEARNING
```

The same words in both, deliberately: an invoice line and an entitlement row
should say the same thing.

| code | when |
|---|---|
| `NOT_ENOUGH_ENTITLEMENTS` | assigning from an empty pool |
| `ENTITLEMENT_REQUIRED` | reaching a feature this seat does not hold |
| `NO_CREDITS_REMAINING` | free allowance spent, and the pool or the cap is empty |
| `ENTITLEMENTS_FROZEN` | the centre's Start subscription has lapsed |
| `CODE_NOT_IN_CENTER` | assigning against somebody else's code |

`ENTITLEMENT_REQUIRED`, `ENTITLEMENTS_FROZEN` and `SUBSCRIPTION_INACTIVE` are
deliberately three different things. "You have no Prep Pass", "your school
stopped paying so your credits are waiting", and "your school stopped paying so
you cannot learn" need three different sentences, and only some of them are
something anyone can act on.

---

## 10. What this locks in

| | |
|---|---|
| The centre always pays | no `student_id` on a payment, no student checkout |
| The pool is the money, the cap is the permission | nothing is stranded on a student who did not use it |
| The cap lives on the code | a seat can be bought ahead, and an add-on follows the seat it was bought for |
| Buying twice accumulates | `payments` is the history; entitlements are a current balance |
| The free allowance is never a row | nothing to reset, nothing to drift |
| A lapsed centre freezes, never loses | credits were paid for |
| Credits never expire | *(a standing liability — a point for the founders, not for the code)* |
| Exam slots stay where they are | two columns on `centers`. Folding them into the pool table is an expand/contract migration for later, not this block |

---

## 11. Build order inside block 23

Each of these is shippable on its own.

| | task | why here |
|---|---|---|
| 1 | the three tables, the enums, the migration | nothing else can start |
| 2 | grant-on-webhook, into the pool | money must land before anything can be handed out |
| 3 | caps: `PUT`/`DELETE`, and the centre's read | the manager's screen |
| 4 | `mayUse` / `spend`, with the freeze | the interface every product calls |
| 5 | `GET /api/me/entitlements` | what the app renders |
| 6 | **22b**: the 5-a-month allowance on `quotaWindowStart`, spent before credits | the first real consumer of 4 |

Blocks 24 and 25 then become small, because they are products rather than
plumbing.
