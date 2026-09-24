import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  PaymentActivationService,
  type ActivationOutcome,
  type FailureResult,
} from './payment-activation.service';
import {
  PAYMENT_PROVIDER_REGISTRY,
  PaymentProviderRegistry,
} from './payment-providers/payment-provider-registry';
import type { WebhookHeaders } from './payment-providers/payment-provider';

export interface WebhookReceipt {
  received: true;
  outcome: ActivationOutcome | FailureResult['outcome'];
}

/**
 * Turns a provider's webhook into a settled payment, in a fixed order.
 *
 * 1. ROUTE by signature header (Stripe vs Notch vs fake) — both MM and card
 *    share this path.
 * 2. PROVE it. The provider verifies the signature over the raw bytes.
 * 3. FIND the payment by the provider's reference.
 * 4. SETTLE through PaymentActivationService.
 */
@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activation: PaymentActivationService,
    @Inject(PAYMENT_PROVIDER_REGISTRY)
    private readonly registry: PaymentProviderRegistry,
  ) {}

  async handle(
    rawBody: Buffer | undefined,
    headers: WebhookHeaders,
  ): Promise<WebhookReceipt> {
    if (!rawBody) {
      throw new BadRequestException('WEBHOOK_RAW_BODY_UNAVAILABLE');
    }

    const provider = this.registry.resolveFromWebhookHeaders(headers);
    const event = await provider.verifyWebhook(rawBody, headers);

    const payment = await this.prisma.payment.findUnique({
      where: { provider_reference: event.providerReference },
      select: { id: true },
    });

    if (!payment) {
      this.logger.warn(
        `Verified payment event for unknown reference ${event.providerReference}`,
      );
      throw new NotFoundException('PAYMENT_REFERENCE_UNKNOWN');
    }

    const result =
      event.outcome === 'SUCCEEDED'
        ? await this.activation.activate(payment.id)
        : await this.activation.markFailed(payment.id);

    return { received: true, outcome: result.outcome };
  }
}
