import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CenterAccessTokenPayload } from '../../shared/interfaces/token-payload.interface';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  CLIENT_PAYMENT_METHODS,
  PAYMENT_PROVIDER_REGISTRY,
  PaymentProviderRegistry,
  type PaymentMethodKind,
} from './payment-providers/payment-provider-registry';

type SignedCenterIdentity = Pick<CenterAccessTokenPayload, 'centerId'>;

export interface StartedCheckout {
  paymentId: string;
  /** Kept server-side by the controller; returned here for callers that need it. */
  providerReference: string;
  /** Which method was used: notchpay (Mobile Money) or stripe (card). */
  provider: string;
  checkoutUrl: string;
}

/**
 * Sends a center to pay for a payment it has already created.
 *
 * Its own service rather than a method on `PaymentsService`: creating a
 * payment prices it and grants nothing, while starting a checkout talks to the
 * outside world. Keeping them apart also keeps the provider out of the
 * creation path, which must keep working when no provider is configured.
 *
 * Notch (Orange / MTN via Collect) and Stripe (card) are different methods —
 * the center picks one; both can be configured at once.
 */
@Injectable()
export class PaymentCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_REGISTRY)
    private readonly registry: PaymentProviderRegistry,
  ) {}

  /**
   * Opens a checkout for a pending payment, once, with the chosen method.
   *
   * ONE PROVIDER TRANSACTION PER PAYMENT. The first checkout stores the
   * provider's reference, method name and URL; any later one returns what was
   * stored without asking the provider again.
   */
  async startCheckout(
    identity: SignedCenterIdentity,
    paymentId: string,
    method: PaymentMethodKind | 'fake',
  ): Promise<StartedCheckout> {
    if (method !== 'fake' && !CLIENT_PAYMENT_METHODS.includes(method)) {
      throw new BadRequestException('PAYMENT_METHOD_INVALID');
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, center_id: identity.centerId },
      select: {
        status: true,
        amount_xaf: true,
        provider_reference: true,
        checkout_url: true,
        provider: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }

    if (payment.status !== 'PENDING') {
      throw new ConflictException('PAYMENT_NOT_PENDING');
    }

    if (payment.provider_reference && payment.checkout_url) {
      // Already opened — ignore a different method on retry; the stored
      // session is the one that can be paid.
      return {
        paymentId,
        providerReference: payment.provider_reference,
        provider: payment.provider ?? method,
        checkoutUrl: payment.checkout_url,
      };
    }

    const provider = this.registry.require(method);

    const manager = await this.prisma.centerUser.findFirst({
      where: { center_id: identity.centerId },
      orderBy: { created_at: 'asc' },
      select: { email: true, phone: true },
    });
    const center = await this.prisma.center.findUnique({
      where: { id: identity.centerId },
      select: { name: true },
    });

    const session = await provider.createCheckout({
      paymentId,
      centerId: identity.centerId,
      amountXaf: payment.amount_xaf,
      customerEmail: manager?.email,
      customerPhone: manager?.phone ?? undefined,
      customerName: center?.name,
    });

    const stored = await this.prisma.payment.updateMany({
      where: { id: paymentId, provider_reference: null },
      data: {
        provider_reference: session.providerReference,
        checkout_url: session.checkoutUrl,
        provider: method,
      },
    });

    if (stored.count === 1) {
      return { paymentId, provider: method, ...session };
    }

    const winner = await this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: {
        provider_reference: true,
        checkout_url: true,
        provider: true,
      },
    });

    if (!winner.provider_reference || !winner.checkout_url) {
      throw new ConflictException('CHECKOUT_IN_PROGRESS');
    }

    return {
      paymentId,
      providerReference: winner.provider_reference,
      provider: winner.provider ?? method,
      checkoutUrl: winner.checkout_url,
    };
  }
}
