# Glossary

**Status:** approved

The words this codebase uses, and the distinctions it depends on. Every
definition below was checked against the schema or the code it names. When a
document, an API field or a variable names one of these concepts, it uses the
word here.

German exam vocabulary is kept in German. Translating *Teil* to "part" or
*Sprachbausteine* to "language elements" loses the mapping to telc's own
material, which is what the content is imported from.

---

## The exam

**telc** — the examining body whose exams this product prepares for. Their
wording and point values are authoritative; where our naming differs from
theirs, theirs is right and ours is a bug.

**CEFR level** — `A1 | A2 | B1 | B2` (`CefrLevel`). A student has one. A
Modelltest belongs to one. Content of one level does not open for a student of
another. See `docs/architecture/multi-level.md`.

**Modelltest** — one complete practice exam paper: all five skills, one level.
Identified by `number`, which is **unique across all levels** — Modelltests 1–6
are B1 and 7 is B2, so the number is a global address, not a per-level index.
Every content endpoint takes this number. The row's `id` is a uuid and is never
accepted as an address.

**Skill** — `HOEREN | LESEN | SPRACHBAUSTEINE | SCHREIBEN | SPRECHEN` (`Skill`).
Enum order is declaration order in Postgres, not alphabetical.

**Teil** — a numbered section within a skill, as telc numbers them. Lesen has
Teil 1–3; Sprechen has Teil 1–3 at B1 and an additional unscored **Teil 0** at
B2. The same Teil number means a different task at different levels: B1 Teil 1
Sprechen is *Einander kennenlernen* and scores 15; B2 Teil 1 is *Über
Erfahrungen sprechen* and scores 25. Never key behaviour on the Teil number
alone without the level.

**Aufgabe** — one task a candidate answers. B2 Schreiben offers two and the
candidate answers one; B1 offers one. Where a choice exists the API returns
`choices` and `choiceGroupId`, and absent otherwise — absent, not empty.

**Aufgabenart** — the *kind* of task (single choice, matching, gap-fill with a
word bank, free writing). Determines which table stores it, which is why B2
reused B1's tables and A1/A2 cannot. See
`docs/architecture/multi-level.md`.

**Block** — `LESEN_SPRACHBAUSTEINE | HOEREN | SCHREIBEN` (`ExamBlock`). How a
sitting is divided and timed, which is not the same as a skill: the first block
contains two skills. Blocks run in order and each must be started and submitted
before the next opens. Durations come from `exam_block_durations` keyed by
level — at B2 Hören runs 20 minutes against B1's 30, the only value that
differs between the two levels.

**M10** — telc's Bewertungsbogen for the oral exam: four criteria graded A–D,
converted to points. The conversion differs per level and is not a scaling of
B1's — at B2 a C is worth 3 where at B1 it is 1 or 2.

---

## Who pays, who learns

**Centre** (`Center`) — a language school. The paying customer. Holds seats,
exam slots and entitlement pools. Spelled *centre* in prose, `center` in code
and database columns.

**Student** — the learner. Never pays directly; there is no student checkout.
Gains access by redeeming a centre's activation code.

**Seat** (`CenterSeat`) — one paid-for student place. A trial is not a separate
plan: it is an ordinary seat priced at zero with a 14-day clock, so trial and
paid students behave identically except for that clock.

**Activation code** (`ActivationCode`) — what a centre hands a student to claim
a seat. Format `LQ-XXXX-XXXX` from an alphabet with no look-alike characters,
because it is read aloud and copied by hand before it is ever pasted. Created
only by the backend — a trial starting or a payment succeeding — so the number
of codes and the number of seats paid for cannot disagree. Carries an optional
CEFR level, which is **copied onto the student at redemption** and overrides
whatever the student declared when registering.

**Subscription** (`CenterSubscription`) — `TRIAL | PAID` plus timestamps. There
is no stored `status` column on purpose: a stored status needs a job to keep it
true, and when that job runs late it grants access nobody paid for. The status
is derived from the timestamps on read.

---

## What is sold beyond a seat

**Start** — the base subscription. One Modelltest per week, at the student's
level, chosen by a rotation.

**Entitlement** (`EntitlementProduct`) — an add-on bought per student:
`PREP_PASS`, `AI_SPEAKING_CREDIT`, `AI_SCHREIBEN_CREDIT` (200 FCFA HT),
`AI_ASSISTED_LEARNING` (shell only). A centre buys them into a pool and grants
them to individual seats. One pot per product rather than one balance, because
a centre may hold passes and credits at once and neither may be spent as the
other.

**AI Schreiben credit** — one prepaid unit (200 FCFA HT) for one **training**
Schreiben AI correction after Start’s free two per UTC day. Assign-from-stock
like AI Speaking. Spec: `domains/ai-schreiben-credits.md`. Not Exam Day marking.

**Prep Pass** — opens every Modelltest of the student's level at once instead
of one per week. A 30-day grant (`PREP_PASS_DAYS`). Enforced by
`PrepPassGuard` → `assertMayAccess`.

**Weekly Modelltest / of-the-week** — the single paper a Start student may use
this week, drawn from the papers of their own level on a 7-day rotation. With
one paper at a level the rotation has one member and does not move.

**Exam slot** — what a centre spends to publish a sitting. Separate counters
for manual and AI grading (`exam_slots_remaining`, `exam_ai_slots_remaining`).

---

## Exam Day

**Sitting** (`ExamSession`) — a scheduled exam a centre runs for named
students. Its **level comes from its Modelltest**, never from a constant, on
both the create and the edit path. Like `CenterSubscription` it has no stored
status; the timestamps are the facts.

`opensAt` must be in the future to create **and** to publish — publishing into
the past would open a sitting the instant it appeared with nobody told — and
in the past to start. A sitting therefore straddles that timestamp.

**Attempt** (`ExamAttempt`) — one student's run at one sitting, divided into
blocks.

**Grading tier** — `MANUAL` or `AI`: whether a human or the model produces the
Schreiben and Sprechen marks. Lesen, Hören and Sprachbausteine are always
machine-marked against an answer key.

**Participant** — a student admitted to a sitting. Admission does **not**
currently check the student's level against the sitting's — see
`docs/backlog.md`.

---

## Content

**Content revision** (`content_revision`) — a version string on a piece of
content, **globally unique** across levels and papers. Derive it from level,
paper number, skill and Teil; a value that omits any of those collides as soon
as a second level exists.

**Answer key** — the correct answers, shipped **with** the exercise rather than
withheld, deliberately. See `docs/adr/0001-answer-key-with-exercise.md`.

**Training versus exam** — the same content served two ways. Training is
self-paced and reveals the key; an exam block is timed and marked. They have
separate attempt tables and separate audio play allowances.

---

## Clients

**Flutter app** — the student client. Runs on web *and* mobile; call it the
Flutter app, not the mobile app.

**Centre dashboard** — the web client a school uses to manage seats, codes,
students and sittings.

**Vitrine** — the public marketing surface and its endpoints.
