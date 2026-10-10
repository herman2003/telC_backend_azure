# Spec: UX Schreiben Vorbereitung (2 min → écriture 30 min)

## Objective

Before the student types the email/letter, force a short **Vorbereitung** step that mirrors the telc PDF instruction (*Überlegen Sie sich vor dem Schreiben eine passende Reihenfolge… Betreff, Anrede, Einleitung, Schluss*). Goal: fewer zeros on **Aufgabenbewältigung** / poor register.

**Users:** training Schreiben (not Exam Day — Exam Day has no Schreiben product path).

**Student flow (success):**
1. Opens Schreiben → sees stimulus + Leitpunkte (existing exercise payload).
2. **Vorbereitung screen (~2 min timer)** — editor locked:
   - Drag-reorder `bulletPoints` into planned order.
   - Checklist: Betreff · Anrede · Einleitung · Schluss (all checkable; not blocking).
3. Timer ends **or** student taps **Weiter** → writing screen.
4. **Writing (~30 min timer):** editor; Leitpunkte stay visible **in chosen order**; checklist remains as reminder.
5. Submit → existing `POST /api/writing/submit` + `correction_ready` (incl. `telcRating`).

## ASSUMPTIONS I'M MAKING

→ Correct me now or say **spec OK**.

1. **Primary work = Flutter.** Prep state (order, checks, timers) is **local session only** — not persisted, not sent on submit.
2. **BE already enough for content:** `GET` exercise exposes `bulletPoints` + `closingReminder` + stimulus. Submit stays `{ exerciseId, content }`.
3. **Small BE contract (CHOSEN):** add optional fields on `WritingExerciseDto` so Flutter does not hardcode:
   - `prepDurationSeconds: 120`
   - `writingDurationMinutes: 30`
   - `registerChecklist: string[]` default `["Betreff","Anrede","Einleitung","Schluss"]`  
   Values are **constants in the mapper** (no DB columns). `closingReminder` text stays as-is.
4. **Checklist does not gate Weiter** — soft scaffolding; student can proceed with unchecked boxes.
5. **Reorder is local only** — does not change server `bulletPoints` or correction Leitpunkte order (AI still uses official exercise order / content).
6. **Skip prep?** Not offered in v1 (always show Vorbereitung once per attempt start). Soft “Weiter” early is enough.
7. **Forumsbeitrag** (`taskType`): same prep UX; checklist labels stay email-oriented unless later we branch (out of scope v1).
8. **Out of scope:** Exam Day Schreiben, analytics on prep completion, changing correction prompt to read client order, micro-leçons.

## Tech Stack

- NestJS `WritingService` mapper + `WritingExerciseDto` (tiny)
- Flutter (separate repo) — prompt in this repo
- Jest: assert new DTO fields on mapped exercise if mapper tests exist; else unit on mapper helper

## Commands

```
Build:   npm run build
Test:    npx jest --testPathPatterns=writing
Lint:    npm run lint
```

## Project Structure

```
src/modules/writing/dto/writing-exercise.dto.ts  → new fields
src/modules/writing/writing.service.ts           → map constants onto DTO

docs/superpowers/specs/2026-10-10-schreiben-vorbereitung-ux.md
docs/superpowers/plans/…                         → after OK
docs/superpowers/prompts/2026-10-10-flutter-schreiben-vorbereitung.md
```

## Code Style

```ts
prepDurationSeconds: 120,
writingDurationMinutes: 30,
registerChecklist: ['Betreff', 'Anrede', 'Einleitung', 'Schluss'],
```

## Testing Strategy

- Unit/mapper: exercise response includes the three new fields with expected values.
- No e2e for Flutter timers in this repo.

## Boundaries

- **Always:** keep submit payload unchanged; do not persist prep.
- **Ask first:** DB columns for prep analytics; making checklist hard-gate Weiter.
- **Never:** send reordered bullets as the source of truth for AI grading in this PR.

## Success Criteria

- [ ] Exercise DTO documents prep/writing durations + register checklist
- [ ] Flutter prompt covers full UX flow + acceptance checklist
- [ ] Review + PR to `dev` (docs + tiny DTO)

## Open Questions

None if assumptions accepted.
