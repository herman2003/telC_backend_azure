# Implementation Plan: A1/A2 Exam Day results can be completed

**Status:** implemented, in review. Archive once merged; the rule lives in `docs/domains/exam-simulator.md` ("Who marks what at A1/A2").
**Weight:** High risk — exam results. Full gates, independent review in a
fresh context, Bruno over HTTP through to a final verdict.

## Why

An A1/A2 exam can never reach PASSED or FAILED today. Found while planning
A1 (verified in code, not in production — A2 has not been sold):

1. The auto-scored Schreiben form (Teil 1) is stored on `writing_attempts`,
   which `exam-result.service.ts` never reads as a mark
   (`marksForMany`, ~742–830), so Schreiben always shows as awaiting.
2. An examiner cannot mark Schreiben: `exam-grading.service.ts:81–86`
   requires a block named `SCHREIBEN` to be submitted. A1/A2 sit Schreiben
   in `LESEN_SCHREIBEN`, so this is `BLOCK_NOT_SUBMITTED` forever.
3. The examiner cannot see the letter: `schreibenSubmissionsFor`
   (~441–503) reads only the `SCHREIBEN` block, and keeps one writing row
   per attempt although A1/A2 store two (form + letter).
4. The form's auto score is shown as an "AI suggestion" (`suggestionsFor`,
   ~229–241), because any scored writing row is treated as the AI's.
5. Decision 1 (B): an answer the matcher does not recognise must go to the
   examiner, not be marked wrong. The content contract already says so
   (`unrecognizedAnswerPolicy: MANUAL_REVIEW`); it was never built. This
   also reaches A2 Hören Teil 1 (free text), which examiners may not mark
   today (`HUMAN_MARKED` is Schreiben/Sprechen only).

B1/B2 are not affected: they have a `SCHREIBEN` block and one Schreiben Teil.

## Design (approved)

All changes apply to A1/A2 (`GENERIC_MODEL_LEVELS`) only; the B1/B2 path is
kept byte-identical and equality-tested.

- **Marks are frozen at submit, in one place.** When a generic-model block is
  scored, every auto-scored Teil whose answers were all recognised gets an
  `exam_section_results` row with its points, `graded_by = 'SERVER'`. A Teil
  with any unrecognised answer gets **no** row: it waits for the examiner.
  Recomputing marks on read was rejected — a later answer-key correction
  would silently change results already given to candidates.
- **The result reads A1/A2 marks from `exam_section_results` only** (server
  and examiner rows); the per-skill attempt tables keep the answers for
  history but stop being the source of the verdict. **Awaiting** becomes "any
  weighted Teil with no mark" at A1/A2; B1/B2 keep "Schreiben/Sprechen with
  no mark".
- **Who may mark what:** Schreiben and Sprechen as today, plus — at A1/A2 —
  any Teil with no mark (i.e. awaiting review). A server mark cannot be
  overwritten: an exam is not negotiable.
- **When:** once that Teil's own block (`exam_section_weights.block`) is
  submitted; Sprechen (no block) as today.
- **What the examiner sees:** `schreibenSubmission` keeps its shape and, at
  A1/A2, carries the letter (the human-marked Schreiben Teil). New, additive:
  each Teil awaiting review lists the unrecognised answers and a provisional
  score. The dashboard only gains fields.
- **Suggestions:** only real AI evaluations; the form's score is not one.

## Tasks

### 1. Matching tells "wrong" from "not recognised"
`generic-section-scoring.ts`: alongside the score, report which items had an
answer that matched no accepted answer (free-text types: `KURZANTWORT`,
`FORMULAR_AUSFUELLEN`; an empty answer is wrong, not unrecognised). Closed
types (`EINZELAUSWAHL`, `RICHTIG_FALSCH`, `ZUORDNUNG`) are never
"unrecognised". Pure function, unit-tested.

### 2. Scoring freezes server marks (`exam-scoring.service.ts`)
At A1/A2, after scoring a block: an `exam_section_results` upsert (points =
correct items × max_points ÷ items, `graded_by = 'SERVER'`) for each fully
recognised auto Teil; no row for a Teil needing review, and a stale server
row removed on re-scoring. Submit response marks the review Teil
`pending: true`. B1/B2 untouched.

### 3. Results read A1/A2 marks correctly (`exam-result.service.ts`)
Generic levels: marks from `exam_section_results` only; awaiting = any Teil
without a mark; `schreibenSubmission` from `LESEN_SCHREIBEN`, the letter's
row; review details per awaiting Teil; no form score among AI suggestions.

### 4. Examiners can mark A1/A2 (`exam-grading.service.ts`)
Block gate from the Teil's own block; at A1/A2 allow any Teil with no mark;
refuse overwriting a `SERVER` mark. B1/B2 rules unchanged.

### 5. Bruno and docs
`bruno/A2 Level`: the centre marks Schreiben Teil 2 and Sprechen 1–3, the
result becomes PASSED or FAILED; a submitted unrecognised form answer leaves
Schreiben Teil 1 awaiting, the examiner marks it, the result completes;
marking a server-marked Teil is refused. Domain doc
(`docs/domains/exam-simulator.md`) records who marks what at A1/A2.

## Acceptance

- [ ] Every existing B1/B2 scoring, grading and result test passes with its
      assertions unchanged
- [ ] An A2 attempt reaches PASSED/FAILED over HTTP once Schreiben Teil 2 and
      Sprechen are marked
- [ ] An unrecognised free-text answer leaves only that Teil awaiting, with
      its unrecognised answers visible to the examiner
- [ ] A server mark cannot be overwritten; an examiner mark can be corrected
- [ ] Gates: tsc, build, unit, integration, e2e, lint ≤ baseline (CI's command)
- [ ] Independent review before the PR

## Non-goals
- Training (non-exam) scoring of A1/A2 — a later task.
- Any B1/B2 behaviour change.
