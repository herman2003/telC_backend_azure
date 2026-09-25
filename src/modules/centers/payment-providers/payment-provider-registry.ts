import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { FAKE_SIGNATURE_HEADER } from './fake-payment-provider';
import { NOTCHPAY_SIGNATURE_HEADER } from './notchpay.util';
import type { PaymentProvider, WebhookHeaders } from './payment-provider';
import { STRIPE_SIGNATURE_HEADER } from './stripe-payment-provider';

/** Injection token for the multi-provider registry (Notch + Stripe coexist). */
export const PAYMENT_PROVIDER_REGISTRY = Symbol('PAYMENT_PROVIDER_REGISTRY');

/**
 * Client-facing payment method kinds (D35).
 * - `notchpay` — Orange Money / MTN via Notch Collect
 * - `stripe` — card
 * `fake` is never accepted from a client; tests inject it directly.
 */
export type PaymentMethodKind = 'notchpay' | 'stripe';

export const CLIENT_PAYMENT_METHODS: readonly PaymentMethodKind[] = [
  'notchpay',
  'stripe',
] as const;

/**
 * Holds every configured provider at once. Notch (Mobile Money) and Stripe
 * (card) are different payment methods — both can be live together; the
 * center picks one at checkout, and the webhook routes by signature header.
 */
export class PaymentProviderRegistry {
  constructor(private readonly providers: Map<string, PaymentProvider>) {}

  has(name: string): boolean {
    return this.providers.has(name);
  }

  /** Configured provider names, stable order. */
  list(): string[] {
    return [...this.providers.keys()].sort();
  }

  /**
   * Returns the named provider, or 503 when that method is not configured.
   */
  require(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new ServiceUnavailableException('PAYMENT_PROVIDER_NOT_CONFIGURED');
    }
    return provider;
  }

  /**
   * Picks the provider from webhook signature headers.
   * Stripe, Notch and fake each use a distinct header — that is how two
   * live methods share one webhook path without a body peek before verify.
   */
  resolveFromWebhookHeaders(headers: WebhookHeaders): PaymentProvider {
    if (headerPresent(headers, STRIPE_SIGNATURE_HEADER)) {
      return this.require('stripe');
    }
    if (headerPresent(headers, NOTCHPAY_SIGNATURE_HEADER)) {
      return this.require('notchpay');
    }
    if (headerPresent(headers, FAKE_SIGNATURE_HEADER)) {
      return this.require('fake');
    }
    throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
  }
}

export function registryOf(
  ...providers: PaymentProvider[]
): PaymentProviderRegistry {
  return new PaymentProviderRegistry(
    new Map(providers.map((p) => [p.name, p])),
  );
}

function headerPresent(headers: WebhookHeaders, name: string): boolean {
  const value = headers[name];
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' && value[0].length > 0;
  }
  return typeof value === 'string' && value.length > 0;
}
