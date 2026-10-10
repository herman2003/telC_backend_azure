# Prompt Flutter — Schreiben Vorbereitung (2 min → écriture 30 min)

## Contexte

Avant l’éditeur, forcer une **Vorbereitung** comme le PDF telc (*Reihenfolge der Punkte*, Betreff, Anrede, Einleitung, Schluss).

`GET /api/writing/exercise…` expose maintenant :

| Champ | Valeur | Usage |
|--------|--------|--------|
| `bulletPoints` | string[] | Drag & drop pour ordonner |
| `closingReminder` | string? | Texte d’aide (déjà seedé) |
| `prepDurationSeconds` | **120** | Timer prep |
| `writingDurationMinutes` | **30** | Timer écriture |
| `registerChecklist` | `Betreff`, `Anrede`, `Einleitung`, `Schluss` | Cases soft |

Submit **inchangé** : `{ exerciseId, content }` — pas d’ordre ni de checklist envoyés.

## Parcours

1. Ouvre Schreiben → charge exercise (stimulus + Leitpunkte).
2. **Écran Vorbereitung** (éditeur verrouillé) :
   - Timer `prepDurationSeconds` (compte à rebours visible).
   - Réordonner les Leitpunkte (drag).
   - Cocher `registerChecklist` (soft — **Weiter** même si non cochée).
   - Afficher `closingReminder` si présent.
3. Fin timer **ou** tap **Weiter** → écran écriture.
4. **Écriture** : timer `writingDurationMinutes` ; Leitpunkte visibles **dans l’ordre choisi** ; checklist en rappel.
5. Submit → flux correction existant (`correction_ready` / `telcRating`).

## Règles

- État prep = **session locale** (pas de persistence).
- Pas de « Skip prep » dédié en v1 (Weiter anticipé suffit).
- Même UX pour `brief` et `forumsbeitrag`.
- Ne pas envoyer l’ordre client au backend pour noter l’IA.

## Acceptance

- [ ] Prep s’affiche avant l’éditeur
- [ ] Drag Leitpunkte + checklist + timers
- [ ] Weiter anticipé fonctionne
- [ ] Submit inchangé ; correction OK
- [ ] Tests UI verts
