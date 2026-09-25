# Phase 21 — The 1,500 XAF tier: AI beside the examiner

**Written:** 2026-09-25
**Branch base:** `dev` @ `c7309a2` (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md`
**Follows:** phases 16–20, which sell and run the 1,000 XAF product

## Why

Two products were agreed. The 1,000 one works end to end. The 1,500 one adds
the machine's opinion beside the human's, and it is small because the
evaluation already exists and is already tested: `POST /api/writing/evaluate`
and `POST /api/speaking/evaluate` have been in production for months.

## What the AI is, and is not

Settled with the product side: **a second opinion, never the verdict.**

The examiner opens the candidate, reads the transcript and the machine's notes
on grammar and vocabulary, and then types their own mark. Lerniqo does not
certify speaking. Nothing the AI produces reaches `exam_section_results`
without a person putting it there.

## What we intend to build

1. **The tier is charged for.** 1,500 XAF a candidate instead of 1,000, chosen
   when slots are bought and stamped on the sitting at publish. The column
   exists; nothing sells it yet.
2. **Schreiben gets a proposal.** When a candidate submits the block, the
   existing writing evaluation runs and its score is stored as a suggestion —
   not as a mark. The trainer sees "AI suggests 32/45" beside an empty field.
3. **Sprechen gets a transcript.** An AI speaking session inside the exam,
   using the endpoint the app already calls, whose transcript and notes the
   manager reads before typing the mark the examiner gave in the room.
4. **The manager's view** shows both, clearly labelled as suggestions.

## Not in this phase

- Anything that lets an AI score count. If that is ever wanted it is a
  different product and a different conversation.
- The Sprechen *dialogue* — Teil 2 and 3 are conversations, and the app
  records one candidate alone. Already documented as a limitation.

## Decisions this phase makes concrete

| | |
|---|---|
| A suggestion is a different thing from a mark | Two columns, not one nullable one. A mark has a person's name on it; a suggestion has a model's |
| The tier is stamped at publish, from the slots that paid | A center that bought the cheap product cannot get the expensive one by editing a draft |
| A MANUAL sitting runs no AI at all | Not "runs it and hides it" — the difference is what the center paid for |
| The AI never blocks a submit | A Gemini timeout must not cost a candidate their Schreiben |

## The order

| | Task | Scope |
|---|---|---|
| 1 | Two slot prices, and the tier stamped at publish | M |
| 2 | Schreiben: the proposal, stored beside the empty mark | M |
| 3 | Sprechen: the transcript, and the manager's view of both | M |

## Done when

A center buys AI slots at 1,500, publishes, and a candidate sits the same exam
— but the trainer opening Schreiben sees a suggested mark and a list of
corrections, and the examiner opening Sprechen sees what the candidate said
and what the machine thought of it. Both still type their own number.

## Open questions

None. What the AI is for was settled before phase 16: a second opinion.
