# Spec: Exam simulator — a center runs a telc sitting

Status: **DRAFT — awaiting review.** Branch `feat/exam-sessions`, off `dev` @ `2961109`.
Drafted 2026-09-24. Requirements from a center manager, decided with Herman.

---

## Assumptions

Correct any of these now.

| # | Assumption | If wrong |
|---|---|---|
| 1 | **Sprechen happens in the center, in person.** Lerniqo never runs the oral exam; it receives a score somebody types in | The whole block model changes: two more timed blocks, and audio storage |
| 2 | **One user per center.** `CenterUser.role` has `MANAGER` in the enum but nothing creates one, so every center has a single `OWNER` who does everything, grading included | A grading permission check, on top of the audit columns already planned |
| 3 | **B1 only at launch.** Every piece of content in the database is B1 | The wizard offers more levels and the duration table gains rows — data, not code |
| 4 | **Exam slots are a counter on the center**, bought in advance, spent when a participant is assigned to a published session. No refunds, no no-show handling | A ledger table instead of a counter |
| 4b | **Exam slots have no minimum.** A center may buy one. This is not the seat rule, where ten is the floor — a sitting for three candidates is a real thing a school does | Phase 2 gets a minimum and the wizard a warning |
| 5 | The center decides when a student sees a result. Nothing is released automatically | — |
| 6 | Modelltests used for exams are unseen material. Reusing a training Modelltest is allowed but warned about | Exam-only content becomes mandatory rather than optional |
| 7 | Independent students (no center) cannot sit an exam yet | A second product: written-only, with nobody to score Sprechen |

---

## Objective

A center manager coordinates exams by hand: telling students when to come,
which test they sit, collecting papers, marking them, typing results into a spreadsheet.

**They create a sitting in five steps, publish it, and Lerniqo does the rest:
opens it at the minute they chose, admits only the students they named,
enforces the telc timing, marks what can be marked, and hands back the results
to finish and export.**

### Non-goals

- Live proctoring, watching answers as they are typed, video surveillance
- Room or workstation management
- Configurable exam duration — a duration a center can edit is not an exam
- Creating or editing Modelltests inside the wizard
- Analytics beyond what running a sitting requires

---

## The shape of the thing

### Two different clocks

The distinction the whole feature rests on:

| | What it is | Who sets it |
|---|---|---|
| **Access window** | How long the sitting is open to start. 24h, 48h or 72h from the opening time | The center |
| **Exam timing** | How long a candidate has once they begin | telc, seeded as data |

A 48-hour access window is not a 48-hour exam.

### Blocks, not sections

telc gives **one 90-minute block to Lesen and Sprachbausteine together**, with
free navigation across their five Teile. A per-Teil timer would be wrong.

| # | Block | Timer | Contains |
|---|---|---|---|
| 1 | `LESEN_SPRACHBAUSTEINE` | 90:00 | Lesen T1–T3, Sprachbausteine T1–T2 |
| 2 | `HOEREN` | ~30:00 | Teil 1–3 |
| 3 | `SCHREIBEN` | 30:00 | one task |

Sprechen is absent by design (assumption 1): 20 minutes' preparation and ~15
minutes of speaking happen in the center, with a real examiner and usually a
second candidate. Lerniqo stores the score, the date and who awarded it.

Blocks are started one at a time, in order. telc runs 1–3 back to back with no
break; online that mostly punishes bad wifi, so a candidate may start each
block when ready, as long as the sitting is still open. The UI says so.

### Hören plays are counted

| Teil | Audios | Plays each |
|---|---|---|
| 1 | 5 short | **1** |
| 2 | 1 long conversation | **2** |
| 3 | 5 short | **2** |

Per-exercise data, not one rule. The server counts; hiding a button is not
enforcement. A play is spent the moment it starts — a connection that drops at
0:15 costs it, exactly as the recording would keep playing in the room.

The table is B1/B2. **A1/A2 Hören is one continuous official recording for the
whole block, played once** — every Teil and every repeat is inside the file,
so there is no per-Teil play. The play is recorded on the block itself
(`exam_attempt_blocks.hoeren_played_at`), and the recording is named by the
Modelltest's id rather than a `listening_exercises` row. Asking to play before
the recording has been uploaded is refused (`HOEREN_AUDIO_NOT_READY`) without
spending the play. Pause, seek and restart are disallowed by the paper
(`modelltests.format.hoerenDelivery`) but only the app can enforce those: once
the file is streamed, the server cannot see the player.

Exam audio is **served, never bundled** — decided 2026-09-24 with the Flutter
team. Asking to play returns a link signed with an HMAC over
`(attemptId, audioId, playNumber, expiry)`, and the app downloads it in full
before playback starts, so a mid-exam network dip cannot stall a recording
already running.

Bundling was the alternative and was rejected on the app team's own evidence:
the in-app play counter is widget state with no persistence and no app
lifecycle handling, the play button is hidden rather than disabled when
autoplay fails, and leaving the page resets the count. That is an honour
system, not a rule, and a center cannot be told otherwise.

Four things this forces on the server:

| | |
|---|---|
| The token goes in the query string | On web the URL is handed to an `<audio>` element, which cannot send headers |
| `content_revision` must stay non-empty for exam payloads | The app's URL path throws without it |
| The per-Teil allowance comes from the server | The app has one hard-coded `2` for every Teil, so "once for Teil 1" is not what it does today |
| The signed link stays valid for one play's worth of time | The file downloads in full first — seconds on a weak connection — and counting at the press of play would burn an allowance on a download that never arrived. The link's validity **is** the play: re-fetchable while it lasts, gone when it expires, which is about what the recording playing on in the room amounts to |

A candidate who saves the file itself is beyond what any unproctored exam can
prevent, and we do not pretend otherwise.

### Status is derived, never stored

Same reasoning as `CenterSubscription`: a stored status needs a job to keep it
true, and the direction it fails in is letting a closed exam be taken.

```
cancelled_at set                        → CANCELLED
published_at null                       → DRAFT
now < opens_at                          → SCHEDULED
force_closed_at set, or now > closes_at → CLOSED
otherwise                               → OPEN
```

`closes_at` is editable after publication: a center may close early or reopen
after the window lapsed. That is its decision to make about its own exam.

---

## The two products

Fixed on the session when it publishes, because a price change must never
re-grade exams somebody already paid for.

| | **1,000 XAF** `MANUAL` | **1,500 XAF** `AI` |
|---|---|---|
| Lesen / Hören / Sprachbausteine | automatic | automatic |
| Schreiben | stored, trainer scores it | stored, **AI proposes**, trainer confirms or overrides |
| Sprechen | in the center, score typed in | in the center, score typed in, **plus** an AI speaking session in the app whose transcript the manager reads |

At 1,500 the AI is a **second opinion, never the verdict**. The examiner opens
the participant, reads the transcript and the machine's notes on grammar and
vocabulary, and then types their own score. Lerniqo does not certify speaking.

The AI tier reuses `POST /api/writing/evaluate` and `POST /api/speaking/evaluate`
unchanged. The Flutter app transcribes speech on the device and sends text; no
audio ever reaches the server.

### Releasing a result

Nothing is automatic and nothing is conditional. The manager sees which
scores exist and decides when to release, however incomplete. Releasing is an
action that can be taken more than once — the written scores now, the verdict
after the oral — and a student sees only what has been released.

### Pass or fail

The real telc rule, since this is a simulation: **60% of the written block and
60% of the oral**, not one combined average. Decided on exact scores; rounded
only for display.

---

## Across the three surfaces

The feature lives in three places. The backend is the only one that decides
anything; the other two render what it says.

| | Dashboard (Next.js) | Flutter app (web + mobile) | Backend |
|---|---|---|---|
| Sessions | the five-step wizard, the session list, the detail page; Modelltest picker via `GET /api/centers/me/exam-modelltests` and content preview via `GET /api/centers/me/exam-modelltests/:number` (full paper, no answer keys) | — | owns them |
| Participants | the picker, from the center's own students | — | the access rule |
| Timing | shows the window it chose | counts down a deadline it was given | sets and enforces it |
| Grading | types Schreiben and Sprechen scores | — | scores the rest, decides pass |
| Results | table, detail, CSV, PDF, print | the student's own result | ships the numbers |
| Notifications | — | the bell, the list | writes them |

### The whole flow, end to end

```
DASHBOARD                     BACKEND                        FLUTTER APP

Buy exam slots ─────────────► payment (Notch / Stripe)
                              webhook verified
                              exam_slots_remaining += N
◄──────────────────────────── 10 slots

Create session
 1 name + level (B1)
 2 pick a Modelltest ───────► "9 of 15 already trained
◄──────────────────────────── on this one"
 3 pick participants ───────► only this center's students
 4 opening + 24/48/72h ─────► closes_at computed
 5 review
Publish ────────────────────► spends 1 slot per participant
                              status: SCHEDULED
                              notification per student ────► "Exam on 5 Oct, 09:00"

                    ── 05 Oct 09:00, nothing runs, the clock simply passes ──
                              status: OPEN

                                                             Student opens the app
                              participant? open? ◄─────────── Start exam
                              attempt created ─────────────►
                              deadlineAt + serverNow ──────► 89:59 … ticking locally

                                                             Block 1, 90 min
                              autosave ◄──────────────────── answers as they go
                              scored on submit ◄──────────── submit (or auto at 0:00)

                                                             Block 2, Hören
                              play counted, signed link ◄─── press play
                              409 if none left ◄──────────── press play again

                                                             Block 3, Schreiben
                              stored, not scored ◄────────── submit

Results page ◄─────────────── Lesen 78 · Hören 72 · SB 83
                              Schreiben pending · Sprechen pending

Type Schreiben 74 ──────────► stored with graded_by
                    ── the oral happens in the center, on paper, with an examiner ──
Type Sprechen 81 ───────────► written 60%? oral 60%? → PASS

Release results ────────────► notification ─────────────────► "Your result is ready"
                                                             Result + corrections
Export CSV / PDF ◄─────────── flat rows, numbers already computed
```

### What each surface must never do

- **Neither client computes a score, a total or a pass.** The server ships
  final numbers; a client that averages them will disagree with the PDF.
- **Neither client owns a clock.** The countdown is rendered from a deadline
  the server gave, corrected by `serverNow`.
- **Hiding a control is not a rule.** Every refusal above is also a refusal
  server-side, because a client can be edited and the server cannot.

---

## Data model

New enums: `ExamGradingTier { MANUAL, AI }`, `ExamBlock { LESEN_SPRACHBAUSTEINE,
HOEREN, SCHREIBEN }`.

```
exam_block_durations   level, block, minutes, position        @@unique(level, block)
                       seeded; no center can edit it

exam_sessions          center_id, name, level, modelltest_id, grading_tier,
                       opens_at, closes_at,
                       published_at, cancelled_at, force_closed_at

exam_session_participants  session_id, student_id             @@unique
                       this row IS the access rule

exam_attempts          session_id, student_id, started_at, submitted_at  @@unique
exam_attempt_blocks    attempt_id, block, started_at, deadline_at, submitted_at
exam_section_results   attempt_id, section, score, grading, graded_by, graded_at
exam_audio_plays       attempt_id, audio_id, plays_used
notifications          student_id, kind, payload, read_at
```

Plus two columns on what exists: `centers.exam_slots_remaining` and
`payments.kind (SEATS | EXAM_SLOTS)`, so slot purchases ride on the payment
flow rather than a second one.

The per-skill attempt tables gain a nullable `exam_attempt_id`. That reuses the
existing grading code untouched, keeps exam work out of training history, and
means the D39 erasure already follows these rows.

---

## Rules the server enforces

Hiding a button is not security. Each of these is refused server-side.

| Rule | Refusal |
|---|---|
| A session may only be read or written by the center that owns it | 404, never 403 — a 403 confirms the id exists |
| Only a participant may start an attempt | `NOT_A_PARTICIPANT` |
| A sitting must be `OPEN` to start | `EXAM_NOT_OPEN` |
| One attempt per student per session | the unique index; a second start returns the first |
| Blocks run in order, one at a time | `BLOCK_OUT_OF_ORDER` |
| A submit after `deadline_at` | `BLOCK_EXPIRED`, graded on what was saved |
| An audio with no plays left | `NO_PLAYS_LEFT` |
| Publishing without enough slots | `NOT_ENOUGH_EXAM_SLOTS` |
| Editing a session after it opened | `EXAM_ALREADY_OPEN` |

Timers are absolute. `start` returns `deadlineAt` plus `serverNow`, the client
renders the difference, and a refresh, a second device or a wrong phone clock
changes nothing.

---

## Auditability

An exam result gets disputed. These are persisted rather than inferred:
session created, published, participant assigned, attempt started, block
started, block submitted, automatic evaluation stored, manual score entered
(with `graded_by`), result released to the student.

---

## Phases

Each merges into `dev` on its own branch, with the four suites green.

| | | Delivers |
|---|---|---|
| **1** | Sessions | The three session tables, the two columns, seeded B1 durations. Session CRUD, participants, publish with a server-enforced window, derived status, slot spending, the "already trained on this Modelltest" warning. No student side |
| **2** | Slots | Buying exam slots through the existing payment flow. Small, and it lets a manager test phase 1 end to end |
| **3** | Sitting | Student session list, attempt start, the three blocks with absolute deadlines, autosave, expiry. Counted Hören plays with signed single-use links |
| **4** | Results | Auto-graded sections wired to the attempt, the manager's results table and participant detail, Schreiben and Sprechen entry with `graded_by`, the telc pass rule, release to the student |
| **5** | Reach | `notifications` (exam published, results released) and the flat export endpoint the clients render as CSV and PDF |
| **6** | AI tier | `grading_tier: AI` — AI Sprechen inside the exam and transcripts in the dashboard. Small: the evaluation already exists |

Phases 1–4 are the product. The `grading_tier` column ships in phase 1 even
though only one value is used, so sittings sold today can be told apart from
sittings sold later without migrating live data.

### Not blocked by any of this

Content authoring. A simulator needs unseen material, which means licensing
telc's Modelltests or writing telc-format ones. It is the longest pole and it
does not depend on the backend — start it in parallel.

---

## Open questions

None blocking. Content sourcing — licensed telc material or telc-format material written
in-house — is a separate decision, taken after the software exists.
