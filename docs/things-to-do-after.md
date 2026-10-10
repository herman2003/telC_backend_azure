# Things to do after

Open follow-ups that are decided but not yet implemented.

---

## Coach date d’examen → tâche du jour

**Status:** todo (après launch)  
**Priority:** P1  
**Area:** progress / student home + center dashboard

### Goal

L’élève saisit une date d’examen ; Lerniqo propose **une tâche par jour** pondérée vers la skill faible (&lt; 45 %, réutilise `WEAK_SKILL_BELOW`). Countdown jusqu’à l’examen. Le centre voit qui est prêt / qui a une date.

### Why

Différenciateur centres / rétention (inspir. Prepilingo, Papagei). Readiness + alertes `weak_skill` existent déjà ; il manque plan journalier et countdown.

### Work required

1. Persister `examDate` côté élève (et exposition centre).
2. Générer 1 tâche/jour orientée skill faible.
3. UI élève : countdown + tâche du jour.
4. UI centre : dates + readiness liées.

---

## Revue d’erreurs + spaced repetition

**Status:** todo (après launch)  
**Priority:** P2  
**Area:** Prep Pass — Lesen / Hören / Sprachbausteine (items discrets)

### Goal

Après un submit, stocker les **erreurs** (item + explication) et les ramener dans une file de révision (ex. 1 / 3 / 7 jours) jusqu’à maîtrise.

### Why

Augmente la valeur Prep Pass sans nouveau contenu Modelltest. Items Richtig/Falsch, Zuordnung, MC du format telc se prêtent bien à la revisit (inspir. Papagei / PassDeutsch).

### Work required

1. Modèle « error bank » lié aux attempts.
2. API : erreurs à revoir + marquer comme révisé / réussi.
3. UI après submit + écran « À revoir ».
4. Scheduling espacé (1 / 3 / 7 jours).
