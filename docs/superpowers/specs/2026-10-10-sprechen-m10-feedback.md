# Spec: Feedback Sprechen M10 A/B/C/D (telc Deutsch B1)

## Objective

Replace the generic 0–100 Sprechen AI scores (`grammar` / `vocabulary` / `coherence` / `overall`) with feedback that mirrors **telc Deutsch B1 Mündlicher Ausdruck — Bewertungsbogen M10**: grades **A/B/C/D** on **four** criteria, **Teil-specific point tables** (T1 max **15**, T2/T3 max **30** each), and a derived 0–100 `score` for readiness / history.

**Users:** student after training `POST /api/speaking/evaluate` (and history that rehydrates stored evaluations). Exam-day human marking stays out of scope; exam AI second-opinion may use the same shape later.

**Success looks like:**
- Response includes `telcRating` with four letters + `points` / `maxPoints` for that Teil.
- Points are computed in **code** from the official M10 table (not trusted from the model).
- `scores.overall` (and stored `speaking_attempts.score`) = `round((points / maxPoints) * 100)` for readiness compatibility.
- Teil 3 evaluation prompt context says **Gemeinsam etwas planen** (not debate).
- Unit tests cover letter→points for T1 and T2/T3 without calling the live model.
- Flutter prompt documents the new payload.

## ASSUMPTIONS I'M MAKING

→ Correct me now or I’ll proceed with these after you say **spec OK**.

1. **Grid = Zertifikat Deutsch / telc Deutsch B1 Übungstest M10** (not B1 Beruf alternate sheet):
   - **1** Ausdrucksfähigkeit (expression / vocabulary / speech intention)
   - **2** Aufgabenbewältigung (participation, strategies, fluency)
   - **3** Formale Richtigkeit (syntax / morphology)
   - **4** Aussprache und Intonation

2. **Official points (from PDF):**

   | Letter | Criteria 1–3 (T1) | Criteria 1–3 (T2/T3) | Criterion 4 (T1) | Criterion 4 (T2/T3) |
   |--------|-------------------|----------------------|------------------|---------------------|
   | A      | 4                 | 8                    | 3                | 6                   |
   | B      | 3                 | 6                    | 2                | 4                   |
   | C      | 1                 | 2                    | 1                | 2                   |
   | D      | 0                 | 0                    | 0                | 0                   |

   Max: T1 = **15**, T2 = **30**, T3 = **30** (oral total **75**).

3. **No oral D-kill** (unlike Schreiben I/III→0). A single `D` only zeros that criterion’s points; other letters still count. (PDF calculation text does not state an oral total wipe.)

4. **Pronunciation from transcript (CHOSEN default):** we only have text today, not audio. The model still returns a letter for criterion 4 with prompt guidance (“estimate from fluency markers / lack of phonetic evidence → prefer B unless transcript shows severe unintelligibility cues”). Code does **not** invent a letter if missing — parse fails → existing failure path (no activity charge). Future audio ASR/prosody is out of scope.

5. **Derived `score` 0–100** for `student_activities`: `round((points / maxPointsForTeil) * 100)`. Keep field names `scores.overall` + attempt `score`.

6. **Legacy `scores.grammar|vocabulary|coherence` (CHOSEN):** keep fields for Flutter backward compat; fill them as **derived mirrors** from telc letters (not independent model scores):
   - `grammar` ← criterion 3 percent-equivalent
   - `vocabulary` ← criterion 1 percent-equivalent
   - `coherence` ← criterion 2 percent-equivalent  
   where percent-equivalent = `round((criterionPoints / criterionMaxForTeil) * 100)`.

7. **Persistence (CHOSEN):** store `telcRating` **inside** existing `speaking_attempts.evaluation` JSON (no new Prisma column). Top-level attempt `score` remains the derived overall.

8. **Wire names (CHOSEN)** camelCase English:

```json
"telcRating": {
  "expression": "B",
  "taskFulfilment": "A",
  "formalAccuracy": "C",
  "pronunciation": "B",
  "points": 24,
  "maxPoints": 30,
  "teilNumber": 2
}
```

9. **Exam AI path:** same parse/shape when `examAttemptId` is set; still **no** `student_activity` write (unchanged).

10. **Out of scope:** Live Room UI, center human M10 entry UI, audio-based pronunciation, Probeprüfung, changing Elena live prompts (already Teil-aware).

## Tech Stack

- NestJS `EvaluationService` + DTOs
- Existing `GeminiService` / model call
- Prisma `SpeakingAttempt.evaluation` Json
- Jest unit tests for pure scoring helpers

## Commands

```
Build:   npm run build
Test:    npx jest --testPathPatterns=speaking-telc|evaluation
Lint:    npm run lint
Dev:     npm run start:dev
```

## Project Structure

```
src/modules/speaking/
  speaking-telc-rating.ts          → NEW pure M10 letter→points helpers
  speaking-telc-rating.spec.ts     → NEW unit tests
  services/evaluation.service.ts   → prompt, parse, score, persist
  dto/evaluation-response.dto.ts   → add telcRating; keep scores
  dto/session-history-item.dto.ts  → expose telcRating if history maps evaluation

docs/superpowers/specs/
  2026-10-10-sprechen-m10-feedback.md
docs/superpowers/plans/
  2026-10-10-sprechen-m10-feedback.md   → after spec OK
docs/superpowers/prompts/
  2026-10-10-flutter-sprechen-m10.md    → with implement
```

## Code Style

```ts
export function m10PointsForTeil(
  criteria: TelcSprechenCriteria,
  teilNumber: 1 | 2 | 3,
): { points: number; maxPoints: number } {
  const table = teilNumber === 1 ? M10_TEIL1 : M10_TEIL23;
  const points =
    table.expression[criteria.expression] +
    table.taskFulfilment[criteria.taskFulfilment] +
    table.formalAccuracy[criteria.formalAccuracy] +
    table.pronunciation[criteria.pronunciation];
  return { points, maxPoints: teilNumber === 1 ? 15 : 30 };
}
```

## Testing Strategy

- **Unit:** letter→points for T1 AAA A = 15; T2 AAAA = 30; mixed letters; D zeros one criterion only.
- **Unit/integration:** parse rejects missing letters; ignores model numeric overall; Teil 3 prompt contains “planen” / not “Debate”.
- **Regression:** existing evaluate flow still returns `scores` + `evaluationText` + corrections; activity still uses overall 0–100.

## Boundaries

- **Always:** recompute points in code; Teil-specific tables; no activity on parse failure; tests before PR.
- **Ask first:** changing max points / letter table; adding audio pronunciation; new DB column instead of JSON embed.
- **Never:** invent A–D on model failure; write oral D-kill without PO change; break readiness by changing max_score away from 100 without a migration plan.

## Success Criteria

- [ ] `POST /api/speaking/evaluate` returns `telcRating` with 4 letters + points/maxPoints
- [ ] Points match M10 table for T1 and T2/T3
- [ ] `scores.overall` derived from points/maxPoints
- [ ] Stored evaluation JSON includes `telcRating`
- [ ] Teil 3 eval context aligned with planen
- [ ] Flutter prompt written
- [ ] Code review approve + CI green + PR to `dev`

## Open Questions

None blocking if assumptions above are accepted. Optional later: real audio for criterion 4.

## Risks / Non-Goals

- Pronunciation quality from transcript is inherently weak — disclosed in prompt + Flutter copy (“estimation”).
- Do not redesign Live Room or Exam Day human marking in this PR.
