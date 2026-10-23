# Implementation Plan: A1 Modelltest 1 on Exam Day

**Status:** approved; implemented, in review. Archive once merged.
**Weight:** High risk. This is exam content and results, plus a migration. It
needs the full gates, an independent review in a fresh context, and Bruno over
HTTP through to a final verdict.

## Goal

A centre gives an A1 code, and the student sits telc Start Deutsch 1
Übungstest 1 on Exam Day. They do Hören (with real audio) and then Lesen und
Schreiben. The examiner marks Schreiben Teil 2 and Sprechen, and the result
becomes PASSED or FAILED, the same as A2 today.

## What already exists

The A2 work is level-generic. These pieces already accept A1, because
`GENERIC_MODEL_LEVELS = ['A1','A2']`:

- content read
- block content
- scoring
- server marks
- examiner marking
- results, release and export
- per-Teil Hören plays

The A1 pass rule (`TOTAL_PERCENT` 60) is already seeded. The enum already
contains `FRAGEN_UND_ANTWORTEN` and `BITTEN_UND_REAGIEREN`.

## What is missing

1. **Content.** There are no A1 Modelltest rows. Catalogue number 9 is free.
2. **Rules.** There are no A1 rows in `exam_block_durations` or
   `exam_section_weights`, so `isComplete('A1')` and `weightsFor('A1')` fail.
3. **Schemas** (`scripts/generic-modelltest-schemas.mjs`). Some A1 tasks do
   not fit the current shapes:
   - `FRAGEN_UND_ANTWORTEN` / `BITTEN_UND_REAGIEREN` have no schema yet.
   - A1 Teil 2 has **two rounds with two topics**, but the contract sketch has
     one topic.
   - The A1 `SICH_VORSTELLEN` rubric is *vorstellen / buchstabieren / zahlen*.
     The A2 rubric is *vorstellen / zusatzfragen*.
   - `RICHTIG_FALSCH` has one stimulus. A1 Lesen 1 has two letters (items 1–2
     and 3–5), and Lesen 3 has one sign per item.
   - A `FORMULAR_AUSFUELLEN` field with `inputType: CHOICE` has no list of
     choices. A1 field 4 is *bar / Kreditkarte*.

## Design

The rule is "text first", the same as A2: every picture is written as words
and `imageUrl` stays null. The asset manifest records each picture for a later
upload.

Every change below is **additive**. A2 #8 must still validate, and its stored
rows are not touched.

| Gap | Change |
|---|---|
| Two topics in Sprechen 2 | `FRAGEN_UND_ANTWORTEN = { rounds: [{ topic, cards: [{key, text, imageUrl?}] }], rubric: { frage, antwort } }` |
| Picture cards in Sprechen 3 | `BITTEN_UND_REAGIEREN = { rounds: [{ topic?, cards }], rubric: { bitte, reaktion } }`; card `text` = the object's name |
| A1 Sprechen 1 rubric | rubric = A2 shape **or** `{ vorstellen, buchstabieren, zahlen }` (a union, so A2 stays valid) |
| Grouped Lesen texts | `RICHTIG_FALSCH.texts?: [{ forItems: number[], title?, body }]`, stored in `material` |
| Choice field | `FORMULAR_AUSFUELLEN` field `choices?: string[]`; required when `inputType` is `CHOICE`; stored as the item's options |

Oral types keep the existing mapping, `material = content, items = []`. The
content contract (`docs/ideas/modelltest-content-contract.md`) is updated in
the same commit.

## A1 content, checked against the Lösungsschlüssel

| Teil | Type | Items | Key |
|---|---|---|---|
| Hören 1 | `EINZELAUSWAHL` | 1–6 | c b a b a c |
| Hören 2 | `RICHTIG_FALSCH` | 7–10 | F F R R |
| Hören 3 | `EINZELAUSWAHL` | 11–15 | a c c b b |
| Lesen 1 | `RICHTIG_FALSCH` + 2 letters | 1–5 | R F F F R |
| Lesen 2 | `EINZELAUSWAHL` (ads a/b) | 6–10 | b a a a b |
| Lesen 3 | `RICHTIG_FALSCH` + 1 sign per item | 11–15 | R F F R R |
| Schreiben 1 | `FORMULAR_AUSFUELLEN` | 1–5 | 4 · 2 · Seeheim · Bar (a choice: a wrong pick is wrong) · Sonntag (open → examiner) |
| Schreiben 2 | `TEXT_SCHREIBEN` | — | rubric 3/1.5/0 × 3 + KG 1/0.5/0, max 10 |
| Sprechen 1 | `SICH_VORSTELLEN` | — | V/B/Z 1/0.5/0, max 3 |
| Sprechen 2 | `FRAGEN_UND_ANTWORTEN` | — | *Essen und Trinken*: Frühstück, Lieblingsessen, Sonntag, Bier, Fisch, Brot · *Einkaufen*: Zeitung, Kasse, Obst, Schuhe, Buch, Stadtplan |
| Sprechen 3 | `BITTEN_UND_REAGIEREN` | — | Äpfel, Fleisch, Laptop, Auto, Banane, Orangensaft, Einkaufskorb, Hund, Schlüssel, Koffer, Blumen, Kuchen |

**Hören delivery.** `PER_TEIL_RECORDINGS`, one play per file. The three R2
files are already uploaded and checked byte for byte:

| Teil | Duration stored | Measured |
|---|---|---|
| 1 | 492 s | 491.3 s |
| 2 | 231 s | 231.0 s |
| 3 | 292 s | 291.77 s |

The transcripts go in `media.transcript`, which is never sent to the student.

**Schreiben 1, field 5.** The answer is "the date of next Sunday", so it
cannot have a fixed key. Accepted answers: "Sonntag", "am Sonntag",
"nächsten Sonntag", "nächster Sonntag", "am nächsten Sonntag". Anything else goes to the examiner (Decision 1 = B, built
in #120).

## Rules (one migration)

`exam_block_durations`:

| Block | Minutes | Position |
|---|---|---|
| HOEREN | 20 | 1 |
| LESEN_SCHREIBEN | 45 | 2 |

`exam_section_weights` (official points; total 60):

| Skill | Teil 1 | Teil 2 | Teil 3 |
|---|---|---|---|
| Hören | 6 | 4 | 5 |
| Lesen | 5 | 5 | 5 |
| Schreiben | 5 | 10 | — |
| Sprechen | 3 | 6 | 6 |

## Tasks

### 1. Schemas and importer (S)

- `generic-modelltest-schemas.mjs`: the five changes above.
- `import-generic-modelltest.mjs`: add `splitContent` cases for the two
  Sprechen types, `texts` into `material`, and choices into options.

**Acceptance.** A2 #8 validates unchanged. The synthetic fixture validates. A
bad A1 shape fails with its `sectionId`. A `CHOICE` field without `choices`
fails.

**Tests.** The schema spec and the import integration spec.

### 2. A1 source JSON (M)

- `content/a1-modelltest-1-source.json`, from the PDF text.
- The asset manifest covers every picture.

**Acceptance.** A golden test reads the file and asserts every key in the
table above, the 15/15/15 item counts, and the recording durations. It is
written from the Lösungsschlüssel, not from the JSON.

### 3. Import and rules migrations (S)

- `import-generic-modelltest.mjs --number 9` → `*_seed_a1_modelltest1`.
- A hand-written `*_seed_a1_exam_rules`.
- Applied with `scripts/apply-migration.mjs` against `.env.test` only.

**Acceptance.** `isComplete('A1', mt9)` is true. Scoring a perfect A1 attempt
gives Hören 15 and Lesen 15.

### 4. Fixture and Bruno (M)

- `seed-b2-bruno-fixture.mjs` gets an A1 student
  (`ngeukeualain+a1student@gmail.com`) and an A1 code.
- `bruno/A1 Level/` copies the A2 journey:
  1. redeem
  2. Hören audio, one play per Teil, and a second play refused
  3. submit both blocks
  4. an unrecognised Schreiben 1 answer goes to review
  5. a server-marked Teil is refused
  6. the examiner marks Schreiben 2 and Sprechen 1–3
  7. the result is PASSED, with the exact total

**Acceptance.** Every request passes over HTTP with
`node run-bru.mjs "A1 Level"`, against `ep-misty-sea`.

### 5. Docs and cleanup (XS)

- Domain doc: A1 rows where the rule names a level.
- Content contract: the new shapes.
- `docs/architecture/multi-level.md`: the A1 readiness tick.
- Archive `a1-a2-exam-results.md`, since #120 is merged.

## Checkpoints

- **After 1–3:** tsc, build, jest, integration, e2e, and lint ≤ 942 (CI's
  command), all read by exit code.
- **After 4:** Bruno A1 Level and A2 Level both pass, then an independent
  review (`mattpocock-skills:code-review`).
- **Then:** the PR into `dev`. You merge.

## Non-goals

- **Real images.** Text first, so pictures are a later upload task.
- **A1 training mode.** Exam Day only, like A2.
- **Flutter / dashboard changes.** The prompts come at the end. One new field
  shape is noted: `rounds[]` in Sprechen 2/3 and `texts[]` in R/F.

## Risks

| Risk | Mitigation |
|---|---|
| A wrong answer key in the JSON | The golden test is written from the Lösungsschlüssel, separately from the JSON |
| A schema change breaks A2 | Union plus optional fields; the A2 file is re-validated in a test |
| A migration on production | Applied to `.env.test` only; production comes with your merge to `main` |
