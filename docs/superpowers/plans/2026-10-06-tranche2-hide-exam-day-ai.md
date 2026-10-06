# Tranche 2 — Hide Exam Day AI purchase (launch)

> **For agentic workers:** TDD. Stop after this tranche until human says go.

**Goal:** Centres cannot **buy** Exam Day AI slots at launch. Keep AI pricing, pools, publish, and activation code for later.

**Architecture:** One launch flag `EXAM_AI_SLOTS_FOR_SALE = false`. `quote` / `purchase` refuse `tier: 'AI'`. Balance, fingerprint, publish, and webhook activation unchanged.

**Tech Stack:** NestJS, Jest

**Spec:** `docs/OFFRES_LERNIQO.md` — Exam Day IA = P (pas vendu)

---

## Task 1: RED — tests expect AI purchase refused

- [x] Unit: purchase/quote with `AI` → `EXAM_AI_TIER_NOT_AVAILABLE`
- [x] Unit: MANUAL purchase still works; AI price constant still 1500
- [x] Integration: AI purchase refused; activation of an existing `EXAM_SLOTS_AI` payment still credits AI pool

---

## Task 2: GREEN — flag + refuse

- [x] `EXAM_AI_SLOTS_FOR_SALE = false` in `exam-slots.service.ts`
- [x] Refuse in `quote` and `purchase`
- [x] Message in `center-exception.filter.ts`
- [x] DTO swagger note: AI not for sale at launch

---

## Checkpoint

- [x] Unit tests green
- [x] Integration tests green (AI pool + refusal)
- [ ] Stop. Wait for human before Tranche 3.
