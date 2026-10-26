# Spec: Micro-leçons / Prep tips par Teil (P3)

## Objective

Give Start (and all) students a **1-screen tip sheet** per exam Teil: strategy + typical traps — linked from the **result / failure** screen via « Comment réussir ce Teil ? ». Not a full course; does **not** replace Prep Pass Modelltest content.

**Users:** student after a scored attempt (any skill) or from a weak-skill alert.

**Success looks like:**
- `GET` returns one tip sheet for `(skill, teil)` with title + short sections (strategy, traps, what-to-practise).
- Flutter can open it from result screens without hardcoding lesson body in the app binary (optional cache).
- Missing `(skill, teil)` → 404, not empty 200.
- Content covers all telc B1 Teils we train (12 sheets).

## ASSUMPTIONS I'M MAKING

→ Correct me now or say **spec OK**.

1. **v1 = static catalog in BE** (versioned TypeScript/JSON), not FE-only markdown and not a CMS. Pattern like `speaking-topics.data.ts`.
2. **Endpoint (CHOSEN):**  
   - `GET /api/prep-tips` → list `{ skill, teil, title }[]`  
   - `GET /api/prep-tips/:skill/:teil` → full sheet  
   Skills on wire: lowercase D29 (`hoeren`|`lesen`|`sprachbausteine`|`schreiben`|`sprechen`). Teil: `1`–`3` as path param (schreiben only `1`; sprachbausteine `1`|`2`).
3. **Auth:** same as other student content — JWT student (or guest if other catalogs allow guests). Prefer **same guard as modelltest catalog** (authenticated student; guests OK if `GuestBlockGuard` not applied on catalog reads — match listening/reading `teils`).
4. **Locale (CHOSEN):** sheets written in **German** (exam language). Flutter can wrap UI chrome in FR/EN; body stays DE for v1. No `?lang=` yet.
5. **Sheet shape:**

```json
{
  "skill": "lesen",
  "teil": 1,
  "title": "Lesen Teil 1 — Globalverstehen",
  "objective": "Den globalen Inhalt von Kleinanzeigen erfassen.",
  "strategy": ["…", "…"],
  "traps": ["…", "…"],
  "practiceHint": "Danach: ein Lesen-Teil-1 aus Modelltest üben."
}
```

6. **Coverage v1:** all 12 Teils with short real content (not lorem), aligned to telc objectives (Global-/Detail-/Selektiv; SB Grammatik vs Lexik; Schreiben/Sprechen high-level).
7. **Deep-link contract for Flutter:** route `/prep-tips/{skill}/{teil}`; CTA on result when score &lt; threshold **or** always secondary button « Tipps zu diesem Teil ».
8. **Out of scope:** CMS admin, spaced repetition, linking tip completion to readiness, Prep Pass paywall on tips (tips stay free), AI-generated tips.

## Tech Stack

- NestJS new thin module or under `progress` / `content` — prefer `src/modules/prep-tips/`
- Static data file + controller + DTO
- Jest: list count = 12; get known tip; 404 unknown

## Commands

```
Build:   npm run build
Test:    npx jest --testPathPatterns=prep-tips
Lint:    npm run lint
```

## Project Structure

```
src/modules/prep-tips/
  prep-tips.data.ts
  prep-tips.service.ts
  prep-tips.controller.ts
  prep-tips.module.ts
  dto/prep-tip.dto.ts
  prep-tips.spec.ts

docs/superpowers/specs/2026-10-10-micro-lecons-prep-tips.md
docs/superpowers/prompts/2026-10-10-flutter-prep-tips.md
```

## Testing Strategy

- Unit: catalog size, lookup by skill/teil, invalid skill/teil → NotFoundException.
- Controller smoke optional.

## Boundaries

- **Always:** version tips in git; no DB migration for v1.
- **Ask first:** paywalling tips; multi-locale bodies; CMS.
- **Never:** invent tips that contradict telc Teil goals; ship empty stubs as “done”.

## Success Criteria

- [ ] 12 tips returnable via API
- [ ] Flutter prompt with result-screen CTA
- [ ] Review + CI + PR to `dev`

## Open Questions

None if assumptions accepted.
