# D4 billing B+C — todo

## B1 — the renewal decision travels on the payment row
- [ ] Add `renews_period`, `amount_net_xaf`, `vat_amount_xaf` to `model Payment`
- [ ] Generate the migration offline with `migrate diff`
- [ ] Apply it to the `.env.test` branch with `scripts/apply-migration.mjs`
- [ ] Failing test: an upsell mid-period leaves `paid_until` unchanged
- [ ] Failing test: an upsell whose webhook lands after the period still does not extend
- [ ] `PaymentsService.create` writes `renews_period: !midPeriod`
- [ ] `activate()` selects `renews_period` and gates `extendPaidPeriod` on it
- [ ] Green: renewal still moves `paid_until`; first purchase still sets it
- [ ] Four suites + lint
- [ ] Apply the migration to production (it deploys on `start`)

## B2 — net and VAT recorded, not just applied
- [ ] Failing test: `amount_net_xaf + vat_amount_xaf = amount_xaf` on a seat order
- [ ] Write all three amounts in `payments.service.ts`
- [ ] Same in `exam-slots.service.ts`
- [ ] Same in `entitlement-purchase.service.ts`
- [ ] `vatAmountXaf` is called rather than dead
- [ ] Four suites + lint

## Blocked, not in this task
- [ ] Task D — calendar period on `anchor_day`, replacing `PAID_PERIOD_DAYS = 30`
- [ ] Task E — pro rata (needs Herman's minimum charge, B2 in the decisions doc)
- [ ] ADR for the VAT reversal; rewrite B5, which still says VAT was dropped
