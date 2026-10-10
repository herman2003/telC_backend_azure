# Plan: Sprechen M10 A/B/C/D

**Decisions locked (spec OK):** M10 4 criteria; T1/T2·T3 point tables; no oral D-kill; pronunciation from transcript; `telcRating` inside `evaluation` JSON; legacy scores derived from letters.

## Tasks

1. Pure helpers `speaking-telc-rating.ts` + unit tests (T1=15, T2/T3=30)
2. Update `EvaluationService` prompt + parse + derive scores/telcRating; fix Teil 3 context → planen
3. Extend `SpeakingEvaluationResponseDto` with `telcRating`
4. Update / add evaluation tests for parse + points
5. Flutter prompt + code review + PR to `dev`
