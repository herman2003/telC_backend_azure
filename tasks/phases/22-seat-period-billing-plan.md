# D4 billing, task B+C — the period an upsell must not move, and the VAT it must record

Branch off `dev` after task A (`fix/renewal-not-blocked`) lands.

## Why

Two defects share one table and therefore one migration.

**B — every upsell gives away a free month.** `PaymentActivationService.activate`
calls `extendPaidPeriod` for every SEATS payment, which pushes `paid_until` out
by a period. D4 rule 3 says adding seats **never moves** the renewal date. A
school going 10 → 12 mid-period pays for two seats and receives a month.

**C — VAT is not recorded, only applied.** PR #16 folded VAT into `amount_xaf`.
`vatAmountXaf` is exported and never called. D27 invoices need HT, TVA and TTC
as lines, and dividing a stored total by 1.18 does not reliably recover the
amount that was rounded.

## The load-bearing constraint

Whether a payment renews the period is decided at **creation** — task A computes
`midPeriod` from `paid_until` there — but applied at **activation**, by a webhook
that can arrive hours later, after the period has lapsed. Activation must not
re-derive it from the clock: a center that pays for two extra seats on the last
day of its period, whose webhook lands the next morning, would be read as a
renewal and get the free month anyway.

So the decision has to travel on the Payment row. This is the same reasoning
`metadata` already carries for entitlements ("the choice has to survive in
between").

## Schema

One migration, three columns on `payments`:

```sql
ALTER TABLE "payments"
  ADD COLUMN "renews_period"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "amount_net_xaf" INTEGER,
  ADD COLUMN "vat_amount_xaf" INTEGER;
```

- **`renews_period`** — true for a first purchase and a renewal, false for a
  mid-period addition. Default true because that is today's behaviour: a PENDING
  row created before this migration keeps the meaning it was created under,
  rather than silently changing when its webhook arrives. Only the SEATS path
  reads it; exam slots and entitlements never reach `extendPaidPeriod`.
- **`amount_net_xaf` / `vat_amount_xaf`** — nullable, no backfill. Null means
  "written before VAT was recorded separately". A backfill would have to guess
  whether an old row's `amount_xaf` was HT or TTC, and guessing wrong puts a
  wrong number on an invoice. Production is demo data, so there is nothing worth
  guessing for. `amount_xaf` stays TTC: it is what the provider is sent.

Invariant, asserted in tests: `amount_net_xaf + vat_amount_xaf = amount_xaf`.

Migration generated offline with `migrate diff`, applied with
`scripts/apply-migration.mjs`. Never a bare `prisma migrate` — `.env` is
production.

## Tasks

### B1 — carry the renewal decision on the payment row
Vertical: migration → written at creation → read at activation → asserted.

1. Migration `2026xxxx_payment_period_and_vat` with all three columns (C's
   columns ride along; one ALTER TABLE on `payments`, not two).
2. `PaymentsService.create` writes `renews_period: !midPeriod`.
3. `payment-activation.service.ts`: add `renews_period` to the `select`; call
   `extendPaidPeriod` only when true, otherwise read the current `paid_until`
   and return it unchanged.
4. `setAnchorDay` needs no change — it is already null-guarded and only moves
   for a center that was BLOCKED, and a blocked center's payment is a renewal.

**Acceptance**
- A center paid through +20 days, holding 10 seats at 4,500, pays for 12: after
  activation `paid_until` is **unchanged**, the seat pool is 12, and two codes
  were minted.
- The same center renewing 12 → 12 once the period elapsed: `paid_until` moves
  forward, pool stays 12, no codes minted.
- A first purchase (no seat row): `paid_until` is set, anchor day recorded.
- An upsell whose webhook arrives **after** the period lapsed still does not
  extend — the row said false, and the clock is not consulted again.
- `renews_period` defaults true, so an untouched exam-slot or entitlement
  payment behaves exactly as before.

**Verify**: `npx jest --config ./test/jest-integration.json test/payment-activation-integration.spec.ts`,
then the four suites.

### B2 — record net and VAT at every creation site
1. `vat.ts`: keep `amountWithVatXaf`, start using `vatAmountXaf`.
2. Write all three amounts at the three creation sites: `payments.service.ts`,
   `exam-slots.service.ts`, `entitlement-purchase.service.ts`.
3. Assert the invariant on each path.

**Acceptance**
- Every new payment row satisfies `amount_net_xaf + vat_amount_xaf = amount_xaf`.
- A seat upsell of 2 at 4,500 stores 9,000 / 1,620 / 10,620.
- Nothing reads the new columns yet — this task only stops losing the numbers.

**Verify**: four suites.

## Checkpoint between B1 and B2

B1 changes what a center is charged for in time; B2 only records what it was
already charged. Land B1, confirm the four suites, then start B2 — so a
regression in either is attributable.

## Out of scope

Calendar periods on the anchor day (task D), pro rata (task E, blocked on B2's
minimum charge from Herman), and rendering HT/TVA/TTC on an invoice (D27).
`PAID_PERIOD_DAYS = 30` stays wrong here and is fixed in D.

## Risk

The one real risk is B1's default. `renews_period` defaults true, so any PENDING
upsell created before the migration still extends the period when its webhook
lands. That is today's bug persisting for in-flight rows only, which is the safe
direction: the alternative default would refuse a period to a center that paid
for one.
