# Task D — calendar-month billing periods

Spec: `docs/BILLING_PERIOD_SPEC.md`. No migration.

## The pure function first
- [ ] `src/modules/centers/billing-period.ts` with `periodEndAfter(from, anchorDay)`
- [ ] Unit tests: 31 Jan, 28 Feb, 31 Mar; anchor 29 leap and non-leap; anchor 30
      in February; December to January; a `from` past this month's anchor
- [ ] Unit test: the boundary is midnight in Africa/Douala, not in UTC
- [ ] Anchor derivation from `paid_until` for a null `anchor_day`

## Wire it into activation
- [ ] `extendPaidPeriod` ends the period on the anchor instead of adding 30 days
- [ ] Failing test first: a first purchase ends on its anchor day
- [ ] Paying early extends from `paid_until`, not from today
- [ ] Paying in grace keeps the anchor and does not gift the late days
- [ ] Paying after BLOCKED moves the anchor to the payment day
- [ ] Task B1's addition tests still pass untouched
- [ ] A null-anchor center renews onto a period derived from `paid_until`
- [ ] `PAID_PERIOD_DAYS` no longer defines a period

## Rewire the reset window
- [ ] `code-reset-allowance.ts` asks the anchor instead of subtracting a month
- [ ] Its stale comment goes
- [ ] Anchor 31 gets the same window in February as in March

## Before merge
- [ ] Four suites + lint
- [ ] ADR noting the period definition changed, and why monthly only

## Still blocked
- [ ] Task E — pro rata, needs Herman's minimum charge
- [ ] Annual (D4 rule 8) — needs a billing interval, a price, a switch rule
