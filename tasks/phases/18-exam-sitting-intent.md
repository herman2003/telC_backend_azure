# Phase 18 — Sitting the exam: blocks, timers and counted plays

**Written:** 2026-09-24
**Branch base:** `dev`, after phase 17 merges (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md`
**Follows:** phase 16 (a sitting exists) and 17 (it can be paid for)

## Why

A center can create a sitting, admit candidates and pay for it. No candidate
can take it. This is the phase the whole feature exists for, and the one where
being wrong is visible to a student mid-exam rather than to a manager.

## What it must get right

Three things, in order of how badly they fail:

1. **The timer is the server's.** A refresh, a second device, a killed app or
   a wrong phone clock must not change how long a candidate has.
2. **A Hören recording plays the number of times telc says.** Once for Teil 1,
   twice for Teils 2 and 3, counted server-side.
3. **Only an admitted candidate, only while the sitting is open.**

## What we intend to build

1. **Schema** — three tables and one column on four existing ones:
   - `exam_attempts` — one per student per sitting, `@@unique`
   - `exam_attempt_blocks` — `started_at`, `deadline_at`, `submitted_at`
   - `exam_audio_plays` — `(attempt, audio)` with a count
   - `exam_attempt_id` (nullable) on `lesen_attempts`, `listening_attempts`,
     `sprachbausteine_attempts`, `writing_attempts`
2. **Starting** — `POST /sessions/:id/start` creates the attempt if the caller
   is admitted and the sitting is `OPEN`. A second call returns the first.
3. **Blocks** — start one, get `deadlineAt` and `serverNow`; answers autosave;
   submit before the deadline or be refused. Blocks run in order, one at a
   time. The content comes from the existing Lesen / Sprachbausteine /
   Hören / Schreiben services — this phase gates and times them, it does not
   re-implement them.
4. **Scoring** — submitting a block scores it through the same code training
   uses, writing the attempt rows with `exam_attempt_id` set so exam work
   never appears in a student's training history.
5. **Counted plays** — `POST /attempts/:id/audio/:audioId/play` spends one
   play and returns a single-use URL signed with an HMAC over
   `(attemptId, audioId, playNumber, expiry)`.

## Not in this phase

- Results, grading, the pass rule, releasing to a student — phase 4
- Notifications — phase 5
- Sprechen in any form. It happens in the center

## Decisions this phase makes concrete

| | |
|---|---|
| The deadline is absolute, stored at start | A pause button, a "time left" counter and a clock offset all fail differently; an instant does not |
| A play is spent when it starts, not when it finishes | Otherwise a dropped connection at 0:15 is a free replay |
| Blocks are sequential, started explicitly | telc runs them back to back; online, forcing one unbroken sitting punishes bad wifi rather than cheating |
| Exam attempts carry `exam_attempt_id` | Reuses the grading code untouched, keeps training history clean, and the D39 erasure already follows those rows |

## The constraint the Flutter team has to know about

Hören audio is served today as `audio_url` **and** `bundled_audio_asset` — the
app can ship the recordings inside the bundle. If exam audio is bundled, a
counted play is theatre: the file is already on the device.

**Exam Modelltests must not have their audio bundled.** It has to come from
the signed route, per play, or the limit means nothing. That is a packaging
decision on the app side, and the backend cannot enforce it — so it goes in
the Flutter prompt in capitals.

## How we will work

Branch from `dev`. Tests before the service for the timer rules, which are
pure. Integration tests against real Postgres for: one attempt per student
under a double start, a submit after the deadline, and a play count under two
simultaneous presses — all three are claims about a statement, not an output.

Migration via `migrate diff`, applied only to the `.env.test` branch. Four
suites green before merge.

## Done when

An admitted student opens the app while the sitting is open, starts, sees
90:00 counting down, answers Lesen and Sprachbausteine with free navigation
between the five Teile, loses their connection, comes back to the right
remaining time, submits, plays each Hören recording exactly as often as telc
allows, writes their Schreiben, and cannot start anything after the sitting
closes — with every one of those limits refused by the server and not merely
hidden by the app.

## Open questions

| # | Question | Needed by |
|---|---|---|
| 1 | Does the app already bundle Hören audio for Modelltest 1, and can exam Modelltests opt out of bundling? | Before the Hören block is built |
