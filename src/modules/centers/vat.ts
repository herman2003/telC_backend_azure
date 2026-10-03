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
  return amountWithVatXaf(htXaf) - Math.max(0, Math.floor(htXaf));
}
