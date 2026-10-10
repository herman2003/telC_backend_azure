# Spec: Sprechen Teil 3 = « Gemeinsam etwas planen »

## Objective

Align Elena’s **exam-path Teil 3** with official **telc Deutsch B1** oral format: co-planning a joint activity (~6 min), not a debate. Teil 2 stays « Über ein Thema sprechen » (opinion / experience). Content already seeded for Modelltests (e.g. MT3 title `Teil 3 Gemeinsam etwas planen`) must drive the session; the examiner prompt must not contradict it.

**User:** student on Start Sprechen Modul (Elena, Modelltest of the week / modelltest + teilNumber).

**Success looks like:**
- Opening a Teil 3 exam session, Elena invites the candidate to **plan together** (ideas, reactions, compromise), using the exercise’s `topicTitle` / `topicDescription` / `topicPoints`.
- Elena does **not** run a two-sided debate / “verteidige deine Meinung” flow on Teil 3.
- Teil 2 prompt still covers topic + opinion (may keep mild challenge); debate-style catalogue topics for **Mit Elena** credits remain unchanged unless we explicitly extend scope.
- Titles/subtitles exposed by `GET /api/speaking/teils` for part 3 remain / become consistent with « Gemeinsam etwas planen » across seeded Modelltests.
- A short Flutter follow-up prompt exists if any hard-coded “Argument / Discussion” copy remains in the app.

## ASSUMPTIONS I'M MAKING

1. Scope = **exam path only** (`teilNumber` + `modelltest` → `SpeakingExercise` + `teil-*-examiner.txt`). **Mit Elena** credit catalogue (`speaking-topics.data.ts` with positionA/B) stays as free practice (debate OK).
2. **No schema change** — `topic_title`, `topic_description`, `topic_points` already describe planning tasks in seed JSON.
3. Primary fix = rewrite `src/config/prompts/teil-3-examiner.txt`; optionally tighten `examiner-prompt.service.ts` so topic bullet points are framed as planning checklist, not debate positions.
4. Seeded MT1/MT2 Teil 3 rows are already “planen” or will be corrected via content migration only if audit finds debate titles — **ask before** large content rewrites.
5. Live Room pair mode / 20 min prep Prüfung mode is **out of scope** (deferred product item).
6. Sprechen M10 A–D grading is **out of scope** (later item).
7. Flutter: mostly display of API titles; only needed if local copy still says “Argument & Discussion”.

→ Correct me now or I’ll proceed with these after you approve this spec.

## Tech Stack

- NestJS speaking live module + file prompts under `src/config/prompts/`
- Prisma `speaking_exercises` (existing)
- Flutter Sprechen UI (follow-up prompt only)

## Commands

```
Build:   npm run build
Test:    npm test -- --testPathPatterns=speaking
Lint:    npm run lint
Dev:     npm run start:dev
```

## Project Structure

```
src/config/prompts/
  teil-1-examiner.txt   → unchanged (kennenlernen)
  teil-2-examiner.txt   → keep topic/opinion; no “planen”
  teil-3-examiner.txt   → REWRITE: Gemeinsam etwas planen

src/modules/speaking/live/
  examiner-prompt.service.ts  → how topic is injected into Elena
  live-token.controller.ts    → loads SpeakingExercise topic for exam path

src/modules/speaking/services/
  speaking.service.ts         → /teils list (title/subtitle)

content/ + prisma migrations  → only if Teil 3 rows are wrong

docs/superpowers/specs/
  2026-10-10-sprechen-teil3-planen.md  → this file
```

## Code Style

Prompt files: German-first instructions for Elena, clear Teil identity, ~6 minutes, B1, no English in candidate-facing speech.

Example intent for Teil 3 (not final wording):

```text
You conduct Teil 3 — Gemeinsam etwas planen (~6 minutes).
Use the provided topic (title, description, bullet points) as a planning checklist.
Ask for ideas, react, propose alternatives, and reach a joint plan.
Do NOT run a for/against debate.
```

## Testing Strategy

| Level | Where | What |
|-------|--------|------|
| Unit | prompt / examiner-prompt service specs (extend or add) | Teil 3 system prompt contains planen keywords; excludes debate-only framing |
| Manual / smoke | live-token exam path Teil 3 | Topic from DB attached; persona is planning |
| Content audit | SQL or script | All `speaking_exercises.part = 3` titles mention planen / gemeinsame Aufgabe |

## Boundaries

**Always:**
- Keep Teil 1 / Teil 2 semantics (kennenlernen / Thema sprechen).
- Prefer prompt + injection fix over inventing new APIs.
- Commit the approved spec before implementation PRs.

**Ask first:**
- Rewriting all Modelltest Teil 3 seed content.
- Changing Mit Elena catalogue topics.
- Changing prep duration / Live Room pair Prüfung mode.

**Never:**
- Turn Teil 2 into “planen”.
- Ship M10 grading in this work.
- Break credit vs exam path routing (`topicId` vs `teilNumber`).

## Success Criteria

- [ ] `teil-3-examiner.txt` describes co-planning only (ideas, react, agree); no primary debate flow.
- [ ] Exam-path Teil 3 still receives DB `topicTitle` / `description` / `points`.
- [ ] Teil 2 prompt unchanged in role (Thema / Meinung).
- [ ] Audit: part=3 exercises are planning-shaped (or listed exceptions agreed).
- [ ] Tests or snapshot covering prompt load for Teil 3 green.
- [ ] Flutter prompt written if UI copy still says Argument/Discussion.

## Open Questions

1. Should Elena **play the partner** (second candidate) for solo Start, or stay “examiner moderating a plan”? (Recommend: Elena acts as **Gesprächspartnerin** who plans with the candidate — closest to pair exam.)
2. Do we need a content migration for MT1/MT2 Teil 3 if any row still looks like debate?
3. Any DE/FR/EN Flutter strings hard-coded for Teil 3 role?

## Out of scope

- Readiness /300 (done)
- Schreiben A–D, Sprechen M10
- UX Schreiben Vorbereitung
- Micro-leçons
- Probeprüfung / Exam Day Sprechen
