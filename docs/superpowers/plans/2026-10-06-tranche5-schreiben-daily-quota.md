# Tranche 5 — Start Schreiben: 2 AI corrections / UTC day

> **For agentic workers:** TDD. Stop after this tranche until human says go.

**Goal:** Registered Start students may submit at most **2** training Schreiben AI corrections per UTC day.

**Architecture:**
- Count `writing_attempts` for the student where `exam_attempt_id` is null (training only), status `pending` or `completed`, `created_at >= utcDayStart`.
- Assert before creating a **new** attempt (idempotent retries of the same attemptId skip the check).
- Guests keep IP rate-limit only (no Start daily quota).
- No new `AiOperation` / migration.

**Out of scope:** Prep Pass gate.

---

## Task 1: RED

- [x] Unit: 3rd new submit in a day refused
- [x] Unit: allows when under daily cap
- [x] Exam attempts excluded via `exam_attempt_id: null` filter

## Task 2: GREEN

- [x] `WritingDailyQuotaService` + wire into `WritingService.submit`
- [x] 429 `writingDailyLimit`
- [x] Tests green

## Checkpoint

- [x] Unit tests green
- [ ] Stop before Tranche 6
