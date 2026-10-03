# ADR 0002 — The centre pays, the code holds

**Status:** accepted
**Date:** 2026-09-25
**Design:** [ENTITLEMENTS_INTERFACE_DESIGN.md](../ENTITLEMENTS_INTERFACE_DESIGN.md)
**Offer:** [OFFRES_LERNIQO.md](../OFFRES_LERNIQO.md)
**Block:** 23 of [BUILD_BLOCKS_22_27.md](../BUILD_BLOCKS_22_27.md)

---

## Context

Lerniqo sells one subscription and four add-ons. Three of the add-ons are
described per student: Prep Pass (3 000 FCFA, 60 days), AI Speaking credits
(300 FCFA each), AI Assisted Learning (2 000 FCFA a month). Start (4 500
FCFA/élève/mois) is the door — an add-on only works behind a paid Start.

The schema has nowhere to put any of them. A centre holds seats and exam slots;
a student holds nothing. Before building three products, we have to decide who
owns an entitlement, who pays for it, and what happens when a centre stops
paying.

Three facts about the existing system constrain the answer, and all three were
verified in the code rather than assumed:

1. **A student's `center_id` is set in exactly one place** — redeeming an
   activation code, in the same transaction that flips the code to `CONNECTED`
   ([code-redemption.service.ts:193](../../src/modules/centers/code-redemption.service.ts#L193)).
   Deactivating a code clears it; removing a student from the roster
   deactivates their code. So **a centre's students are exactly its connected
   codes** — 25 codes means 25 students in Lerniqo, and people in the classroom
   without a code are not in the system at all.
2. **A code exists before any student holds it** (`ACTIVATED`,
   `student_id: null`), created when a payment succeeds. A seat is a real row
   before it is a person.
3. **A seat rotates.** A centre can deactivate a code and hand it to somebody
   else; `ActivationCodeEvent` exists partly to count that.

## Decision

**The centre pays and holds the pool. An activation code holds the cap and the
assignment. A student never sees money.**

Concretely:

| | where it lives | |
|---|---|---|
| what was bought | `center_entitlement_pools` | `(center_id, product)`, a balance |
| who may draw on it | `code_entitlement_caps` | `(code_id, product)`, a ceiling and a used count |
| a timed grant | `code_entitlements` | `(code_id, product)`, an expiry |

AI Speaking credits stay in the pool and are drawn against a cap. Prep Pass and
AI Assisted Learning leave the pool to become a period on one seat. Start's
five free monthly sessions are stored nowhere — they stay derived from
`ai_usage` rows, behind `quotaWindowStart(now)`.

A lapsed Start **freezes** entitlements. Nothing is deleted, nothing is
spendable, and paying again restores exactly what was there.

## Alternatives considered

### Per-student wallets — credits moved onto a person at purchase

The founder's first description: buy 40 credits for 4 students, 10 each.

- **Pros:** exactly what the purchase screen says. Trivial to explain.
- **Cons:** it strands money. A centre buys 40 for four students; Marie uses her
  10 and needs 2 more before an exam; 27 credits sit on three students who did
  not use them, unreachable. The centre must buy again while holding credit it
  cannot spend.
- **Rejected:** the pool-and-cap version keeps everything the screen promised —
  the centre still chooses who, and how many — while a shortfall becomes one
  number a manager changes instead of a second purchase. It is the pattern
  prepaid platforms converge on: one balance, per-principal limits.

### The cap on the student rather than on the code

- **Pros:** a manager thinks in students, so the row would match the mental
  model.
- **Cons:** a centre could not buy ahead, because an unredeemed code has no
  student to attach to — and that is the one case where buying ahead is useful.
  When a seat rotates, the add-on would stay with the person who left rather
  than with the seat the centre paid for.
- **Rejected:** a student holds at most one connected code (a partial unique
  index, migration `20260918200000`), so cap-per-code and cap-per-student are
  the same number whenever somebody holds it. The code costs nothing and buys
  both missing cases. The dashboard still shows names.

### Student-direct checkout

- **Pros:** a motivated student could buy credits without waiting for their
  school.
- **Cons:** `payments.center_id` is required and the whole payment stack is
  written around a centre — idempotency keyed on `(center_id, key)`, invoices,
  the webhook's activation path. It would also put in-app purchase rules
  between us and the Flutter release on mobile.
- **Rejected:** out of scope, and the offer sells to centres. If an independent
  student product ever exists it is a different conversation and a different
  ADR.

### One `entitlements` table with nullable `balance` and `expires_at`

- **Pros:** one table, one grant path, one read.
- **Cons:** which column is meaningful would depend on the product, so the rule
  would live in application code instead of the schema, and a row carrying the
  wrong one would be invisible — no constraint catches it. The two are spent by
  different statements anyway: a balance is `decrement … WHERE balance >= 1`, a
  period is `expires_at > now()`.
- **Rejected:** three narrow tables, one meaningful column each, and no row can
  be nonsense.

### A row per purchase, spent FIFO

- **Pros:** an audit trail inside the entitlement itself.
- **Cons:** spending has to walk rows in expiry order, and a second history
  would have to be kept true beside the one that already exists.
- **Rejected:** `payments` already records who bought what, when, for how much,
  and which provider reference settled it. Buying twice accumulates into one
  row.

### Deleting credits when a centre lapses

- **Rejected** without much argument. The centre paid for them. Prepaid
  balances survive delinquency everywhere it has been thought about, and
  confiscating stored value is both bad practice and legally exposed. A frozen
  balance shown in the dashboard is also the cheapest retention argument we
  will ever have: it is the centre's own money asking them to come back.

## Consequences

- **Blocks 24 and 25 become small.** AI Speaking credits and Prep Pass are
  products on top of this plumbing rather than plumbing of their own. That is
  the whole reason this block comes first.
- **One freeze rule, not two.** "Start is the door" and "a lapsed centre keeps
  what it bought" are the same check — every code reads `CENTER_UNPAID` through
  `StudentEntitlementService`, which already exists.
- **Buying ahead works.** A centre can attach an add-on to a code it has not
  handed out, and whoever redeems it inherits the seat and its cap.
- **An add-on follows the seat, not the person.** Deliberate, and it will
  surprise somebody one day: a centre that moves Marie's code to Paul moves her
  remaining cap with it. This is the right default — the centre bought a seat —
  but it belongs in the dashboard copy.
- **Exam slots are now the odd ones out.** They live as two columns on
  `centers` and should eventually move into the pool table. An expand/contract
  migration for later; not this block.
- **Unexpiring credits are a standing liability.** Money received for sessions
  not yet delivered, possibly for years. Nothing for the code; a point the
  founders should carry into planning.
