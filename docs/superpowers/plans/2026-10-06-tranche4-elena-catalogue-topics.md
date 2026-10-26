# Tranche 4 — Mit Elena: catalogue topics on live-token

> **For agentic workers:** TDD. Stop after this tranche until human says go.

**Goal:** Student can start Elena with a **Lerniqo catalogue topic** (`SPEAKING_TOPICS`) paid by **credits only**. Exam path (`teilNumber` + Modelltest) unchanged (free then credits).

**Architecture:**
- `POST live-token` accepts **either** `teilNumber` (+ optional modelltest) **or** `topicId`.
- `topicId` → resolve from `SPEAKING_TOPICS`, prompt via Teil persona matching `topic.teil` (today always 2), spend with `allowFree: false`.
- `GET /api/speaking/elena-topics` lists catalogue topics for the app.
- No new theme content — reuse existing data file.

**Out of scope:** Schreiben ×2, Prep Pass gate.

---

## Task 1: RED — live-token + spend

- [x] Unit: `topicId` mints token, spend called with allowFree false, countsTowardFree false
- [x] Unit: refuses unknown topicId
- [x] Unit: refuses both teilNumber and topicId together / neither
- [x] Unit: exam path still works with teilNumber

## Task 2: GREEN

- [x] DTO validation
- [x] Controller branch + `allowFree` on entitlements
- [x] GET elena-topics
- [x] Tests green

## Checkpoint

- [x] Unit tests green
- [ ] Stop before Tranche 5
