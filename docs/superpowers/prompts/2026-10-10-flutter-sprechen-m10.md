# Prompt Flutter — Sprechen feedback M10 A/B/C/D

## Contexte

`POST /api/speaking/evaluate` (et l’historique qui rejoue `evaluation` stocké) expose maintenant :

```json
"scores": { "grammar": 25, "vocabulary": 75, "coherence": 100, "overall": 67 },
"telcRating": {
  "expression": "B",
  "taskFulfilment": "A",
  "formalAccuracy": "C",
  "pronunciation": "B",
  "points": 20,
  "maxPoints": 30,
  "teilNumber": 2
}
```

| Champ | Critère telc M10 |
|--------|------------------|
| `expression` | 1 Ausdrucksfähigkeit |
| `taskFulfilment` | 2 Aufgabenbewältigung |
| `formalAccuracy` | 3 Formale Richtigkeit |
| `pronunciation` | 4 Aussprache / Intonation (estimé depuis transcript) |
| `points` / `maxPoints` | T1 **/15**, T2–T3 **/30** |
| `scores.overall` | 0–100 dérivé (`points/maxPoints`) — readiness |

Les champs `grammar` / `vocabulary` / `coherence` sont des miroirs dérivés (rétrocompat) — **ne plus les montrer en primaire**.

## À faire

1. Parser `telcRating` (null-safe si absente / anciennes evals).
2. Écran résultat : 4 lettres + **xx / maxPoints** en principal ; `%` secondaire.
3. Labels FR/DE/EN pour les 4 critères.
4. Mention discrète que l’Aussprache est estimée (pas d’audio).
5. Si `telcRating == null` : garder l’UI scores 0–100 actuelle.

## Acceptance

- [ ] Résultat montre A–D × 4 + /15 ou /30 selon Teil
- [ ] Ancien payload sans `telcRating` ne crash pas
- [ ] Tests verts
