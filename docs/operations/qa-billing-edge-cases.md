# QA runbook — Billing edge cases (pre-prod)

**Audience:** QA / another engineer verifying launch readiness.  
**Happy-path smoke (already done):** [PROD_READY_BILLING_SMOKE.md](./billing-smoke.md)  
**Commercial source:** [OFFRES_LERNIQO.md](../domains/offres-lerniqo.md)

This document covers what **still matters after** trial / Start / Prep Pass / Elena / Exam Day succeed once. Industry practice (Stripe go-live, SaaS billing checklists) is: do **not** only re-buy add-ons; prove **failure, expiry, duplicates, and ops visibility**.

Inspired by:

- [Stripe Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- [Stripe Billing testing](https://docs.stripe.com/billing/testing)
- [SaaS billing checklist (Throttle)](https://usethrottle.dev/guides/saas-billing-checklist/)
- [Chargebee go-live (small live charge + refund)](https://www.chargebee.com/docs/billing/2.0/implementing-chargebee/checklist)

---

## 0. How to run (tools)

| Case | Tool | Why |
|------|------|-----|
| Grace / BLOCKED / freeze | **Bruno + SQL** (test DB only) | Status is derived from timestamps; changing dates *is* the test |
| Failed payment webhook | **Bruno** + fake provider | No real money; outcome `FAILED` |
| Duplicate webhook | **Bruno** | Prove idempotent activation |
| Real declined card / MM | **Stripe or Fapshi test mode** + Bruno checkout | Provider-realistic failure |
| Refund | **Provider dashboard** | App does **not** auto-handle card refunds today (see §4) |
| Prod webhook health | **Provider dashboard + API logs** | Not Bruno |

**Never** run destructive SQL against production.

**Local fake payments**

```text
PAYMENT_PROVIDER=fake
FAKE_PAYMENT_WEBHOOK_SECRET=<same as Bruno fakeWebhookSecret, ≥32 chars>
```

API: `npm run start:testdb` → `http://localhost:3001`  
Bruno env: `local`

**Center id** (for SQL): from `GET /api/centers/me/subscription` response context, or:

```sql
SELECT c.id, c.name FROM centers c ORDER BY c.created_at DESC LIMIT 5;
```

---

## Pass / fail rules

- Mark **PASS** only if every assertion in the case holds.
- Mark **FAIL** if access is granted without money, or access continues when Start is BLOCKED (student learn).
- Mark **BLOCKED (product)** if behaviour is intentional but undocumented for support (e.g. refund).

Use the result table at the bottom.

---

## Case A — Grace period (still learning)

**Goal:** After `paid_until`, students still learn for **7 days**.

### Setup

Center must already be **ACTIVE** / `plan: PAID` with seats and a connected student (reuse smoke center or re-run happy path).

```sql
UPDATE center_subscriptions
   SET plan = 'PAID',
       paid_until = now() - interval '2 days',
       trial_started_at = NULL,
       trial_ends_at = NULL
 WHERE center_id = '<center_id>';
```

### Steps

1. Bruno: `Center Auth / 03 Login` (if token expired).
2. Bruno: `Center Subscription / 01 Get subscription`.
3. Bruno: `Subscription Access / 01 Student login` then `02 Learn` (use of-the-week MT, or `02a` then Learn with that number).

### Expected

| Check | Expected |
|-------|----------|
| Center subscription `status` | `GRACE_PERIOD` |
| `studentsMayLearn` | `true` |
| Student Learn | **200** |
| `graceEndsAt` | ~ `paid_until` + 7 days |

### Pass criteria

All of the above.

---

## Case B — BLOCKED after grace + add-on freeze

**Goal:** Past grace → students cannot learn; add-ons freeze; center can still read dashboard and pay.

### Setup

```sql
UPDATE center_subscriptions
   SET plan = 'PAID',
       paid_until = now() - interval '8 days',
       trial_started_at = NULL,
       trial_ends_at = NULL
 WHERE center_id = '<center_id>';
```

(Center should already hold Prep Pass / Elena assigned from smoke, if possible.)

### Steps

1. `Center Subscription / 01 Get subscription`
2. Student `02 Learn` (of-the-week)
3. Student `Student Activation / 03 My entitlements`
4. Center `Subscription Access / 05 Center provisions while blocked` (or try mint/provision)
5. Center `Center Payments / 01 Quote seats` (must still work)

### Expected

| Check | Expected |
|-------|----------|
| Center `status` | `BLOCKED` |
| `studentsMayLearn` | `false` |
| Student Learn | **403** (`SUBSCRIPTION_INACTIVE` / similar) |
| Student entitlements | `frozen: true` (Prep Pass / Elena not spendable; balances not wiped) |
| Center provision new codes | **403** |
| Center quote / create payment | Still allowed (**200/201**) |
| Center read subscription / usage | **200** |

### Restore after test

```sql
UPDATE center_subscriptions
   SET paid_until = now() + interval '30 days'
 WHERE center_id = '<center_id>';
```

Re-check Learn → **200**, entitlements `frozen: false`.

### Pass criteria

Block cuts learning; freeze does not delete pools; payment path remains open.

Bruno reference: `Subscription Access / 00 How to block and restore`.

---

## Case C — Failed payment webhook (no grant)

**Goal:** Provider says money did **not** move → no seats / slots / entitlements granted.

### Setup

1. Center logged in, profile complete.
2. New `idempotencyKey` (unique).
3. Create a PENDING payment, e.g. `Center Payments / 02 Create payment` (`{"seats": 10}`) **or** Exam Day / add-on purchase.
4. Note `paymentId`. Record current `seatsHeld` / `slotsRemaining` / entitlement pools **before**.

Attach fake reference (test DB only):

```sql
UPDATE payments
SET provider_reference = 'fake_<paymentId>',
    checkout_url = 'https://checkout.fake-payments.invalid/fake_<paymentId>',
    provider = 'fake'
WHERE id = '<paymentId>';
```

### Steps — webhook FAILED

Bruno `Center Payments / 06 Simulate provider webhook` (manual body; Bruno may not load `crypto`):

**Body (exact):**
```json
{"reference":"fake_<paymentId>","outcome":"FAILED"}
```

Generate signature (same secret as `fakeWebhookSecret`):

```bash
node -e "const c=require('crypto');const id='PAYMENT_ID';const secret='YOUR_FAKE_SECRET';const raw=JSON.stringify({reference:'fake_'+id,outcome:'FAILED'});console.log(raw);console.log(c.createHmac('sha256',secret).update(raw).digest('hex'));"
```

Header: `x-fake-signature: <hex>`

### Expected

| Check | Expected |
|-------|----------|
| Webhook response | `{ "received": true, "outcome": "MARKED_FAILED" }` (or equivalent fail mark) |
| Payment status | `FAILED` |
| `seatsHeld` / slots / pools | **Unchanged** vs before |
| Subscription | Still whatever it was (no false ACTIVE from this payment) |

### Optional — later SUCCEEDED

Same payment, webhook `outcome: SUCCEEDED` → should still **activate** (provider is authority). Assert seats/slots then move.

### Pass criteria

FAILED never grants access; SUCCEEDED after FAILED can still activate once.

---

## Case D — Duplicate SUCCEEDED webhook (idempotency)

**Goal:** Provider redelivery does not double-grant.

### Setup

Use a payment already activated once (or activate with SUCCEEDED). Note `paidUntil` / `seatsHeld` / pool balances.

### Steps

1. Send the **same** SUCCEEDED webhook body + signature again.
2. Re-read subscription / usage / exam-slots / entitlements pools.

### Expected

| Check | Expected |
|-------|----------|
| Second webhook | `outcome: "ALREADY_ACTIVE"` (or equivalent no-op) |
| `paidUntil` | **Unchanged** |
| Seats / slots / pools | **Not doubled** |

### Pass criteria

Exactly one activation effect for one payment.

Also: same `Idempotency-Key` + different body on create → **409** `IDEMPOTENCY_KEY_REUSED`.

---

## Case E — Real provider failure (staging test mode)

**Goal:** Decline / abort at Stripe or Fapshi does not leave a false ACTIVE.

### Tools

Staging API + **test-mode** Stripe and/or Fapshi (not `PAYMENT_PROVIDER=fake`).

### Steps

1. Create PENDING payment (Bruno).
2. `POST …/checkout` with `provider: "stripe"` or `"fapshi"`.
3. Complete checkout with a **declining** test card / abort MM (provider docs).
4. Confirm webhook (or lack of success event) in provider dashboard.
5. Assert DB: payment not `SUCCEEDED`; no seat/slot grant.

### Pass criteria

User-visible error or pending state; no access grant.

---

## Case F — Refund behaviour (document + observe)

**Important product fact (current code):** revoke of Prep Pass / Elena is **not** a card refund. Payment providers in this repo do **not** currently map Stripe/Fapshi **refund** webhooks to automatic access revocation.

### Steps (staging or controlled live)

1. Complete a small successful payment that granted something (e.g. Exam Day slots or Start).
2. In Stripe/Fapshi dashboard, issue a **full refund**.
3. Wait for webhook delivery (if any).
4. Observe Lerniqo: subscription / seats / slots.

### Expected (record actual behaviour)

| Question | Fill in during QA |
|----------|-------------------|
| Did Lerniqo receive a refund event? | Yes / No |
| Did access / seats / slots change? | Yes / No — describe |
| Is support runbook clear for “refunded but still ACTIVE”? | Yes / No |

### Pass criteria

- Behaviour is **recorded** for support.
- If auto-revoke is required by product, open a bug/ticket; do not ship assuming refund = revoke unless implemented.

---

## Case G — Production webhook monitoring (ops gate)

**Goal:** Failures are visible without waiting for user complaints.

### Checklist

- [ ] Live webhook URL: `https://<api-host>/api/webhooks/payments` registered for **Stripe** and **Fapshi**
- [ ] Live signing secrets in prod env (not sandbox `whsec_` / not fake)
- [ ] `PAYMENT_PROVIDER` is **not** `fake` in production
- [ ] First real SUCCEEDED delivery shows **2xx** in provider dashboard
- [ ] Alert or daily check for: webhook delivery failures, payments stuck `PENDING` > N minutes, centers that paid but stay non-ACTIVE
- [ ] Kill switch known: disable checkout / unset provider keys without long redeploy

### Pass criteria

Owner named; at least one monitored live delivery proven.

---

## Case H — Trial edge (no grace)

**Goal:** Trial ends hard at `trial_ends_at` (no 7-day grace).

```sql
UPDATE center_subscriptions
   SET trial_ends_at = now() - interval '1 hour'
 WHERE center_id = '<center_id>';
```

| Check | Expected |
|-------|----------|
| Status | `BLOCKED` (or unpaid / blocked UX) |
| Student Learn | **403** |
| Grace | **None** (`graceEndsAt` null when never paid) |

---

## Recommended order for the assignee (~45–90 min)

1. Case A — Grace  
2. Case B — BLOCKED + freeze + restore  
3. Case C — FAILED webhook  
4. Case D — Duplicate SUCCEEDED  
5. Case H — Trial expiry (if time)  
6. Case E — Provider decline (staging)  
7. Case F — Refund observe + write findings  
8. Case G — Prod webhook ops (before open to schools)

Do **not** spend time re-buying Prep Pass happily unless a regression is suspected.

---

## Results log (fill in)

| Case | Tester | Date | Result | Notes / evidence |
|------|--------|------|--------|------------------|
| A Grace | | | PASS / FAIL | |
| B BLOCKED + freeze | | | PASS / FAIL | |
| C FAILED webhook | | | PASS / FAIL | |
| D Duplicate webhook | | | PASS / FAIL | |
| E Provider decline | | | PASS / FAIL / SKIP | |
| F Refund observe | | | PASS / FAIL / DOCUMENTED | |
| G Prod webhooks | | | PASS / FAIL | |
| H Trial end | | | PASS / FAIL / SKIP | |

**Sign-off:** _________________ date ________  
**OK to open to real centers?** Yes / No / Yes with follow-ups: ________

---

## Related Bruno folders

| Folder | Use for |
|--------|---------|
| `bruno/Subscription Access/` | Learn, block/restore, dashboard while blocked |
| `bruno/Center Payments/` | Quote, create, checkout, fake webhook |
| `bruno/Center Entitlements/` | Prep Pass / Elena purchase & assign |
| `bruno/Center Exam Slots/` | Exam Day purchase & balance |
| `bruno/Center Subscription/` | Trial start, subscription read |
