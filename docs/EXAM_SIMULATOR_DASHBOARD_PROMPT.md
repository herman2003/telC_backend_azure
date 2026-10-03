# Build the exam simulator into the center dashboard

For the Next.js center dashboard team. The backend is finished, tested and on
`dev`. Nothing here is speculative: every endpoint below exists and every rule
below is enforced server-side, so a screen that disagrees with it will get a
400 rather than a wrong result.

Read this whole file before starting. The last section lists the mistakes that
would actually hurt.

---

## 1. What you are building

A center runs a telc B1 mock exam for its own students. The manager buys exam
places, creates a sitting, picks who may take it, publishes it, and afterwards
marks the two halves a machine cannot mark and releases the results.

The candidates sit the exam in the Flutter app. The dashboard never shows
questions — it sells, schedules, marks and releases.

Five screens:

1. **Exam credit** — how many places the center holds, and buying more.
2. **Sittings** — the list, and the wizard that creates one.
3. **Candidates** — who is admitted, and publishing.
4. **Marking** — Schreiben and Sprechen, candidate by candidate.
5. **Results** — the table, one candidate in detail, release, export.

All of it is under the existing center JWT. Same auth, same error envelope,
same layout as the rest of the dashboard.

---

## 2. The two products

| | MANUAL | AI |
|---|---|---|
| Price a candidate | 1,000 XAF | 1,500 XAF |
| Who marks Schreiben and Sprechen | a person | a person |
| What the machine does | nothing | writes a **suggestion** the marker reads first |

Say that plainly wherever the tier is chosen. The AI does not mark. It proposes
a number and some notes, and a trainer types their own. If your copy implies
otherwise, a center will sell certification it cannot back.

The two pools are counted separately and **cannot be spent as each other**. A
center holding 40 MANUAL places and 0 AI places cannot publish an AI sitting.

---

## 3. Screen by screen

### 3.1 Exam credit

```
GET  /api/centers/me/exam-slots
→ { slotsRemaining: number, aiSlotsRemaining: number }

POST /api/centers/me/exam-slots/purchase
Headers: Idempotency-Key: <uuid you generate per attempt>
Body:    { quantity: 1..N, tier?: "MANUAL" | "AI" }   // tier defaults to MANUAL
→ 201 { id, kind: "EXAM_SLOTS" | "EXAM_SLOTS_AI", quantity,
        unitPriceXaf, amountXaf, status: "PENDING", createdAt }
```

Then open checkout at `POST /api/payments/{id}/checkout` — **exactly the same
flow you already use for seats.** Notch Pay and Stripe, same components.

Rules:

- Show both balances side by side, always. A single number would hide the pool
  the manager actually needs.
- The purchase grants nothing. The balance only moves when the provider webhook
  confirms. Show the payment as pending and let the existing payments screen
  own the rest.
- Generate the `Idempotency-Key` **once per attempt** and reuse it across
  retries of that attempt. Reusing it for a different quantity is refused with
  a 409, which is the point.
- No minimum. A sitting for three is an ordinary thing a school does.

### 3.2 Creating a sitting

```
POST  /api/centers/me/exam-sessions
Body: { name, modelltestNumber, opensAt, accessWindowHours: 24 | 48 | 72 }

GET   /api/centers/me/exam-sessions            // list, newest first
GET   /api/centers/me/exam-sessions/:id
PATCH /api/centers/me/exam-sessions/:id        // only while it has not opened
```

`accessWindowHours` is a **choice of three**, not a free number. The closing
time is computed from it; never send `closesAt`.

A sitting's status is **derived on every read** — there is no status column and
no job that flips it:

| status | means |
|---|---|
| `DRAFT` | created, not published, nothing paid |
| `SCHEDULED` | published, opening time not yet reached |
| `OPEN` | candidates can sit it right now |
| `CLOSED` | window passed, or the manager closed it early |
| `CANCELLED` | called off |

Render from the `status` the API returns. Do not recompute it from dates in the
browser — a laptop with a wrong clock would show a button that 400s.

### 3.3 Candidates and publishing

```
GET /api/centers/me/exam-sessions/:id/eligible-students?page=&limit=&search=
→ { students: [{ id, firstName, lastName, email,
                 selected, trainedOnModelltest }], total }

PUT /api/centers/me/exam-sessions/:id/participants
Body: { studentIds: string[] }   // the WHOLE list, not a delta
```

`trainedOnModelltest: true` means this student has already worked through this
Modelltest in training. **Surface it as a warning next to their name** — an
exam on material the candidate has already seen measures nothing. Do not block
it; the manager may have a reason.

```
POST /api/centers/me/exam-sessions/:id/publish
Body: { gradingTier?: "MANUAL" | "AI" }   // defaults to MANUAL
→ { publishedAt, participantCount, slotsSpent,
    slotsRemaining,     // what is left in the pool that paid
    gradingTier }
```

This is the moment money is spent and the moment the tier is fixed. One slot
per admitted candidate, out of the pool matching `gradingTier`, in one
transaction with the publish.

Build the publish button as a confirmation dialog that states, before the
click: the tier, the candidate count, the slots this will spend, and the pool
balance afterwards. A manager should never discover the price after paying it.

- Tier is chosen **here**, not on the draft. Drafts are free; a draft that
  carried a tier would let someone edit their way into the expensive product.
- `NOT_ENOUGH_EXAM_SLOTS` → the chosen pool cannot cover every candidate.
  Publishing is refused entirely; four of six candidates is not a partial
  success. Link straight to the purchase screen, preselecting that tier.
- Publishing a second time is a 409, safely. A double-clicked button spends
  nothing twice.
- Adding a candidate to an **already published** sitting spends a slot right
  then, from that sitting's pool. Removing one refunds nothing. Say so in the
  UI before the save.

Three more actions:

```
POST /api/centers/me/exam-sessions/:id/cancel   // never a delete
POST /api/centers/me/exam-sessions/:id/close    // stop admitting now
POST /api/centers/me/exam-sessions/:id/reopen   // Body: { accessWindowHours }
```

Cancel is not delete, deliberately: it was published, students were told, and
somebody may ask in six months why it did not happen.

### 3.4 Marking

```
GET /api/centers/me/exam-attempts/:attemptId/result
```

Returns one candidate in full:

```ts
{
  attemptId, studentId, submittedAt, releasedAt,
  sections: [{ skill, teil, points, maxPoints, percent,
               markedBy: "SERVER" | "PERSON" | null }],
  written: { points, maxPoints, percent, passed },   // out of 225
  oral:    { points, maxPoints, percent, passed },   // out of 75
  outcome: "PASSED" | "FAILED" | "INCOMPLETE",
  awaiting: Skill[],          // what still needs a person
  suggestions: [ ... ]        // AI tier only; see below
}
```

```
PUT /api/centers/me/exam-attempts/:attemptId/marks
Body: { skill: "SCHREIBEN" | "SPRECHEN", teil: number,
        points: number, note?: string }
```

Only those two skills. Everything else is marked by the server the moment the
candidate submits the block, and `markedBy: "SERVER"` says so.

- **Points, not percentages.** `maxPoints` tells you the ceiling for that Teil.
  Validate against it in the form.
- Marking is repeatable. A trainer correcting their own mark is normal; the
  upsert replaces it and records who and when.
- Schreiben cannot be marked before the candidate has submitted that block
  (`BLOCK_NOT_SUBMITTED`). **Sprechen always can** — it happens in a room, not
  in the app, and the examiner may type the mark before the candidate has
  finished the written half. Do not gate Sprechen behind submission.

**The AI suggestions** (`suggestions`, empty unless the sitting is AI):

```ts
{ skill: "SCHREIBEN" | "SPRECHEN", source: "AI",
  points: number | null,     // already converted into telc points for that Teil
  maxPoints: number,
  notes: string | null,
  corrections: unknown,      // the model's structured feedback
  transcript: string | null } // Sprechen only: what the candidate said
```

Design this as a panel **beside** an empty mark field, never as a prefilled
value. Label it "AI suggestion" and keep the marker's input blank until they
type. A prefilled field is a mark nobody gave.

For Sprechen the transcript is the point of the product: the examiner reads
what the candidate said in the room, then types their number.

### 3.5 Results, release and export

```
GET /api/centers/me/exam-sessions/:id/results
→ { sessionId,
    candidates: [{ studentId, attemptId, firstName, lastName, email,
                   outcome: "PASSED"|"FAILED"|"INCOMPLETE"|"NOT_TAKEN",
                   written, oral, awaiting, releasedAt }],
    summary: { candidates, awaitingMarks, released, passed, failed } }
```

`NOT_TAKEN` is a candidate who was admitted and never started. They appear in
the table with no numbers — a missing row would be a candidate nobody noticed.

```
POST /api/centers/me/exam-sessions/:id/results/release
POST /api/centers/me/exam-attempts/:attemptId/results/release
Body: { allowIncomplete?: boolean }
```

Release is a **snapshot**. What the candidate sees is frozen at that instant
and never recomputed — so a later re-mark cannot silently change a verdict a
student has already read. If a mark changes, the center releases again and the
candidate is told again.

By default a release with anything still `awaiting` is refused:

```
400 { message: "RESULTS_INCOMPLETE", incomplete: 3, total: 15 }
```

Show those two numbers ("3 of 15 candidates still need a Sprechen mark") and
offer a second, explicit confirmation that sends `allowIncomplete: true`. That
path exists for the real case where an oral never happened — not as a default.

The candidate's released view deliberately excludes the AI suggestions. Those
are for the person deciding a mark, not the person receiving one.

```
GET /api/centers/me/exam-sessions/:id/results/export
```

Returns **rows, not a file**:

```ts
{ sitting: { sessionId, name, level, modelltest, modelltestTitle,
             centerName, opensAt, closesAt, exportedAt },
  rows: [{ studentId, firstName, lastName, email, outcome,
           writtenPoints, writtenMaxPoints, writtenPercent,
           oralPoints, oralMaxPoints, oralPercent,
           awaiting, releasedAt,
           sections: [{ skill, teil, points, maxPoints, percent }] }],
  summary: { ... } }
```

You generate the CSV and the PDF client-side. That was agreed with both
clients: the server ships numbers, the client formats them.

**Never compute a percentage or a total in the browser.** Every number you need
is in the payload. A percentage computed twice is a percentage that eventually
disagrees with the screen next to it.

`null` and `0` are different: `null` means unmarked, `0` means zero. Render
`null` as a blank cell, never as a zero. The header block exists so a
spreadsheet found in two years still says which exam it was — put it at the top
of both the CSV and the PDF.

---

## 4. The pass rule, for your copy

telc B1 is two halves, each passed separately:

- **Written**, 225 points: Lesen, Sprachbausteine, Hören, Schreiben.
- **Oral**, 75 points: Sprechen.
- 60% of each half. 60% overall with a weak half is a fail.

The backend computes this. Display `written.passed`, `oral.passed` and
`outcome` — do not re-derive them. But explain the rule somewhere near the
results table, because a manager seeing "68% overall — FAILED" will otherwise
file a bug.

`INCOMPLETE` means a human mark is missing, not that the candidate failed.
Style it as neutral, never as red.

---

## 5. Error codes you will actually hit

| code | when | what the screen should do |
|---|---|---|
| `NOT_ENOUGH_EXAM_SLOTS` | publishing, or adding a late candidate | offer the purchase screen, preselecting that tier |
| `EXAM_ALREADY_PUBLISHED` | double-clicked publish | treat as success, refresh |
| `OPENS_AT_IN_PAST` | publishing a sitting whose opening time has passed | ask for a new opening time |
| `NO_PARTICIPANTS` | publishing an empty sitting | send them back to the picker |
| `EXAM_ALREADY_OPEN` | editing a sitting candidates can sit | lock the form, explain why |
| `EXAM_CANCELLED` | anything on a cancelled sitting | read-only |
| `STUDENT_NOT_IN_CENTER` | a stale id in the picker | refresh the list |
| `RESULTS_INCOMPLETE` | releasing with marks missing | the two-step confirmation above |
| `BLOCK_NOT_SUBMITTED` | marking Schreiben too early | not an error state — just not markable yet |
| `EXAM_SESSION_NOT_FOUND` | another center's sitting, or a bad id | 404 page. It is deliberately not a 403 |

---

## 6. Things that would actually hurt

1. **Prefilling a mark field with the AI suggestion.** It is a second opinion.
   The whole product rests on a person typing the number.
2. **Recomputing anything.** Status, percentages, totals, pass/fail. All of it
   arrives computed. Every local copy is a future disagreement.
3. **Showing one slot balance.** Two pools, two numbers, never summed.
4. **Treating publish as free.** It spends money. Confirm with figures first.
5. **Hiding `NOT_TAKEN` candidates.** The absence is the information.
6. **Rendering `null` as `0`.** One says "nobody marked this", the other says
   "they scored nothing".
7. **A silent `allowIncomplete: true`.** Never send it without a second,
   explicit confirmation naming how many candidates are affected.

---

## 7. Where to check yourself

Swagger has every endpoint with request and response schemas, and its
descriptions carry the reasoning. Run the backend and open `/api/docs` — it is
the contract, and it is generated from the code that enforces it.
