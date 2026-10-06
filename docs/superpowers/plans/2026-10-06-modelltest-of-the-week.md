# Implementation Plan: Modelltest de la semaine

## Overview

Exposer un **Modelltest training unique toutes les 7 jours** aux élèves **Start**, sans Prep Pass. Rotation **100 % automatique** : index déterministe sur les MT `exam_only: false`. **Pas de calendrier lundi→dimanche** — juste un cycle glissant de 7 × 24 h depuis une époque fixe (UTC). L’app Start consomme ensuite `GET /api/speaking/teils?modelltest=N` (déjà Start). Le catalogue Prep Pass ne change pas.

## Architecture Decisions

1. **Endpoint dédié** `GET /api/modelltests/of-the-week` — pas d’ouverture de `GET /` ni `GET /:number`.
2. **Guards Start-only** : `JwtAuthGuard` + `StudentSubscriptionGuard`. **Pas** de `PrepPassGuard`.
3. **Controller séparé** `ModelltestOfTheWeekController` (préfixe `api/modelltests`) — conserve Prep Pass classe sur le catalogue.
4. **Sélection — cycle 7 jours (pas ISO week)** :
   ```ts
   const MS_PER_DAY = 86_400_000;
   const EPOCH = Date.UTC(2026, 0, 1); // 2026-01-01T00:00:00.000Z (fixe)
   const dayIndex = Math.floor((nowUtcMs - EPOCH) / MS_PER_DAY);
   const periodIndex = Math.floor(dayIndex / 7); // change tous les 7 jours
   const index = periodIndex % rows.length;
   ```
   Tous les élèves voient le même MT pendant la fenêtre courante. Flip exact 7 jours après le début de la période, **quel que soit le jour de la semaine**.
5. **Payload** : `{ id, number, title, periodStart, periodEnd }` — bornes de la fenêtre de 7 jours courante (pas « lundi/dimanche »).
6. **Hors scope** : Flutter, quotas Sprechen, Elena, migration Prisma, choix manuel.

## Dependency Graph

```
7-day period helper (pur, epoch UTC)
    │
    └── ModelltestsService.getOfTheWeek()
            │
            ├── DTO ModelltestOfTheWeekDto
            │
            └── ModelltestOfTheWeekController (Start guards)
                    │
                    └── Tests (service → controller → enforcement)
```

## Task List

### Phase 1: Sélection automatique

#### Task 1: Helper période 7 jours + `getOfTheWeek` (TDD)

**Description:** Fonction pure : à partir de `now`, calcule `periodIndex`, `periodStart`, `periodEnd` (fenêtre de 7 jours depuis `EPOCH` UTC). `getOfTheWeek()` charge les MT training et retourne `rows[periodIndex % length]`.

**Acceptance criteria:**
- [ ] Jour J et jour J+6 → même MT ; jour J+7 → MT suivant (si N≥2).
- [ ] Avec 1 MT, toutes les périodes renvoient ce MT.
- [ ] Table vide → `NotFoundException`.
- [ ] Query : `exam_only: false`, `orderBy: number asc`, select léger (pas d’exercices).
- [ ] Réponse inclut `periodStart` / `periodEnd` (ISO) de la fenêtre courante.

**Verification:**
- [ ] `npx jest src/modules/modelltests/modelltests.service.spec.ts` vert
- [ ] Tests avec dates fixes (injecter `now`) : J, J+6, J+7

**Dependencies:** None

**Files likely touched:**
- `src/modules/modelltests/modelltests.service.ts`
- `src/modules/modelltests/modelltests.service.spec.ts`
- éventuellement `src/modules/modelltests/seven-day-period.ts`

**Estimated scope:** S

---

#### Task 2: DTO

**Acceptance criteria:**
- [ ] `ModelltestOfTheWeekDto` : `id`, `number`, `title`, `periodStart`, `periodEnd` (ISO strings).
- [ ] Pas de champ `exercises`.

**Dependencies:** Task 1

**Files likely touched:**
- `src/modules/modelltests/dto/modelltest.dto.ts`

**Estimated scope:** XS

---

### Checkpoint: Foundation

- [ ] Rotation « tous les 7 jours » prouvée (pas lundi ISO)
- [ ] Catalogue Prep Pass intact

---

### Phase 2: Surface HTTP Start

#### Task 3: Controller Start-only `of-the-week`

**Description:** `ModelltestOfTheWeekController` — Jwt + Start, `@Get('of-the-week')`, module.

**Acceptance criteria:**
- [ ] Start sans Prep Pass → 200
- [ ] Catalogue `/` et `/:number` restent Prep Pass
- [ ] Spec : délégation + pas de PrepPassGuard

**Dependencies:** Task 1, Task 2

**Files likely touched:**
- `src/modules/modelltests/modelltest-of-the-week.controller.ts`
- `src/modules/modelltests/modelltest-of-the-week.controller.spec.ts`
- `src/modules/modelltests/modelltests.module.ts`

**Estimated scope:** S–M

---

#### Task 4: Enforcement

**Acceptance criteria:**
- [ ] Nouveau controller Start sans Prep Pass
- [ ] `ModelltestsController` garde Prep Pass classe
- [ ] Sweep unenforced reste vert

**Dependencies:** Task 3

**Files likely touched:**
- `test/subscription-enforcement.spec.ts`

**Estimated scope:** XS–S

---

### Checkpoint: Core Features

- [ ] Endpoint + tests + enforcement OK
- [ ] Review humain

---

### Phase 3: Polish (optionnel)

#### Task 5: Doc offre

Mentionner rotation auto **tous les 7 jours** via `GET /api/modelltests/of-the-week`.

**Files:** `docs/OFFRES_LERNIQO.md` — XS

---

### Checkpoint: Complete

- [ ] Tasks 1–4 (et 5 si inclus) OK
- [ ] Flutter hors scope

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Prep Pass sur of-the-week | High | Controller séparé |
| Epoch changée après prod | High — reset des fenêtres | Constante figée `2026-01-01Z` ; ne jamais la bouger |
| Confusion « semaine calendaire » | Low | Noms `periodStart`/`periodEnd`, pas weekStart |

## Open Questions

- [x] **Pas lundi** — cycle 7 jours depuis epoch UTC (tranché)
- [ ] **Task 5 doc** : même PR ou skip ?

## Verification globale

```bash
npx jest src/modules/modelltests/
npx jest test/subscription-enforcement.spec.ts
npx jest test/prep-pass.guard.spec.ts
```
