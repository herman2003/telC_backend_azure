# Implementation Plan: Sprechen Teil 3 planen

> Execute with Addy: incremental-implementation + test-driven-development.

**Goal:** Elena exam-path Teil 3 = Gemeinsam etwas planen (Gesprächspartnerin).

**Architecture:** Rewrite `teil-3-examiner.txt`; assert via ExaminerPromptService tests; optional topic-block wording for Teil 3; no Mit Elena catalogue change.

## Task List

### Task 1: RED — tests for Teil 3 planen persona
- Files: `test/examiner-prompt.service.spec.ts`
- Acceptance: failing assertions that Teil 3 prompt contains planen / Gemeinsam and does not centre on debate-only framing
- Verify: `npx jest test/examiner-prompt.service.spec.ts`

### Task 2: GREEN — rewrite `teil-3-examiner.txt`
- Files: `src/config/prompts/teil-3-examiner.txt`
- Acceptance: Elena is planning partner; uses THEMA_JSON bullets as checklist; ~6 min; German only
- Verify: tests pass

### Task 3: Topic injection clarity (Teil 3)
- Files: `examiner-prompt.service.ts` (+ spec)
- Acceptance: when teil=3 and topic present, topic block says planning / Stichpunkte zur Planung
- Verify: unit test

### Task 4: Ship
- Commit, PR to `dev`, short Flutter prompt if needed
