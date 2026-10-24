# ADR 0004 — Abonnement utilisateur indépendant (B19) différé

**Statut :** accepted (différé)  
**Date :** 2026-10-17  
**Contexte produit :** Lerniqo prépare aux examens de langue ; aujourd’hui seuls
les **centres** paient (sièges Start). Le produit **ne gère pas encore** les
apprenants indépendants.

## Décision

Ne **pas** implémenter B19 dans NestJS tant que le produit n’expose pas le
parcours indépendant. Documenter le design cible pour reprise ultérieure.

## Prix

- **4 500 XAF** / mois (aligné sur Start HT des centres, pas 4 800).
- Constantes centres actuelles : `START_PRICE_XAF = 4_500` —
  `src/modules/centers/pricing.service.ts`.

## Design cible (MVP Stripe, quand le produit sera prêt)

1. **Catalogue Stripe (test puis live)**  
   - Product : `Lerniqo Individuel`  
   - Price : mensuel `4500` XAF (`recurring.interval = month`)

2. **Checkout**  
   - `mode: 'subscription'`  
   - Pas de `payment_method_types` (méthodes dynamiques Dashboard)  
   - Webhooks obligatoires :  
     `checkout.session.completed`,  
     `customer.subscription.created|updated|deleted`,  
     `invoice.paid`, `invoice.payment_failed`,  
     et risques (`charge.dispute.created`, `charge.refunded`,
     `radar.early_fraud_warning.created`) avant prod.

3. **Customer Portal**  
   - Changements de moyen de paiement / annulation self-serve.

4. **Entitlement app**  
   - Étendre `StudentEntitlementService` / `StudentSubscriptionGuard` pour un
     étudiant **sans** `center_id` dont l’accès dépend d’un abo Stripe actif
     (état local dérivé des webhooks, pas de la success URL).

5. **Factures**  
   - Facture client Lerniqo : même principe que D27 (`INV-YYYY-NNNN`) côté
     produit.  
   - Facture Stripe Billing : artefact Stripe **à part**, non source de vérité
     UI.

## Hors scope jusqu’à activation produit

- Essai, grâce, annuel, Apple/Google IAP  
- Règles « rejoint un centre plus tard »  
- Migration des sièges centres vers Stripe Subscriptions

## Conséquences

- Le travail Stripe actuel reste **Payments Checkout `mode: payment`** pour les
  centres.  
- Aucun endpoint étudiant-billing dans cette passe.  
- Quand le produit active les indépendants, reprendre cet ADR +
  `docs/guides/stripe-local.md`.

## Références

- D35 / B19 — `docs/contracts/center-dashboard-sync.md`  
- D27 factures — numéros `INV-YYYY-NNNN`  
- Stripe Billing best practices — `.agents/skills/stripe-best-practices`

---

*Ce document a été créé avec Cursor (IA).*
