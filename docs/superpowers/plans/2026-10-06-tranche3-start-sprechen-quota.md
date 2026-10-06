# Tranche 3 — Start Sprechen free quota (offer A)

> **For agentic workers:** TDD. Stop after this tranche until human says go.

**Goal:** Start free Elena (exam Teile) = **1 session / Teil / UTC day**, **max 12 / month**. Credits still apply when free cannot cover the request.

**Architecture:**
- Raise `FREE_LIVE_SESSIONS_PER_MONTH` from 5 → **12**.
- Add `teil_number` + `counts_toward_free` on `ai_usage`.
- Free count = rows with `counts_toward_free` this month.
- Per-Teil day gate: if this Teil already has a free row today, do not use free → try credits.
- `spend` returns whether free or credit was used; `recordDelivered` stores teil + flag.

**Out of scope this tranche:** Schreiben ×2/day, Mit Elena theme catalogue (tranche 4), Prep Pass content gate.

**Tech Stack:** Prisma migration, NestJS, Jest

**Spec:** `docs/OFFRES_LERNIQO.md` § Sprechen Modul

---

## Task 1: Schema

- [x] Migration: `teil_number INT NULL`, `counts_toward_free BOOLEAN NOT NULL DEFAULT true`
- [x] Index useful for day/teil lookup (optional composite)

## Task 2: RED then GREEN — spend / freeRemaining

- [x] Monthly allowance constant = 12
- [x] `mayUse` / `spend` accept optional `teilNumber`
- [x] Same Teil twice same day → second uses credit (or refuses if no credit)
- [x] Different Teile same day → free allowed (up to monthly 12)
- [x] Live-token passes `dto.teilNumber` into spend + record

## Task 3: Catalogue / DTO copy

- [x] `plans.catalog` picks up 12 via constant
- [x] `my-entitlements.dto` description updated

## Checkpoint

- [x] Targeted integration green
- [ ] Stop before Tranche 4 (Mit Elena thèmes / Prep Pass gate / Schreiben ×2)
