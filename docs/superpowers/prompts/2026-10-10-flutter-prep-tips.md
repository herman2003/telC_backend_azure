# Prompt Flutter — Micro-leçons (prep tips)

## API

Auth JWT (comme progress).

```
GET /api/prep-tips
→ [{ "skill": "lesen", "teil": 1, "title": "…" }, …]  // 12 items

GET /api/prep-tips/{skill}/{teil}
→ {
  "skill": "lesen",
  "teil": 1,
  "title": "Lesen Teil 1 — Globalverstehen",
  "objective": "…",
  "strategy": ["…"],
  "traps": ["…"],
  "practiceHint": "…"
}
```

`skill` lowercase : `hoeren` | `lesen` | `sprachbausteine` | `schreiben` | `sprechen`.  
404 si combo inconnue (ex. `schreiben/2`).

Corps des fiches en **allemand** ; chrome UI FR/EN OK.

## UX

1. Écran résultat (après attempt) : CTA secondaire **« Tipps zu diesem Teil »** / **« Comment réussir ce Teil ? »**.
2. Route : `/prep-tips/{skill}/{teil}` (ou bottom sheet).
3. Afficher `title`, `objective`, listes `strategy` + `traps`, puis `practiceHint` + bouton **Réessayer** / retour exercice.
4. Optionnel : depuis alerte `weak_skill` → ouvrir tip du skill (Teil 1 par défaut ou dernier Teil pratiqué).

## Règles

- Tips **gratuits** (Start) — pas de paywall Prep Pass.
- Ne pas remplacer le contenu Modelltest.
- Null-safe si API down : cacher le CTA ou message soft.

## Acceptance

- [ ] CTA résultat ouvre la bonne fiche skill/teil
- [ ] 12 fiches listables
- [ ] 404 géré
- [ ] Tests verts
