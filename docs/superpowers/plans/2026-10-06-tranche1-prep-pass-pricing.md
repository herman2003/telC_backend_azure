# Tranche 1 — Prep Pass launch pricing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Align Prep Pass billing constants with launch offer: **1 000 FCFA**, **30 days**.

**Architecture:** Change the two source-of-truth constants (`PREP_PASS` unit price, `PREP_PASS_DAYS`). Update tests that assert the old numbers. No schema migration. No content gating (that is a later tranche).

**Tech Stack:** NestJS, Prisma, Jest

**Spec:** `docs/OFFRES_LERNIQO.md` — Prep Pass 1 000 FCFA / 30 jours

## Global Constraints

- Do not gate Prep Pass content in this tranche.
- Do not change Exam Day AI, Mit Elena, or Start quotas here.
- Keep AI Assisted Learning constants untouched.

---

## Task 1: Failing tests for new price and duration

**Acceptance criteria:**
- [x] Purchase test expects `unitPriceXaf: 1_000` (and VAT total for qty 6).
- [x] Unit test expects period grant days `30`, not `60`.
- [x] Payment helper for Prep Pass uses `1000`.

**Files:**
- `test/entitlement-purchase-integration.spec.ts`
- `test/entitlements.service.spec.ts`
- `test/payment-activation-integration.spec.ts`

**Steps:**
- [x] Update test expectations to 1000 / 30
- [x] Run tests — confirm RED (implementation still 3000 / 60)

---

## Task 2: Change constants

**Acceptance criteria:**
- [x] `PREP_PASS` list price is `1_000`
- [x] `PREP_PASS_DAYS` is `30`
- [x] Comments that say "sixty days" for Prep Pass updated to thirty

**Files:**
- `src/modules/centers/entitlement-purchase.service.ts`
- `src/modules/centers/entitlements.service.ts`
- `src/modules/centers/entitlements.controller.ts` (Prep Pass wording only)

**Steps:**
- [x] Change constants
- [x] Update comments
- [x] Run the three test files — GREEN

---

## Checkpoint after Tranche 1

- [x] Targeted unit tests pass
- [ ] Stop. Do not start Tranche 2 until human says go.
