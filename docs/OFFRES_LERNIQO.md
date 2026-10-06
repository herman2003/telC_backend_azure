# Offres Lerniqo — Launch

**Source commerciale.** Ce document est la référence pour le launch : quand le
code et ce document divergent, c'est le code qui a tort jusqu'à décision
contraire du fondateur et de Herman.

Lerniqo = une offre principale (**Start**) + des add-ons en complément.

> **Start = apprendre**
> **Prep Pass = s'entraîner**
> **Exam Day = se tester**
> **Mit Elena = pratiquer davantage l'oral avec l'IA**

---

## Au launch

| Offre | Prix | Statut |
|-------|------|--------|
| **Lerniqo Start** | 4 500 FCFA / élève / mois | Launch |
| **Mit Elena sprechen** | 300 FCFA / crédit | Launch |
| **Prep Pass** | 1 000 FCFA / élève / 30 jours | Launch |
| **Exam Day** (manuel) | 1 000 FCFA / candidat / examen | Launch |

---

## Après le launch (pas vendu pour l’instant)

| Offre | Note |
|-------|------|
| **Exam Day IA** (1 500 FCFA) | Code déjà livré — **gardé, pas vendu** |
| **AI Assisted Learning** | Entitlement prévu — **pas construit / pas vendu** |

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
| **Sprechen Modul** | Oral d’examen avec l’IA (détail ci-dessous) |

> Les **séries Modelltest** d’entraînement (Hören, Lesen, Sprachbausteine) sont
> dans **Prep Pass**, pas dans Start.

### Sprechen Modul (inclus Start)

Entraînement structuré sur les **3 Teile** du **Modelltest de la semaine**.

Le MT courant est résolu par `GET /api/modelltests/of-the-week` (rotation
automatique tous les **7 jours** UTC, Start only — pas Prep Pass). L’app charge
ensuite les sujets via `GET /api/speaking/teils?modelltest=<number>`.

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

> Start prépare l’**oral d’examen**.  
> Pour parler librement avec l’IA → **Mit Elena**.

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

## 3. Prep Pass — 1 000 FCFA / élève / 30 jours

Add-on. Paiement unique. Pour **s’entraîner** sur des séries Modelltest telc.

| Module | Accès |
|--------|--------|
| **Hören, Lesen, Sprachbausteine** | Exercices complets + **suivi des résultats** |
| **Sprechen** | **Sujets** des Teile seulement — **pas** de discussion IA |
| **Schreiben** | **Sujets** seulement — **pas** de correction IA |

- Accès pendant **30 jours** à partir de l’assignation
- Exercices refaisables
- Ce n’est **pas** un examen blanc complet (→ Exam Day)
- **Sans IA** : l’IA orale / correction reste Start et Mit Elena

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

## Comment ça se complète

```
Start              Prep Pass           Exam Day            Mit Elena
─────────────      ─────────────       ─────────────       ─────────────
Apprendre          S'entraîner         Se tester           Oral IA libre
Quota Teile exam   Sujets / séries     Examen blanc        Thèmes Lerniqo
Live Room illimité Sans IA             Dashboard centre    Crédits
```

Tous les add-ons viennent **en complément de Start**.
