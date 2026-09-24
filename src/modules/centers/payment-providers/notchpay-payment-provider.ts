import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import axios from 'axios';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentProvider,
  VerifiedOutcome,
  VerifiedPaymentEvent,
  WebhookHeaders,
} from './payment-provider';
import {
  NOTCHPAY_SIGNATURE_HEADER,
  notchPayExtractCheckoutUrl,
  notchPayExtractEventType,
  notchPayExtractMerchantReference,
  notchPayExtractProviderStatus,
  notchPayMapEventTypeToStatus,
  notchPayNormalizePaymentStatus,
  notchPayVerifySignature,
  type NotchPayWebhookEvent,
} from './notchpay.util';

export { NOTCHPAY_SIGNATURE_HEADER, signNotchPayWebhook } from './notchpay.util';

export interface NotchPayProviderConfig {
  publicKey: string;
  /** Optional. Sent as X-Grant when present (same as afroschool). */
  privateKey?: string;
  webhookSecret: string;
  /** Defaults to https://api.notchpay.co */
  baseUrl?: string;
  /** Where Notch redirects the payer after checkout. */
  callbackUrl: string;
}

export type NotchPayHttpPost = (params: {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}) => Promise<{ status: number; data: unknown }>;

const defaultHttpPost: NotchPayHttpPost = async ({ url, body, headers }) => {
  const response = await axios.post(url, body, {
    headers,
    validateStatus: () => true,
  });
  return { status: response.status, data: response.data };
};

/**
 * Real Notch Pay provider for center seat payments (Orange Money / MTN via
 * Notch Collect). Implements the same two-method seam as the fake: open a
 * checkout, prove a webhook genuine. Never writes seats or subscriptions.
 */
export class NotchPayProvider implements PaymentProvider {
  readonly name = 'notchpay';

  private readonly baseUrl: string;
  private readonly httpPost: NotchPayHttpPost;

  constructor(
    private readonly config: NotchPayProviderConfig,
    httpPost: NotchPayHttpPost = defaultHttpPost,
  ) {
    this.baseUrl = (
      config.baseUrl?.trim().replace(/\/$/, '') || 'https://api.notchpay.co'
    );
    this.httpPost = httpPost;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    const email = request.customerEmail?.trim();
    if (!email) {
      throw new BadRequestException('PAYMENT_CUSTOMER_EMAIL_REQUIRED');
    }

    // Merchant reference = our payment id. Stored as provider_reference so the
    // webhook can find the row without a second lookup table.
    const merchantReference = request.paymentId;

    const payload: Record<string, unknown> = {
      amount: request.amountXaf,
      currency: 'XAF',
      reference: merchantReference,
      callback: this.config.callbackUrl,
      description: `Lerniqo seats — payment ${merchantReference}`,
      customer: {
        email,
        ...(request.customerName?.trim()
          ? { name: request.customerName.trim() }
          : {}),
        ...(request.customerPhone?.trim()
          ? { phone: request.customerPhone.trim() }
          : {}),
      },
    };

    const headers: Record<string, string> = {
      Authorization: this.config.publicKey,
      'Content-Type': 'application/json',
    };
    if (this.config.privateKey?.trim()) {
      headers['X-Grant'] = this.config.privateKey.trim();
    }

    const response = await this.httpPost({
      url: `${this.baseUrl}/payments`,
      body: payload,
      headers,
    });

    const checkoutUrl = notchPayExtractCheckoutUrl(response.data);
    if (!checkoutUrl || response.status >= 400) {
      throw new BadRequestException('PAYMENT_CHECKOUT_FAILED');
    }

    return {
      providerReference: merchantReference,
      checkoutUrl,
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
    const header = headers[NOTCHPAY_SIGNATURE_HEADER];
    const presented = Array.isArray(header) ? header[0] : header;

    if (
      !presented ||
      !notchPayVerifySignature({
        rawPayload: rawBody.toString('utf8'),
        signature: presented,
        hashKey: this.config.webhookSecret,
      })
    ) {
      throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
    }

    let event: NotchPayWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as NotchPayWebhookEvent;
    } catch {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    const providerReference = notchPayExtractMerchantReference(event);
    if (!providerReference) {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    const outcome = this.resolveOutcome(event);
    if (!outcome) {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    return { providerReference, outcome };
  }

  /**
   * Maps Notch event type / status to our binary outcome. Pending and unknown
   * states are refused — never treated as success.
   */
  private resolveOutcome(event: NotchPayWebhookEvent): VerifiedOutcome | null {
    let status = notchPayMapEventTypeToStatus(
      notchPayExtractEventType(event),
    );
    if (status === 'PENDING') {
      status = notchPayNormalizePaymentStatus(
        notchPayExtractProviderStatus(event),
      );
    }

    if (status === 'SUCCEEDED') return 'SUCCEEDED';
    if (status === 'FAILED' || status === 'CANCELLED') return 'FAILED';
    return null;
  }
}
