import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Pure Notch Pay helpers, ported from afroschool-backend's notchpay.util.
 * Signature, status mapping and reference extraction only — no Prisma, no Nest.
 */

export type NotchPayWebhookEvent = {
  id?: string;
  name?: string;
  type?: string;
  data?: Record<string, unknown>;
  payload?: {
    event?: string;
    data?: Record<string, unknown>;
    id?: string;
  };
};

export const NOTCHPAY_SIGNATURE_HEADER = 'x-notch-signature';

export function notchPayVerifySignature(params: {
  rawPayload: string;
  signature: string;
  hashKey: string;
}): boolean {
  const computed = createHmac('sha256', params.hashKey)
    .update(params.rawPayload)
    .digest('hex');

  const received = params.signature.trim().toLowerCase();
  const expected = computed.trim().toLowerCase();
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function notchPayNormalizePaymentStatus(
  input: string | null | undefined,
): 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PENDING' {
  const status = (input ?? '').trim().toLowerCase();
  if (
    ['complete', 'completed', 'succeeded', 'success', 'paid'].includes(status)
  ) {
    return 'SUCCEEDED';
  }
  if (['failed', 'declined', 'error'].includes(status)) {
    return 'FAILED';
  }
  if (['canceled', 'cancelled', 'expired'].includes(status)) {
    return 'CANCELLED';
  }
  return 'PENDING';
}

export function notchPayMapEventTypeToStatus(
  eventType: string | null | undefined,
): 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'PENDING' {
  const type = (eventType ?? '').trim().toLowerCase();
  if (type === 'payment.complete') return 'SUCCEEDED';
  if (type === 'payment.failed') return 'FAILED';
  if (type === 'payment.canceled' || type === 'payment.cancelled') {
    return 'CANCELLED';
  }
  if (type === 'payment.expired') return 'CANCELLED';
  return 'PENDING';
}

export function notchPayExtractEventType(
  event: NotchPayWebhookEvent,
): string | null {
  const nested = event.payload?.event;
  if (typeof nested === 'string' && nested.trim().length > 0) {
    return nested.trim();
  }
  if (typeof event.name === 'string' && event.name.trim().length > 0) {
    return event.name.trim();
  }
  if (typeof event.type === 'string' && event.type.trim().length > 0) {
    return event.type.trim();
  }
  return null;
}

export function notchPayExtractProviderStatus(
  event: NotchPayWebhookEvent,
): string | null {
  const nestedStatus = event.payload?.data?.status;
  if (typeof nestedStatus === 'string' && nestedStatus.trim().length > 0) {
    return nestedStatus.trim();
  }
  const rootStatus = event.data?.status;
  if (typeof rootStatus === 'string' && rootStatus.trim().length > 0) {
    return rootStatus.trim();
  }
  return null;
}

/**
 * Reference we store on `payments.provider_reference` is the merchant
 * reference we sent to Notch (`paymentId`). Prefer that over Notch's own
 * transaction id so the webhook can find the payment with a single column.
 */
export function notchPayExtractMerchantReference(
  event: NotchPayWebhookEvent,
): string | null {
  const payloadData = event.payload?.data ?? {};

  const merchantReference = payloadData.merchant_reference;
  if (
    typeof merchantReference === 'string' &&
    merchantReference.trim().length > 0
  ) {
    return merchantReference.trim();
  }

  const payloadReference = payloadData.reference;
  if (
    typeof payloadReference === 'string' &&
    payloadReference.trim().length > 0
  ) {
    return payloadReference.trim();
  }

  const trxref = payloadData.trxref;
  if (typeof trxref === 'string' && trxref.trim().length > 0) {
    return trxref.trim();
  }

  const data = event.data ?? {};
  const reference = data.reference;
  if (typeof reference === 'string' && reference.trim().length > 0) {
    return reference.trim();
  }
  const id = data.id;
  if (typeof id === 'string' && id.trim().length > 0) {
    return id.trim();
  }
  return null;
}

export function notchPayExtractCheckoutUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const d = data as Record<string, unknown>;
  for (const key of [
    'authorization_url',
    'authorizationUrl',
    'checkout_url',
    'payment_url',
  ]) {
    const value = d[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export function signNotchPayWebhook(hashKey: string, rawBody: Buffer): string {
  return createHmac('sha256', hashKey).update(rawBody).digest('hex');
}
