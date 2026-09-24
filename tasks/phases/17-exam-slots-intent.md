# Phase 17 — Buying exam slots: intent and task breakdown

**Written:** 2026-09-24
**Branch base:** `dev` @ `be5079d` (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md`
**Follows:** phase 16, which spends slots but cannot buy them

## Why

Publishing a sitting spends one exam slot per candidate, and there is no way
to get a slot except editing the database. Nothing built in phase 16 can be
demonstrated to a center, or tested by anyone without database access. This
phase closes that loop, and it is small because the payment flow already
exists: Notch for Mobile Money, Stripe for card, one webhook, one activation.

## Architecture decisions

| Decision | Why |
|---|---|
| Exam slots ride on `payments`, not a second table | A center gets one payment history and one invoice shape. `payments.kind` already exists for exactly this |
| A separate `create` path, not a `kind` parameter on the seat one | The seat path carries the ten-seat floor, the seat pricing context and grandfathering, none of which apply. Threading a flag through it would put two products in one function |
| The fingerprint gains the kind | Otherwise one idempotency key could match a seat payment and a slot payment of the same number, and hand back the wrong one |
| Activation branches on kind | `activate()` currently extends `paid_until` and sets seats. A slot purchase must do neither: it adds to `exam_slots_remaining` and leaves the subscription alone |
| 1,000 XAF, no minimum | A sitting for three candidates is a real thing a school does. Seats keep their floor of ten; slots have none |
| Only the MANUAL price ships | The 1,500 AI tier is phase 6. The column exists; nothing sells it yet |
| `payments.total_seats` is renamed to `quantity` | It already holds the wrong noun, and will hold slots tomorrow and AI credits later. Ten call sites today; five products' worth of confusion in three months |
| The slot path stays thin — quantity times a constant | Two products, two paths is fine. The third product is when these collapse into one catalogue of `kind -> {price, min, max, grant}`, and a thick second path is what would make that collapse impossible |
| Everything here is bought BY A CENTER | Independent students buying their own subscription is a later, separate path: `payments` requires a center and its profile gate asks about the center's manager |

## The dependency graph

```
payments.kind (exists)
    │
    ├── slot pricing ──→ create a slot payment ──→ checkout (unchanged)
    │                                                   │
    └── activation branch ◄─────────────── webhook (unchanged)
                │
                └── exam_slots_remaining ──→ publish (phase 16, unchanged)
```

Checkout and the webhook need no change: both read a payment and neither asks
what it bought. That is the point of putting slots on the same table.

---

## Task 1 — What a slot costs, and buying one

**Description:** The price, its bounds, and a `create` that writes an
`EXAM_SLOTS` payment through the same profile gate, idempotency claim and
transaction as a seat payment.

**Acceptance criteria:**
- [ ] `EXAM_SLOT_PRICE_XAF = 1_000`; a quote is quantity × price
- [ ] One slot is allowed; zero, negative and fractional are refused
- [ ] An order too large for the amount column is refused, not truncated
- [ ] The same key with a different quantity is `IDEMPOTENCY_KEY_REUSED`
- [ ] The same key and quantity returns the original payment
- [ ] A center with an incomplete profile is refused, as for seats

**Verification:** `npx jest test/exam-slots.service.spec.ts` · `npm run build`

**Dependencies:** none · **Files:** `pricing.service.ts`, `exam-slots.service.ts`, 1 spec · **Scope:** M

## Task 2 — Activation credits slots, and nothing else

**Description:** `activate()` learns the payment's kind. `SEATS` behaves
exactly as today. `EXAM_SLOTS` increments `exam_slots_remaining` and touches
neither `paid_until` nor `center_seats`.

**Acceptance criteria:**
- [ ] An activated slot payment raises the balance by its quantity
- [ ] It leaves `paid_until`, the plan and the seat row untouched
- [ ] Activating twice credits once, including under a concurrent double
- [ ] A seat payment still extends the period and sets seats, unchanged

**Verification:** `npm run test:integration -- exam-slots` — a claim about one
transaction, so it runs against real Postgres · existing payment integration
specs must stay green

**Dependencies:** Task 1 · **Files:** `payment-activation.service.ts`, 1 spec · **Scope:** S

## Checkpoint A

- [ ] Four suites green
- [ ] A slot payment, activated by hand, raises a balance that publish spends

## Task 3 — The routes a dashboard calls

**Description:** Read the balance, buy slots, and see what a payment bought.

**Acceptance criteria:**
- [ ] `GET /api/centers/me/exam-slots` → `{ slotsRemaining }`
- [ ] `POST /api/centers/me/exam-slots/purchase` → a payment, with the
      idempotency key from the header the seat route already uses
- [ ] Checkout is the existing route: nothing new to open a payment
- [ ] `kind` appears on a payment, so an invoice list can tell the two apart

**Verification:** `npx jest test/exam-slots.controller.spec.ts` · Swagger
renders both routes

**Dependencies:** Tasks 1–2 · **Files:** controller, DTO, module, `payments.service.ts`, 2 specs · **Scope:** M

## Task 4 — The whole loop, once

**Description:** One integration test walking buy → checkout → webhook →
balance → publish, because every piece being right separately is not the same
claim as the loop closing.

**Acceptance criteria:**
- [ ] A center with no slots buys 5, the webhook lands, and a sitting for 5
      publishes
- [ ] A replayed webhook does not credit twice

**Verification:** `npm run test:integration`

**Dependencies:** Tasks 1–3 · **Files:** 1 spec · **Scope:** S

## Checkpoint B — done when

A manager with no exam slots can buy five through the dashboard, pay with
Mobile Money or card, watch the balance become five, and publish a sitting for
five candidates — with no developer touching the database at any point.

---

## Not in this phase

- The 1,500 AI tier (phase 6)
- Refunds, expiry, or returning a no-show's slot — an exam fee is spent when
  it is booked
- Anything a student can call (phase 3)

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The activation branch breaks seat payments, which are live | High | The existing payment integration specs run unchanged; the branch is additive and the seat path keeps its own tests |
| A webhook credits twice on a replay | High | Already solved for seats by the `status != SUCCEEDED` claim in the same statement; the branch sits inside it rather than beside it |
| Provider keys are still missing in production | Low | Checkout answers 503 per method; buying is testable with `PAYMENT_PROVIDER=fake` |

## Open questions

None. The price, the absence of a minimum and the no-refund rule were settled
before phase 16.
