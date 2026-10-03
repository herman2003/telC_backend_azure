# ADR 0003 — Prices carry VAT, and a period is a calendar month

**Status:** accepted
**Date:** 2026-10-03
**Supersedes:** B5 in [CENTER_FRONTEND_SYNC_DECISIONS.md](../CENTER_FRONTEND_SYNC_DECISIONS.md) (VAT dropped, 2026-09-18)
**Spec:** [BILLING_PERIOD_SPEC.md](../BILLING_PERIOD_SPEC.md)
**Rules:** D4 rules 3, 5, 6, 7 and 9

---

## Context

Two decisions were taken in code before they were taken in writing, which is why
this ADR exists after the fact rather than before it.

**VAT.** B5 was decided on 2026-09-18: *"dropped for now: prices as listed, in
XAF. Revisit only when German schools are sold to."* On 2026-10-03, PR #16 began
charging 18% on every center payment — seats, exam slots and all three add-ons.
Nothing in the docs changed, so for a day the recorded decision and the running
code disagreed about what a school owes.

That disagreement is not a filing problem. PR #16 was written against the
decisions doc, and it half-applied D4 rule 3: it billed the seat delta but kept
extending the period, and it refused the renewal of a center ordering the seat
count it already held. An agent or a person reading a doc that contradicts the
code will implement the sentence they happen to be looking at. Three defects
reached `dev` that way, and the integration suite was red when they landed.

**The period.** `PAID_PERIOD_DAYS = 30` was a deliberate choice, and its comment
said why: *"so there is no month-end arithmetic to get wrong."* But D4 rule 9 asks
for a calendar month on an anchor day, and pro rata (rule 3) divides by the real
length of the current month. A 30-day counter cannot express either. It also made
the renewal date wander — 1 January, then the 31st by March.

## Decision

**1. Catalogue prices are HT. Amounts sent to a provider are TTC, at 18%.**

Fapshi and Stripe take a single integer amount with no tax field, so the stored
`amount_xaf` is gross. The net and the VAT are stored beside it, because an
invoice needs HT, TVA and TTC as lines (D27) and dividing a rounded gross back out
does not return them. One function produces all three so they cannot drift
([vat.ts](../../src/modules/centers/vat.ts)), and the rounding falls on the VAT
line rather than on a net nobody agreed to.

B5 is **reopened and reversed**. Its reasoning — revisit when German schools are
sold to — was about EUR and about whether listed prices already included tax. The
EUR half stands: prices are in XAF.

**2. A period is a calendar month ending on the center's anchor day, in
Africa/Douala.**

`anchor_day` becomes a column the code reads. It is clamped on read and never
written back, so a center anchored on the 31st is paid to 28 February and to 31
March rather than becoming a 28th center for good. `PAID_PERIOD_DAYS` is gone.

**3. Monthly only. Annual (rule 8) is not built.**

It needs a billing interval on the subscription, the 12 × 0.95 price, and the
monthly ↔ annual switch-at-renewal rule. None of the three is decided, and nobody
has sold one.

**4. The one seat-payment route tells its three purchases apart by the clock.**

Mid-period an order adds seats: only the addition is billed, a shrink is refused,
and neither the period nor the anchor moves. Once the period has elapsed the same
order is a renewal: the whole pack is billed and may be smaller. Which one a
payment is gets decided when it is created and **stored on the row**, because the
webhook that applies it can arrive after the period has ended.

## Consequences

**Every add-on got 18% more expensive to the customer**, not only seats. PR #16's
message mentioned seats; the change was wider. Anyone quoting a school from the
catalogue is quoting HT.

**Periods become 28 to 31 days instead of always 30.** A center anchored on the
31st gets three fewer days in February for the same money. That is what a monthly
subscription is, and the wandering renewal date it replaces was the defect — but
it is the kind of detail that surfaces in a conversation with a school.

**A reset-window bug went with it.** The allowance used to subtract a calendar
month from `paid_until`. For a 31-anchored center that gave a window starting 28
January for a period that began 31 January, so resets in those three days were
counted in no period at all.

**No backfill.** A center paying since before `anchor_day` existed has its anchor
derived from the day its current period ends on, which is what the reset window
already assumed. The first renewal stamps a real one.

## What this does not decide

- **The minimum charge for a small pro rata payment** (B2, owner: Herman). Pro
  rata cannot ship without it: one seat added three days before the anchor comes
  to 435 XAF, below the transaction fee.
- **Whether Lerniqo collects and declares the VAT it now charges.** This ADR
  records what the code does. Whether an 18% line on an invoice is correct for
  this company, in Cameroon, today, is a question for the founders and not for a
  commit.

## Alternatives considered

**Leave B5 as written and strip the VAT out of the code.** Defensible — it was
the standing decision, and reversing it in a PR nobody reviewed is how the
contradiction arose. Rejected because the founders want VAT charged; the fix is to
rewrite the decision, not to revert the code.

**Keep the 30-day counter and build pro rata on it.** Would have shipped a
formula wrong by one to three days every month, in a direction that favours
nobody consistently.

**Backfill `anchor_day` for existing centers.** Same arithmetic as the
derivation, run once against production, leaving a script to maintain. Derivation
cannot half-apply.

**Store only the gross amount and derive HT on the invoice.** Fails on rounding:
360 TTC could be 305 or 306 HT, and an invoice is the wrong place to guess.
