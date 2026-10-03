# The billing period is a calendar month, not thirty days

Task D of the D4 billing work. Decided monthly-only on 2026-10-03; annual
(rule 8) is deliberately not in scope.

Filed beside `PAYMENT_MINTS_CODES_SPEC.md` rather than as a root `SPEC.md`,
following the convention this repo already uses for payment specs.

## Objective

A center's period ends on its **anchor day**, in **Africa/Douala**, in the next
calendar month — not thirty days after it paid. `anchor_day` becomes a column the
code **reads**; today it is written and read by nothing.

Three things follow from that:

1. `PAID_PERIOD_DAYS = 30` stops defining a period.
2. `code-reset-allowance.ts:115` stops guessing the period and asks the anchor,
   which its own comment has been waiting for.
3. Pro rata (task E) becomes possible, because it divides by the real length of
   the current month and cannot be written against a 30-day counter.

**No migration.** `anchor_day` already exists, monthly-only needs no new column,
and existing rows are handled by derivation rather than backfill (below). This is
the rare task where the schema is already right.

## The one function everything else rests on

```ts
/** The anchor day of the month after `from`, as an instant. */
export function periodEndAfter(from: Date, anchorDay: number): Date
```

Pure: no database, no clock of its own, no Prisma. The whole of rule 9 lives in
it, which is what lets every edge below be a unit test rather than an integration
test.

**It returns midnight Africa/Douala on the anchor day.** A period boundary is a
day, not a moment: D4 counts days in Douala, pro rata counts whole days left, and
a boundary carrying the hour someone happened to pay at makes "days left" a
fraction. The cost is that a first period is a few hours short of a full month —
paying at 14:00 on 1 January ends at 00:00 on 1 February. That is accepted, and
written down here so nobody later reads it as a rounding bug.

Africa/Douala is UTC+1 with no DST, which is why this is arithmetic rather than a
timezone library.

## Rules

### Month-end, rule 9

The anchor day is **clamped per month and never rewritten**. Anchor 31:
31 January, 28 February, 31 March. A center whose anchor is 31 does not become a
28 center in February. Clamping on read is what makes that true; storing the
clamped value is the bug this rule exists to prevent.

Anchor 29 in a non-leap February clamps to 28; in a leap year it does not.

### Paying early, while ACTIVE

The new period runs from the **current** `paid_until` to the next anchor after
it. Days already bought are not thrown away — the behaviour `extendPaidPeriod`
already has, expressed in months.

### Paying in grace, rule 7

The anchor does not move, and the new period still runs from the previous
`paid_until`. A school with anchor 1 that pays on 6 May is paid until 1 June, not
6 June: it had access through those six days, so they were served and are
charged. This is the worked example in the decisions doc — *6 May, pays in grace,
anchor stays 1, pays 45,000*.

### Paying after being BLOCKED, rule 7

The anchor **moves to the payment day** and the period runs from that day.
Blocked days are not charged. `setAnchorDay` already does exactly this and needs
no change.

### A first purchase

Anchor is the payment day in Douala. The period runs from the payment instant to
the next anchor.

### An addition mid-period

Moves neither the period nor the anchor. Already true as of task B1, and the
tests that pin it must keep passing unchanged.

## Existing rows, and why there is no backfill

Every center paying today has a `paid_until` and, for most, a null `anchor_day` —
the column only started being written on 2026-09-30.

**A null anchor is derived from `paid_until`:** its day of the month, in Douala.
That is not a new guess; it is exactly what `code-reset-allowance.ts` already
assumes when it treats the period as *the calendar month before `paid_until`*. So
the derivation is current behaviour written down, and the first renewal stamps a
real anchor.

A backfill would do the same arithmetic, once, against production, with a script
to maintain afterwards. Derivation costs nothing and cannot half-apply.

## What changes

| File | Change |
|---|---|
| a new `billing-period.ts` | `periodEndAfter`, and the anchor derivation |
| `payment-activation.service.ts` | `extendPaidPeriod` uses it; `PAID_PERIOD_DAYS` stops defining a period |
| `code-reset-allowance.ts` | the window asks the anchor instead of subtracting a month |

`subscription-policy.service.ts` is untouched: grace stays seven days from
`paid_until`, which is a duration and correctly a day count.

## Out of scope, deliberately

- **Annual** (rule 8). Needs a billing interval on the subscription, the 0.95
  price, and the switch-at-renewal rule — none of which are decided.
- **Pro rata** (task E). Unblocked by this, not included in it. Still waiting on
  Herman's minimum charge (B2 in the decisions doc).
- **Entitlement durations.** `PREP_PASS_DAYS = 60` and
  `AI_ASSISTED_LEARNING_DAYS = 30` stay day counts. A prep pass is a product
  lasting sixty days, not a thing with a renewal date, and
  `entitlements.service.ts` already says so.

## Testing strategy

**Unit, on `periodEndAfter`** — where every edge belongs, because it is pure:

- 31 January, then 28 February, then 31 March (the anchor survives the short
  month)
- anchor 29 in February, leap and non-leap
- anchor 30 in February
- anchor 1, every month
- December to January (the year rolls)
- a `from` already past this month's anchor
- the returned instant is midnight in Douala, not in UTC

**Integration, on activation** — one per rule:

- a first purchase sets the anchor and a period ending on it
- paying early extends from `paid_until`, not from today
- paying in grace keeps the anchor and does not gift the late days
- paying after BLOCKED moves the anchor to the payment day
- an addition moves neither (task B1's tests, unchanged)
- a center with a null anchor renews onto a period derived from `paid_until`

**Integration, on the reset window** — the allowance counts resets in the month
ending at the anchor, and a center whose anchor is 31 gets the same window in
February as in March.

## Boundaries

- **Always:** four suites green before merge. Every date rule gets a unit test on
  the pure function, not only an integration test through a payment.
- **Ask first:** anything that changes what an existing `paid_until` means for a
  center currently paid up, or that moves an anchor day a center is already on.
- **Never:** store a clamped anchor day. Never a bare `prisma migrate` — `.env`
  is production. Never backfill `anchor_day` from a script when derivation does
  the same work.

## Risk

The one behavioural change a paying center could notice: periods become 28 to 31
days instead of always 30. For a center with anchor 31, February is three days
shorter than it used to be, for the same money. That is what a monthly
subscription means and what rule 9 asks for, and the alternative — the drift that
made the renewal date wander every month — is the thing being fixed. Worth saying
out loud in case it reaches a customer conversation.
