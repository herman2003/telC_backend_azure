# Offres Lerniqo — Launch

**Source commerciale.** Ce document est la référence pour le launch : quand le
code et ce document divergent, c'est le code qui a tort jusqu'à décision
contraire du fondateur et de Herman.

Lerniqo = une offre principale (**Start**) + des add-ons en complément.

> **Start = apprendre**
> **Prep Pass = s'entraîner**
> **Exam Day = se tester**
> **Mit Elena = pratiquer davantage l'oral avec l'IA**
> **Corrections Schreiben IA = corriger davantage à l'écrit avec l'IA**

---

## Au launch

| Offre | Prix | Statut |
|-------|------|--------|
| **Lerniqo Start** | 4 500 FCFA / élève / mois | Launch |
| **Mit Elena sprechen** | 300 FCFA / crédit | Launch |
| **Corrections Schreiben IA** | 200 FCFA / crédit | Launch |
| **Prep Pass** | 1 000 FCFA / élève / 30 jours | Launch |
| **Exam Day** (manuel) | 1 000 FCFA / candidat / examen | Launch |

---

## Après le launch (pas vendu pour l’instant)

| Offre | Note |
|-------|------|
| **Exam Day IA** (1 500 FCFA) | Code déjà livré — **gardé, pas vendu** |
| **AI Assisted Learning** | Entitlement prévu — **pas construit / pas vendu** (accompagnement multi-compétences, **pas** des packs de corrections) |

---

## 1. Lerniqo Start — 4 500 FCFA / élève / mois

L’offre principale.

### Inclus

| | |
|--|--|
| **Accès Lerniqo** | Plateforme (ordinateur et mobile) |
| **Suivi personnalisé** | Progression et readiness de l’élève |
| **Live Room** | Discussions orales avec d’autres personnes — **illimité** |
| **Schreiben** | **2 corrections IA / jour**, chaque mois Start |
| **Modelltest de la semaine** | Hören + Lesen + Sprachbausteine sur le MT courant |
| **Schreiben + Sprechen** | Sujets de **tous les MT disponibles** |
| **Sprechen Modul** | Oral d’examen avec l’IA (détail ci-dessous) |

### Ce que Start donne, ce que Prep Pass ajoute

La ligne de partage n’est pas « un MT contre tous les MT » : elle dépend du
module.

| Module | Start | Prep Pass (1 000 FCFA / 30 jours) |
|---|---|---|
| **Schreiben** (sujets) | **tous les MT disponibles** | rien de plus |
| **Sprechen** (sujets) | **tous les MT disponibles** | rien de plus |
| **Lesen** | MT de la semaine | **les autres MT** |
| **Hören** | MT de la semaine | **les autres MT** |
| **Sprachbausteine** | MT de la semaine | **les autres MT** |

Autrement dit : Prep Pass ouvre le **pool d’exercices corrigés
automatiquement** — Lesen, Hören, Sprachbausteine — au-delà du MT de la
semaine. Les **sujets** Schreiben et Sprechen sont sur Start pour tous les MT,
par décision produit (détail plus bas).

> **Prep Pass ne débloque aucune IA.** La correction IA Schreiben reste sur
> les quotas Start (2 / jour), puis — une fois vendu — sur les crédits
> **Corrections Schreiben IA**. Mit Elena sprechen reste sur les crédits AI
> Speaking. Lire un sujet n’est pas le faire corriger.

### Modelltest de la semaine (inclus Start)

Le MT courant est résolu par `GET /api/modelltests/of-the-week` (rotation
automatique tous les **7 jours** UTC). Avec Start, l’élève peut s’entraîner sur
ce MT en **Hören, Lesen et Sprachbausteine** (passer `?modelltest=<number>`
sur les endpoints skill). Pour ces trois modules, les autres MT du catalogue
restent derrière Prep Pass.

### Schreiben et Sprechen : tous les MT, sur Start

**Règle produit approuvée — 2026-10-22. Intentionnel, à ne pas « corriger ».**

Un élève Start actif lit les **sujets** Schreiben et Sprechen de **tous les
Modelltests disponibles**, sans Prep Pass. Techniquement :
`GET /api/writing/exercise` et `GET /api/speaking/teils` ne portent pas
`PrepPassGuard`, et c’est voulu — décidé le 2026-10-06
(`docs/superpowers/plans/2026-10-06-tranche6-prep-pass-gate.md` : « Sprechen /
Schreiben topic GETs stay on Start »), et confirmé le 2026-10-22.

Ce que cette règle **ne** débloque **pas** :

| | Reste comme avant |
|---|---|
| **Correction IA Schreiben** | quotas Start (2 / jour), puis crédits Corrections Schreiben IA (200 FCFA). Lire un sujet n’est pas le faire corriger |
| **Mit Elena sprechen** | crédits AI Speaking |
| **Lesen, Hören, Sprachbausteine des autres MT** | Prep Pass |
| **Catalogue MT complet** (`GET /api/modelltests`) | Prep Pass — hors MT de la semaine |
| **Niveau CEFR** | indépendant de Prep Pass : un élève ne voit que son niveau. Le contrôle niveau sur writing / speaking est la **Phase 1b**, pas encore livrée — voir `../backlog.md` |

Lire un sujet n’est donc pas s’entraîner dessus : la valeur Prep Pass reste
le pool d’exercices corrigés automatiquement.

### Sprechen Modul (inclus Start)

Entraînement structuré sur les **3 Teile** du **Modelltest de la semaine**.

L’app charge les sujets via `GET /api/speaking/teils?modelltest=<number>`.

| Règle | Détail |
|--------|--------|
| Contenu | Teil 1, Teil 2, Teil 3 |
| Thèmes | Modelltest de la semaine (`of-the-week`) |
| Avec l’IA | **1 session / Teil / jour** (max **3 / jour**) |
| Durée | **5 minutes** par session |
| Plafond | **12 sessions IA / mois** |
| Objectif | Se préparer à l’oral d’examen |

Règles session IA :

- fermeture après **30 s** sans parole au démarrage
- fermeture en cas d’inactivité prolongée
- **une seule session active à la fois**

Le Live Room (parler avec un autre élève) est **illimité** et ne consomme pas
ce quota.

> Start = MT de la semaine (écrit + oral).  
> Prep Pass = pool complet. Mit Elena = oral libre avec l’IA.

---

## 2. Mit Elena sprechen — 300 FCFA / crédit

Add-on. Pratique orale **libre** avec Elena.

| | |
|--|--|
| **1 crédit** | **1 session** |
| **Durée** | **5 minutes** |
| **Prix** | **300 FCFA** |
| **Thèmes** | Catalogue **Lerniqo** (pas le Modelltest de la semaine) |
| **Achat** | Le centre achète un stock, puis **assigne** aux élèves |
| **Crédits non utilisés** | Retournent au stock du centre si retirés du siège |
| **Crédits consommés** | Jamais remboursés |

Ce n’est **pas** un Teil d’examen. C’est de la conversation pour la fluidité et
la confiance à l’oral.

Exemple : 100 crédits = 100 sessions de 5 minutes = 30 000 FCFA.

---

## 2b. Corrections Schreiben IA — 200 FCFA / crédit

Add-on. Corrections IA training **au-delà** des 2 / jour Start
(ADR 0006, `docs/domains/ai-schreiben-credits.md`).

| | |
|--|--|
| **1 crédit** | **1 correction IA** training (`POST /api/writing/submit`) |
| **Prix** | **200 FCFA** HT |
| **Ordre** | d’abord les **2 corrections / jour** Start, puis 1 crédit |
| **Achat** | Le centre achète un stock, puis **assigne** aux sièges |
| **Non inclus** | Exam Day (notation humaine / suggestions Exam Day IA séparées) |
| **Invités** | Pas de crédits — limite IP uniquement |

Même mécanique stock → assignation → retrait que Mit Elena.

Exemple : 40 crédits = 40 corrections = **8 000 FCFA** HT (~9 440 TTC).

---

## 3. Prep Pass — 1 000 FCFA / élève / 30 jours

Add-on. Paiement unique. Pour **s’entraîner sur le pool** des séries Modelltest
telc (pas seulement le MT de la semaine).

| Module | Accès |
|--------|--------|
| **Hören, Lesen, Sprachbausteine** | **Tous** les MT d’entraînement + **suivi des résultats** |
| **Catalogue** | `GET /api/modelltests` liste le pool complet |
| **Sprechen** | Rien de plus : les sujets des Teile sont **déjà inclus dans Start**, pour tous les MT. Pas de discussion IA |
| **Schreiben** | Rien de plus : les sujets sont **déjà inclus dans Start**, pour tous les MT. Pas de correction IA |

- Accès pendant **30 jours** à partir de l’assignation
- Exercices refaisables
- Ce n’est **pas** un examen blanc complet (→ Exam Day)
- **Sans IA** : l’IA orale / correction reste Start, Mit Elena et
  Corrections Schreiben IA

---

## 4. Exam Day — 1 000 FCFA / candidat / examen

Add-on. Paiement à l’usage. Vrai **examen blanc telc** organisé par le centre.

**Le centre choisit :** niveau, Modelltest, participants, date, heure, fenêtre
d’accès — puis publie la session.

**Lerniqo gère :** chronométrage type examen, accès élèves, notifications,
centralisation des scores.

**Correction :**

| | |
|--|--|
| **Automatique** | Lesen, Hören, Sprachbausteine |
| **Formateur / centre** | Schreiben, Sprechen |

**Dashboard centre :** consultation des résultats, comparaison entre élèves,
publication aux étudiants, export **PDF** et **CSV**.

Règle de réussite (simulation telc) : **60 % écrit** et **60 % oral**.

> La question du centre : **quels élèves sont réellement prêts pour l’examen ?**

Le palier **Exam Day IA (1 500 FCFA)** existe en code mais **n’est pas vendu
au launch**.

---

## Pilote Exam Day — essai gratuit centre

Offre d’essai pour les centres (pas un plan étudiant). Une fois par centre.

| | |
|--|--|
| **Durée** | **14 jours** (horloge au bouton « démarrer l’essai ») |
| **Places Start** | **3** codes (Start complet, prix 0) |
| **Exam Day** | **6** places manuelles (2 sessions × 3 candidats) |
| **Mit Elena** | **9** crédits (stock centre, à assigner) |
| **Corrections Schreiben IA** | **6** crédits (stock centre, à assigner) |
| **Prep Pass** | non inclus |
| **Achats add-ons / Exam Day pendant l’essai** | non — seul l’achat de places Start (conversion) est ouvert |
| **Après J14 sans paiement** | accès coupé ; slots et crédits d’essai restants annulés |
| **Ensuite** | à partir de **10 places** Start + add-ons au tarif catalogue |

Détail contrat : `docs/contracts/center-dashboard-sync.md` § D3.

---

## Comment ça se complète

```
Start         Prep Pass      Exam Day       Mit Elena      Schreiben IA
─────────     ─────────      ─────────      ─────────      ─────────────
Apprendre     Pool MT        Se tester      Oral IA libre  Corrections
MT semaine    Hören/Lesen/SB Examen blanc   Thèmes Lerniqo après les 2/j
Live + IA     Sans IA        Dashboard      300/crédit     200/crédit
```

Tous les add-ons viennent **en complément de Start**.
