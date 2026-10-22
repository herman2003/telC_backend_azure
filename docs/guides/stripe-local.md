# Stripe — setup local Lerniqo (centres)

Paiements carte pour les **centres** (packs de sièges Start). Les factures
client restent **Lerniqo (D27)** ; Stripe n’est que le collecteur de paiement.

## Clés API (test)

Variables dans `.env` (jamais committer) :

| Variable | Rôle |
|----------|------|
| `STRIPE_SECRET_KEY` | `sk_test_…` ou mieux `rk_test_…` (RAK) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` (frontend / mobile) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (signature webhooks) |
| `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL` | Retours Checkout |
| `STRIPE_ALLOW_LIVE_KEYS` | `false` hors production |

### Rotation obligatoire si une clé a fuité

Si une `sk_test_` / `sk_live_` a été collée dans un chat, un ticket ou un
dépôt :

1. [Dashboard → API keys (test)](https://dashboard.stripe.com/test/apikeys) →
   **Roll key** sur la clé secrète exposée.
2. Remplacer `STRIPE_SECRET_KEY` (et publishable si besoin) dans `.env`.
3. Préférer ensuite une [clé restreinte (RAK)](https://docs.stripe.com/keys.md#manage-your-api-keys).
4. Vérifier les logs Workbench pour activité inattendue.

Ne jamais coller de secret dans un chat agent.

## Webhooks locaux

Le serveur écoute souvent sur `PORT` (ex. `3005`). Forward :

```bash
# Utiliser la clé du compte Lerniqo (pas un autre compte CLI par défaut)
export STRIPE_API_KEY="$(grep '^STRIPE_SECRET_KEY=' .env | cut -d= -f2-)"

stripe listen \
  --api-key "$STRIPE_API_KEY" \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired \
  --forward-to "127.0.0.1:${PORT:-3005}/api/webhooks/payments"
```

Utiliser `127.0.0.1` (pas `localhost`) pour éviter un refus IPv6
(`dial tcp [::1]:… connection refused`).

Copier le `whsec_…` affiché dans **`.env` et `.env.test`** →
`STRIPE_WEBHOOK_SECRET`, puis redémarrer Nest.

Important : `ConfigModule` charge `[.env.test, .env]` — la **première**
valeur gagne. Un vieux `whsec` dans `.env.test` écrase `.env` et produit
`401 WEBHOOK_SIGNATURE_INVALID`.

Endpoint applicatif : `POST /api/webhooks/payments`
(voir `stripe-payment-provider.ts`).

## Smoke Checkout sièges

1. Centre avec profil complet (`country`, `city`, `phone`).
2. `POST /api/payments` (Idempotency-Key) — serveur calcule le montant
   (Start **4 500 XAF HT**, TTC = ×1,18).
3. `POST /api/payments/:id/checkout` body `{ "provider": "stripe" }`.
4. Ouvrir `checkoutUrl`, carte test `4242 4242 4242 4242`.
5. Vérifier paiement `SUCCEEDED` + sièges / `paid_until`.

Prix code : `START_PRICE_XAF = 4_500` dans `src/modules/centers/pricing.service.ts`.

## Plugin / MCP Stripe (Cursor)

1. Installer le plugin : `/add-plugin stripe` ou
   [marketplace](https://cursor.com/marketplace/stripe).
2. Ou CLI : `stripe agent setup --client cursor -y`
3. Serveur MCP déjà ajoutable dans `~/.cursor/mcp.json` :

```json
"stripe": { "url": "https://mcp.stripe.com" }
```

4. Authentifier OAuth quand Cursor le demande (`mcp_auth` / popup Stripe).
5. Nouvelle session / recharger les outils.
6. Confirmer `stripe_implementation_planner`.

Sans MCP authentifié, les skills locaux
`.agents/skills/stripe-best-practices` (via
`npx skills add https://docs.stripe.com` ou `stripe agent setup`) restent
disponibles.

### Planner MCP (compte test Lerniqo)

Exécuté le 2026-10-17 sur `acct_1URTMhK72OlXC9tB` (test) :

- **Forme retenue :** Stripe Checkout **hosted** (web), `mode: payment` pour les
  centres.
- Factures client : **Lerniqo D27** (pas Stripe Invoicing comme source).
- B19 indépendants : différé (voir ADR 0004).

### Smoke centres vérifié

- Paiement 10 sièges : `unitPriceXaf=4500`, `amountXaf=53100` (TTC).
- Checkout `provider: stripe` → session `cs_test_…` en base.
- Webhook signé → `SUCCEEDED` / `ACTIVATED`.
- `stripe listen --forward-to 127.0.0.1:3005/api/webhooks/payments` + sync
  `whsec` dans **`.env` et `.env.test`**.

## Facturation

| Système | Rôle |
|---------|------|
| Lerniqo D27 (`INV-YYYY-NNNN`) | Facture métier centres (source de vérité) |
| Reçu / facture Stripe | Artefact Stripe éventuel, **à part** |

Ne pas activer `invoice_creation` Checkout pour remplacer D27.

---

*Ce document a été créé avec Cursor (IA).*
