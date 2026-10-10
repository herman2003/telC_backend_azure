# Spec: Feedback Schreiben A/B/C/D (telc Deutsch B1)

## Objective

Replace the generic 0–100 AI Schreiben score with feedback that mirrors **telc Deutsch B1 Schriftlicher Ausdruck**: grades **A/B/C/D** on three criteria, a **points total out of 45**, and the hard rule **D on criterion I or III → 0 points**. Keep a derived 0–100 `score` for readiness / history compatibility.

**Users:** student (training correction via WebSocket `correction_ready` + attempt history); not Exam Day trainer marking (out of scope — Exam Day has no Schreiben product path for now).

**Success looks like:**
- After correction, the client receives `criteria: { I, II, III }` each in `A|B|C|D`, plus `pointsTelc` (0–45), plus existing `score` / `feedback` / `corrections` / `correctedText`.
- If I or III is `D`, `pointsTelc === 0` and `score === 0` regardless of other grades (enforced in code, not only in the model prompt).
- `points_addressed` still reported when Leitpunkte exist; criterion I must be consistent with Leitpunkte coverage (model instructed; code may downgrade I if `points_addressed` implies fewer Leitpunkte).
- Unit tests cover parse + D-kill rule + points mapping without calling the live model.
- Flutter prompt documents the new payload fields.

## ASSUMPTIONS I'M MAKING

1. **Grid = telc Deutsch B1 Zertifikat Deutsch** (not B1+ Beruf extras): three criteria only —  
   - **I** Aufgabenbewältigung (Leitpunkte)  
   - **II** Kommunikative Gestaltung (Betreff, Anrede, Einleitung, Schluss, coherence)  
   - **III** Formale Richtigkeit (grammar / spelling)  
2. **Letter → raw points per criterion:** A=5, B=3, C=1, D=0. Sum of three = 0–15. **Display/telc points** = `sum * 3` → **0–45** (matches Schreiben weight in the 300-point exam).  
3. **D-kill:** if I=`D` **or** III=`D` → `pointsTelc = 0` and activity `score = 0`. (Same spirit as official rater rules.)  
4. **Derived `score` 0–100** for `student_activities` / readiness: `round((pointsTelc / 45) * 100)` after applying D-kill. Keep field name `score`.  
5. **Persistence (CHOSEN):** JSON column `telc_rating Json?` on `writing_attempts`.  
6. **Stub path** (model failure): keep stub behaviour but set `telc_rating: null` and do **not** invent fake A–D; existing stub score 75 still must **not** write `student_activity` (already the case when `parsed` is null).  
7. **Exam AI suggestions** (if any notify=false path): same parse/shape for trainers later; no Exam Day UI work in this PR.  
8. **No change** to daily Schreiben quota or exercise content.
9. **Leitpunkte vs I (CHOSEN):** after model parse, if `points_addressed` is known and Leitpunkte count is N:  
   - addressed ≤ 1 → force I = `D`  
   - addressed === 2 → I at most `C`  
   - addressed === 3 → I at most `B`  
   - addressed ≥ 4 (or N) → keep model I  
10. **Wire names (CHOSEN):** camelCase English keys mapped to telc I/II/III:

```json
"telcRating": {
  "taskFulfilment": "B",
  "communicativeDesign": "A",
  "formalAccuracy": "C",
  "points": 27
}
```

→ Decisions locked by PO (“choisis”).

## Tech Stack

- NestJS `WritingCorrectionService` + `WritingGateway` payload
- Prisma `WritingAttempt`
- Existing model service (`MODEL_SERVICE_TOKEN`)
- Jest unit tests (prompt parse / scoring helpers)

## Commands

```
Build:   npm run build
Test:    npx jest --testPathPatterns=writing-correction
Lint:    npm run lint
Dev:     npm run start:dev
```

## Project Structure

```
src/modules/writing/
  writing-correction.service.ts   → prompt, parse, D-kill, persist, notify
  writing.gateway.ts              → CorrectionReadyPayload
  dto/                            → attempt detail DTOs if REST returns score
  writing-telc-rating.ts          → NEW pure helpers (letter→points, kill rule)

prisma/schema.prisma              → WritingAttempt.telc_rating (or columns)
prisma/migrations/…               → migration

test/
  writing-telc-rating.spec.ts     → pure scoring
  writing-correction*.spec.ts     → parse + integration of kill rule

docs/superpowers/specs/
  2026-10-10-schreiben-abcd-feedback.md
docs/superpowers/prompts/
  2026-10-10-flutter-schreiben-abcd.md  → after implement
```

## Code Style

Pure scoring in a small module (like `progress-formula.ts`):

```ts
export type TelcLetter = 'A' | 'B' | 'C' | 'D';
export type TelcSchreibenCriteria = {
  I: TelcLetter; // Aufgabenbewältigung
  II: TelcLetter; // Kommunikative Gestaltung
  III: TelcLetter; // Formale Richtigkeit
};

export function letterPoints(letter: TelcLetter): number {
  const map = { A: 5, B: 3, C: 1, D: 0 } as const;
  return map[letter];
}

export function telcSchreibenPoints(c: TelcSchreibenCriteria): {
  pointsTelc: number; // 0–45
  killed: boolean;
} {
  if (c.I === 'D' || c.III === 'D') {
    return { pointsTelc: 0, killed: true };
  }
  const raw = letterPoints(c.I) + letterPoints(c.II) + letterPoints(c.III); // 0–15
  return { pointsTelc: raw * 3, killed: false };
}
```

Prompt asks the model for letters + short German rationale per criterion; **code** recomputes points.

## Testing Strategy

| Level | What |
|-------|------|
| Unit | `letterPoints`, D-kill, `pointsTelc` / derived `score` |
| Unit | `parseWritingResponse` accepts new JSON; rejects bad letters |
| Unit | When I=D, persisted/notified score is 0 even if model sent score 80 |
| Optional | Snapshot of prompt containing criteria names |

## Boundaries

**Always:**
- Enforce D-kill and points mapping in TypeScript.
- Keep `score` 0–100 for readiness.
- Do not count stub corrections as activity.
- Add/extend unit tests before merge.
- Run **code review** before asking the human to check the PR.

**Ask first:**
- Typed DB columns vs single `telc_rating` JSON.
- Changing readiness to use /45 directly instead of derived %.
- Downgrading criterion I automatically from `points_addressed` (recommended light rule: if 0–1 Leitpunkte addressed → force I to D or C — confirm).

**Never:**
- Trust model-provided `pointsTelc` / `score` without recomputation.
- Expose Exam Day student Schreiben marks early.
- Scope-creep into Sprechen M10 or Vorbereitung UX.

## Success Criteria

- [ ] Model prompt requests I/II/III as A–D + German feedback.
- [ ] Parser validates letters; scoring helper applies D-kill and /45.
- [ ] DB + `correction_ready` include criteria + `pointsTelc` (names TBD in plan).
- [ ] `student_activity.score` uses derived 0–100 after D-kill.
- [ ] Tests green; Flutter prompt written.
- [ ] Code review done before human PR check.

## Decisions (locked)

1. **JSON** `telc_rating` — not separate columns.  
2. **Auto-cap criterion I** from `points_addressed` (see assumption 9).  
3. **Wire:** `telcRating.taskFulfilment | communicativeDesign | formalAccuracy | points`.

## Out of scope

- Exam Day marking UI  
- Sprechen M10  
- Schreiben Vorbereitung screen  
- Changing Leitpunkte content
