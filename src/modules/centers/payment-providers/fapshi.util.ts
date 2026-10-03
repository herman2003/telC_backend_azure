import { timingSafeEqual } from 'crypto';

/**
 * Pure Fapshi helpers: webhook secret check, status mapping, payload extraction.
 * No Prisma, no Nest — easy to unit-test in isolation.
 */

export const FAPSHI_WEBHOOK_SECRET_HEADER = 'x-wh-secret';

export type FapshiWebhookPayload = {
  transId?: unknown;
  status?: unknown;
  externalId?: unknown;
  amount?: unknown;
  medium?: unknown;
};

export function fapshiVerifyWebhookSecret(params: {
  presented: string | undefined;
  expected: string;
}): boolean {
  const received = (params.presented ?? '').trim();
  const expected = params.expected.trim();
  if (received.length === 0 || expected.length === 0) {
    return false;
  }
  if (received.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export function fapshiMapStatus(
  input: string | null | undefined,
): 'SUCCEEDED' | 'FAILED' | 'PENDING' {
  const status = (input ?? '').trim().toUpperCase();
  if (status === 'SUCCESSFUL') return 'SUCCEEDED';
  if (status === 'FAILED' || status === 'EXPIRED') return 'FAILED';
  return 'PENDING';
}

export function fapshiExtractTransId(
  payload: FapshiWebhookPayload,
): string | null {
  if (typeof payload.transId === 'string' && payload.transId.trim().length > 0) {
    return payload.transId.trim();
  }
  return null;
}

export function fapshiExtractCheckoutLink(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const link = (data as Record<string, unknown>).link;
  if (typeof link === 'string' && link.trim().length > 0) {
    return link.trim();
  }
  return null;
}

export function fapshiExtractTransIdFromResponse(
  data: unknown,
): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const transId = (data as Record<string, unknown>).transId;
  if (typeof transId === 'string' && transId.trim().length > 0) {
    return transId.trim();
  }
  return null;
}
