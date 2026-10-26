# Vocab (sens multiples + conjugaisons) & Grammar (pool MT) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un vocabulaire hebdo de **~100 mots clés** (pas tout le MT) par **nature** (Substantifs, Verbes, Adjectifs, Adverbes, Prépositions), avec sens multiples + exemples traduits, conjugaisons DE complètes en DB pour les verbes, catalogue searchable hors MT ; et limiter le thème grammar du jour au pool du Modelltest de la semaine.

**Architecture:** Runtime = PostgreSQL uniquement. Enrichissement offline. Pack `of-the-week` = **100 lemmes** choisis par un **algo de score** (pas « tout le MT ») : candidats = occurrences MT **+** mots réputés du catalogue (CEFR / Goethe / fréquence DWDS). Quotas par `pos`. UI = **5 onglets**. Wordchat / search = catalogue élargi. Grammar = `topicOfTheDay` sur pool MT weekly.

**Tech Stack:** NestJS, Prisma/PostgreSQL, scripts `ts-node` d’import, mêmes guards que MT of-the-week.

## Global Constraints

- JWT + `StudentSubscriptionGuard` ; pas de `PrepPassGuard` sur vocab/grammar of-the-week / of-the-day.
- Guests accessibles (comme grammar actuel).
- Pas d’appel live DWDS / rep12 / Gemini dans les controllers élèves.
- Conjugaison verbe = **formes allemandes uniquement** (traduction seulement dans `senses[]`).
- Localisation fiches : FR + EN (exemples / sens) ; paradigme verbe toujours DE.
- ADR 0001 : **answers dans le GET** pour quiz vocab **comme** Lesen / Sprachbausteine / grammar (même logique modules) ; `submit` = score / progress, pas pour « cacher » la réponse.
- Catalogue CEFR / réputé : **tous niveaux** (A1–C1), pas B1 seul.
- Pack 100 : doit **toujours** contenir une part de lemmes **hors MT** (mots réputés), pas seulement en secours.
- Wordchat V1 : `GET /vocab/search` seul — **pas** d’ajout manuel « mes mots ».
- Grammar : pool de thèmes **par semaine** (lié au MT weekly), puis 1 thème / jour dans ce pool.
- Mettre à jour `docs/VOCAB_GRAMMAR_SPEC.md` quand une décision de ce plan contredit l’ancienne.

## Décisions produit figées (2026-10-17)

| # | Décision |
|---|---|
| V1 | Pack hebdo = **100** lemmes, quotas **36 / 27 / 17 / 10 / 10**. Sources : **MT + mots réputés** (catalogue **tous niveaux**). Algo de score déterministe. **Toujours** ≥ N lemmes hors MT dans le pack (voir Algo) |
| V2 | UI **5 onglets** : Substantifs / Verbes / Adjectifs / Adverbes / Prépositions |
| V3 | Chaque lemme a **N significations** ; chaque sens = trad (FR/EN) + exemple DE + trad exemple |
| V4 | Verbe : conjugaison **DE only** en DB, personnes × temps retenus |
| V5 | Search / Wordchat : catalogue élargi (`GET search`) — **pas** d’ajout de mots par l’élève en V1 |
| V6 | Grammar : pool thèmes **par semaine** (= liés au MT of-the-week), puis 1 thème / jour dans ce pool |
| V7 | Champs fiche selon `pos` — tous avec `senses[]` |
| V8 | Algo dans `vocab-pack-score.ts` + script ; testable |
| V9 | Quiz vocab : **answers dans le GET** (ADR 0001, aligné autres modules) + `submit` pour score/progress |

### Algo de sélection du pack (100) — logique de calcul

**But :** remplir les quotas sans prendre « tous les mots du MT », en mélangeant **présence exam** et **réputation** (fréquence / listes CEFR).

**Sources de candidats (pool) :**

| Source | `source` / signal | Rôle |
|--------|-------------------|------|
| A — Occurrences du MT weekly | `VocabOccurrence` pour ce `modelltest_id` | Ancrage exam |
| B — Catalogue réputé | `source ∈ {cefr_list, goethe, manual}` + `frequency_rank` / DWDS | Mots utiles même hors texte MT |

**Score par lemme** (plus haut = prioritaire) :

```
score = 0
+ 40  si présent dans le MT courant (occurrence)
+ 15  × nombre de skills distincts du MT où il apparaît (max 4 → +60)
+ 20  si frequency_rank ≤ 2000 (très fréquent)   // ou dwds_frequency ≥ 4
+ 12  si frequency_rank ≤ 5000
+ 10  si dans liste CEFR/Goethe du niveau cible (ex. B1)
+ 8   si déjà `known`/`learning` chez beaucoup d’élèves — V1.1 ; ignorer en V1
− 25  si bruit (stopword, nom propre détecté, lemma < 2 lettres)
```

**Remplissage (par `pos`) :**

```
MIN_OUTSIDE_MT_RATIO = 0.30   // au moins 30% du pack (= 30 lemmes) hors MT — toujours

pour chaque pos dans [noun, verb, adj, adv, prep]:
  quota = QUOTAS[pos]
  mtPool   = candidats pos ∩ inModelltest, tri score DESC, lemma ASC
  outPool  = candidats pos ∩ !inModelltest (réputés), tri score DESC, lemma ASC
  // Garantir une part hors MT globale :
  //   d’abord réserver ceil(quota * 0.30) depuis outPool (si dispo)
  //   puis remplir le reste depuis mtPool
  //   puis compléter encore depuis outPool si mt insuffisant
  marquer in_weekly_pack=true
```

**Règles :**

- Total pack = **100** si assez de candidats ; sinon max possible + warning.
- **Toujours** des mots hors MT dans le pack (cible **≥ 30 / 100**), pas seulement en secours.
- Catalogue réputé = **tous niveaux** CEFR importés.
- Dédup `lemma+article+pos` ; déterministe ; runtime = lit `in_weekly_pack` seulement.

### Champs fiche par nature (V1)

| Nature (UI) | `pos` | Champs spécifiques (+ `senses[]` toujours) |
|-------------|-------|--------------------------------------------|
| Substantifs | `noun` | `article`, `gender`, `plural` |
| Verbes | `verb` | `auxiliary`, `separable`, `partizipIi`, `conjugation` (DE only) |
| Adjectifs | `adj` | `comparative`, `superlative` |
| Adverbes | `adv` | (légers) — sens + exemples ; `note` optionnelle |
| Prépositions | `prep` | `governsCase` (`akk`\|`dat`\|`gen`\|`wechsel`) |

### Temps de conjugaison V1 (paradigme DE)

| Temps | Personnes |
|--------|-----------|
| präsens | ich, du, er_sie_es, wir, ihr, sie_Sie |
| präteritum | idem |
| perfekt | auxiliaire + partizip II (formes conjuguées ou template) |
| konjunktiv_ii | idem (utile TELC B1) |
| imperativ | du, ihr, Sie |

Métadonnées verbe : `auxiliary` (`haben`\|`sein`), `separable` (bool), `partizip_ii`, `praesens_stem` optionnel.

### Shape `senses[]` (tous `pos`)

```json
{
  "id": "uuid",
  "sortOrder": 0,
  "meaningFr": "banque (établissement)",
  "meaningEn": "bank (financial)",
  "exampleDe": "Ich gehe zur Bank.",
  "exampleFr": "Je vais à la banque.",
  "exampleEn": "I go to the bank.",
  "noteFr": null
}
```

---

## File map (cible)

| Fichier / zone | Rôle |
|----------------|------|
| `prisma/schema.prisma` | `VocabEntry`, `VocabSense`, `VocabVerbForm`, `VocabOccurrence`, `VocabProgress`, `VocabExercise`, `GrammarTopicModelltest` |
| `prisma/migrations/…` | migrations |
| `src/modules/vocab/*` | module Nest (nouveau) |
| `src/modules/vocab/vocab-pack-score.ts` | calcul score + sélection quotas (pur, testable) |
| `scripts/vocab-*.ts` | extract / enrich / curate (appelle l’algo) / conjugaisons |
| `scripts/grammar-link-modelltests.ts` | lier ~7 topics par MT |
| `src/modules/grammar/grammar.service.ts` | `resolveTopicOfTheDay` filtre par weekly MT |
| `docs/VOCAB_GRAMMAR_SPEC.md` | aligner décisions |

---

### Task 0: Mettre à jour la spec (décisions)

**Files:**
- Modify: `docs/VOCAB_GRAMMAR_SPEC.md`

- [ ] Documenter pack **100** = MT + mots réputés via **algo de score** ; quotas **36 / 27 / 17 / 10 / 10** ; **5 onglets** nature
- [ ] Remplacer décision 4d (pool grammar global) par **pool lié au MT weekly**
- [ ] Remplacer glosses simples par modèle `VocabSense[]`
- [ ] Documenter conjugaison DE-only + Wordchat hors pack
- [ ] Mention Cursor en bas du doc

---

### Task 1: Schéma Prisma vocab + grammar_topic_modelltests

**Files:**
- Modify: `prisma/schema.prisma`
- Create: migration SQL via Prisma

**Modèles (indicatif) :**

```prisma
model VocabEntry {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  lemma          String
  article        String?  // der|die|das — nouns
  gender         String?  // mask|fem|neutr
  plural         String?
  pos            String   // noun|verb|adj|adv|prep|pron|conj|other
  cefr_level     String?
  source         String   // modelltest|cefr_list|manual
  frequency_rank Int?
  // verb meta
  auxiliary      String?  // haben|sein
  separable      Boolean?
  partizip_ii    String?
  // adj meta
  comparative    String?
  superlative    String?
  // prep meta
  governs_case   String?  // akk|dat|gen|wechsel
  created_at     DateTime @default(now()) @db.Timestamptz(6)
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  senses       VocabSense[]
  verb_forms   VocabVerbForm[]
  occurrences  VocabOccurrence[]
  progress     VocabProgress[]
  exercises    VocabExercise[]

  @@unique([lemma, article, pos])
  @@map("vocab_entries")
}

model VocabSense {
  id           String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  entry_id     String  @db.Uuid
  sort_order   Int     @default(0)
  meaning_fr   String
  meaning_en   String?
  example_de   String
  example_fr   String?
  example_en   String?
  note_fr      String?
  note_en      String?

  entry VocabEntry @relation(fields: [entry_id], references: [id], onDelete: Cascade)

  @@index([entry_id])
  @@map("vocab_senses")
}

model VocabVerbForm {
  id         String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  entry_id   String @db.Uuid
  tense      String // praesens|praeteritum|perfekt|konjunktiv_ii|imperativ
  person     String // ich|du|er_sie_es|wir|ihr|sie_Sie|du_imp|ihr_imp|Sie_imp
  form_de    String // allemand uniquement

  entry VocabEntry @relation(fields: [entry_id], references: [id], onDelete: Cascade)

  @@unique([entry_id, tense, person])
  @@map("vocab_verb_forms")
}

model VocabOccurrence {
  id               String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  vocab_entry_id   String  @db.Uuid
  modelltest_id    String  @db.Uuid
  skill            String
  content_revision String?
  context_snippet  String?
  in_weekly_pack   Boolean @default(false) // true = compte dans les 100 mots clés

  entry      VocabEntry @relation(fields: [vocab_entry_id], references: [id], onDelete: Cascade)
  modelltest Modelltest @relation(fields: [modelltest_id], references: [id], onDelete: Cascade)

  @@unique([vocab_entry_id, modelltest_id, skill, content_revision])
  @@map("vocab_occurrences")
}

model VocabProgress {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  student_id     String   @db.Uuid
  vocab_entry_id String   @db.Uuid
  status         String   // learning|known
  updated_at     DateTime @updatedAt @db.Timestamptz(6)

  @@unique([student_id, vocab_entry_id])
  @@map("vocab_progress")
}

model VocabExercise {
  id             String  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  modelltest_id  String  @db.Uuid
  vocab_entry_id String? @db.Uuid
  kind           String  // mcq|cloze
  prompt_fr      String
  prompt_en      String?
  prompt_de      String?
  options_json   Json?
  answer         String
  explanation_fr String?
  sort_order     Int     @default(0)

  @@map("vocab_exercises")
}

model GrammarTopicModelltest {
  id            String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  topic_id      String @db.Uuid
  modelltest_id String @db.Uuid
  sort_order    Int    @default(0)

  topic      GrammarTopic @relation(fields: [topic_id], references: [id], onDelete: Cascade)
  modelltest Modelltest   @relation(fields: [modelltest_id], references: [id], onDelete: Cascade)

  @@unique([topic_id, modelltest_id])
  @@map("grammar_topic_modelltests")
}
```

- [ ] Ajouter relations inverses sur `Modelltest` et `GrammarTopic` / `Student`
- [ ] `npx prisma migrate dev --name vocab_senses_verb_forms_grammar_mt_link`
- [ ] Vérifier `prisma generate`

---

### Task 2: Grammar — pool of-the-day = topics du MT weekly

**Files:**
- Modify: `src/modules/grammar/grammar.service.ts` (`resolveTopicOfTheDay`)
- Modify: `src/modules/grammar/grammar.service.spec.ts`
- Create: `scripts/grammar-link-modelltests.ts`
- Modify: `docs/VOCAB_GRAMMAR_SPEC.md` (algo)

**Logique (pool = par semaine / MT weekly) :**

```
weeklyNumber = trainingAccess.weeklyModelltestNumber(now)
mt = modelltest where number = weeklyNumber
pool = grammar topics published liés à ce MT (grammar_topic_modelltests)
        ordered by sort_order, slug
topic = topicOfTheDay(pool, now)   // dayIndex % pool.length → 1 thème / jour
fallback: pool vide → 404 GRAMMAR_POOL_EMPTY (pas de fallback 365)
```

- [ ] Test : pool = semaine MT ; jour N → topic attendu
- [ ] Script : lier **≥ 7 topics / MT** (rotation journalière dans la semaine)
- [ ] Smoke `GET /api/grammar/of-the-day`

---

### Task 3: Module Nest `vocab` — lecture fiches

**Files:**
- Create: `src/modules/vocab/vocab.module.ts`
- Create: `src/modules/vocab/vocab.controller.ts`
- Create: `src/modules/vocab/vocab.service.ts`
- Create: `src/modules/vocab/dto/vocab.dto.ts`
- Create: `src/modules/vocab/vocab.service.spec.ts`
- Modify: `src/app.module.ts`

**Endpoints V1 :**

| Method | Path | Comportement |
|--------|------|--------------|
| GET | `/api/vocab/of-the-week` | Pack 100 mots clés (`in_weekly_pack=true`), groupé `nouns` / `verbs` / `adjectives` / `adverbs` / `prepositions` |
| GET | `/api/vocab/entries/:entryId` | Fiche complète : meta pos + `senses[]` + `verbForms` si verb |
| GET | `/api/vocab/search?q=&pos=&limit=` | Catalogue (search seul — pas d’add mot) |
| PUT | `/api/vocab/entries/:entryId/progress` | `{ status: learning\|known }` |
| GET | `/api/vocab/me/progress` | résumé |

**DTO fiche (verbe) :**

```ts
{
  id, lemma, pos: 'verb',
  auxiliary: 'haben',
  separable: false,
  partizipIi: 'gegangen',
  senses: [{ meaningFr, meaningEn, exampleDe, exampleFr, exampleEn }],
  conjugation: {
    praesens: { ich: 'gehe', du: 'gehst', /* … */ },
    praeteritum: { /* … */ },
    // formes DE only
  },
  progressStatus: 'learning' | 'known' | null
}
```

**DTO fiche (substantif) :** `article`, `gender`, `plural`, `senses[]` — pas de `conjugation`.

- [ ] Tests service : of-the-week compte ≤ 100 ; filtre pos ; search hors pack
- [ ] Routes statiques (`of-the-week`, `search`, `me/progress`) **avant** `entries/:entryId`

---

### Task 4a: Algo de score (unitaire, sans I/O)

**Files:**
- Create: `src/modules/vocab/vocab-pack-score.ts`
- Create: `src/modules/vocab/vocab-pack-score.spec.ts`

```ts
export const VOCAB_PACK_QUOTAS = {
  noun: 36, verb: 27, adj: 17, adv: 10, prep: 10,
} as const; // sum = 100

export type PackCandidate = {
  entryId: string;
  lemma: string;
  pos: keyof typeof VOCAB_PACK_QUOTAS;
  inModelltest: boolean;
  skillCount: number;       // 0–4
  frequencyRank: number | null; // lower = more frequent
  inCefrList: boolean;
  isNoise: boolean;
};

export function scorePackCandidate(c: PackCandidate): number { /* formule V8 */ }

export function selectWeeklyPack(
  candidates: PackCandidate[],
): { entryId: string; pos: string; score: number }[]
// → au plus 100, respect des quotas, tri score desc + lemma asc
```

- [ ] Tests : complète CEFR ; **≥ 30% hors MT** même si MT est riche ; bruit exclu ; tie-break stable ; total ≤ 100 ; quotas respectés
- [ ] Pas de random

### Task 4b: Pipeline contenu — extract + senses + conjugaisons + curate

**Files:**
- Create: `scripts/vocab-extract-from-modelltests.ts`
- Create: `scripts/vocab-import-cefr-reputable.ts` (listes Goethe/CEFR → `source=cefr_list`)
- Create: `scripts/vocab-enrich-senses.ts`
- Create: `scripts/vocab-generate-conjugations.ts`
- Create: `scripts/vocab-curate-weekly-pack.ts` (charge candidats, appelle `selectWeeklyPack`, écrit `in_weekly_pack`)
- Modify: `package.json` (scripts npm)

**Étapes offline :**

### Phase A — Analyse MT + extraction (obligatoire en premier)

1. Pour chaque Modelltest : lire Lesen / Hören (transcript) / Sprachbausteine / Schreiben
2. Tokenize + lemmatize (heuristique DE V1) → candidats lemma/pos/article
3. Filtrer bruit (stopwords, trop courts, noms propres grossiers)
4. UPSERT `VocabEntry` + `VocabOccurrence` (`in_weekly_pack=false`, `skill`, `context_snippet`)
5. Rapport JSON : `{ modelltestNumber, candidatesFound, byPos, topLemmas }`

Script : `scripts/vocab-analyze-extract-modelltest.ts`  
npm : `npm run vocab:analyze-extract -- --mt=2` (ou tous)

### Phase B — Catalogue + enrich + pack

6. **Import réputés** → catalogue CEFR/Goethe/fréquence
7. **Enrich senses** + **conjugaisons** verbes (DB maison)
8. **Curate** : `selectWeeklyPack(...)` → `in_weekly_pack` (toujours ≥ 30 % hors MT)

- [ ] Documenter commandes dans `docs/VOCAB_GRAMMAR_SPEC.md`
- [ ] Seed **1 MT** : 100 fiches via l’algo + conjugaisons démo

---

### Task 5: Exercices vocab of-the-week

**Files:**
- Extend: `src/modules/vocab/*`
- Extend: `scripts/vocab-generate-exercises.ts` (ou dans enrich)

| Method | Path |
|--------|------|
| GET | `/api/vocab/exercises/of-the-week` |
| POST | `/api/vocab/exercises/:exerciseId/submit` |

- [ ] ~20–25 items quiz sur le pack 100
- [ ] GET exercices **avec `answer` + explanation** (ADR 0001, comme autres modules)
- [ ] POST submit → score / progress
- [ ] Tests submit correct/incorrect

---

### Task 6: Alignement FE contract + smoke

**Files:**
- Modify: `docs/VOCAB_GRAMMAR_SPEC.md` (contrats JSON finaux)
- Modify: `docs/CENTER_FRONTEND_SYNC_DECISIONS.md` si sync FE requis

- [ ] Exemples de réponse `of-the-week` avec les 5 groupes (labels UI : Substantifs / Verbes / Adjectifs / Adverbes / Prépositions)
- [ ] Smoke local : migrate → seed → `GET vocab/of-the-week` → `GET entries/:id` (verbe avec conjugaison DE) → `GET grammar/of-the-day` (topic ∈ MT)
- [ ] Checklist manuelle dans le plan (ci-dessous)

---

## Ordre d’exécution recommandé

```
Task 0 (spec) → Task 1 (schema) → Task 2 (grammar MT pool)
                              ↘ Task 3 (API vocab lecture)
                              ↘ Task 4a (algo score) → Task 4b (pipeline) → Task 5 (exercices) → Task 6 (smoke)
```

Task 2 peut avancer en parallèle de Task 3 une fois le schéma `GrammarTopicModelltest` migré.

---

## Test plan (fin de plan)

- [ ] `npx prisma migrate deploy` OK
- [ ] Pack weekly = 100 mots clés (quotas **36 / 27 / 17 / 10 / 10**) pour le MT courant
- [ ] Fiche verbe : conjugaison DE, sens traduits à part
- [ ] Fiche substantif / adj / adv / prep : champs spécifiques + multi-sens
- [ ] `GET /api/vocab/search?q=geh` trouve hors pack
- [ ] Grammar of-the-day ∈ topics du MT weekly uniquement
- [ ] Tests unitaires vocab + grammar verts

---

## Hors scope (ce plan)

- TTS audio par mot
- Open-search type Google Translate
- Éditorial manuel luxe des 7 thèmes grammar (script déterministe suffit V1)
- Conjugaison Futur / Plusquamperfekt (V1.1)
- Ajout manuel de mots par l’élève (« mes mots »)
- UI Wordchat Flutter (BE : `search` seulement)

---

*Ce document a été créé avec Cursor (IA).*
