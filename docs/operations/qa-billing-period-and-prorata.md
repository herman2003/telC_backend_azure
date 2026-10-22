# QA runbook — Période Start, renouvellement & prorata

**Audience:** QA / autre ingénieur.  
**Happy-path abo / add-ons:** [PROD_READY_BILLING_SMOKE.md](./billing-smoke.md)  
**Échecs / grâce / webhooks:** [QA_BILLING_EDGE_CASES.md](./qa-billing-edge-cases.md) (branche `docs/qa-billing-edge-cases` si absent sur `dev`)  
**Règles produit:** D4 dans [CENTER_FRONTEND_SYNC_DECISIONS.md](../contracts/center-dashboard-sync.md), [BILLING_PERIOD_SPEC.md](../domains/billing-period.md)

---

## 0. Ce qu’on teste (et ce qu’on ne confond pas)

| Concept | Signification | Prorata ? |
|---------|---------------|-----------|
| **Trial 14 j** | Gratuit, 1 code | Non |
| **1er paiement Start** | Pack plein (min 10 sièges). Le **jour du paiement** = **anchor**. Période = jusqu’au même jour le mois suivant (Douala). | **Non** — même si on paie un 19 mid-calendar |
| **Renouvellement** | Tout le pack au prochain anchor | **Non** |
| **Ajout de sièges mid-period** | Centre déjà `ACTIVE` / `paid_until` futur, commande un total de sièges **>** sièges déjà payés | **Oui** (règle produit) |

**État du code (2026-10-16)**

| Comportement | Status |
|--------------|--------|
| Trial → 1er pay → anchor → `paid_until` calendaire | **Buildé** — à smoke-tester |
| Mid-period : facture seulement les sièges **ajoutés** ; n’avance pas l’anchor | **Buildé** |
| Mid-period : montant = **prorata jours** | **Pas buildé** — aujourd’hui = **plein prix × sièges ajoutés** (HT puis TTC) |
| Charge minimum (B2) pour petits montants | **Pas décidé / pas buildé** |

Donc : on teste **deux colonnes** — *aujourd’hui* vs *cible produit* — pour ne pas marquer FAIL à tort.

---

## 1. Outils (comme le smoke abo)

| Besoin | Outil |
|--------|--------|
| Flows HTTP | Bruno `local` → `npm run start:testdb` (`http://localhost:3001`) |
| Fake pay | `PAYMENT_PROVIDER=fake` + `FAKE_PAYMENT_WEBHOOK_SECRET` = Bruno `fakeWebhookSecret` |
| Forcer mid-period / dates | **SQL test DB only** |
| Montants | Note `unitPriceXaf` (HT), `amountXaf` payment (**TTC** = HT × 1.18) |

**Folders Bruno**

- `Center Auth / 03 Login`
- `Center Subscription / 03 Start trial`, `01 Get subscription`
- `Center Payments / 01 Quote` → `02 Create` → `05 Checkout` → `06 Webhook`
- `Center Profile` si payment refuse (pays / ville / téléphone)

**Formule cible prorata (quand shippé)**

```text
HT = ceil( sièges_ajoutés × prix_siège × jours_restants ÷ jours_de_la_période )
TTC = HT × 1.18   (arrondi selon splitVatXaf)
si HT < MIN_CHARGE (B2) → facturer MIN_CHARGE
```

Exemple doc (Alain, Start 4 500, +6 le 5 jan, 27/31 j) → ~23 600 HT.

---

## 2. Préparation d’un centre « déjà payé »

Option A — smoke trial + Start 10 (recommandé, vrai chemin) :

1. Register / verify / login  
2. Start trial  
3. Patch profile  
4. Quote / create / checkout / webhook SUCCEEDED pour `{"seats": 10}`  
5. Noter `center_id`, `paid_until`, `anchor`, `seatsHeld`

Option B — SQL (plus rapide, test DB) :

```sql
-- After a real center exists and has a seat row from a prior smoke:
UPDATE center_subscriptions
   SET plan = 'PAID',
       paid_until = now() + interval '20 days',
       trial_started_at = NULL,
       trial_ends_at = NULL,
       anchor_day = EXTRACT(DAY FROM (now() AT TIME ZONE 'Africa/Douala'))::int
 WHERE center_id = '<center_id>';

-- Ensure paid seat pool (quantity + unit_price > 0) matches what you expect.
```

Vérifier : `GET …/subscription` → `ACTIVE` / `studentsMayLearn: true`.

---

## 3. Matrice de scénarios

Cocher **PASS / FAIL / SKIP**.  
Pour le prorata : **PASS_TODAY** = comportement code actuel ; **PASS_TARGET** = formule D4 (après ship).

### P1 — Trial → 1er Start (y compris un 19 mid-month)

| Étape | Attendu |
|-------|---------|
| Quote 10 | `unitPriceXaf` 4500 ; total TTC attendu **53 100** (10 × 4500 × 1.18) |
| Webhook SUCCEEDED | `plan` PAID, sièges 10, codes mintés |
| Anchor | = **jour du paiement** (Douala), pas le 1er du mois |
| `paid_until` | Prochain mois calendaire sur cet anchor (`periodEndAfter`) |
| Montant | **Plein pack** — **pas** de prorata « reste d’octobre » |

**Pass:** plein prix + anchor = jour de pay.

### P2 — Renouvellement (période écoulée mais encore grâce ou juste avant)

```sql
UPDATE center_subscriptions
   SET paid_until = now() - interval '1 day'  -- in grace if < 7 days
 WHERE center_id = '<center_id>';
```

| Étape | Attendu |
|-------|---------|
| Create payment `{"seats": 10}` (ou total actuel) | `renews_period` true ; facture **tout** le pack |
| Webhook | `paid_until` étendu ; **anchor inchangé** (grâce) |

### P3 — Mid-period +N sièges (cœur prorata)

Préreq : `paid_until` **dans le futur**, pool payé = 10.

Bruno / API : body `{"seats": 16}` (= total voulu, **pas** « +6 »).

| Check | **Aujourd’hui (code)** | **Cible (D4)** |
|-------|------------------------|----------------|
| Sièges facturés | **6** (16 − 10) | 6 |
| Montant HT | **6 × 4500 = 27 000** (TTC **31 860**) | `ceil(6 × 4500 × jours_restants / jours_période)` |
| Anchor / `paid_until` après webhook | **Inchangés** | Inchangés |
| Codes | +6 codes, même fin de période | Idem |
| Quote vs payment | Quote may show **full** 16× TTC; payment `amountXaf` is **delta only** | Same split once prorata ships |

**Comment mesurer les jours (cible)**

```text
jours_restants = jours calendaires Douala de demain → paid_until (ou selon BILLING_PERIOD_SPEC)
jours_période  = longueur du mois courant d’anchor
```

Noter dans le log QA : date du test, `paid_until`, montant quote, montant payment.

**Pass today:** amount = plein × delta ; anchor fixe.  
**Pass target (après ship):** amount = formule ; même ancre.

### P4 — Mid-period +1 siège, peu de jours restants (B2)

```sql
UPDATE center_subscriptions
   SET paid_until = (now() AT TIME ZONE 'Africa/Douala')::date + 3
 WHERE center_id = '<center_id>';
```

Puis `{"seats": 11}`.

| Aujourd’hui | Cible |
|-------------|--------|
| HT = 4500 | Souvent **MIN_CHARGE** (ex. 1 000) car 4500 × 3/31 ≈ 435 < frais |

**SKIP** tant que B2 n’est pas fixé.

### P5 — Mid-period shrink

- `{"seats": 8}` avec 10+ payés → souvent `SEATS_BELOW_MINIMUM` (floor contrat 10 d’abord).
- Pour viser le floor **payé** : tenir 16, demander `{"seats": 12}`.

| Attendu | `400` / `SEATS_BELOW_PAID_FLOOR` (requiredSeatsTotal = sièges déjà payés) |
|---------|--------------------------------------------------------------------------|

### P6 — NOTHING_TO_PAY

`{"seats": 10}` alors que déjà 10 payés mid-period.

| Attendu | `400` / `NOTHING_TO_PAY` |

### P7 — Pay après BLOCKED

```sql
UPDATE center_subscriptions
   SET paid_until = now() - interval '10 days'
 WHERE center_id = '<center_id>';
```

| Attendu | Facture **pack entier** ; **nouvel** `anchor_day` = jour du paiement ; période repart de ce jour |

### P8 — Fiabilité (toujours)

| Cas | Attendu |
|-----|---------|
| Même `Idempotency-Key` + même body | Même payment, pas de double charge |
| Webhook SUCCEEDED × 2 | `ALREADY_ACTIVE`, sièges non doublés |
| Webhook FAILED | Pas de sièges |
| Quote puis create | Montants alignés (après prorata ship : figer jours sur le payment) |

---

## 4. Ordre recommandé (~60–90 min)

1. P1 Trial → Start 10 (plein mois)  
2. P3 Mid-period `seats: 16` — noter montant **today**  
3. P5 Shrink refusé  
4. P6 NOTHING_TO_PAY  
5. P2 ou P7 (grâce / blocked) selon le temps  
6. P8 Failed + duplicate webhook  
7. P4 SKIP jusqu’à B2  

Ne pas re-tester Prep Pass / Elena ici sauf régression.

---

## 5. Results log

| Case | Tester | Date | Today | Target | Notes (amounts, paid_until) |
|------|--------|------|-------|--------|------------------------------|
| P1 First Start | Auto (agent) | 2026-10-16 | **PASS** | n/a | Center `prorata.qa+20261016080056@lerniqo.test`. Amount TTC **53100**. `ACTIVE`, seats 10, `paidUntil` **2026-11-15T23:00:00.000Z** (anchor ~16 Douala → next month). Full pack, not calendar prorata. |
| P2 Renewal / grace | | | SKIP | n/a | Not run this session |
| P3 Mid +N | Auto (agent) | 2026-10-16 | **PASS** | SKIP (formule non shippée) | `seats:16` → payment **amountXaf 31860** (= 6×4500×1.18). `paidUntil` **unchanged**. seatsHeld **16**. Note: quote returned 84960 (16× plein) while payment billed delta only. |
| P4 Min charge | | | SKIP | | B2 open |
| P5 Shrink | Auto (agent) | 2026-10-16 | **PASS** | n/a | `seats:8` → `SEATS_BELOW_MINIMUM`; `seats:12` with 16 held → `SEATS_BELOW_PAID_FLOOR` |
| P6 Nothing to pay | Auto (agent) | 2026-10-16 | **PASS** | n/a | `seats:16` mid-period → `NOTHING_TO_PAY` |
| P7 Blocked re-entry | | | SKIP | n/a | |
| P8 Idempotency / webhooks | Auto (agent) | 2026-10-16 | **PASS** | n/a | Duplicate SUCCEEDED → `ALREADY_ACTIVE` |

**OK pour client qui ne fait qu’un 1er Start ?** Oui si P1 + P8 PASS. → **Oui (cette session).**  
**OK pour promettre le prorata mid-period ?** Non tant que P3 Target ≠ PASS et B2 ouvert. → **Non** (today = plein × delta).

---

## 6. Lien commercial (semaine prochaine)

Client finit trial ≈ **19** → **P1** : plein pack, anchor 19.  
Le prorata n’apparaît que s’il **ajoute** des sièges avant le prochain 19 → **P3**.
