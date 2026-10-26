# Design: Option A — gate contenu par niveau CEFR exact

**Date:** 2026-10-18  
**Status:** accepted — Phase 1 implemented on `feat/content-level-gate-phase1`  
**Depends on:** `ActivationCode.level` / `Student.level` (PR #79, already on `dev`)  
**Supersedes draft:** `2026-10-17-content-level-gate-option-a-design.md`

---

## Problem

Le centre peut fixer le niveau d’un siège (A1–B2). L’intention produit est :

> Si le siège est **B1**, l’étudiant n’accède qu’au **contenu B1**.

Aujourd’hui le niveau est une étiquette de profil. Le catalogue training (Modelltests) n’a pas de `level` et n’est pas filtré. Le contenu A1/A2/B2 n’existe pas encore, mais doit pouvoir être branché plus tard **sans refonte**.

## Decision

**Option A — exact match :** `content.level === student.level`.

- Ancrage DB : colonne `Modelltest.level` (`CefrLevel`). Les exercices héritent via `modelltest_id` (pas de tag par exercice).
- Ancrage API : `TrainingModelltestAccessService` (+ listes catalogue / weekly).
- Contenu actuel : tous les MT existants backfillés `B1`.
- Sièges A1/A2/B2 sans contenu : catalogue training **vide** (voulu).
- `student.level === null` → `LEVEL_REQUIRED` (pas de défaut silencieux B1).

### Alternatives rejected

| Option | Pourquoi non |
|--------|----------------|
| B — « jusqu’au niveau » (A1+A2+B1) | Mélange des examens telc distincts |
| Taguer chaque exercice | Redondant ; tout le training est déjà lié à un MT |
| Attendre le contenu avant tout code | Le filtre et le schéma coûtent peu ; évite une dette plus tard |

### Prep Pass vs niveau (orthogonal)

| Règle | Rôle |
|-------|------|
| **Niveau CEFR** | *Quel* contenu (A1 / A2 / B1 / B2) |
| **Prep Pass** | *Combien* de MT training (weekly only vs full pool **du même niveau**) |
| **Exam slots** | Sessions d’examen centre — **hors Phase 1** |

**Critique fiabilité :** aujourd’hui `PrepPassGuard` court-circuite `assertMayAccess` si Prep Pass est actif. Le check niveau doit s’appliquer **aussi** aux titulaires Prep Pass (sinon un B1 Prep Pass verrait tout le pool multi-niveau plus tard).

---

## Scope

### Phase 1 — Moules (ce plan)

1. `Modelltest.level` + migration + backfill `B1`
2. Filtre exact dans access + catalogue + of-the-week
3. Prep Pass : full pool **filtré par niveau**
4. Tests + note FE/Flutter
5. Exposer `level` sur les DTO catalogue MT si utile au client

### Phase 1 — Explicitly out

- Seeds contenu A1 / A2 / B2
- Schreiben / Sprechen / Vocab / Grammar gate (pas de `PrepPassGuard` aujourd’hui) → **Phase 1b**
- Exam centre (`EXAM_LEVEL`), readiness multi-niveau, topics Elena, prep tips
- Rendre `ActivationCode.level` obligatoire avant handout

### Phase 2 — Contenu

- Nouveaux MT avec `level` A1/A2/B2
- Weights / durations exam pour ces niveaux
- Puis brancher Phase 1b + exam

### Phase 1b (après Phase 1, avant ou avec le contenu)

Brancher le même check niveau sur : writing, speaking catalog, vocab, grammar (chemins qui bypassent Prep Pass aujourd’hui).

---

## Data model

```
Student.level          CefrLevel?     // already
ActivationCode.level   CefrLevel?     // already

Modelltest
  + level CefrLevel @default(B1)
  + @@index([level, exam_only])

Listening / Lesen / SB / Writing / Speaking exercises
  → modelltest_id only (inherit level)
```

When adding A2 content later: insert rows with `level = A2`. No schema change.

---

## Behaviour

### Resolve student level

1. Read `student.level` for the authenticated student.
2. If `null` → `403 LEVEL_REQUIRED` on training list/access that needs a level.
3. Guests : inchangé (démo) — pas de gate CEFR en Phase 1 (documenté).

### Catalogue / weekly / assertMayAccess

```
trainingPool = Modelltest where exam_only = false AND level = student.level

weekly     = rotate(trainingPool)          // empty pool → NotFound / empty list
list       = trainingPool (Prep Pass) or { weekly } (Start)
assertMayAccess(mtNumber):
  load MT by number (training)
  if MT.level !== student.level → 403 LEVEL_MISMATCH (or CODE_INVALID-style)
  then existing Prep Pass / weekly rules
```

Prep Pass active **does not** skip the level check.

### Concrete flow

1. Centre : `PATCH` code `{ "level": "B1" }`
2. Étudiant redeem → `student.level = B1`
3. List MT → uniquement `level = B1`
4. Ouvre MT 2 (B1) → OK  
5. Plus tard MT A2 en DB → invisible / 403 pour cet étudiant  
6. Siège A2 sans MT A2 → liste vide

---

## Error codes (Phase 1)

| Code | When |
|------|------|
| `LEVEL_REQUIRED` | `student.level` null on gated training |
| `LEVEL_MISMATCH` | Requested MT level ≠ student level |
| Existing | `PREP_PASS_REQUIRED`, etc. unchanged |

---

## Client impact (not built here)

**Center dashboard:** already can set code level (PR #79).  
**Flutter:** after redeem, trust `student.level`; hide level picker for school seats; empty state if no MT for that level.  
**Landing marketing:** no change.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Prep Pass bypass level | Always check level before Prep Pass short-circuit |
| Writing/Speaking leak | Phase 1b; document as known gap |
| Empty catalogue for A2 seats | Product-accepted until content ships |
| Guest sees B1 | Explicit exception Phase 1 |

---

## Success criteria (Phase 1)

- [ ] All existing MT rows have `level = B1`
- [ ] Student B1 sees current training catalogue
- [ ] Student A2 with only B1 MT in DB sees empty training list / cannot open B1 MT
- [ ] Student without level gets `LEVEL_REQUIRED`
- [ ] Prep Pass student still cannot open other-level MT
- [ ] Unit tests cover access + list + weekly

## Approval

Approve this spec to unlock the implementation plan  
`docs/superpowers/plans/2026-10-18-content-level-gate-phase1.md`.
