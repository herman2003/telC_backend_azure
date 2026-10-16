# Mid-period seat prorata Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Checkboxes track progress.

**Goal:** Charge day-prorata HT (then VAT) when a paid center adds seats mid-period; keep full-pack pricing for first purchase and renewal.

**Architecture:** Pure Douala day math in `billing-period` + `seat-prorata.ts`; `PricingService` / payments apply it only when `midPeriod`; quote returns the same amount due now.

**Tech Stack:** NestJS, existing `splitVatXaf`, Bruno, Jest.

## Assumptions (agreed intent)

1. Formula: `ceil(added × unitPrice × daysLeft ÷ daysInPeriod)`, then `max(..., MIN_PRO_RATA = 1000 HT)`.
2. `daysLeft` = Douala calendar days from today inclusive through day before `paid_until` (midnight Douala boundary).
3. `daysInPeriod` = Douala days from previous period start inclusive to `paid_until` exclusive.
4. Adds only; no mid-period refunds; shrink still refused.
5. First purchase / renewal / grace / blocked: unchanged (full pack × seats).
6. Quote `totalXaf` = **amount due now** (TTC), aligned with create payment.

## Files

| File | Role |
|------|------|
| `src/modules/centers/billing-period.ts` | `periodStartBefore`, `wholeDaysRemaining` |
| `src/modules/centers/seat-prorata.ts` | Pure HT for mid-period addition |
| `src/modules/centers/seat-prorata.spec.ts` | Unit tests |
| `src/modules/centers/pricing.service.ts` | Optional helpers / constants export |
| `src/modules/centers/payments.service.ts` | Use prorata HT when midPeriod |
| `src/modules/centers/center-subscription.service.ts` | Quote mid-period amount |
| `src/modules/centers/dto/subscription-quote.dto.ts` | Extra response fields |
| `bruno/Center Payments Prorata/*` | Manual QA collection |
| `test/billing-period.spec.ts` | Day helpers |

## Tasks

- [x] Task 1: Douala day helpers + tests
- [x] Task 2: `midPeriodAdditionHt` / `priceSeatsDue` + tests (Alain 5 Jan → 23600, min charge)
- [x] Task 3: Wire payments create
- [x] Task 4: Wire quote + DTO + pricingContext
- [x] Task 5: Bruno collection `Center Payments Prorata`
- [ ] Task 6: Review + push
