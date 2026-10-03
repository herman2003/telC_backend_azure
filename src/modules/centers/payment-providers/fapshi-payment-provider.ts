import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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
  FAPSHI_WEBHOOK_SECRET_HEADER,
  fapshiExtractCheckoutLink,
  fapshiExtractTransId,
  fapshiExtractTransIdFromResponse,
  fapshiMapStatus,
  fapshiVerifyWebhookSecret,
  type FapshiWebhookPayload,
} from './fapshi.util';

export { FAPSHI_WEBHOOK_SECRET_HEADER } from './fapshi.util';

export interface FapshiProviderConfig {
  apiUser: string;
  apiKey: string;
  webhookSecret: string;
  /** Defaults to https://sandbox.fapshi.com */
  baseUrl?: string;
  /** Where Fapshi redirects the payer after checkout. */
  redirectUrl: string;
}

export type FapshiHttpPost = (params: {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}) => Promise<{ status: number; data: unknown }>;

/** Cap so a hung Fapshi never leaves the checkout request open forever. */
export const FAPSHI_HTTP_TIMEOUT_MS = 15_000;

const defaultHttpPost: FapshiHttpPost = async ({ url, body, headers }) => {
  try {
    const response = await axios.post(url, body, {
      headers,
      timeout: FAPSHI_HTTP_TIMEOUT_MS,
      validateStatus: () => true,
    });
    return { status: response.status, data: response.data };
  } catch {
    // Never rethrow AxiosError: its .config.headers still holds apiuser/apikey,
    // and APM tools (e.g. New Relic) serialize whole error objects.
    throw new BadRequestException('PAYMENT_CHECKOUT_FAILED');
  }
};

/**
 * Fapshi Collect for Orange Money / MTN Mobile Money (hosted initiate-pay).
 * Same two-method seam as Stripe: open a checkout, prove a webhook genuine.
 * Never writes seats or subscriptions.
 */
export class FapshiPaymentProvider implements PaymentProvider {
  readonly name = 'fapshi';

  private readonly baseUrl: string;
  private readonly httpPost: FapshiHttpPost;

  constructor(
    private readonly config: FapshiProviderConfig,
    httpPost: FapshiHttpPost = defaultHttpPost,
  ) {
    this.baseUrl =
      config.baseUrl?.trim().replace(/\/$/, '') || 'https://sandbox.fapshi.com';
    this.httpPost = httpPost;
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    // externalId reconciles in the Fapshi dashboard; provider_reference stores
    // Fapshi's transId so the webhook can find the payment row.
    const payload: Record<string, unknown> = {
      amount: request.amountXaf,
      externalId: request.paymentId,
      redirectUrl: this.config.redirectUrl,
      message: `Lerniqo payment ${request.paymentId}`,
    };

    const email = request.customerEmail?.trim();
    if (email) {
      payload.email = email;
    }

    const userId = request.centerId?.trim();
    if (userId && /^[a-zA-Z0-9\-_]{1,100}$/.test(userId)) {
      payload.userId = userId;
    }

    let response: { status: number; data: unknown };
    try {
      response = await this.httpPost({
        url: `${this.baseUrl}/initiate-pay`,
        body: payload,
        headers: {
          apiuser: this.config.apiUser,
          apikey: this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      // Injected transports (and Axios) must not leak credentials upward.
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('PAYMENT_CHECKOUT_FAILED');
    }

    const checkoutUrl = fapshiExtractCheckoutLink(response.data);
    const transId = fapshiExtractTransIdFromResponse(response.data);
    if (!checkoutUrl || !transId || response.status >= 400) {
      throw new BadRequestException('PAYMENT_CHECKOUT_FAILED');
    }

    return {
      providerReference: transId,
      checkoutUrl,
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: WebhookHeaders,
  ): Promise<VerifiedPaymentEvent> {
    // Executor form so a sync throw from verify becomes a rejection (Jest
    // `rejects.*` and Nest exception filters both need a rejected Promise).
    return new Promise((resolve) => resolve(this.verify(rawBody, headers)));
  }

  private verify(
    rawBody: Buffer,
    headers: WebhookHeaders,
  ): VerifiedPaymentEvent {
    const header = headers[FAPSHI_WEBHOOK_SECRET_HEADER];
    const presented = Array.isArray(header) ? header[0] : header;

    if (
      !fapshiVerifyWebhookSecret({
        presented,
        expected: this.config.webhookSecret,
      })
    ) {
      throw new UnauthorizedException('WEBHOOK_SIGNATURE_INVALID');
    }

    let payload: FapshiWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as FapshiWebhookPayload;
    } catch {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    const providerReference = fapshiExtractTransId(payload);
    if (!providerReference) {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    const status =
      typeof payload.status === 'string' ? payload.status : undefined;
    const outcome = this.resolveOutcome(status);
    if (!outcome) {
      throw new BadRequestException('WEBHOOK_PAYLOAD_INVALID');
    }

    return { providerReference, outcome };
  }

  private resolveOutcome(
    status: string | undefined,
  ): VerifiedOutcome | null {
    const mapped = fapshiMapStatus(status);
    if (mapped === 'SUCCEEDED') return 'SUCCEEDED';
    if (mapped === 'FAILED') return 'FAILED';
    return null;
  }
}
