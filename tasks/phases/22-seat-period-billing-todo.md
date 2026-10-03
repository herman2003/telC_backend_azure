# D4 billing B+C — todo

## B1 — the renewal decision travels on the payment row
- [x] Add `renews_period`, `amount_net_xaf`, `vat_amount_xaf` to `model Payment`
- [x] Generate the migration offline with `migrate diff`
- [x] Apply it to the `.env.test` branch with `scripts/apply-migration.mjs`
- [x] Failing test: an upsell mid-period leaves `paid_until` unchanged
- [x] Failing test: an upsell whose webhook lands after the period still does not extend
- [x] `PaymentsService.create` writes `renews_period: !midPeriod`
- [x] `activate()` selects `renews_period` and gates `extendPaidPeriod` on it
- [x] Green: renewal still moves `paid_until`; first purchase still sets it
- [x] Four suites + lint
- [ ] Apply the migration to production — happens automatically when `main` is
      deployed, so it is really the `dev` → `main` decision, not a separate step

## B2 — net and VAT recorded, not just applied
- [x] Failing test: `amount_net_xaf + vat_amount_xaf = amount_xaf` on a seat order
- [x] Write all three amounts in `payments.service.ts`
- [x] Same in `exam-slots.service.ts`
- [x] Same in `entitlement-purchase.service.ts`
- [x] `vatAmountXaf` kept as the single-value form of `splitVatXaf` (tests only)
- [x] Four suites + lint

## Blocked, not in this task
- [x] Task D — calendar period on `anchor_day` (done; `PAID_PERIOD_DAYS` is gone)
- [ ] Task E — pro rata (needs Herman's minimum charge, B2 in the decisions doc)
- [x] ADR 0003 written; B5 reversed in writing, and the VAT confirmed as declared
