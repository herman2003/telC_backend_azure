# Prompt Flutter — Sprechen Teil 3 « Gemeinsam etwas planen »

## Contexte

Backend (PR `feat/sprechen-teil3-planen`) : Elena exam-path Teil 3 planifie **avec** l’élève (Gesprächspartnerin). Plus de débat « Argument & Discussion ».

Les titres viennent déjà de l’API (`GET /api/speaking/teils` → `title` / `subtitle`, souvent `Teil 3 Gemeinsam etwas planen`).

## À faire

1. Chercher toute copy hard-codée du type « Argument », « Discussion », « Debate », « Meinung begründen » pour **Teil 3** du chemin examen.
2. Remplacer par **Gemeinsam etwas planen** / « Planifier ensemble » (FR/DE/EN).
3. Afficher les `topicPoints` comme **checklist de planification**, pas comme positions pour/contre.
4. **Mit Elena** (crédits, catalogue libre) : ne pas changer sauf si la même string est partagée par erreur avec le chemin examen.

## Hors scope

Live Room Prüfung 20 min, grille M10, readiness.

## Acceptance

- [ ] Aucune UI examen Teil 3 qui parle de débat/argument
- [ ] Labels alignés « planen » / « planifier ensemble »
- [ ] Tests/l10n verts
