# Multi-level architecture — A1, A2, B1, B2

**Written:** 2026-10-20
**For:** whoever (human or agent) extends Lerniqo beyond B1.
**Status:** design. Supersedes nothing; `MODELLTEST_CONTENT_ARCHITECTURE.md` is the
MT1/MT2 deployment runbook and stays valid for what it covers.

This document is the single reference for two questions:

1. **How exam content is stored**, for all four levels.
2. **How a level changes each feature**, from the schema up to the endpoint.

---

## Part 1 — The four exam structures

Authoritative. Everything else in this document derives from these four tables.
Point sums are checked.

### A1 — telc Deutsch A1 / Start Deutsch 1

Family `START_DEUTSCH` · **60 points** · pass = **60 % of the total**

| Block | Min | Teil | Aufgabenart | Items | Points |
|---|---|---|---|---|---|
| Hören | ~20 | 1 | `EINZELAUSWAHL` | 6 | 6 |
| | | 2 | `RICHTIG_FALSCH` | 4 | 4 |
| | | 3 | `EINZELAUSWAHL` | 5 | 5 |
| Lesen und Schreiben | 45 | Lesen 1 | `RICHTIG_FALSCH` | 5 | 5 |
| | | Lesen 2 | `EINZELAUSWAHL` | 5 | 5 |
| | | Lesen 3 | `RICHTIG_FALSCH` | 5 | 5 |
| | | Schreiben 1 | `FORMULAR_AUSFUELLEN` | 5 fields | 5 |
| | | Schreiben 2 | `TEXT_SCHREIBEN` | 1 | 10 |
| Sprechen | — | 1 | `SICH_VORSTELLEN` | — | 3 |
| | | 2 | `FRAGEN_UND_ANTWORTEN` | — | 6 |
| | | 3 | `BITTEN_UND_REAGIEREN` | — | 6 |

Hören 15 + Lesen 15 + Schreiben 15 + Sprechen 15 = **60**. No Sprachbausteine.

### A2 — telc Deutsch A2 / Start Deutsch 2

Family `START_DEUTSCH` · **60 points** · pass = **60 % of the total**

| Block | Min | Teil | Aufgabenart | Items | Points |
|---|---|---|---|---|---|
| Hören | ~20 | 1 | `KURZANTWORT` | 5 | 5 |
| | | 2 | `EINZELAUSWAHL` | 5 | 5 |
| | | 3 | `ZUORDNUNG` | 5 | 5 |
| Lesen und Schreiben | 50 | Lesen 1 | `EINZELAUSWAHL` | 5 | 5 |
| | | Lesen 2 | `RICHTIG_FALSCH` | 5 | 5 |
| | | Lesen 3 | `ZUORDNUNG` | 5 | 5 |
| | | Schreiben 1 | `FORMULAR_AUSFUELLEN` | 5 fields | 5 |
| | | Schreiben 2 | `TEXT_SCHREIBEN` | 1 | 10 |
| Sprechen | — | 1 | `SICH_VORSTELLEN` | — | 3 |
| | | 2 | `ALLTAGSGESPRAECH` | — | 6 |
| | | 3 | `ETWAS_AUSHANDELN` | — | 6 |

Same sum, **60**. No Sprachbausteine.

### B1 — telc Deutsch B1 / Zertifikat Deutsch

Family `ZERTIFIKAT_DEUTSCH` · **300 points** (225 written + 75 oral)
Pass = **60 % of written AND 60 % of oral** (135 / 45)

| Block | Min | Teil | Aufgabenart | Items | Points |
|---|---|---|---|---|---|
| Lesen + Sprachbausteine | 90 | Lesen 1 | `ZUORDNUNG` | 5 texts / 10 titles | 25 |
| | | Lesen 2 | `EINZELAUSWAHL` | 5 × 3 options | 25 |
| | | Lesen 3 | `ZUORDNUNG` | 10 situations / 12 ads | 25 |
| | | SB 1 | `LUECKENTEXT_EINZELAUSWAHL` | 10 gaps | 15 |
| | | SB 2 | `LUECKENTEXT_WORTBANK` | 10 gaps / 15 words | 15 |
| Hören | ~30 | 1 | `RICHTIG_FALSCH` | 5 | 25 |
| | | 2 | `RICHTIG_FALSCH` | 10 | 25 |
| | | 3 | `RICHTIG_FALSCH` | 5 | 25 |
| Schreiben | 30 | 1 | `TEXT_SCHREIBEN` | 1 task, 4 Leitpunkte | 45 |
| Sprechen | — | 1 | `SICH_VORSTELLEN` (Einander kennenlernen) | — | **15, scored** |
| | | 2 | `UEBER_EIN_THEMA_SPRECHEN` | — | 30 |
| | | 3 | `GEMEINSAM_PLANEN` | — | 30 |

Written 75 + 30 + 75 + 45 = **225**. Oral **75**. Total **300**.

### B2 — telc Deutsch B2

Family `ZERTIFIKAT_DEUTSCH` · **300 points** (225 written + 75 oral)
Pass = **60 % of written AND 60 % of oral**

| Block | Min | Teil | Aufgabenart | Items | Points |
|---|---|---|---|---|---|
| Lesen + Sprachbausteine | 90 | Lesen 1 | `ZUORDNUNG` | 5 | 25 |
| | | Lesen 2 | `EINZELAUSWAHL` | 5 | 25 |
| | | Lesen 3 | `ZUORDNUNG` | 10 | 25 |
| | | SB 1 | `LUECKENTEXT_EINZELAUSWAHL` | 10 gaps | 15 |
| | | SB 2 | `LUECKENTEXT_WORTBANK` | 10 gaps / 15 words | 15 |
| Hören | **~20** | 1 | `RICHTIG_FALSCH` | 5 | 25 |
| | | 2 | `RICHTIG_FALSCH` | 10 | 25 |
| | | 3 | `RICHTIG_FALSCH` | 5 | 25 |
| Schreiben | 30 | **A** | `TEXT_SCHREIBEN` | choose one of two | 45 |
| | | **B** | `TEXT_SCHREIBEN` | same `choiceGroupId` | 45 |
| Sprechen | 15 (prep 20) | **0** | `SICH_VORSTELLEN` | intro | **NOT_SCORED** |
| | | 1 | `UEBER_ERFAHRUNGEN_SPRECHEN` | — | 25 |
| | | 2 | `DISKUSSION` | — | 25 |
| | | 3 | `GEMEINSAM_PLANEN` | — | 25 |

Written 75 + 30 + 75 + 45 = **225**. Oral 25 + 25 + 25 = **75**. Total **300**.

### What the families do and do not share

| | A1 ↔ A2 | B1 ↔ B2 |
|---|---|---|
| Blocks, total points, pass rule | identical | identical |
| Point distribution | identical | identical |
| Aufgabenart per Teil | **all Hören + Lesen differ** | Lesen/SB identical; Sprechen differs |
| Item counts | Hören differs (6/4/5 vs 5/5/5) | identical |
| Schreiben | identical (form + text) | **B1 one task, B2 choice of two** |
| Hören duration | identical (~20) | **B1 ~30, B2 ~20** |

**The trap.** The families are real at the *block* level and false at the *Teil*
level. Two specific consequences:

1. A shared "A-family" table set keyed by Teil would need `a_hoeren_teil1` to be
   multiple-choice for A1 and short-answer for A2 — two shapes in one table.
2. **B1 Teil 1 and B2 Teil 1 are different tasks.** `Einander kennenlernen` is
   B1's scored Teil 1 (15 points) and B2's *unscored* intro. B2's Teil 1 is
   `UEBER_ERFAHRUNGEN_SPRECHEN` (25 points). Anything keyed on the Teil number
   alone gives B2 candidates B1 Teil 1 behaviour. This is the most dangerous
   mismatch in the whole document, because nothing throws.

---

## Part 2 — The `Aufgabentyp` enum

Seventeen values. This enum is the discriminator for every stored section and
the only thing a reader needs in order to know a section's shape.

```prisma
enum Aufgabentyp {
  // Written — auto-scored
  EINZELAUSWAHL                 // single choice, n options
  RICHTIG_FALSCH                // true/false
  ZUORDNUNG                     // match n prompts to m options
  KURZANTWORT                   // short free-text answer
  FORMULAR_AUSFUELLEN           // fill a form's fields
  LUECKENTEXT_EINZELAUSWAHL     // cloze, options per gap
  LUECKENTEXT_WORTBANK          // cloze, shared word bank
  // Written — human/AI scored
  TEXT_SCHREIBEN
  // Oral
  SICH_VORSTELLEN
  FRAGEN_UND_ANTWORTEN
  BITTEN_UND_REAGIEREN
  ALLTAGSGESPRAECH
  ETWAS_AUSHANDELN
  UEBER_EIN_THEMA_SPRECHEN      // B1 Teil 2
  UEBER_ERFAHRUNGEN_SPRECHEN    // B2 Teil 1
  DISKUSSION
  GEMEINSAM_PLANEN
}
```

Eight written types cover **all four levels**. That ratio — 8 types against
~45 `(level, skill, Teil)` slots — is the whole argument for storing by type
rather than by position in the paper.

---

## Part 3 — How content is stored

### The decision rule

> **A level is stored in the existing B1 tables if every Aufgabenart it uses
> already has a table there. Otherwise it goes in the generic model.**

Applied:

| Level | Storage | Why |
|---|---|---|
| B1 | existing 18 tables | it *is* those tables |
| **B2** | **existing 18 tables** | same Aufgabenarten as B1 |
| **A2** | **generic model** | needs `KURZANTWORT`, `FORMULAR_AUSFUELLEN` |
| **A1** | **generic model** | needs `FORMULAR_AUSFUELLEN` |

This is deliberate, not indecision. B2 costs **one** schema change in the
existing tables; forcing it through a new model would cost a model *and* a
reader before anything proves the level plumbing works. A1/A2 cannot use the
existing tables at all — `FORMULAR_AUSFUELLEN` and `KURZANTWORT` have no table
and no analogue — and building ~20 more per-Teil tables for them repeats a
mistake already visible in the schema (see *Why not more per-Teil tables*).

### Track 1 — B2 in the existing tables

Verified section by section:

| Section | Table | Change |
|---|---|---|
| Lesen 1, 3 (`ZUORDNUNG`) | `lesen_teil1_*`, `lesen_teil3_*` | none |
| Lesen 2 (`EINZELAUSWAHL`) | `lesen_teil2_*` | none — the article goes in `topBody`, exactly as MT 3–6 already do |
| SB 1, 2 | `sprachbausteine_*` | none |
| Hören 1–3 | `listening_exercises` | none |
| Sprechen intro + 1–3 | `speaking_exercises` | none — intro is `part: 0`; the key is `(modelltest_id, part)` on an `Int` |
| **Schreiben A/B** | `writing_exercises` | **`@@unique([modelltest_id])` → `@@unique([modelltest_id, part])`, add `choice_group_id`** |

One schema change. Note `writing.service.ts` uses `findFirst`, which would
return one of B2's two tasks arbitrarily — it must return both so the candidate
can choose.

### Track 2 — the generic model, for A1 and A2

Three tables replace the ~20 that per-Teil modelling would need. The design
follows IMS QTI, where an item is a set of typed *interactions* rather than a
position in a paper.

```prisma
model ExamSection {
  id               String      @id @default(uuid())
  modelltest_id    String      @db.Uuid
  skill            Skill
  teil             Int         // 0 for an unscored intro
  aufgabentyp      Aufgabentyp
  label            String
  instruction      String
  max_points       Int
  scored           Boolean     @default(true)
  /// Everything this Aufgabentyp needs that is not an item: the passage, the
  /// article, the form, the word bank, the audio reference, the Sprechen card.
  /// Validated against `aufgabentyp` at import, never on read.
  material         Json
  content_revision String      @unique
  /// Set on both halves of a B2-style one-of-two choice.
  choice_group_id  String?
  sort_order       Int

  modelltest Modelltest @relation(fields: [modelltest_id], references: [id])
  items      ExamItem[]

  @@unique([modelltest_id, skill, teil])
  @@map("exam_sections")
}

model ExamItem {
  id          String  @id @default(uuid())
  section_id  String
  item_number Int
  prompt      String
  /// null for TEXT_SCHREIBEN and every oral type — nothing to key.
  correct_key String?
  sort_order  Int

  section ExamSection      @relation(fields: [section_id], references: [id], onDelete: Cascade)
  options ExamItemOption[]

  @@unique([section_id, item_number])
  @@map("exam_items")
}

model ExamItemOption {
  id         String  @id @default(uuid())
  item_id    String
  /// "a" | "b" | "c", or the word-bank letter.
  key        String
  content    String
  is_correct Boolean @default(false)
  sort_order Int

  item ExamItem @relation(fields: [item_id], references: [id], onDelete: Cascade)

  @@unique([item_id, key])
  @@map("exam_item_options")
}
```

### `material` per Aufgabentyp

The only thing `Json` costs is compile-time typing, so each shape is pinned by
a Zod schema at the import boundary and validated **once**, when a file is
imported. A bad file fails loudly at import; no read path ever guesses.

| Aufgabentyp | `material` | Items |
|---|---|---|
| `EINZELAUSWAHL` | `{ passage? }` | one per question, options with one `is_correct` |
| `RICHTIG_FALSCH` | `{ passage? }` | one per statement, `correct_key` = `richtig` / `falsch` |
| `ZUORDNUNG` | `{ texts[], options[] }` | one per prompt, `correct_key` = option key, or null for no-match |
| `KURZANTWORT` | `{ passage? }` | one per question, `correct_key` = accepted answers |
| `FORMULAR_AUSFUELLEN` | `{ form: { heading, fields[] } }` | one per blank field |
| `LUECKENTEXT_EINZELAUSWAHL` | `{ body }` | one per gap, options per item |
| `LUECKENTEXT_WORTBANK` | `{ body, wordBank[] }` | one per gap, `correct_key` = word letter |
| `TEXT_SCHREIBEN` | `{ intro?, stimulus?, bulletPoints[], minimumWords? }` | none |
| oral types | `{ topicTitle, topicDescription, topicPoints[], prepSeconds }` | none |

### Rules that never move into `material`

Anything the backend branches on stays a column or a row: `skill`, `teil`,
`aufgabentyp`, `max_points`, `scored`, `choice_group_id`, `content_revision`.
The discipline that keeps `material` safe is one rule — **never write a `WHERE`
that reaches inside it.** The day you need to, that field has earned a column.

### Why not more per-Teil tables

Two pieces of evidence already in the repo:

1. `lesen_teil2_exercises` carries `cautionNote`, `topSender`, `topReceiver`,
   `topBody`, `quotedThread` — one paper's visual layout turned into columns.
   Four of those five are **empty strings in Modelltests 3, 4, 5 and 6**. The
   table rotted one paper after it was written.
2. `lesen_teil1_*` (5 texts → 10 titles) and `lesen_teil3_*` (10 situations →
   12 ads) are the *same interaction* — `ZUORDNUNG` — modelled twice under
   different column names. Six tables doing the work of two.

### Performance

The generic model issues **fewer** queries than today, not more. Assembling a
Modelltest currently takes ~8 round trips across 18 tables. Generic:

```ts
prisma.examSection.findMany({
  where: { modelltest_id },
  include: { items: { include: { options: true } } },
  orderBy: [{ skill: 'asc' }, { teil: 'asc' }],
})
```

Covered by `@@unique([modelltest_id, skill, teil])`. One Modelltest is ~13
sections, ~50 items, ~150 options; four levels × six papers is roughly
**3,600 option rows** — smaller than `grammar_exercises` today. `material` is
fetched by key and rendered, never filtered, so no GIN index is needed.

### Identity

`modelltests.number` stays **globally unique**, and a level is an attribute of
the row, not part of its address:

| number | level |
|---|---|
| 1–6 | B1 |
| 7+ | B2 |
| … | A2, then A1 |

Making identity `(level, number)` would be closer to how telc names its papers,
but `number` is the address in ~15 services, every public URL, the Flutter app
and the center dashboard. Not worth it. Revisit only if the numbering genuinely
confuses a center.

---

## Part 4 — Level as data, not constants

Four tables hold the rules. Three exist; one is new. Seeding a level must be a
migration, never a deployment.

| Table | Holds | Today |
|---|---|---|
| `exam_block_durations` | `(level, block)` → minutes, position | **B1 only — 3 rows** |
| `exam_section_weights` | `(level, skill, teil)` → max_points, part | **B1 only — 10 rows** |
| `exam_pass_rules` *(new)* | `(level)` → rule type + thresholds | does not exist |
| `modelltests.level` | which exam a paper is for | exists, defaults `B1` |

### Why `exam_pass_rules` is needed

`PASS_RATIO = 0.6` is applied to each half separately —
`written.passed && oral.passed` (`exam-result.service.ts:336`). That is correct
for B1 and B2. **A1 and A2 use a single combined 60 %**, so an A1 candidate
scoring 100 % written and 50 % oral passes under telc and is marked `FAILED` by
this code. The rule itself has to become per-level data:

```prisma
enum PassRuleType { TOTAL_PERCENT, PART_PERCENT }

model ExamPassRule {
  level            CefrLevel    @id
  type             PassRuleType
  /// TOTAL_PERCENT
  minimum_percent  Int?
  /// PART_PERCENT
  written_percent  Int?
  oral_percent     Int?

  @@map("exam_pass_rules")
}
```

Seeds: A1/A2 to `TOTAL_PERCENT 60`; B1/B2 to `PART_PERCENT 60/60`.

---

## Part 5 — How level affects each feature

Audited against the code. **Ready** means already level-generic.

### Already correct — no work

| Feature | Where | Why it works |
|---|---|---|
| Level on a student | `auth.service.ts:185`, `code-redemption.service.ts:279`, `auth.service.ts:687`, `center-students.service.ts:108` | four writers, all take any `CefrLevel` |
| Activation code level | `activation_codes.level` | center sets it before handout; copied at redemption |
| Training catalogue | `modelltests.service.ts:49` | filters `where: { exam_only: false, level }` |
| Modelltest of the week | `training-modelltest-access.service.ts:133` | rotation pool is level-scoped |
| Training access gate | `assertLevelAllows` | `403 LEVEL_MISMATCH` on a cross-level paper |
| Prep Pass | same service | widens how many papers *of the level* are open |
| Exam block timings | `exam-sitting.service.ts:459` | reads `(level)` rows |
| Exam section weights | `exam-result.service.ts:575`, `exam-grading.service.ts:85` | reads `(level, skill, teil)` rows |
| Skill content endpoints | lesen / hören / SB / schreiben / sprechen | addressed by Modelltest number; level enforced by the gate above |
| Audio play allowance | `training_audio_plays` | per student and recording |

Adding a level therefore needs **no change at all** to catalogue, rotation,
entitlements, Prep Pass, erasure, attempt history or audio metering. That is
the shape the previous author built toward, and it holds.

### Breaks that must be fixed

| # | Feature | Where | What happens | Fix |
|---|---|---|---|---|
| 1 | **Live Room** (Start, sold as *illimité*) | `speaking-topics.data.ts:1` `type SpeakingLevel = 'B1'`; `find-partner.dto.ts:14` `@IsIn(['B1'])` | a non-B1 student gets a **400** — cannot open a room at all | enum instead of the literal; `level` column on topics |
| 2 | **Sprechen AI evaluation** (Start) | `evaluation.service.ts:264-318` — prompt hard-codes *telc Deutsch B1*, B1 Teil names, `maxPts = teil===1 ? 15 : 30` | a B2 student practising Teil 1 is graded as B1 Teil 1, out of 15 instead of 25 | key context and max points on `(level, teil)`, or better on `aufgabentyp` |
| 3 | **Exam Day** | `exam-sessions.service.ts:18` `EXAM_LEVEL = 'B1'` | session stamped B1 whatever paper is chosen, so a B2 sitting gets B1 timings and weights, silently | take `level` from `modelltest.level` |
| 4 | **Exam Modelltest picker** | `exam-modelltests.service.ts:59` | lists `{number,title}` with no level; a manager picks a CEFR level blind | add `level`, filter by it |
| 5 | **Readiness / Suivi** (Start) | `progress-formula.ts:24` — `SKILL_MAX_POINTS`, `WRITTEN_MAX=225`, `TOTAL_MAX=300` | A1 has no Sprachbausteine and a 60-point exam; unpractised skills count 0, so **an A1 student can never be marked ready** | read `exam_section_weights` rows instead of constants |
| 6 | **Exam pass verdict** | `exam-result.service.ts:6` | part-rule applied to A1/A2, which use a total rule, so a passing candidate is marked `FAILED` | read `exam_pass_rules` |
| 7 | **Guest demo access** | `guest-modelltest-access.ts:8` allowlist `{1, 2}` | guests only ever see B1 papers 1–2 | decide per level, or keep B1-only deliberately |

### Watch, but not blocking

| Feature | Note |
|---|---|
| **Schreiben AI correction** | `writing-telc-rating.ts` is the B1 Schreiben grid. B2 is also 45 points, so points coincide and criteria differ in wording only. A1/A2 are 10 points and need their own grid. |
| **Mit Elena** | level appears in the topic DTOs as B1 examples. Confirm Elena's topic generation takes the student's level before selling to non-B1 seats. |
| **Grammar / Vocab** | `grammar_topics.cefr_levels` and `vocab_entries.cefr_level` are stored and exposed but never filtered. Content for new levels is pure data; add filtering only if the product wants it. |

### The rule behind the breaks

Every item above is the same bug: **a level's rule written as a constant instead
of read as a row.** Timing and weights were built as data and work. Pass rules,
readiness caps, Sprechen contexts and `EXAM_LEVEL` were built as constants and
all four fail. New level-dependent behaviour goes in a table.

---

## Part 6 — Interaction with the rest of the app

The two-track split (B1/B2 in the existing tables, A1/A2 in the generic model)
is only safe if the cross-cutting features do not reach into content tables.
Audited below.

### Why the split is mostly invisible

Two seams already exist, and they do the work:

1. **`student_activities` is the history and progress layer, and it is
   content-agnostic.** It stores `(skill, teil, score, max_score,
   modelltest_id?, attempt_id)` with **no foreign key to any content table** —
   `attempt_id` is a loose pointer "in the table the skill names". Every
   history read, readiness calculation, per-Teil statistic and erasure sweep
   runs on those numbers.
2. **Exam attempts record the Teil number, not the content row.**
   `exam-scoring.service.ts:157` writes `exercise_id: section.teil` — the bare
   Teil number. Nothing in an exam attempt points at a content row.

So history, readiness, per-Teil stats, erasure (D39), entitlements, Prep Pass,
weekly rotation and exam results **do not change at all** when a level is stored
in a different set of tables.

### Feature-by-feature

| Feature | Keys on | Two-track safe? |
|---|---|---|
| Weekly Modelltest rotation | Modelltest `number`, filtered by level | ✅ |
| Training catalogue + level gate | `number`, `level` | ✅ |
| Prep Pass / entitlements | `level`, `number` | ✅ |
| Student history (`/history`) | `student_activities` rows | ✅ |
| Readiness / Suivi | `skillScores` over activity `teils` | ✅ (break 5 in Part 5 still applies) |
| Per-Teil statistics (D29) | raw SQL over `student_activities` | ✅ |
| Erasure (D39) | `erasure_id` on attempts + activities | ✅ |
| Exam attempt + blocks | `(skill, teil)` strings | ✅ |
| Exam section results / grading | `exam_section_weights` rows | ✅ |
| Vocab occurrences | `modelltest_id` | ✅ |
| **Training audio metering** | **FK to `listening_exercises`** | ❌ **break 8** |
| **Listening attempt link** | FK to `listening_exercises` | ⚠️ **break 9** |
| **Exam block composition** | hard-coded constant | ❌ **break 10** |
| **Exam Modelltest picker** | `some {}` on 12 B1 relations | ❌ **break 11** |
| **Activity writer** | rejects `teil < 1` | ⚠️ **break 12** |
| Weekly full content assembly | calls the five B1 skill services | ❌ **break 13** |

### Break 8 — training audio metering cannot cover A1/A2

`TrainingAudioPlay.audio_id` is a **non-nullable foreign key** to
`ListeningExercise` (`onDelete: Cascade`). A1/A2 Hören lives in the generic
model, so there is no `listening_exercises` row to point at and the row cannot
be written at all — **audio-play limits would silently not exist for A-level
students.**

`ExamAudioPlay.audio_id` in the same schema is a plain `@db.Uuid` with **no
foreign key**, documented as "the `listening_exercises` row this counts plays
of". That is the precedent to follow.

**Fix:** drop the FK on `TrainingAudioPlay.audio_id`, keeping the column and the
`@@unique([student_id, audio_id])`. Two-line migration, matching the convention
already used one table away.

A1/A2 Hören genuinely cannot reuse `listening_exercises`: their Hören Teile are
`EINZELAUSWAHL`, `KURZANTWORT` and `ZUORDNUNG`, and `listening_questions` has
only `prompt` + `correct_answer` with **no options table**. B1/B2 Hören is
`RICHTIG_FALSCH` throughout, which is why one string sufficed.

### Break 9 — listening attempt loses its content link

`ListeningAttempt.listening_exercise_id` is a nullable FK with
`onDelete: Restrict`. A1/A2 attempts would set it `null` and rely on
`content_revision`, which the schema already documents as the fallback for rows
whose revision names no Modelltest. Tolerable, but it weakens analysis.

**Fix:** same as break 8 — plain column, no FK — or accept `null` deliberately
and say so in the comment.

### Break 10 — Exam Day cannot assemble an A1/A2 sitting

Two problems, both constants:

1. `enum ExamBlock` has only `LESEN_SPRACHBAUSTEINE`, `HOEREN`, `SCHREIBEN`.
   A1/A2 need **`LESEN_SCHREIBEN`**, which does not exist.
2. `exam-scoring.service.ts:51` hard-codes the block composition:

```ts
const BLOCK_SECTIONS: Record<ExamBlock, { skill: ExamSkill; teil: string }[]> = {
  LESEN_SPRACHBAUSTEINE: [LESEN 1, LESEN 2, LESEN 3, SPRACHBAUSTEINE 1, SPRACHBAUSTEINE 2],
  HOEREN:                [HOEREN 1, HOEREN 2, HOEREN 3],
  SCHREIBEN:             [SCHREIBEN 1],
};
```

That is B1/B2's structure written as code. A1/A2 put Lesen and Schreiben in one
block, and their Schreiben has **two** Teile where Teil 1
(`FORMULAR_AUSFUELLEN`) is auto-scorable while the current code routes all
`SCHREIBEN` to human grading via `storeWriting`.

**Fix:** add `LESEN_SCHREIBEN` to the enum, add a `block` column to
`exam_section_weights`, and derive `BLOCK_SECTIONS` from those rows. The table
already holds `(level, skill, teil, max_points, part)` — `block` is the one
missing field, and with it the composition becomes a query instead of a
constant. Route Schreiben to auto-scoring or human grading on `aufgabentyp`,
not on skill.

This is the same bug class as Part 5: a level's rule as a constant.

### Break 11 — A1/A2 Modelltests never reach the exam picker

`COMPLETE_EXAM_MODELLTEST_WHERE` requires `some {}` on twelve B1 relations,
including `sprachbausteineExercises`. **A1 and A2 have no Sprachbausteine**, so
an A-level paper can never satisfy it and will not appear in a center's exam
catalogue or preview.

B2 passes all twelve checks unchanged.

**Fix:** make completeness a per-level check — every section the level's
`exam_section_weights` rows name must have content, in whichever track holds it.

### Break 12 — the activity writer rejects Teil 0

`student-activity.writer.ts:46` rejects `input.teil < 1`. B2's Sprechen intro is
`part: 0`. It is `NOT_SCORED`, so it should never produce an activity row — but
if the Flutter app lets a student practise and submit the intro, the writer
throws.

**Fix:** never write an activity for an unscored section, and keep the guard.
The guard is correct; the caller must not reach it.

### Break 13 — the content seam, and where the branch lives

`modelltests.service.ts` assembles full weekly content by calling the five B1
skill services. For an A1/A2 paper those services read the B1 tables and return
nothing.

**This is the one unavoidable cost of two tracks**, and it is bounded: the
branch goes in the service layer that already builds the DTOs, keyed on
`modelltest.level`. The DTO shape the clients receive does not change, so the
Flutter app and the center dashboard need no change for storage at all.

### Net effect

Eleven of the seventeen audited features need **nothing**. Five of the six
breaks are a constant that should have been a row — the same defect Part 5
describes, found in different files. One (break 13) is the deliberate price of
not migrating B1.

Nothing in this audit changes the storage recommendation. It adds four items to
the sequence, all in phase 3 where A1/A2 arrive — except break 12, which belongs
with B2 in phase 2.

---

## Part 7 — The integration procedure

The goal is that **every level has the functionality B1 has**, with no
regression to B1 at any point. Two principles make that mechanical rather than
careful.

### Principle 1 — one contract, four levels

**Never add a level-specific endpoint, DTO or client branch.** Every level
returns the same DTO shapes from the same routes; the level only decides which
rows are read. This is what gives a new level the whole feature set at once —
history, readiness, Prep Pass, exam sittings and the Flutter app all work
because they never learn that a level exists.

Corollary: the only place that may branch on level is the service layer that
assembles DTOs (break 13). If a branch on level appears in a controller, a DTO
or a client, the design has been violated.

### Principle 2 — replace a constant with a row only under an equality test

Every break in Parts 5 and 6 is a level rule written as a constant. When
replacing one, the migration seeds the rows **and** a test asserts the
row-derived value equals the old constant for B1:

```ts
// Phase 1 — this test is the no-regression guarantee.
it('B1 rows reproduce the constants they replace', async () => {
  expect(await blockSectionsFor('B1')).toEqual(BLOCK_SECTIONS_LEGACY);
  expect(await passRuleFor('B1')).toEqual({ type: 'PART_PERCENT', written: 60, oral: 60 });
  expect(await skillMaxPointsFor('B1')).toEqual(SKILL_MAX_POINTS_LEGACY);
});
```

Keep the old constant in the test file as the expected value, not in the
production path. A refactor that changes B1 behaviour then fails loudly instead
of shipping.

---

### Phase 0 — the safety net (no behaviour change, half a day)

Nothing else starts until this is green. It converts "we did not break B1" from
a judgement into a test run.

| | Work |
|---|---|
| Code | Golden-master test: for Modelltests 1–6, call every skill endpoint (`/lesen`, `/sprachbausteine`, `/listening`, `/writing`, `/speaking`) and snapshot each response to a committed fixture |
| Code | Generator-fidelity test: re-run `generate-modelltest-seed.mjs` for MT 3–6 and diff the output against the committed migration SQL — byte-identical |
| DB | None |

**Done when** both tests pass and a deliberate one-character change to any
B1-facing mapper makes them fail.

Why first: phases 1–3 all touch shared code. Without the snapshots, each one
needs a human to decide whether B1 still works. With them, the suite decides.

---

### Phase 1 — level becomes data (no content, no new content tables)

Everything here is additive in the DB and pinned by the equality test above.
Ship it before any B2 content, or Exam Day will stamp B1 on a B2 sitting.

**DB**

| Change | Kind |
|---|---|
| Seed `exam_block_durations` for B2 — 90 / **20** / 30 | additive |
| Seed `exam_section_weights` for B2 — the same ten rows as B1 | additive |
| New table `exam_pass_rules` + rows for all four levels | additive |
| Add `block` to `exam_section_weights`, backfill B1 and B2 | additive column |

**Code** — breaks 1, 2, 3, 4, 6, and the composition half of 10

| Break | Change |
|---|---|
| 3 | `EXAM_LEVEL` deleted; session level from `modelltest.level` |
| 4 | exam Modelltest picker exposes and filters `level` |
| 6 | pass verdict reads `exam_pass_rules` instead of `PASS_RATIO` |
| 10 | `BLOCK_SECTIONS` derived from `exam_section_weights` rows; `LESEN_SCHREIBEN` added to `enum ExamBlock` |
| 1 | `SpeakingLevel` literal replaced by `CefrLevel`; `level` column on Live Room topics |
| 2 | Sprechen evaluation context and max points keyed on `(level, teil)` |

**Done when** the golden master is unchanged, the equality test passes, and a
B2 exam session created from a B2 paper reports 20-minute Hören.

---

### Phase 2 — B2 content (one schema change, then the launch)

**DB**

| Change | Kind |
|---|---|
| `writing_exercises`: `@@unique([modelltest_id])` becomes `@@unique([modelltest_id, part])`, add `part` (backfill `1`) and `choice_group_id` | widening — existing rows stay valid |

**Code**

- `writing.service.ts`: `findFirst` becomes a read of every task of the
  Modelltest, so a B2 candidate can choose. B1 returns a one-element list; the
  DTO gains a list field rather than changing the existing one, so the clients
  keep working.
- Break 12: never write a `student_activities` row for an unscored section.
- New importer (a **second** script — the B1 generator stays untouched):
  accepts `part: 0` Sprechen, two Schreiben tasks, `media.audioUrl` and
  `media.durationSeconds`, emits `level`.

**Content**

- `content/b2-modelltest-1-source.json`: set `number: 7`.
- Decide the transcripts (see Open decisions).
- Generate the seed migration, apply against `.env.test`, verify, commit.

**Done when** MT 1–6 snapshots are unchanged, MT 7 returns all five skills, a
B2 student sees only MT 7 in the catalogue, a B1 student gets
`403 LEVEL_MISMATCH` on MT 7, and a B2 sitting times and marks with B2 rows.

---

### Phase 3 — the generic model and A2

Entirely additive in the DB. B1 and B2 keep reading the existing tables.

**DB**

| Change | Kind |
|---|---|
| `enum Aufgabentyp` (17 values) | additive |
| `exam_sections`, `exam_items`, `exam_item_options` | additive |
| Drop the FK on `TrainingAudioPlay.audio_id`, keep the column (break 8) | constraint drop |

**Code**

| Break | Change |
|---|---|
| 13 | DTO assembly branches on `modelltest.level`: existing tables, or the generic reader |
| 5 | `progress-formula` reads `exam_section_weights` instead of its constants — **must land before any A-level content**, or A students can never be marked ready |
| 11 | exam completeness becomes per-level: every section the level's weight rows name must have content |
| 10 | Schreiben routed to auto-scoring or human grading on `aufgabentyp`, not on skill |
| 9 | `ListeningAttempt.listening_exercise_id` left null for generic-model levels, deliberately |
| — | Zod schema per `aufgabentyp`, validated at import only |

**Content** — A2 Modelltest 1.

**Done when** everything above holds for A2 *and* the B1/B2 snapshots are still
byte-identical.

---

### Phase 4 — A1

Importer run only. No migration, no schema change, no new code path — A1 uses
the same infrastructure as A2 with different rows. If phase 4 needs code,
phase 3 was built wrong.

---

### The level readiness checklist

A level is not sellable until all nine pass. This exists to prevent the
half-launched level, which is the error class most likely to reach a paying
center.

| | Check |
|---|---|
| 1 | `exam_block_durations` rows exist for the level |
| 2 | `exam_section_weights` rows exist, with `block`, summing to the level total |
| 3 | `exam_pass_rules` row exists |
| 4 | At least one Modelltest imported, `level` set, content verified against the source |
| 5 | All five skill endpoints return a DTO for it |
| 6 | Catalogue and `of-the-week` resolve; a student of another level is refused |
| 7 | Center exam picker lists it; a sitting times and marks with that level rows |
| 8 | Readiness returns a number, and a perfect student reaches `ready` |
| 9 | Live Room opens; training audio metering writes a play row |

Checks 8 and 9 are the two that fail silently. Both are in the list for that
reason.

### Standing constraints

- Never a bare `prisma migrate` — `.env` is production. Export `.env.test` and
  refuse `ep-wandering-hall`.
- All four suites green before merge: unit, e2e, integration, build.
- Branch from `dev`, never `main`. Direct pushes to `dev` are rejected; open a PR.
- Content is immutable by `content_revision`; a correction is a new revision.
- Exercise `GET` responses never contain correct answers — `correct_key` and
  `is_correct` are stripped on read, as the B1 readers already do.
- B1's 18 content tables are never migrated and never altered except by
  widening (phase 2's `writing_exercises`).

---

## Open decisions

1. **Is A1 in the offer?** Phases 3–4 exist for the A-family. If the answer is
   B1 + B2 only, phase 3 shrinks to breaks 5–6 and no new tables are needed.
   *Business — needs the founder and Herman.*
2. **B1 Sprechen Teil 2's Aufgabenart.** `UEBER_EIN_THEMA_SPRECHEN` here and in
   the level blueprint; `SPEC-modelltest-content-contract.md:231` omits it from
   its 16-value enum. Pin the enum at 17 before anything imports against it.
3. **Guest demo scope** across levels (break 7).
4. **Does B1 ever migrate** into the generic model? Default: no. Revisit only if
   maintaining two readers becomes the larger cost.
