# Checklist FE — niveau étudiant choisi par le centre

**Backend (déjà sur `dev`) :** PR #79 (niveau sur le code) + PR #86 (filtre contenu = niveau exact).

## Produit (en une phrase)

Le **centre** choisit le niveau CEFR du siège (`A1` | `A2` | `B1` | `B2`). Après activation, l’**étudiant ne voit que le contenu de ce niveau**.

## Flux attendu

1. Centre crée / reçoit des codes d’activation (paiement ou trial).
2. **Avant de donner le code**, le centre fixe le niveau :
   - `PATCH /api/centers/me/activation-codes/:id`
   - Body : `{ "level": "B1" }` (ou `A1` / `A2` / `B2`)
   - Seulement si le code est encore `activated` (pas encore connecté).
3. L’étudiant saisit le code → redeem → `student.level` = niveau du code.
4. Dans l’app (Flutter) : catalogue / training = **uniquement** les Modelltests avec le même `level`.
5. Correction après coup : `PATCH /api/centers/me/students/:studentId` `{ "level": "A2" }` (API students déjà existante).

## Ce que le dashboard centre DOIT avoir

| # | UI | API |
|---|----|-----|
| 1 | Sur la liste des codes, afficher `level` (ou « — » si `null`) | `GET /api/centers/me/activation-codes` → champ `level` |
| 2 | Sur un code **`activated`**, sélecteur A1–B2 + enregistrer | `PATCH .../activation-codes/:id` `{ "level": "…" }` |
| 3 | Impossible / désactivé de changer le niveau via codes si `connected` / `suspended` / `deactivated` | 409 `INVALID_CODE_TRANSITION` |
| 4 | (Optionnel) Sur la fiche étudiant, pouvoir corriger le niveau | `PATCH .../students/:id` `{ "level": "…" }` |
| 5 | Copy claire : « Ce niveau détermine le contenu visible par l’élève » | — |

## Ce que le dashboard / landing N’A PAS besoin

- Upload de contenu A1–B2 (Phase 2 backend / contenu).
- Choisir le niveau à la **création** du code (les codes sont mintés au paiement ; le niveau se pose après, avant handout).
- Landing marketing (logos partenaires, etc.) : **pas concernée**, sauf si une page centre y est embarquée.

## Ce que Flutter DOIT avoir

| # | Comportement |
|---|--------------|
| 1 | Après redeem école : ne pas forcer l’élève à choisir son niveau |
| 2 | Afficher le niveau du profil (lu API) |
| 3 | Catalogue vide / message si aucun MT pour ce niveau (ex. siège A2 tant qu’il n’y a que du B1) |
| 4 | Gérer `LEVEL_REQUIRED` (pas de niveau) et `LEVEL_MISMATCH` (mauvais MT) |

## États aujourd’hui (contenu)

- Tout le contenu training actuel est tagué **B1**.
- Siège **B1** → voit les MT.
- Siège **A1 / A2 / B2** → catalogue training **vide** jusqu’à l’ajout de contenu (voulu).

## Comment tester manuellement (dashboard)

1. Centre connecté, code `activated`.
2. Poser `level = B1` → OK.
3. Donner le code à un étudiant → redeem.
4. Vérifier côté app : contenu B1 accessible.
5. Autre code : poser `level = A2` → redeem → app : pas de MT B1 (liste vide / erreur claire).

## Réponses API utiles

```http
PATCH /api/centers/me/activation-codes/{id}
Authorization: Bearer {centerToken}
{ "level": "B1" }
```

Champs sur un code listé : `id`, `code`, `status`, **`level`**, `linkedName`, …

Erreurs étudiant training : `LEVEL_REQUIRED`, `LEVEL_MISMATCH`, `PREP_PASS_REQUIRED`.
