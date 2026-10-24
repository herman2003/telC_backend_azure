# ADR 0006 — AI Schreiben credits: assign from stock

**Status:** accepted — sold at **200 FCFA HT** per credit  
**Date:** 2026-10-24  
**Extends:** ADR 0005 pattern for a second prepaid product  
**Spec:** [ai-schreiben-credits.md](../domains/ai-schreiben-credits.md)

---

## Context

Start includes **two** training Schreiben AI corrections per student per UTC
day. Centres asked how to buy more. Three shapes were considered:

| | |
|---|---|
| **A** Prepaid Schreiben credits (mirror Mit Elena) | chosen |
| **B** Raise/skip the daily quota while `AI_ASSISTED_LEARNING` is active | rejected |
| **C** Raise Start’s free two for everyone | rejected |

B conflates Block 26 (“AI accompanies learning”) with letter top-ups and risks
unlimited Gemini spend inside a flat monthly fee. C gives every school more
corrections whether they want them or not.

Industry guidance for discrete, costly AI actions (prepaid credit burndown
with a hard stop) matches the pattern already shipping for oral:
`AI_SPEAKING_CREDIT`.

## Decision

Add **`AI_SCHREIBEN_CREDIT`**:

- Same **assign-from-stock** mechanics as `AI_SPEAKING_CREDIT` (ADR 0005):
  unallocated pool → seat `cap` (remaining) → spend decrements seat only;
  remove returns unused to unallocated.
- **Training only** — `POST /api/writing/submit` with `exam_attempt_id` null.
  Exam Day Schreiben marks stay human (AI-tier suggestions stay a separate
  Exam Day product, still not sold).
- **Spend order:** Start’s free **2 / UTC day** first, then one seat credit
  per correction, else `writingDailyLimit`.
- **Guests:** unchanged — IP rate limit only; no credits.
- **`AI_ASSISTED_LEARNING`:** untouched; reserved for Block 26.
- **Prep Pass:** still unlocks no IA.

Unit price: **200 FCFA HT** (cheaper than Mit Elena’s 300 — text correction
vs live audio). Toggle: `AI_SCHREIBEN_CREDITS_FOR_SALE` in
`entitlement-purchase.service.ts`.

## Alternatives considered

### Reuse `AI_ASSISTED_LEARNING` as a higher daily cap
Cheap to wire (`mayUse` in `WritingDailyQuotaService`). Rejected: wrong
product story, no hard stop on model cost, blocks a clean Block 26 later.

### Raise Start’s included two
No centre control. Rejected.

## Consequences

- Fourth `EntitlementProduct` value; purchase / assign / revoke APIs already
  accept product enums — extend price map, activation, student entitlements
  view, and the writing submit gate.
- Commercial sheet (`offres-lerniqo.md`) lists the offer at 200 FCFA / crédit.
- Centre dashboard should expose purchase/assign like Mit Elena; Bruno covers
  the HTTP path.
