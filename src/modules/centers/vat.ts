/**
 * Cameroon VAT on center payments.
 *
 * Fapshi / Stripe take a single integer `amount` in XAF — no tax parameter.
 * Catalogue prices (seats, add-ons, exam slots) stay **HT**; the amount stored
 * on the payment and sent to the provider is **TTC** = HT × 1.18.
 */
export const VAT_RATE_PERCENT = 18;

/** TTC from an HT amount (XAF integers, no minor units). */
export function amountWithVatXaf(htXaf: number): number {
  if (!Number.isFinite(htXaf) || htXaf <= 0) return 0;
  return Math.round((htXaf * (100 + VAT_RATE_PERCENT)) / 100);
}

/** VAT portion of an HT amount. */
export function vatAmountXaf(htXaf: number): number {
  return amountWithVatXaf(htXaf) - netAmountXaf(htXaf);
}

/** The HT amount as it is stored: a whole number of XAF, never negative. */
function netAmountXaf(htXaf: number): number {
  if (!Number.isFinite(htXaf) || htXaf <= 0) return 0;
  return Math.floor(htXaf);
}

/**
 * The three amounts a payment row carries, from one HT figure.
 *
 * Together rather than one at a time, because the three have to agree:
 * `netXaf + vatXaf = grossXaf` exactly, with the rounding falling on the VAT
 * line. A caller that computed the gross here and the net somewhere else would
 * eventually store a pair that does not add up, and an invoice is the worst
 * place to discover it.
 *
 * `grossXaf` is what the provider is sent; the other two are what an invoice
 * shows underneath it (D27).
 */
export function splitVatXaf(htXaf: number): {
  netXaf: number;
  vatXaf: number;
  grossXaf: number;
} {
  const netXaf = netAmountXaf(htXaf);
  const grossXaf = amountWithVatXaf(htXaf);

  return { netXaf, vatXaf: grossXaf - netXaf, grossXaf };
}
