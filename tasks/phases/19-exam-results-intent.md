# Phase 19 — Results: marking, the pass rule, and releasing

**Written:** 2026-09-25
**Branch base:** `dev` @ `0c63251` (never `main`)
**Spec:** `docs/EXAM_SIMULATOR_SPEC.md`
**Follows:** phase 18, which stores scores nobody can read

## Why

A candidate can sit the exam and be marked. Nobody can see the result — not
the manager, not the student. Every score written in phase 18 is invisible,
which makes the whole feature undemonstrable.

## What we intend to build

1. **Weights as data.** telc B1 is 225 written points and 75 oral: Lesen 75,
   Sprachbausteine 30, Hören 75, Schreiben 45, Sprechen 75. A percentage per
   Teil cannot be added up without them, and they are seeded like the block
   durations rather than written into code.
2. **Human marks.** Schreiben is marked by a trainer; Sprechen happens in the
   center and arrives as a typed score. Both carry `graded_by` and
   `graded_at`, because a grade is the one number somebody may later be asked
   to defend.
3. **The pass rule, the real one.** 60% of the written block AND 60% of the
   oral — not one combined average. Decided on exact scores; rounded only for
   display.
4. **The manager's two views**: a table of every candidate in a sitting, and
   one candidate's result Teil by Teil.
5. **Releasing.** Nothing reaches a student until the manager says so, and
   releasing may happen more than once: the written scores now, the verdict
   after the oral.

## Not in this phase

- Notifications and CSV/PDF export — phase 20
- The 1,500 AI tier's Sprechen transcripts — phase 21

## Decisions this phase makes concrete

| | |
|---|---|
| Auto scores stay where phase 18 put them | The per-skill attempt rows are already the record; copying them into a results table would be two sources of truth and one of them would drift |
| Human marks get their own table | Sprechen has no attempt row at all — it happened in a room — and Schreiben's needs a grader's name beside it |
| Weights are rows, not constants | A2 and B2 are the same product with different numbers |
| A released result is a snapshot of what was released | A student who saw "pass" must not see it change because somebody re-marked afterwards |

## The order

| | Task | Scope |
|---|---|---|
| 1 | Weights seeded, `exam_section_results`, `results_released_at` | M |
| 2 | The result of one attempt: per-Teil, written and oral totals, pass or fail | M |
| 3 | Entering a human mark, with who and when | S |
| 4 | The manager's table and detail routes | M |
| 5 | Releasing, and what a student may read | M |

## Done when

A manager opens a finished sitting, sees every candidate with Lesen, Hören and
Sprachbausteine already marked and Schreiben and Sprechen waiting, types the
two missing marks, watches the verdict compute itself on telc's rule, presses
release, and the candidate sees exactly what was released and nothing more.

## What changed while building it

| | |
|---|---|
| Releasing an incomplete result needs `allowIncomplete` | Planned as always-allowed. Made explicit instead, so "we told them before the oral" is a decision the server saw rather than something a client did quietly |
| Marking is gated per block, not per attempt | The plan said a finished exam. A candidate who walked out before Hoeren could then never have their oral recorded, and the oral happened in a room regardless |
| One batched assembler behind both result paths | Releasing a sitting called the single-candidate path per candidate — the same N+1 the table had just been batched to avoid |
| `prisma.config.ts` fixed on the way past | `directUrl` is not in Prisma 7's datasource type, was ignored, and every migration had been running over the pooler |

## Open questions

None. The pass rule, the release behaviour and who may grade were all settled
before phase 16.
