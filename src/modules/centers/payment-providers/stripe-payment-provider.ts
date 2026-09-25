import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import Stripe from 'stripe';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  VerifiedPaymentEvent,
  WebhookHeaders,
} from './payment-provider';

/** Express lower-cases incoming header names. */
export const STRIPE_SIGNATURE_HEADER = 'stripe-signature';

export interface StripeProviderConfig {
  secretKey: string;
  webhookSecret: string;
  successUrl: string;
  cancelUrl: string;
}

export type StripeClientFactory = (secretKey: string) => Stripe;

const defaultClientFactory: StripeClientFactory = (secretKey) =>
  new Stripe(secretKey, {
    apiVersion: '2025-02-24.acacia',
    typescript: true,
  });

/**
 * Stripe Checkout for card payments (D35: mobile + web card).
 * Same two-method seam as Notch/fake: open a session, verify a webhook.
 * Never writes seats or subscriptions.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';

  private readonly stripe: Stripe;

  constructor(
    private readonly config: StripeProviderConfig,
    createClient: StripeClientFactory = defaultClientFactory,
  ) {
    this.stripe = createClient(config.secretKey);
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const email = request.customerEmail?.trim();

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: this.withSessionPlaceholder(this.config.successUrl),
      cancel_url: this.config.cancelUrl,
      client_reference_id: request.paymentId,
      customer_email: email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'xaf',
            unit_amount: request.amountXaf,
            product_data: {
              name: `Lerniqo seats — payment ${request.paymentId}`,
            },
          },
        },
      ],
      metadata: {
        paymentId: request.paymentId,
        centerId: request.centerId,
      },
      payment_intent_data: {
        metadata: {
          paymentId: request.paymentId,
          centerId: request.centerId,
        },
      },
    });

    if (!session.url || !session.id) {
      throw new BadRequestException('PAYMENT_CHECKOUT_FAILED');
    }

    return {
      providerReference: session.id,
      checkoutUrl: session.url,
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: WebhookHeaders,
  ): Promise<VerifiedPaymentEvent> {
    return new Promise((resolve) => resolve(this.verify(rawBody, headers)));
  }

  private verify(
    rawBody: Buffer,
    headers: WebhookHeaders,
  ): VerifiedPaymentEvent {
    const header = headers[STRIPE_SIGNATURE_HEADER];
    const signature = Array.isArray(header) ? header[0] : header;

    if (!signature) {
      throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.config.webhookSecret,
      );
    } catch {
      throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
    }

    return this.mapEvent(event);
  }

  private mapEvent(event: Stripe.Event): VerifiedPaymentEvent {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (!session.id) {
          throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
        }
        // unpaid / no_payment_required with incomplete money must not activate
        if (session.payment_status === 'unpaid' && session.mode === 'payment') {
          throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
        }
        return {
          providerReference: session.id,
          outcome: 'SUCCEEDED',
        };
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        if (!session.id) {
          throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
        }
        return { providerReference: session.id, outcome: 'SUCCEEDED' };
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = event.data.object;
        if (!session.id) {
          throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
        }
        return { providerReference: session.id, outcome: 'FAILED' };
      }
      default:
        throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }
  }

  private withSessionPlaceholder(url: string): string {
    if (url.includes('{CHECKOUT_SESSION_ID}')) {
      return url;
    }
    const join = url.includes('?') ? '&' : '?';
    return `${url}${join}session_id={CHECKOUT_SESSION_ID}`;
  }
}
