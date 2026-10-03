# Offres Lerniqo pour les centres de langue

**Source commerciale.** Ce document est la référence : quand le code et ce
document divergent, c'est le code qui a tort jusqu'à décision contraire du
fondateur et de Herman.

Lerniqo fonctionne avec une offre principale, **Start**, puis des add-ons qui
s'ajoutent selon les besoins du centre et des étudiants.

> **Start = apprendre**
> **Prep Pass = s'entraîner**
> **Exam Day = se tester**
> **AI Assisted Learning = être accompagné par l'IA**
> **AI Speaking = pratiquer davantage l'oral avec l'IA**

Tous les add-ons viennent **en complément de Start**.

---

## 1. Lerniqo Start — 4 500 FCFA / élève / mois

L'offre principale et la base de l'écosystème.

**Inclus :** accès à la plateforme, cours et contenus principaux, suivi de
progression, tableau de bord étudiant, accès ordinateur et mobile, et
**Sprechen IA Light**.

**Sprechen IA Light**, par élève :

- **5 sessions IA par mois**
- **5 minutes maximum** par session
- fermeture automatique après **30 secondes sans parole au démarrage**
- fermeture automatique en cas d'inactivité prolongée
- **une seule session active à la fois**

---

## 2. Lerniqo Prep Pass — 3 000 FCFA / élève / 60 jours

Paiement unique. Pour l'étudiant qui veut intensifier sa préparation au telc.

Bibliothèque d'exercices indépendants : Hören, Lesen, Sprachbausteine,
Schreiben, Sprechen. Plus de 20 exercices, accès illimité pendant 60 jours,
exercices refaisables, suivi de progression.

Ce n'est **pas** un examen blanc complet. C'est de l'entraînement.

---

## 3. Lerniqo Exam Day — 1 000 FCFA / candidat / examen

Paiement à l'usage. De véritables examens blancs telc organisés dans Lerniqo.

**Le centre choisit :** le niveau, le Modelltest, les participants, la date,
l'heure, la fenêtre d'accès — puis publie la session aux étudiants.

**Lerniqo gère :** le chronométrage aux standards de l'examen, l'accès des
étudiants, les résultats, les notifications, la centralisation des scores.

**Correction automatique :** Lesen, Hören, Sprachbausteine.
**Évaluation par le formateur ou le centre :** Schreiben, Sprechen.

**Résultats :** consultation, comparaison entre étudiants, export PDF, export
CSV, publication aux étudiants.

> La question à laquelle le centre doit pouvoir répondre :
> **quels étudiants sont réellement prêts pour l'examen ?**

---

## 4. Lerniqo AI Assisted Learning — 2 000 FCFA / élève / mois

Une IA qui accompagne l'apprentissage, dans Hören, Lesen, Schreiben et
Sprechen. Différent de AI Speaking : l'objectif n'est pas de faire parler
l'étudiant, mais de l'aider à comprendre.

Elle peut expliquer une réponse, guider quand l'étudiant bloque, donner un
feedback ciblé, aider à comprendre les erreurs, accompagner la progression,
rendre l'étudiant plus autonome, compléter le travail du formateur.

Exemple — l'étudiant se trompe en Lesen. Au lieu de « Mauvaise réponse », l'IA
explique pourquoi la réponse est incorrecte, quel passage du texte donne
l'indice, et comment reconnaître ce type de question la prochaine fois.

---

## 5. Lerniqo AI Speaking — 300 FCFA / crédit

**1 crédit = 1 session IA de 5 minutes.** Complément du Sprechen IA Light déjà
inclus dans Start, pour la pratique orale intensive.

Conversations réalistes avec l'IA, prononciation, fluidité, confiance à l'oral,
situations proches du telc, interaction spontanée, feedback instantané.

Exemple : le centre achète 100 crédits, soit 100 sessions de 5 minutes,
utilisables par les étudiants autorisés.

---

## Écarts connus entre ce document et le code

Au 2026-09-25 :

| | |
|---|---|
| Sprechen IA Light | le code donne **2 sessions par 24 h glissantes**, pas 5 par mois. Aucun plafond de 5 minutes, aucune fermeture sur silence, aucune limite d'une session à la fois → **bloc 22** |
| Prep Pass | n'existe pas → **bloc 25** |
| AI Assisted Learning | n'existe pas → **bloc 26** |
| AI Speaking | n'existe pas ; pas de notion de crédit → **bloc 24** |
| Exam Day | construit. Mais un **palier IA à 1 500 FCFA / candidat** a été livré (phase 21) et ne figure pas dans cette offre → **bloc 27**, décision à prendre |

Le plan de construction est dans `docs/BUILD_BLOCKS_22_27.md`.
