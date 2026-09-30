# Spec: a successful payment hands the school something to give out

**Written:** 2026-09-30
**Priority:** P0 — a school can pay for ten seats and enrol one student
**Contract:** `CENTER_FRONTEND_SYNC_DECISIONS.md`, D4 rules 1–2 and line 336
**Reported by:** the frontend, against centre `testapplication551@gmail.com`
**Status:** 🛑 awaiting review of §1 and §7 before the task split

---

## 1. What is actually broken

Activation codes are created in **one place in the entire backend**:
`center-trial.service.ts:121`, the trial. `PaymentActivationService.activate`
extends `paid_until`, calls `setSeats`, and returns.

So a school that pays for ten seats has `center_seats.quantity = 10` and one
code — the trial one, already held by a student. It can enrol nobody.

This was known. `CENTER_FRONTEND_SYNC_DECISIONS.md` line 336 lists **three**
things a successful payment must also do, and the report found the first:

| | | in the report? |
|---|---|---|
| 1 | create one code per seat, `expires_at = null` | yes |
| 2 | move the trial student to a paid code, retire the trial code | **no** |
| 3 | store the anchor day | **no** |

Shipping only the first would leave two bugs behind the one that was found.
All three are this task.

---

## 2. Assumptions

1. **Top up, never replace.** Ten seats with one existing code means nine new
   ones, not ten. The rule is "create codes until the count equals the seat
   quantity", and `DEACTIVATED` codes do not count toward it — they are seats
   a manager deliberately took back.
2. **Paid codes carry `expires_at = null`** and follow `paid_until`. Only the
   trial code carries a date of its own, which is what makes it recognisable.
3. **The anchor day is a day of the month (1–31), in Africa/Douala.** Rule 9:
   a missing day uses the month's last, and the next month returns to the real
   one (31 Jan → 28 Feb → 31 Mar). Storing a date rather than a day would lose
   that.
4. **Storing the anchor day is in scope; using it is not.** Renewal and pro
   rata are not built. It is captured now because it cannot be recovered
   later: the day a school first paid is only knowable on the day it pays.
5. **A late payment after being blocked sets a new anchor day** (rule 7). A
   payment in grace does not move it.
6. **The backfill is a script, not a route.** It runs once, by hand, against a
   named centre.

→ Correct these now or the task split proceeds on them.

---

## 3. Minting the codes

In `activate`, inside the transaction that already moves `paid_until` and the
seats:

```
wanted  = center_seats.quantity           (what was just paid for)
holding = count of codes NOT DEACTIVATED  (ACTIVATED + CONNECTED)
mint    = max(0, wanted - holding)
```

Each new code: a fresh `LQ-XXXX-XXXX` from `generateActivationCode()`,
`status = ACTIVATED`, `expires_at = null`.

**Idempotent by construction.** The count is taken inside the same transaction
as the mint, so a replayed webhook finds `holding = wanted` and mints nothing.
It does not depend on the payment row's status, which is what makes it safe
against a webhook that arrives twice for one payment and against two payments
landing together.

**Never delete.** A school that shrinks at renewal keeps its codes; rule 6
says no shrinking mid-period and rule 5 says never below the number of
connected students.

---

## 4. Retiring the trial code

The part the report missed, and the part with a real trap.

A student holds **at most one connected code** — a partial unique index from
migration `20260918200000`. So the new paid code cannot be inserted as
`CONNECTED` for that student while the trial code still is. The order inside
the transaction is load-bearing:

```
1. find the trial code:  status = CONNECTED, expires_at IS NOT NULL
2. set it DEACTIVATED                       ← frees the index
3. insert a paid code:   CONNECTED, same student_id, expires_at = null,
                         linked_name / linked_email / connected_at copied
4. write two ActivationCodeEvent rows, so the move is visible afterwards
```

**The student's `center_id` must not be cleared.** The ordinary deactivation
path clears it — that is how a manager removes somebody
(`center-activation-codes.service.ts:265`). Here the student is not losing
their seat, they are being moved onto a paid one, and clearing it would cut
off the very student the school just paid for.

The paid code counts toward `holding` in §3, so the school still ends with
exactly `quantity` codes.

**A trial code nobody redeemed** (`ACTIVATED`, with a date) is retired the same
way, minus the student: deactivate it, and §3 mints a dated-free replacement.
Leaving it would give the school a code that expires on the old trial date.

---

## 5. The anchor day

New column on `CenterSubscription`:

```prisma
/// The day of the month every period of this centre ends on, 1–31, in
/// Africa/Douala. Null until the first payment.
anchor_day Int?
```

Set on activation when it is null, or when the centre was `BLOCKED` before
this payment (rule 7: blocked days are not charged and paying starts a new
period that day). Otherwise left alone — adding seats must never move the
renewal date (rule 3).

It already has a waiting consumer. `code-reset-allowance.ts:115` says so:

> *"D4's anchor day will replace this once it is built; until then the paid
> period is the calendar month before the date the center is paid until."*

This task **stores** it. Rewiring the reset window, renewal and pro rata onto
it is separate work and is not in scope.

---

## 6. The backfill

`scripts/backfill-activation-codes.mjs`, run by hand:

- for a named centre, or every centre with `paid_until` set
- mint up to `center_seats.quantity` using the §3 rule
- retire a trial code the same way as §4
- set `anchor_day` from the payment that paid them, where it can be found
- **dry run by default**; `--apply` to write
- refuses to run against `ep-wandering-hall` unless `--production` is passed
  explicitly, for the reason every other script in this repo refuses

It fixes `testapplication551@gmail.com`: 1 code → 10, the connected one kept.

---

## 7. Success criteria

- [ ] A centre pays for 10 seats holding 1 trial code → **10 codes**: the
      trial student on a new paid code, 9 fresh `ACTIVATED`.
- [ ] The moved student keeps `center_id` and keeps access without
      re-redeeming anything.
- [ ] The retired trial code is `DEACTIVATED`, and two events record the move.
- [ ] Every paid code has `expires_at = null`.
- [ ] **The same webhook twice mints once.** Two concurrent activations also
      mint once — proven against real Postgres, not a mock.
- [ ] A centre paying again for 10 while holding 10 mints nothing.
- [ ] `DEACTIVATED` codes do not count: 10 seats, 2 deactivated, 8 live →
      2 minted.
- [ ] `anchor_day` is set on first payment and **unchanged** by a later one,
      unless the centre was blocked.
- [ ] The backfill takes the test centre from 1 to 10 without touching the
      `CONNECTED` row, and is a no-op on a second run.

## 8. Testing

**Integration, against real Postgres** — the whole task is claims about rows,
counts and concurrency, and a mocked Prisma will happily mint twice and report
success both times. The unique index in §4 in particular cannot be exercised
by a mock.

Unit tests only for the arithmetic: how many to mint given seats, holdings and
deactivated rows.

## 9. Commands and boundaries

```
Typecheck    npx tsc --noEmit -p tsconfig.json
Unit         npx jest
Integration  npm run test:integration
E2E          npm run test:e2e
Build        npm run build
```

Migrations are generated offline with `migrate diff` and applied through
`scripts/apply-migration.mjs`. **Never a bare `prisma migrate`** — `.env` is
production.

- **Always:** four suites green before merge; the mint counted and written in
  one transaction.
- **Ask first:** anything that changes what an existing code's `expires_at`
  means; running the backfill against production.
- **Never:** delete an activation code; clear `center_id` on the student being
  moved; mint outside the activation transaction.

## 10. Out of scope, deliberately

Renewal, pro rata for seats added mid-period, the minimum charge, annual
billing, and rewiring the reset window onto `anchor_day`. Each is its own
task; this one makes a paid school usable and captures the date the rest will
need.
