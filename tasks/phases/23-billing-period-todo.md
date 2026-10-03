# Task D — calendar-month billing periods

Spec: `docs/BILLING_PERIOD_SPEC.md`. No migration.

## The pure function first
- [x] `src/modules/centers/billing-period.ts` with `periodEndAfter(from, anchorDay)`
- [x] Unit tests: 31 Jan, 28 Feb, 31 Mar; anchor 29 leap and non-leap; anchor 30
      in February; December to January; a `from` past this month's anchor
- [x] Unit test: the boundary is midnight in Africa/Douala, not in UTC
- [x] Anchor derivation from `paid_until` for a null `anchor_day`

## Wire it into activation
- [x] `extendPaidPeriod` ends the period on the anchor instead of adding 30 days
- [x] Failing test first: a first purchase ends on its anchor day
- [x] Paying early extends from `paid_until`, not from today
- [x] Paying in grace keeps the anchor and does not gift the late days
- [x] Paying after BLOCKED moves the anchor to the payment day
- [x] Task B1's addition tests still pass untouched
- [x] A null-anchor center renews onto a period derived from `paid_until`
- [x] `PAID_PERIOD_DAYS` no longer defines a period

## Rewire the reset window
- [x] `code-reset-allowance.ts` asks the anchor instead of subtracting a month
- [x] Its stale comment goes
- [x] Anchor 31 gets the same window in February as in March

## Before merge
- [x] Four suites + lint
- [x] ADR noting the period definition changed, and why monthly only

## Still blocked
- [ ] Task E — pro rata, needs Herman's minimum charge
- [ ] Annual (D4 rule 8) — needs a billing interval, a price, a switch rule
