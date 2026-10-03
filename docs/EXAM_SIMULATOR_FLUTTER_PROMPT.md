# Build the exam simulator into the Lerniqo app

For the Flutter team (web and mobile, one codebase). The backend is finished,
tested and on `dev`. Every endpoint and every rule below exists and is enforced
server-side — a screen that disagrees with it gets a 400, not a wrong grade.

Read the whole file first. Section 8 is the part that decides whether a real
exam survives a lost connection.

---

## 1. What you are building

A student's center runs a telc B1 mock exam. The student sits it **in the app**,
under a real clock, and their center marks the two halves a machine cannot mark
and releases the result.

This is not training. Training is forgiving: retry, replay, check the answer.
The exam is not. Everything below exists because of that difference.

A sitting has **three timed blocks, in order**:

| order | block | minutes | what is in it |
|---|---|---|---|
| 1 | `LESEN_SPRACHBAUSTEINE` | 90 | Lesen and Sprachbausteine together |
| 2 | `HOEREN` | 30 | listening |
| 3 | `SCHREIBEN` | 30 | the letter |

**Sprechen happens in the center, with a human examiner, not in the app.** The
only exception is section 7.

The block order is enforced. Starting Hören before submitting the first block
is `BLOCK_OUT_OF_ORDER`.

---

## 2. Auth, and one thing that is different

Everything is under the normal student JWT.

**Do not apply the subscription gate to these routes.** An exam is paid for by
the candidate's center, per candidate. A student with no active subscription
still sits an exam their center bought. The backend deliberately does not run
`StudentSubscriptionGuard` here; if your client blocks it locally, a paid-for
candidate cannot sit their exam.

---

## 3. Finding and starting an exam

```
GET /api/exams/sessions
→ [{ sessionId, name, level, status, opensAt, closesAt,
     attemptId, submittedAt }]
```

`status` is `DRAFT | SCHEDULED | OPEN | CLOSED | CANCELLED`, computed by the
server on every read.

Render from that field. Do not derive it from `opensAt`/`closesAt` on the
device — a phone set to the wrong hour would show a Start button that fails, or
hide one that works.

- `SCHEDULED` → "Opens 5 October at 09:00", no button.
- `OPEN` → Start (or Continue, if `attemptId` is set).
- `CLOSED` / `CANCELLED` → no button, say which.

```
POST /api/exams/sessions/:sessionId/start
→ the attempt
```

Called twice, it returns **the same attempt**. An exam you can restart is not
an exam. So "Start" and "Continue" are the same call — you never need to decide
which to send.

Refusals: `EXAM_NOT_OPEN`, `NOT_A_PARTICIPANT` (404 — not admitted).

---

## 4. The clock

This is the part to get exactly right.

```
GET  /api/exams/attempts/:attemptId
→ { id, sessionId, startedAt, submittedAt,
    serverNow,
    blocks: [{ block, position, minutes, state,
               startedAt, deadlineAt, remainingSeconds }] }

POST /api/exams/attempts/:attemptId/blocks/:block/start
→ { block, startedAt, deadlineAt, serverNow, remainingSeconds }
```

`deadlineAt` is an **absolute instant**, not a duration. `serverNow` is the
server's clock at that moment.

Compute the offset once, when a response arrives:

```dart
final offset = serverNow.difference(DateTime.now());
// then, every tick:
final remaining = deadlineAt.difference(DateTime.now().add(offset));
```

Tick locally from that. Do not poll the server every second, and do not trust
the device clock on its own.

- Starting a block again after a refresh, a crash, or an app switch returns
  **the same `deadlineAt`**. Time spent is spent. Do not treat a fresh call as
  a fresh timer, and never store "minutes remaining" anywhere.
- `GET /attempts/:attemptId` is what a cold start calls. It rebuilds the whole
  screen: which blocks are done, which is running, how long is left.
- When the countdown hits zero, submit (section 6). Do not freeze the UI and
  wait for the student.

Refusals on start: `BLOCK_OUT_OF_ORDER`, `BLOCK_IN_PROGRESS`,
`BLOCK_ALREADY_SUBMITTED`.

---

## 5. The questions

```
GET /api/exams/attempts/:attemptId/blocks/:block
→ { block,
    sections,        // the Teile, keyed by skill — the same shapes training uses
    savedAnswers,    // what this candidate has already saved
    deadlineAt, serverNow, remainingSeconds }
```

Same question shapes your training screens already render, with **every answer
key removed** server-side. Reuse the training widgets.

Only for a block that is currently running (`BLOCK_NOT_STARTED` otherwise). The
whole paper at once would let a candidate read the Schreiben task during the
ninety minutes meant for Lesen.

`savedAnswers` is why a reload restores the paper instead of blanking it.
Always hydrate from it.

---

## 6. Answers: saving and submitting

```
PUT  /api/exams/attempts/:attemptId/blocks/:block/answers
Body: { answers: { "LESEN_1": { "1": "a" }, "SPRACHBAUSTEINE_1": { "21": "21b" } } }

POST /api/exams/attempts/:attemptId/blocks/:block/submit
Body: { answers?: { ... } }
→ { block, submittedAt, late, sections: [{ skill, teil, score, pending }] }
```

**Send the whole answer set every time, not a delta.** A client that has to
merge is a client that can lose an answer.

Autosave rules:

- Save on every answer change, debounced at about 5 seconds, and again
  whenever the app goes to background.
- Keep the last saved set in local storage too, so a crash loses seconds rather
  than ninety minutes.
- `PUT` after the deadline is refused (`BLOCK_EXPIRED`). That is correct: the
  block is over. Handle it by moving on, not by retrying forever.

Submitting:

- A submit arriving **after** the deadline is accepted and comes back with
  `late: true`. It is marked on the answers saved in time — the `answers` in
  the late body are ignored. Refusing would leave the block unmarked forever;
  accepting late answers would hand back time nobody had. Tell the student the
  block closed, without alarm.
- `pending: true` on a section means a person still has to mark it (Schreiben).
  Show "awaiting your center", never a zero.
- `BLOCK_ALREADY_SUBMITTED` on a retry means it worked. Treat it as success.

---

## 7. Hören: one play, and why

```
POST /api/exams/attempts/:attemptId/audio/:audioId/play
→ { audioId, url, playsRemaining, expiresAt }
```

Call this **immediately before every play**. It spends one play and returns a
signed, single-use URL valid for roughly twice the recording's length, so a
slow download does not cost the play.

Play the URL exactly as given. It carries its token in the query string
precisely because a player element cannot send an auth header. Do not add
headers, do not rewrite it, do not cache it, do not preload it, and **never**
fall back to a bundled asset. The response is `no-store` — a cached exam
recording is a second play nobody counted.

**One play per Teil.** Not two. telc plays each recording once for the
candidate; where the real exam repeats, the repeat is *inside the recording*.
The audio file for a Teil already contains its own "Sie hören es zweimal"
where telc calls for it.

Content note, for your layout: **one audio file per Teil.** Some Modelltests
have three files for Hören, some have one long one — either way, the server
gives you the recording that belongs to the Teil you are showing, and the
number of plays it allows.

- Disable the play button after the play, showing "played" — **do not hide it.**
  A hidden button and a failed autoplay look identical to a candidate, and on
  web autoplay does fail.
- `playsRemaining: 0` before any play is attempted means the count is already
  spent; render the disabled state from the server's number, not from local
  state.
- The play is spent when the link is issued, not when the audio finishes. Make
  the button a deliberate action ("Play — you can only listen once"), with a
  confirmation on the first Teil of the block.

Refusals: `NO_PLAYS_LEFT`, `BLOCK_NOT_STARTED`, `BLOCK_EXPIRED`,
`AUDIO_NOT_FOUND`, `AUDIO_NOT_IN_EXAM` (a recording from a different
Modelltest).

### Two bugs in the training screens, while you are here

Both found while building this, both in **training**, not the exam:

1. Teil 1's play count is 2. It should be 1 — the repeat is inside the file, so
   two plays is four listens.
2. The play button is **hidden** rather than disabled after a play. When
   autoplay fails on web, the candidate sees no button at all, taps around, and
   can end up replaying without limit.

---

## 8. Sprechen in the app — AI tier only

Only exists when the center bought the 1,500 XAF tier.

**How to know which you are in** — `gradingTier`, on both student reads:

```
GET /api/exams/sessions      → each sitting carries gradingTier
GET /api/exams/attempts/:id  → the attempt carries it too  ← use this one
```

`"AI"` means draw the Sprechen step: the candidate speaks Teil by Teil and the
app sends each transcript. `"MANUAL"` means **draw nothing** — Sprechen happens
in the room with an examiner and never touches the app.

Decide from this field, never by calling and catching. `EXAM_TIER_WITHOUT_AI`
is still returned on a MANUAL sitting, but as a backstop for a client that
ignored the field, not as the way to find out.

This is **not Elena.** Elena is practice — a live conversation, five a month
on Start plus bought credits, through `POST /api/speaking/live-token`. It never
appears inside a sitting. The exam's Sprechen is a transcript per Teil, paid
for by the centre per candidate, and read by the examiner before they type
their own mark. The two share no allowance: an exam spends none of the
student's free sessions and none of their centre's credits.

```
POST /api/exams/attempts/:attemptId/speaking
Body: { teilNumber: 1..3, transcript: "..." }   // max 10,000 chars
```

- **Transcription happens on the device. No audio reaches the server.** Send
  text, exactly as your existing speaking practice does.
- **One evaluation per Teil**, and there are three Teile. A second call for the
  same Teil is `EXAM_TEIL_ALREADY_EVALUATED`. There is no retry: warn before
  submitting, because this is the candidate's only attempt at that Teil.
- This does **not** spend the practice allowance — an exam is paid for
  separately — but the burst limit still applies. Do not fire three calls at
  once.
- What it produces is a transcript and notes for the **examiner**, who is in the
  room with the candidate and types the actual mark. Do not show the AI's score
  to the candidate, and do not describe this screen as "your speaking result".

The examiner still decides. The app is providing them a transcript.

Known limitation, already agreed: telc Sprechen Teil 2 and 3 are conversations,
and the app records one candidate alone. That is why the mark comes from the
room, not from here.

---

## 9. Results

```
GET /api/exams/attempts/:attemptId/result
```

`RESULT_NOT_RELEASED` (400) until the center releases it. That is the normal
state for hours or days after the exam — render it as "your center has not
published results yet", not as an error.

Once released you get a **frozen snapshot**: the two halves, the Teil-by-Teil
breakdown, and the outcome, exactly as they stood at release. It does not
change under the student between two refreshes. If the center re-marks and
releases again, the student is notified again.

The pass rule, for your copy:

- **Written**, 225 points: Lesen, Sprachbausteine, Hören, Schreiben.
- **Oral**, 75 points: Sprechen.
- **60% of each half, separately.** 68% overall with a weak oral is a fail.

Display `written.passed`, `oral.passed` and `outcome` as given. Do not compute
anything. But do explain the two-halves rule on the screen, or a student seeing
"68% — FAILED" will think the app is broken.

`INCOMPLETE` means a human mark is still missing. Neutral styling, never red.

The candidate's result deliberately contains no AI suggestions. Those are for
the person deciding a mark, not the person receiving one.

---

## 10. Notifications

```
GET  /api/me/notifications?unreadOnly=true&limit=50
→ { notifications: [{ id, kind, payload, createdAt, readAt }], unread }

POST /api/me/notifications/:id/read
POST /api/me/notifications/read
```

Two kinds so far:

| kind | payload |
|---|---|
| `EXAM_PUBLISHED` | `{ sessionId, name, opensAt, closesAt }` |
| `EXAM_RESULT_RELEASED` | `{ sessionId }` |

The payload is **facts, never a sentence**. The app writes the wording, in the
language the student reads. Nothing stored server-side is in any one language.

`EXAM_RESULT_RELEASED` carries no verdict on purpose. A lock screen at a bus
stop is not where somebody should learn they failed — the notification is a
nudge to go and look.

---

## 11. Error codes

| code | when |
|---|---|
| `EXAM_NOT_OPEN` | starting outside the window |
| `NOT_A_PARTICIPANT` | not admitted (404) |
| `EXAM_ATTEMPT_NOT_FOUND` | someone else's attempt, or a bad id (404, never 403) |
| `BLOCK_OUT_OF_ORDER` | Hören before the first block is submitted |
| `BLOCK_IN_PROGRESS` | starting a block that is already running |
| `BLOCK_NOT_STARTED` | fetching questions, or audio, before starting |
| `BLOCK_ALREADY_SUBMITTED` | re-submitting — treat as success |
| `BLOCK_EXPIRED` | saving after the deadline |
| `NO_PLAYS_LEFT` | the recording was already played |
| `AUDIO_NOT_IN_EXAM` | audio from a different Modelltest |
| `AUDIO_TOKEN_INVALID`, `AUDIO_TOKEN_EXPIRED`, `AUDIO_UNAVAILABLE` | a bad or stale link — call `/play` again only if plays remain |
| `EXAM_TIER_WITHOUT_AI` | speaking on a 1,000 tier sitting |
| `EXAM_TEIL_ALREADY_EVALUATED` | a second evaluation of the same Teil |
| `RESULT_NOT_RELEASED` | the normal pre-release state |
| `EXAM_CANCELLED` | the center called the sitting off mid-exam |

---

## 12. Things that would actually hurt

1. **Storing "minutes remaining" anywhere.** Store the instant. A duration
   persisted across a crash is time given back or taken away.
2. **Trusting the device clock.** Always `deadlineAt` against
   `now + (serverNow − deviceNow)`.
3. **Treating a re-start as a fresh timer.** It returns the same deadline for a
   reason.
4. **Any bundled-audio fallback.** The only source of an exam recording is a
   freshly issued signed link. `bundled_audio_asset` is images; it is not an
   audio fallback and must not be reached for here.
5. **Hiding the play button instead of disabling it.** See section 7 — this is
   already a live bug in training.
6. **Sending answer deltas.** The full set, every save.
7. **Showing the AI's score to a candidate.** It is a note for the examiner.
8. **Blocking the exam behind the subscription check.** The center paid per
   candidate; a student with no subscription still sits it.
9. **Retrying a speaking evaluation.** One per Teil, and the second is refused.
   Warn before the first.

---

## 13. Where to check yourself

Run the backend and open `/api/docs`. Every route above is there with its
request and response schema, and the descriptions carry the reasoning behind
each rule. It is generated from the code that enforces them.
