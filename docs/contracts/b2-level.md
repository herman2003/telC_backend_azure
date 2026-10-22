# B2 — what changes for the clients

**Status:** merged to `dev` on 2026-10-21 (PR #97). **Not deployed.** `main` is
what auto-deploys; `dev` is still blocked on Center auth. Build against this
contract, but nothing here answers on production yet.

**For:** the Flutter app and the centre dashboard.

The short version: **B2 behaves exactly as B1 does, with B2 content.** No
endpoint was renamed, no response shape was broken. Four things are genuinely
new, and one gap is yours to cover.

---

## 1. The level comes from the student, never from a parameter

There is no `?level=` anywhere. The server reads the student's own level and
filters to it.

```
GET /modelltests            → only the student's level
GET /modelltests/of-the-week → only the student's level
GET /modelltests/:number     → 404/403 if it is another level
```

**A student with no level set gets 403 on all of it:**

```json
{ "message": "LEVEL_REQUIRED", "messageKey": "levelRequired" }
```

This is the one change most likely to look like an outage. Before B2 the level
was effectively ignored; now an account with `level: null` sees an empty app.

**What to do:** make level a required step. It is already accepted on
registration and on profile update, and a centre can set it per seat on the
activation code before handout. Handle `LEVEL_REQUIRED` as "finish your
profile", not as an error toast.

---

## 2. Schreiben can offer a choice of two Aufgaben

B1 has one writing task. **B2 has two and the candidate picks one.**

The response is unchanged for B1 — same fields, no new wrapper. When a choice
exists, two extra fields appear:

```jsonc
{
  "id": "...", "part": 1, "title": "...",   // the first task, as before
  "choiceGroupId": "...",                   // present only when there is a choice
  "choices": [ { "id": "...", "part": 1, ... },
               { "id": "...", "part": 2, ... } ]
}
```

Entries inside `choices` never nest — a task in the list carries no `choices`
of its own.

**What to do:** if `choices` is absent, render exactly as today. If present,
show the pick-one screen and **send back the id of the task the student chose**.
The server records which Aufgabe was answered and the trainer's marking screen
shows it ("Aufgabe B — Beschwerde"). Send the wrong id and the AI correction
marks against the wrong prompt.

---

## 3. Timings differ by level — read them, do not hard-code

| Block | B1 | B2 |
|---|---|---|
| Lesen + Sprachbausteine | 90 min | 90 min |
| **Hören** | **30 min** | **20 min** |
| Schreiben | 30 min | 30 min |

Point values are identical (225 written + 75 oral = 300). Only Hören moves.

**What to do:** the deadline comes from the server with the block. Any timer
constant in the client is now wrong for half the users.

---

## 4. Sprechen at B2 opens with an unscored introduction

B2 has a **part 0** — the introduction — that carries no marks. B1 has parts
1–3 only.

A Live Room opens at any level now. If a level has no topics, it returns:

```json
{ "message": "NO_TOPICS_FOR_LEVEL", "messageKey": "noTopicsForLevel", "level": "A2" }
```

Today B1 and B2 have topics; **A1 and A2 do not**, so that is the response you
will get for them until their content lands.

**What to do:** render part 0 without a score, and treat
`NO_TOPICS_FOR_LEVEL` as "not available at your level yet", not as a failure.

---

## 5. The centre dashboard must filter by level itself

The exam picker now returns `level` on each Modelltest, so you can show and
group by it.

**The gap:** the backend does **not** check the level on admission.
`eligible-students` filters on centre and name only; nothing compares a
student's level to the sitting's. A centre can admit a B1 student to a B2
sitting, and that candidate is then marked against the B2 grid.

**What to do, until the backend closes this:** filter the eligible-student
list to the sitting's level in the dashboard, and warn on a mismatch. This is
logged as the first backend follow-up, but right now the dashboard is the only
thing standing between a centre and a wrongly marked candidate.

---

## What has NOT changed

- No endpoint renamed or removed
- No existing field removed or retyped
- B1 responses byte-identical — pinned by a golden-master suite over
  Modelltests 1–6
- Answer keys still ship with `GET /exercise` as before (ADR 0001)

A client that ignores everything above keeps working for B1 students.

---

## Content available today

| Level | Papers |
|---|---|
| B1 | Modelltests 1–6 |
| **B2** | **Modelltest 7** |
| A1, A2 | none yet |

Two caveats worth knowing before you demo:

- **Modelltest 7 has no Hören transcripts** — withheld on purpose, so its
  weekly vocabulary pack carries no listening words.
- **Modelltest 1 has no Hören audio at all.** Pre-existing, and it sits in
  every B1 student's rotation.

---

## Landing page

**Not a developer decision, and not yet.** Two reasons to hold:

1. **B2 is not deployed.** Advertising it while `main` has only B1 means
   selling something that answers 404.
2. **One B2 paper exists.** B1 has six. A B2 buyer who finishes Modelltest 7
   has nothing left, and the honest comparison is "1 paper" against "6".

When it does go up, the claims the code actually supports are: full telc
Deutsch B2 exam simulation, all five skills, the same 300-point telc marking
as B1, AI correction for Schreiben and Sprechen keyed to the B2 criteria, and
a Live Room with B2 topics. Avoid implying a library of B2 tests until there
is more than one.

Pricing and whether B2 is a separate product or part of Start is a business
call — the user and Herman, not this document.
