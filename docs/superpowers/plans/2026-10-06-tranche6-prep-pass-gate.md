# Tranche 6 — Prep Pass content gate

> **For agentic workers:** TDD. Stop after this tranche until human says go.

**Goal:** Training library (Modelltests + Hören / Lesen / Sprachbausteine) requires an **active Prep Pass**. Sprechen/Schreiben **topic GETs** stay on Start; AI paths (live-token, writing submit) stay Start — Prep Pass does not unlock AI.

**Architecture:**
- `PrepPassGuard` → `entitlements.mayUse(PREP_PASS)`; 403 `{ messageKey: 'prepPassRequired' }`.
- Apply on: `ModelltestsController`, `ListeningController`, `LesenController`, `SprachbausteineController`.
- Do **not** apply on: `WritingController` submit/AI, `LiveTokenController`, speaking evaluate (Start AI).
- Speaking catalog `GET teils` (topics): keep Start subscription only (sujets).
- Update `OFFRES_LERNIQO.md`: Start no longer lists Modelltests as included; Prep Pass owns the séries.

**Out of scope:** Separate content DB; Flutter UI.

---

## Task 1: Guard + unit tests

## Task 2: Wire controllers + offer doc tweak

## Checkpoint

- [x] Stop. Summarize launch coding status.
