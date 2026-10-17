# Design: Niveau CEFR sur le code d’activation

**Date:** 2026-10-17  
**Status:** agreed — ready for implementation  
**Related:** D38 (student level)

## Problem

Le centre ne peut pas fixer le niveau d’un siège avant de donner le code. Le niveau vit seulement sur `Student.level` (déclaré à l’inscription, corrigeable après). L’étudiant peut donc choisir un niveau incorrect.

## Decision

**Niveau optionnel sur `ActivationCode`**, fixé par le centre **avant** remise du code. À la rédemption, si le code a un niveau, il est copié sur `student.level` et remplace toute déclaration étudiante.

| Règle | Choix |
|-------|--------|
| Moment | Sur le code `ACTIVATED`, avant handout |
| Obligatoire ? | Non — `null` autorisé ; le centre peut encore PATCH le student après |
| Qui écrit | Centre uniquement (`PATCH .../activation-codes/:id`) |
| Qui lit | Liste codes + réponses code (champ `level`) |
| Redeem | Si `code.level != null` → `student.level = code.level` |
| Mint / trial | `level = null` |
| Reset | **Conserve** le niveau (siège de classe) |
| Correction post-connexion | API students existante (`PATCH .../students/:id`) |

## Out of scope

- Niveau obligatoire pour redeem
- UI Flutter / dashboard (contrat API seulement)
- Changer le niveau d’un code déjà `CONNECTED` via l’endpoint codes (utiliser students)
- Filtrer la liste codes par niveau

## API

```
PATCH /api/centers/me/activation-codes/:id
Body: { "level": "A2" } | { "level": null }
→ ActivationCodeDto with level
```

- Guard: `CenterAuthGuard` + `CenterSubscriptionGuard` (comme deactivate/reset)
- Autorisé seulement si `status === ACTIVATED`
- Sinon: `INVALID_CODE_TRANSITION` (409) ou équivalent existant

## Data

```prisma
// ActivationCode
level CefrLevel?  // set by center before handout; applied on redeem
```
