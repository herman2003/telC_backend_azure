import { DisabledPaymentProvider } from './disabled-payment-provider';
import { FakePaymentProvider } from './fake-payment-provider';
import { NotchPayProvider } from './notchpay-payment-provider';
import { PaymentProviderRegistry } from './payment-provider-registry';
import { StripePaymentProvider } from './stripe-payment-provider';

export {
  PaymentProviderRegistry,
  PAYMENT_PROVIDER_REGISTRY,
  registryOf,
  CLIENT_PAYMENT_METHODS,
  type PaymentMethodKind,
} from './payment-provider-registry';

/** @deprecated Prefer PAYMENT_PROVIDER_REGISTRY — kept for older test modules. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * The shortest fake webhook secret accepted. A short secret can be guessed,
 * and a guessed secret lets anyone forge "payment succeeded".
 */
export const MIN_FAKE_WEBHOOK_SECRET_LENGTH = 32;

export interface CheckoutRequest {
  paymentId: string;
  centerId: string;
  /** Computed by the server when the payment was created. Never a client value. */
  amountXaf: number;
  /** Required by Notch Pay; filled by PaymentCheckoutService from the manager. */
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
}

export interface CheckoutSession {
  /**
   * The provider's own id for this transaction. Stored on the payment and
   * unique there, so a webhook can find its payment and one provider
   * transaction can never be applied to two payments.
   */
  providerReference: string;
  /** Where the center is sent to pay. */
  checkoutUrl: string;
}

export type VerifiedOutcome = 'SUCCEEDED' | 'FAILED';

/** A webhook whose authenticity has been proven. Nothing else reaches activation. */
export interface VerifiedPaymentEvent {
  providerReference: string;
  outcome: VerifiedOutcome;
}

export type WebhookHeaders = Record<string, string | string[] | undefined>;

/**
 * What a payment provider has to do for Lerniqo, and nothing more.
 *
 * Deliberately two methods. A provider starts a checkout and proves a webhook
 * genuine; it never grants access. Turning a verified event into seats and
 * paid time is `PaymentActivationService`'s job alone, so a provider cannot
 * get grandfathering or exactly-once wrong — it never touches those tables.
 *
 * Implementations: `FakePaymentProvider`, `DisabledPaymentProvider`,
 * `NotchPayProvider` (Mobile Money), `StripePaymentProvider` (card).
 * Notch and Stripe coexist in {@link PaymentProviderRegistry}.
 */
export interface PaymentProvider {
  readonly name: string;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Proves the event came from the provider and returns what it says.
   *
   * `rawBody` is the exact bytes received. Signatures are computed over bytes,
   * and re-serialising parsed JSON does not reproduce them.
   */
  verifyWebhook(
    rawBody: Buffer,
    headers: WebhookHeaders,
  ): Promise<VerifiedPaymentEvent>;
}

export interface PaymentProviderSettings {
  /**
   * Enables the fake provider when set to `fake` (non-production only).
   * Does NOT choose between Notch and Stripe — those activate from their keys.
   */
  PAYMENT_PROVIDER?: string;
  NODE_ENV?: string;
  FAKE_PAYMENT_WEBHOOK_SECRET?: string;
  /** Notch Pay public key (Authorization header). */
  NOTCHPAY_PUBLIC_KEY?: string;
  /** Optional private key (X-Grant). */
  NOTCHPAY_PRIVATE_KEY?: string;
  /** Webhook HMAC hash key. */
  NOTCHPAY_WEBHOOK_SECRET?: string;
  /** Optional API base; defaults to https://api.notchpay.co */
  NOTCHPAY_BASE_URL?: string;
  /** Redirect URL after the payer finishes on Notch's page. */
  NOTCHPAY_CALLBACK_URL?: string;
  /** Stripe secret key (sk_test_… / sk_live_…). */
  STRIPE_SECRET_KEY?: string;
  /** Stripe webhook signing secret (whsec_…). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Redirect after successful Stripe Checkout. */
  STRIPE_SUCCESS_URL?: string;
  /** Redirect after cancelled Stripe Checkout. */
  STRIPE_CANCEL_URL?: string;
  /** Allow sk_live_ outside production (default: refuse). */
  STRIPE_ALLOW_LIVE_KEYS?: string;
}

function isTruthyFlag(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function assertStripeSecretKeySafe(
  apiKey: string,
  nodeEnv: string | undefined,
  allowLiveKeys: string | undefined,
): boolean {
  const env = (nodeEnv ?? '').trim().toLowerCase();
  if (env === 'production') return true;
  if (!apiKey.startsWith('sk_live')) return true;
  return isTruthyFlag(allowLiveKeys);
}

/**
 * Builds every configured provider. Notch (Mobile Money) and Stripe (card)
 * are independent: both register when their keys are present. The fake only
 * when explicitly asked, outside production.
 */
export function buildPaymentProviders(
  settings: PaymentProviderSettings,
): Map<string, PaymentProvider> {
  const map = new Map<string, PaymentProvider>();

  const fakeSecret = settings.FAKE_PAYMENT_WEBHOOK_SECRET ?? '';
  if (
    settings.PAYMENT_PROVIDER === 'fake' &&
    settings.NODE_ENV !== 'production' &&
    fakeSecret.length >= MIN_FAKE_WEBHOOK_SECRET_LENGTH
  ) {
    map.set('fake', new FakePaymentProvider(fakeSecret));
  }

  const publicKey = settings.NOTCHPAY_PUBLIC_KEY?.trim() ?? '';
  const notchWebhook = settings.NOTCHPAY_WEBHOOK_SECRET?.trim() ?? '';
  const callbackUrl = settings.NOTCHPAY_CALLBACK_URL?.trim() ?? '';
  if (
    publicKey.length > 0 &&
    notchWebhook.length > 0 &&
    callbackUrl.length > 0
  ) {
    map.set(
      'notchpay',
      new NotchPayProvider({
        publicKey,
        privateKey: settings.NOTCHPAY_PRIVATE_KEY?.trim() || undefined,
        webhookSecret: notchWebhook,
        baseUrl: settings.NOTCHPAY_BASE_URL?.trim() || undefined,
        callbackUrl,
      }),
    );
  }

  const stripeSecret = settings.STRIPE_SECRET_KEY?.trim() ?? '';
  const stripeWebhook = settings.STRIPE_WEBHOOK_SECRET?.trim() ?? '';
  const stripeSuccess = settings.STRIPE_SUCCESS_URL?.trim() ?? '';
  const stripeCancel = settings.STRIPE_CANCEL_URL?.trim() ?? '';
  if (
    stripeSecret.length > 0 &&
    stripeWebhook.length > 0 &&
    stripeSuccess.length > 0 &&
    stripeCancel.length > 0 &&
    assertStripeSecretKeySafe(
      stripeSecret,
      settings.NODE_ENV,
      settings.STRIPE_ALLOW_LIVE_KEYS,
    )
  ) {
    map.set(
      'stripe',
      new StripePaymentProvider({
        secretKey: stripeSecret,
        webhookSecret: stripeWebhook,
        successUrl: stripeSuccess,
        cancelUrl: stripeCancel,
      }),
    );
  }

  return map;
}

export function buildPaymentProviderRegistry(
  settings: PaymentProviderSettings,
): PaymentProviderRegistry {
  return new PaymentProviderRegistry(buildPaymentProviders(settings));
}

/**
 * @deprecated Single-provider picker. Prefer {@link buildPaymentProviderRegistry}.
 * Returns one provider for older call sites: preferred name if set and present,
 * otherwise disabled.
 */
export function selectPaymentProvider(
  settings: PaymentProviderSettings,
): PaymentProvider {
  const map = buildPaymentProviders(settings);
  const preferred = settings.PAYMENT_PROVIDER?.trim();
  if (preferred && map.has(preferred)) {
    return map.get(preferred)!;
  }
  return new DisabledPaymentProvider();
}
