# Phase 20 — Telling people, and getting the data out

**Written:** 2026-09-25
**Branch base:** `dev` @ `859660f` (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md`
**Follows:** phase 19, which finishes the exam but tells nobody

## Why

Two gaps, both small and both the difference between a feature and a usable
one:

1. **Nobody is told anything.** A candidate has no way to learn a sitting was
   published or a result released, short of opening the app and checking. The
   spec asked for a notification at exactly those two moments.
2. **Results are trapped.** A center can read them on a screen and nowhere
   else. Audrey needs them in a file — for the archive, for a printout, for
   the spreadsheet somebody upstairs keeps.

## What we intend to build

1. **A notifications table** and the two routes an app needs: my unread list,
   and marking one read. Written in the same transaction as the thing they
   announce, so a notification cannot exist for an exam that was not published
   — nor an exam published with nobody told.
2. **Two notifications**: a sitting published, and a result released.
3. **One export endpoint** returning flat rows with every number already
   computed. The clients build CSV and PDF from it — decided with the Flutter
   team, and it means no PDF library in Node and no second implementation of
   a percentage.

## Not in this phase

- Push notifications (FCM). In-app first; the table is what a push would read
  from anyway.
- Email. Same reason.
- The 1,500 AI tier — phase 21.

## Decisions this phase makes concrete

| | |
|---|---|
| Notifications are written in the publishing transaction | A published exam nobody was told about is worse than a failed publish |
| The payload is data, not a sentence | The app writes the wording, in the language the student reads; a sentence stored in English is a translation nobody can do later |
| Export returns rows, not a file | Both clients already render; a server-side PDF is a library, a font and a memory limit we do not need |
| Export is one query, unpaginated | A file with page two missing is not a file. It is bounded by the sitting, which is bounded by what a school can seat |

## The order

| | Task | Scope |
|---|---|---|
| 1 | The table, the two student routes, the unread count | M |
| 2 | Written when a sitting publishes and when a result is released | M |
| 3 | The export endpoint | S |

## Done when

A candidate opens the app and sees "Exam on 5 October" without having looked
for it; sees "Your result is ready" when the center releases; and a manager
can download the whole sitting as a file that opens in Excel with the same
numbers the screen showed.

## Open questions

None blocking. Whether a push follows the in-app notification is a product
decision that changes nothing here — a push reads this table.
