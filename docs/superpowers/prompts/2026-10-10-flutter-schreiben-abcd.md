# Prompt Flutter — Schreiben feedback A/B/C/D (/45)

## Contexte

Backend expose désormais sur `correction_ready` (WebSocket) et sur les attempts REST :

```json
"score": 60,
"pointsAddressed": 3,
"telcRating": {
  "taskFulfilment": "B",
  "communicativeDesign": "A",
  "formalAccuracy": "C",
  "points": 27
}
```

| Champ | Sens telc |
|--------|-----------|
| `taskFulfilment` | I Aufgabenbewältigung (Leitpunkte) |
| `communicativeDesign` | II Kommunikative Gestaltung |
| `formalAccuracy` | III Formale Richtigkeit |
| `points` | / **45** |
| `score` | 0–100 dérivé (`points/45*100`) — garder pour progress |

**Règle :** si I ou III = `D` → `points = 0` et `score = 0` (déjà appliqué backend).

## À faire

1. Parser `telcRating` (null-safe si absent / anciennes corrections).
2. Écran résultat : afficher les 3 lettres + **xx / 45** en principal ; `%` en secondaire.
3. Labels FR/DE/EN pour I/II/III (Aufgabenbewältigung, etc.).
4. Si `telcRating == null` (stub / ancien) : garder l’UI score 0–100 actuelle.

## Acceptance

- [ ] Résultat montre A–D × 3 + /45
- [ ] Ancien payload sans `telcRating` ne crash pas
- [ ] Tests verts
