# Training correction package — API contract

**Status:** backend implemented on branch `feat/training-correction-hoeren-b1` — Flutter pending  
**Pilot:** B1 Modelltest 3 · Hören Teil 1 (items 41–45)  
**Readers:** Flutter app (Herman), backend implementers  
**Related:** [answer-key-with-exercise](../domains/answer-key-with-exercise.md) (keys), [hoeren-training-exam-alignment](../domains/hoeren-training-exam-alignment.md) (play/stream), [exam-simulator](../domains/exam-simulator.md) (Exam Day strip)

This document is the client-facing contract for **authored teaching text** that
ships with a Modelltest. It is not live AI on submit. Personal AI for Schreiben
and Sprechen stays on their existing endpoints.

---

## Scope

| In | Out |
|---|---|
| Training Hören: `correction` on `POST /api/listening/submit` | Exam Day candidate payloads |
| Training Lesen / Sprachbausteine: optional `correction` on each item in `GET /exercise` | Changing keys / scoring |
| Pilot content: **B1** Modelltests with packages; **A1/A2** generic `exam_items.correction` | B2 same as B1 tables; Schreiben T2 / Sprechen open packages later |

**Language (v1):** German only (`whyCorrect`, `whyOppositeFails`, `learningPoint`,
`evidence`). Optional FR/EN keys may be added later without removing DE.

---

## Behaviour

1. **Training** may return `correction` after a successful submit, keyed like
   `answerKey`.
2. **Old clients** ignore unknown fields — `correction` is optional.
3. **Exam Day** must never include `correction` (or transcripts / keys) on the
   live paper. Release after the sitting follows the centre’s results policy
   (same family as answer-key strip); that release path is **not** defined in
   this pilot.
4. Missing package for an item: omit that key from `correction` (or omit the
   whole object). Do not send empty strings as placeholders.

---

## Response shape — `POST /api/listening/submit`

Existing fields stay. New field is additive:

```json
{
  "attemptId": "uuid",
  "score": 80,
  "answerKey": {
    "q41": "+",
    "q42": "-",
    "q43": "-",
    "q44": "+",
    "q45": "-"
  },
  "correction": {
    "q41": {
      "evidence": "Na, eigentlich mach alles ich, ich bin zu Haus, daher koch ich, ich wasch ab, ich bügle, ich versorge das Kind",
      "whyCorrect": "Die Sprecherin sagt, dass sie praktisch alles macht. Sie nennt mehrere Aufgaben: kochen, abwaschen, bügeln und das Kind versorgen.",
      "whyOppositeFails": "„Falsch“ passt nicht, weil sie ausdrücklich beschreibt, dass die Hausarbeit hauptsächlich bei ihr liegt.",
      "learningPoint": "„Fast alles“ bedeutet nicht „wirklich alles“. Kleine Ausnahmen machen die Aussage nicht falsch.",
      "audioHighlight": {
        "startMs": null,
        "endMs": null
      }
    }
  }
}
```

### Field rules

| Field | Type | Required if item present | Meaning |
|---|---|---|---|
| map key | string | — | Same id as `answerKey` (`q` + question number for B1/B2 Hören) |
| `evidence` | string | yes | Exact quote (or continuous span) from the Teil transcript |
| `whyCorrect` | string | yes | Why the keyed answer follows from the evidence (DE) |
| `whyOppositeFails` | string | yes | Why the other of `+` / `−` fails (DE) |
| `learningPoint` | string | yes | One short tip (vocab, nuance, or listening strategy) |
| `audioHighlight.startMs` | number \| null | no | Clip start; `null` until timestamps exist |
| `audioHighlight.endMs` | number \| null | no | Clip end; `null` until timestamps exist |

For +/- Hören, do **not** use a distractor map; use `whyOppositeFails`.

### Lesen / Sprachbausteine — on each item in `GET /exercise`

Keys already ship with the exercise (ADR 0001). Attach `correction` on the
same item object (optional):

| Skill | Item | Extra teaching fields |
|---|---|---|
| Lesen T1 | text | `whyCompetingFails` (string) |
| Lesen T2 | question | `whyDistractorsFail: { a?: string, b?: string, c?: string }` (wrong options only) |
| Lesen T3 | situation | `whyCompetingFails` (string) |
| SB T1 | gap | `whyDistractorsFail` for wrong options |
| SB T2 | gap | `whyCompetingFails` (string) |

Shared fields: `evidence`, `whyCorrect`, `learningPoint`.

---

## Content source (import later)

Packages are authored with the Modelltest, not generated at request time.
Pilot content for MT 3 Hören Teil 1 was reviewed against
`content/modelltest-3-source.json` (keys and quotes coherent with items 41–45).

Suggested source JSON under each question (importer work is a later task):

```json
{
  "questionNumber": 41,
  "prompt": "…",
  "correctAnswer": "+",
  "sortOrder": 0,
  "correction": {
    "evidence": "…",
    "whyCorrect": "…",
    "whyOppositeFails": "…",
    "learningPoint": "…",
    "audioHighlight": { "startMs": null, "endMs": null }
  }
}
```

Storage shape in Postgres is an implementation detail; the **API** shape above
is what Flutter depends on.

---

## Flutter expectations

Today Corrigé compares the student answer to `answerKey` only
(`ListeningSubmitResult`). After this lands:

1. Parse optional `correction` on submit (ignore if absent).
2. On the Corrigé row for each question id, when a package exists, show
   `evidence`, `whyCorrect`, `whyOppositeFails`, `learningPoint`.
3. Ignore `audioHighlight` until both ends are non-null and a clip UI exists.

Do not require a new app release before the backend can ship empty/absent
`correction` — additive only.

---

## Pilot checklist

- [x] Design approved (this document)
- [x] Backend returns `correction` on Training Hören submit when stored
- [x] Lesen / SB GET include optional per-item `correction`
- [x] Exam strip omits `correction` (`ANSWER_KEY_FIELDS`)
- [x] MT 3 full auto-scored packages on **test** DB (Hören 20 + Lesen 20 + SB 20)
- [ ] Flutter shows packages on Corrigé when present
- [ ] Bruno / manual Training check for MT 3 verified on test
- [ ] Remaining B1 Modelltests (1–2, 4–6)
- [ ] Production migration (separate approval — never via bare `prisma migrate`)

---

## A1 / A2 (generic model)

Packages live on `exam_items.correction`. Training Hören/Lesen submit may
return `correction` keyed by item number (`"1"` …). Training Lesen GET
includes `correction` on each item when present. Exam Day strips `correction`
via `ANSWER_KEY_FIELDS` (same as B1).

Closed auto items use the same DE fields as B1; multiple-choice uses
`whyDistractorsFail`, richtig/falsch uses `whyOppositeFails`, form fields may
use `whyOtherAnswersFail`.

## Later (not this pilot)

- Schreiben T2 / Sprechen open-ended teaching packages (examples, checklists)
- Exam results-release of packages
- FR/EN parallel strings
- Audio clip replay from `audioHighlight`
