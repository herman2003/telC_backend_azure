# Prod-ready smoke — Start, essai 14j, add-ons, dashboard

Checklist pour vérifier que les parcours monétisation sont **utilisables sans erreur** avant d’ouvrir aux centres. Alignée sur [OFFRES_LERNIQO.md](./OFFRES_LERNIQO.md).

**Dernière exécution (2026-10-15)**

| Suite | Résultat |
|-------|----------|
| Unit (trial / subscription / payment / entitlements) | **214 passed** |
| Integration (payment / entitlement / subscription) | **194 passed** |
| Smoke manuel Bruno (trial → Start → Prep Pass → Elena → Exam Day) | **Passed** |
| Paiement réel (confirmé produit) | **Working** |

Commandes :

```bash
npm test -- --testPathPatterns="center-trial|subscription-policy|subscription-access|subscription-enforcement|payment-activation|payment-checkout|payment-flow|entitlement-purchase|entitlement-spend|entitlements|billing-period|center-subscription|payment-providers|payments-replay|my-entitlements|auth-subscription|student-subscription"

npm run test:integration -- --testPathPatterns="payment|entitlement|subscription|billing|center-trial"
```

---

## Prérequis staging

1. API sur `baseUrl` (Bruno `environments/local.bru` → `http://localhost:3001` ou URL staging).
2. DB de test / staging — **jamais** la prod pour les SQL de block/restore.
3. Paiements locaux : `PAYMENT_PROVIDER=fake` + `FAKE_PAYMENT_WEBHOOK_SECRET` (≥32 chars, même valeur que `fakeWebhookSecret` Bruno).
4. Staging réel : Stripe + Fapshi en **test mode**, webhooks pointant vers staging.
5. Profil centre completable avant paiement : `country`, `city`, `phone` (trial OK sans ; payment refuse).

---

## Matrice smoke (9 scénarios)

Cocher **API** + **dashboard centre** + **élève** à chaque ligne.

### 1. Onboarding

| Étape | Attendu |
|-------|---------|
| Register → verify email → login | 200 / tokens |
| Profil incomplet | trial OK |
| Payment sans country/city/phone | **refusé** (profil incomplet) |
| Patch profil complet | payment possible |

Bruno : `Center Auth/*`, `Center Profile/*`, puis `Center Subscription / 03 Start trial`.

### 2. Essai 14 jours

| Étape | Attendu |
|-------|---------|
| `POST /api/centers/me/trial` | **201**, `trialEndsAt` ≈ now+14j, **1** code daté |
| `GET …/subscription` | `status: TRIAL`, `studentsMayLearn: true` |
| 2ᵉ `POST …/trial` | **409** `TRIAL_ALREADY_USED` |
| Élève activate + learn | 200 |

Bruno : `Center Subscription / 03 Start trial` → provision/activate → `Subscription Access / 02 Learn`.

> Le clock démarre au **bouton** `POST …/trial`, pas à la première activation élève.

### 3. Fin d’essai (pas de grâce)

```sql
UPDATE center_subscriptions
   SET trial_ends_at = now() - interval '1 hour'
 WHERE center_id = '<id>';
```

| Acteur | Attendu |
|--------|---------|
| Élève learn | **403** (subscription inactive) |
| Dashboard | `BLOCKED` / unpaid |
| Quote + create payment | encore accessibles |

### 4. Achat Start (≥10 sièges)

| Étape | Attendu |
|-------|---------|
| `POST …/subscription/quote` `{"seats":10}` | unit 4500 HT, total TTC = HT×1.18 |
| `POST /api/payments` + `Idempotency-Key` | PENDING, amount cohérent |
| Checkout `fapshi` ou `stripe` (staging) / fake (local) | `checkoutUrl` |
| Webhook SUCCEEDED | `ACTIVE`, `paid_until` posé, codes mintés (`expires_at` null) |
| Code trial daté | retiré / élève passé sur code payé |

Bruno : `Center Payments / 01–06`. Double-envoi même clé → même `paymentId`. Double webhook → **une** activation.

### 5. Grâce 7 jours (après Start payé)

```sql
-- Grâce (learn encore OK)
UPDATE center_subscriptions SET paid_until = now() - interval '2 days' WHERE center_id = '<id>';
-- Blocked (après grâce)
UPDATE center_subscriptions SET paid_until = now() - interval '8 days' WHERE center_id = '<id>';
```

| État | Élève | Dashboard |
|------|-------|-----------|
| −2j | learn OK | `GRACE_PERIOD` (badge paid côté onboarding) |
| −8j | 403 | `BLOCKED` |

### 6. Add-ons launch

| Produit | Achat | Après webhook | Assign | Élève |
|---------|-------|---------------|--------|-------|
| **Mit Elena** `AI_SPEAKING_CREDIT` | qty crédits @ 300 HT | pool | cap sur code | spend session |
| **Prep Pass** `PREP_PASS` | qty @ 1000 HT | pool | grant **30 jours** | MT hors semaine OK |
| **Exam Day** slots | via payments slots | `exam_slots_remaining` | — | sitting OK |

Ne **pas** vendre / exposer en UI : Exam Day IA, AI Assisted Learning.

Bruno : `Center Entitlements / 01 Purchase add-on` (+ checkout + webhook + assign).

### 7. Freeze add-ons si Start lapses

1. Start BLOCKED (−8j).
2. Spend Elena / Prep Pass → **FROZEN** (pool intact).
3. Re-payer Start → pools dégelés, spend OK.

### 8. Idempotence & webhooks

| Cas | Attendu |
|-----|---------|
| Même `Idempotency-Key`, même body | même payment id |
| Même clé, body différent | **409** `IDEMPOTENCY_KEY_REUSED` |
| Webhook rejoué | `received: true`, une seule grant |
| Signature invalide | rejeté |

### 9. Dashboard centre bloqué

| Action | Attendu |
|--------|---------|
| Lire subscription / usage / payments | **200** |
| Provisionner nouveaux codes | **403** |
| Payer | possible |

Bruno : `Subscription Access / 05–06`.

---

## Go-live gate (avant vrais centres)

- [ ] Webhooks **live** Stripe + Fapshi enregistrés, signature vérifiée
- [ ] Secrets / price IDs sandbox **absents** de la config prod
- [ ] Prix = OFFRES : Start 4500, Elena 300, Prep Pass 1000, Exam Day 1000 (HT ; TTC = ×1.18)
- [ ] UI n’expose pas Exam Day IA / AI Assisted Learning
- [ ] Monitoring : erreurs webhook, paiements `PENDING` bloqués, mismatch `paid_until`
- [ ] 1 paiement réel contrôlé (montant min) puis annulation / remboursement
- [ ] Procédure kill : désactiver checkout / provider sans redeploy long

**Période Start / renouvellement / mid-period (+ prorata cible) :**  
→ [QA_BILLING_PERIOD_AND_PRORATA.md](./QA_BILLING_PERIOD_AND_PRORATA.md)

---

## Ordre d’exécution recommandé (staging, ~1–2 h)

1. Filet auto (`npm test` + `test:integration` ci-dessus).
2. Bruno : Auth → **Start trial** → Activate student → Learn.
3. Bruno Payments : quote → pay → checkout → webhook → re-lire subscription.
4. Bruno Entitlements : Prep Pass + Elena → assign → élève `/api/me/entitlements`.
5. SQL block/restore (grâce + freeze).
6. Période / mid-period : [QA_BILLING_PERIOD_AND_PRORATA.md](./QA_BILLING_PERIOD_AND_PRORATA.md) (P1 puis P3).
7. Cocher go-live gate avant prod.

---

## Sources méthode

- [Stripe Billing testing](https://docs.stripe.com/billing/testing)
- [Stripe Go-live checklist](https://docs.stripe.com/get-started/checklist/go-live)
- [SaaS billing checklist (Throttle)](https://usethrottle.dev/guides/saas-billing-checklist/)
