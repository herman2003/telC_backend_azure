# Spec: Center visibility of exam Schreiben text

## Status

Implemented on backend (`feat/center-exam-schreiben-visibility`). Front
marking UI / download still open — see `docs/things-to-do-after.md`.

## Problem

When a candidate submits the exam `SCHREIBEN` block, the letter text is stored
(`writing_attempts.content`, and also on `exam_attempt_blocks.answers` as
`{ text }`). The center manager must mark it by hand on both tiers:

| Tier | Price | Who marks Schreiben |
|------|------:|---------------------|
| `MANUAL` | 1,000 XAF | person only |
| `AI` | 1,500 XAF | person (AI may propose) |

Today the dashboard APIs expose awaiting marks and (on AI) suggestions, but
**never the candidate’s text**. A manager cannot read or download the letter
before typing points. That breaks the 1,000 XAF product promise: the school
marks the writing themselves.

## Goal

A signed-in center manager can:

1. **Read** the candidate’s exam Schreiben text on the marking screen.
2. **Download** that text (client builds a `.txt` / file from the API payload;
   the server returns the string, not a generated PDF).
3. Do this on **both** `MANUAL` and `AI` sittings.
4. Keep AI suggestions as a separate panel (AI tier only) — never a substitute
   for the text, never a prefilled mark.

## Non-goals

- Changing pricing, slot spend, or grading-tier rules.
- Auto-scoring Schreiben on `MANUAL`.
- Showing Schreiben text on the student released result (they wrote it; the
  center mark/snapshot flow stays as today).
- Shipping binary PDF/DOCX from the server (same decision as exam export:
  numbers/text from API, client formats).
- Surfacing exam Schreiben in training readiness / `GET .../students`.

## Source of truth

Prefer **`writing_attempts.content`** where `exam_attempt_id = attemptId`.

Fallback if a row is missing but the block was submitted: read
`exam_attempt_blocks.answers` for `block = SCHREIBEN` and take `answers.text`
when it is a string.

If the Schreiben block is not submitted: `text = null` (marking already refused
with `BLOCK_NOT_SUBMITTED`).

## API contract

### Extend attempt detail (primary)

```
GET /api/centers/me/exam-attempts/:attemptId/result
```

Add a field (name fixed for this spec):

```ts
schreibenSubmission: {
  text: string | null;       // full letter; null if not submitted / empty
  submittedAt: Date | null;  // block submitted_at
  characterCount: number;    // text.length when text != null, else 0
} | null                     // null only if attempt has no SCHREIBEN block yet
```

Existing fields unchanged: `sections`, `written` / `oral`, `outcome`,
`awaiting`, `suggestions`.

Rules:

- Scoped by center in the query (same as today): other school → `404
  EXAM_ATTEMPT_NOT_FOUND`.
- Returned for **MANUAL and AI**.
- Do **not** put the letter inside `suggestions`.
- Do **not** include `schreibenSubmission` on the student
  `GET /api/exams/attempts/:attemptId/result` released snapshot.
- Session table
  `GET /api/centers/me/exam-sessions/:sessionId/results` stays summary-only
  (no full essays in a 400-row payload).

### Extend export (download / CSV)

```
GET /api/centers/me/exam-sessions/:sessionId/results/export
```

Add per candidate row:

```ts
schreibenText: string | null;
```

So the dashboard can build a spreadsheet or a per-student download without a
second round-trip for bulk export. Detail view still uses attempt `result` for
the marking UI.

### Optional thin download (defer unless product insists)

A dedicated `GET .../exam-attempts/:attemptId/schreiben` returning
`text/plain` is **not required** for v1 if `schreibenSubmission.text` is on
the detail endpoint and the front triggers a file download. Add later only if
the client needs a direct link.

## Security and privacy

| Abuse | Control |
|-------|---------|
| Manager reads another school’s letter | Query scoped by `session.center_id` |
| Student / guest token hits center route | Existing `CenterAuthGuard` |
| Letter leaked on student release | Strip / never include in release snapshot |
| Oversized payload on session list | Essays only on attempt detail + export |

No new auth roles. Same center bearer as other exam-results routes.

## Frontend expectations (`sprach`)

Out of backend scope to implement, but the contract assumes:

1. Marking page loads `GET .../exam-attempts/:id/result`.
2. Shows `schreibenSubmission.text` (scrollable) beside the points form.
3. “Download” button → client saves text as
   `{lastName}_{firstName}_schreiben.txt` (or similar).
4. AI panel still uses `suggestions` only; never prefill marks from AI.

## Data / migration

**None.** Content already exists on `WritingAttempt` and the attempt block.

## Acceptance (product)

- [ ] On a **1,000 XAF** sitting, after the candidate submits Schreiben, the
      manager opens attempt result and sees the letter text.
- [ ] Manager can download that text from the dashboard (client file from API
      string).
- [ ] On a **1,500 XAF** sitting, text is visible **and** AI suggestions still
      appear separately when ready.
- [ ] Before Schreiben submit, text is null / UI shows “not submitted yet”;
      mark still returns `BLOCK_NOT_SUBMITTED`.
- [ ] Student released result does not gain the center-only submission payload.
- [ ] Export rows include `schreibenText` for submitted candidates.

## References

- `docs/domains/exam-simulator.md` — tiers 1,000 / 1,500
- `docs/archive/exam-simulator-dashboard-prompt.md` — §3.4 Marking
- `src/modules/centers/exam-scoring.service.ts` — `storeWriting`
- `src/modules/centers/exam-result.service.ts` — `forAttempt` / `suggestionsFor`
- `src/modules/centers/exam-results.controller.ts`
- `src/modules/centers/exam-export.service.ts`
