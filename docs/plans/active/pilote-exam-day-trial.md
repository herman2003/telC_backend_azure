# Implementation Plan: Pilote Exam Day (free trial package)

## Overview

Replace the current free trial (14 days, **1** Start seat, **1** code, no
add-ons) with **Pilote Exam Day**: 14 days, **3** Start seats/codes, **6**
manual Exam Day slots, **9** Mit Elena credits and **6** Corrections Schreiben
IA credits in the centre pool. Locked commercial rules are below; this plan
only implements them.

**Not in scope:** Prep Pass in the trial, Exam Day IA, changing paid min seats
(10), freemium after day 14, frontend/dashboard copy beyond API contract.

## Locked product rules (approved)

| Rule | Value |
|------|--------|
| Name | Pilote Exam Day |
| Duration | 14 days (unchanged) |
| Start seats / codes | **3**, created when trial **starts** (not at register) |
| Start content | Full Start (same as paid Start seat) |
| Exam Day | **6** manual slots (`exam_slots_remaining`) |
| Mit Elena | **9** in pool (`AI_SPEAKING_CREDIT`) — centre assigns |
| Schreiben IA | **6** in pool (`AI_SCHREIBEN_CREDIT`) — centre assigns |
| Prep Pass | Not granted |
| Buy add-ons / Exam Day slots during trial | **No** |
| Buy Start seats during trial | **Yes** (conversion path — keep open) |
| Second trial | **No** (`TRIAL_ALREADY_USED` / `ALREADY_PAID`) |
| Clock | Trial button (`POST /api/centers/me/trial`) |
| Unused gifts after trial ends without pay | **Void** |
| Mid-trial conversion (pays seats) | Keep remaining slots/credits; retire dated trial codes as today |

## Flow

```
REGISTER
  → account + subscription TRIAL_PENDING
  → seat row stays quantity 1 (or 0) — no pilot codes yet
  → students cannot learn

POST /api/centers/me/trial
  → seats.quantity = 3
  → 3 activation codes (expires_at = trialEndsAt)
  → exam_slots_remaining += 6
  → pool AI_SPEAKING_CREDIT += 9
  → pool AI_SCHREIBEN_CREDIT += 6
  → trial_started_at / trial_ends_at set (14 days)
  → status TRIAL

HAND CODES → LEARN + up to 2 Exam Day sittings (3+3)
DAY 14 without pay → BLOCKED + void leftover slots/credits
PAY ≥10 seats anytime → retire dated codes, mint paid codes (existing path)
```

## Architecture decisions

1. **Grant everything in one transaction in `CenterTrialService.claimTrial`** —
   same atomicity as today’s clock + code: no trial without gifts, no gifts
   without a claimed trial.
2. **Constants in one place** on `center-trial.service.ts` (or a tiny
   `trial-package.ts` next to it): seats, slots, Elena, Schreiben. Registration
   keeps creating a placeholder seat; trial start **sets** quantity to 3.
3. **Void = lazy cleanup when policy is BLOCKED and `paid_until` is null** —
   zero `exam_slots_remaining` and zero the two AI pools (and clear seat caps
   for those products). Prefer check-on-read / first gated action over a cron,
   matching how subscription status is derived. Do **not** rely only on
   entitlement `frozen`: paying later would unfreeze leftover free credits.
4. **Refuse add-on / Exam Day purchases while status is `TRIAL` or
   `TRIAL_PENDING`**; seat payments (`SEATS`) stay allowed. Error key e.g.
   `TRIAL_ADDONS_NOT_FOR_SALE`.
5. **API response change:** `TrialStartedDto` returns `codes: ActivationCodeDto[]`
   (length 3), not a single `code`. Breaking for the dashboard — document in
   D3 / Bruno.
6. **`retireTrialCodes` already finds all dated codes** — three trial students
   convert without a new retirement design.

## Task list

### Phase 0: Permanent docs (same PR as code, or first commit)

#### Task 0: Record the approved package

**Description:** Update the authoritative trial rules so D3 and the offer sheet
match the locked card. Do not leave the plan as the only source.

**Acceptance criteria:**
- [ ] `docs/contracts/center-dashboard-sync.md` D3: 14 days, **3** seats/codes,
      gifts (6 slots, 9 Elena, 6 Schreiben), grant at trial start, void on
      unpaid expiry, no add-on purchase during trial
- [ ] `docs/domains/offres-lerniqo.md`: short “Pilote Exam Day” trial section
- [ ] Stale “1 seat / one code” wording in controller OpenAPI text updated

**Verification:** Human skim of D3 + offres.

**Dependencies:** None

**Files likely touched:**
- `docs/contracts/center-dashboard-sync.md`
- `docs/domains/offres-lerniqo.md`
- `src/modules/centers/center-subscription.controller.ts` (description only)

**Estimated scope:** S

---

### Phase 1: Grant package on trial start

#### Task 1: Constants + seat bump + 3 codes

**Description:** On successful trial claim, set `center_seats.quantity` to 3
(unit price stays 0) and create **3** codes with `expires_at = endsAt`. Return
all three from `start()`.

**Acceptance criteria:**
- [ ] `TRIAL_PACKAGE_SEATS = 3` (name as you like)
- [ ] After start, seat quantity is 3; three codes share the same `expires_at`
- [ ] Predicated claim unchanged (double-press → one trial)
- [ ] `TrialStartedDto` / response: `codes` array (length 3)

**Verification:**
- [ ] Unit: `test/center-trial.spec.ts` rewritten for 3 codes + seat update
- [ ] `npx jest test/center-trial.spec.ts` exit 0

**Dependencies:** Task 0 preferred

**Files likely touched:**
- `src/modules/centers/center-trial.service.ts`
- `src/modules/centers/dto/activation-code.dto.ts`
- `src/modules/centers/center-subscription.controller.ts`
- `test/center-trial.spec.ts`
- `test/center-subscription.controller.spec.ts`

**Estimated scope:** M

---

#### Task 2: Grant Exam Day slots + entitlement pools

**Description:** In the same transaction as Task 1, increment
`exam_slots_remaining` by 6 and upsert pool balances
`AI_SPEAKING_CREDIT += 9`, `AI_SCHREIBEN_CREDIT += 6`. Do not auto-assign to
codes.

**Acceptance criteria:**
- [ ] Fresh trial centre: slots remaining ≥ 6 (exactly 6 if started at 0)
- [ ] Pools show balances 9 and 6; assignable via existing entitlement routes
- [ ] No Prep Pass grant

**Verification:**
- [ ] Unit/integration assertions on trial start side effects
- [ ] Optional: thin integration against `.env.test`

**Dependencies:** Task 1

**Files likely touched:**
- `src/modules/centers/center-trial.service.ts`
- `test/center-trial.spec.ts`
- possibly `test/center-trial-integration.spec.ts` (new)

**Estimated scope:** M

---

### Checkpoint: After Tasks 1–2

- [ ] Trial start grants 3 codes + 6 slots + pools 9/6 in one transaction
- [ ] Unit tests green
- [ ] Human spot-check with Bruno against test DB (if available)

---

### Phase 2: Abuse / cost guards

#### Task 3: Block add-on and Exam Day purchases during trial

**Description:** While subscription status is `TRIAL` or `TRIAL_PENDING`, refuse
creating payments for `EXAM_SLOTS`, `EXAM_SLOTS_AI`, and entitlement products.
`SEATS` payments remain allowed so conversion works.

**Acceptance criteria:**
- [ ] Trial centre: Exam Day purchase → 4xx with stable message key
- [ ] Trial centre: Elena / Schreiben / Prep Pass purchase → same
- [ ] Trial centre: SEATS payment create still succeeds
- [ ] Paid / grace centres unchanged

**Verification:**
- [ ] Unit or integration covering the three refusal paths + seats allowed
- [ ] Exit code of the chosen suite

**Dependencies:** Tasks 1–2 (can start after Task 1 if needed)

**Files likely touched:**
- `src/modules/centers/exam-slots.service.ts` (or purchase entry)
- `src/modules/centers/entitlement-purchase.service.ts`
- `src/modules/centers/payments.service.ts` (if seats-only path is shared)
- matching tests

**Estimated scope:** M

---

#### Task 4: Void unused gifts when trial expires unpaid

**Description:** When status resolves to `BLOCKED` and `paid_until` is null
(expired trial, not a lapsed paid centre), clear leftover trial gifts:
`exam_slots_remaining = 0`, zero `AI_SPEAKING_CREDIT` and `AI_SCHREIBEN_CREDIT`
pools, clear seat caps for those two products. Invoke lazily from a single
helper called on relevant centre reads / spend gates (slots assign, entitlement
spend overview, or subscription evaluate path) so a cron is not required.

**Acceptance criteria:**
- [ ] After `trial_ends_at` with no payment: slots 0, pools 0, caps cleared
- [ ] Lapsed **paid** centre does not lose purchased slots/credits via this path
- [ ] Mid-trial SEATS activation still retires dated codes; remaining gifts may
      stay until natural use (do not void on convert)

**Verification:**
- [ ] Spec with frozen clock: start trial → advance past end → assert void
- [ ] Spec: paid centre with slots, past `paid_until`, grace/block — gifts from
      purchases not wiped by trial void helper

**Dependencies:** Task 2

**Files likely touched:**
- new small helper e.g. `trial-gift-void.service.ts` or method on trial service
- call sites: exam participants / exam slots read, entitlements overview
- tests

**Estimated scope:** M

---

### Checkpoint: After Tasks 3–4

- [ ] Cannot buy add-ons on trial; can buy seats
- [ ] Expired unpaid trial cannot spend leftover slots/credits
- [ ] Unit + targeted integration green

---

### Phase 3: Conversion + API contract polish

#### Task 5: Confirm payment activation with 3 trial codes

**Description:** Existing `retireTrialCodes` + `mintMissingCodes` should move up
to three connected students and top up to paid seat count. Add/adjust
integration coverage for “3 trial codes, 2 connected → pay 10 seats”.

**Acceptance criteria:**
- [ ] All dated trial codes deactivated; connected students on paid codes
- [ ] Centre ends with `quantity` paid codes (non-deactivated count)

**Verification:**
- [ ] Extend `test/payment-activation-integration.spec.ts` (or equivalent)
- [ ] Exit code 0

**Dependencies:** Task 1

**Files likely touched:**
- `test/payment-activation-integration.spec.ts`
- only touch `payment-activation.service.ts` if a real bug appears

**Estimated scope:** S–M

---

#### Task 6: Bruno + registration seat comment

**Description:** Update Bruno trial request expectations for `codes[]`. Confirm
registration still creates a non-pilot seat row (quantity 1 is fine as
placeholder; document why). No dashboard app work in this repo.

**Acceptance criteria:**
- [ ] Bruno trial request documents 3 codes + package side effects
- [ ] Controllers’ OpenAPI text matches behaviour

**Verification:** Report blocked if no safe `.env.test` Bruno run; else run the
trial request manually.

**Dependencies:** Tasks 1–2

**Files likely touched:**
- `bruno/` trial-related `.bru`
- comments in `centers.service.ts` if seat placeholder needs clarifying

**Estimated scope:** S

---

### Checkpoint: Complete

- [ ] Five gates: `npx tsc --noEmit`, `npm run build`, `npx jest`,
      `npm run test:integration`, `npm run test:e2e` — **exit codes**
- [ ] D3 + offres match code
- [ ] Plan ready to archive after merge
- [ ] PR opened against `dev` (never push to `dev`/`main` directly)

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Dashboard still expects single `code` | High | Coordinate DTO change; return `codes` and briefly keep deprecated `code` = `codes[0]` only if product asks — default is clean break |
| Void runs on paid centres | High | Gate on `paid_until === null` + expired trial timestamps |
| Trial centres buy cheap Exam Day forever | Med | Task 3 purchase guard |
| Double-grant on retry after partial failure | Med | Single transaction in `claimTrial` |
| Cost blow-up via Start free quotas | Med | Accepted product risk; seats capped at 3; document max exposure separately |

## Open questions

None blocking — package and rules approved. Optional later:

- Whether response should include package summary fields (`seats`, `examSlots`,
  pool balances) for the dashboard, or force a follow-up `GET /me`.
- Exact HTTP status for `TRIAL_ADDONS_NOT_FOR_SALE` (409 vs 403) — pick one and
  stick to centre error conventions.

## Out of scope

- Changing `MIN_PAID_SEATS_TOTAL`
- Auto-assigning Elena/Schreiben to the three codes
- Granting Prep Pass
- Frontend/Flutter/dashboard UI
- Cost spreadsheet (ops, outside this plan)
