import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  buildPaymentProviders,
  type PaymentProvider,
} from '../src/modules/centers/payment-providers/payment-provider';
import {
  FakePaymentProvider,
  FAKE_SIGNATURE_HEADER,
  signFakeWebhook,
} from '../src/modules/centers/payment-providers/fake-payment-provider';
import { DisabledPaymentProvider } from '../src/modules/centers/payment-providers/disabled-payment-provider';
import {
  NotchPayProvider,
  NOTCHPAY_SIGNATURE_HEADER,
  signNotchPayWebhook,
} from '../src/modules/centers/payment-providers/notchpay-payment-provider';
import {
  StripePaymentProvider,
  STRIPE_SIGNATURE_HEADER,
} from '../src/modules/centers/payment-providers/stripe-payment-provider';
import Stripe from 'stripe';

const SECRET = 'a-long-enough-fake-webhook-secret-for-tests';

/**
 * The seam Herman's Notch Pay integration plugs into, and the fake that lets
 * the whole payment flow be exercised before it exists.
 *
 * The property that matters most is not the happy path: `main` auto-deploys,
 * so a provider that accepts forged "payment succeeded" events must be
 * impossible to switch on by forgetting an environment variable.
 */
describe('choosing the payment providers', () => {
  it('registers the fake only when asked for, outside production, with a secret', () => {
    const map = buildPaymentProviders({
      PAYMENT_PROVIDER: 'fake',
      NODE_ENV: 'development',
      FAKE_PAYMENT_WEBHOOK_SECRET: SECRET,
    });
    expect(map.get('fake')).toBeInstanceOf(FakePaymentProvider);
  });

  it('registers nothing when nothing is configured', () => {
    expect(buildPaymentProviders({}).size).toBe(0);
  });

  it('never registers the fake in production', () => {
    const map = buildPaymentProviders({
      PAYMENT_PROVIDER: 'fake',
      NODE_ENV: 'production',
      FAKE_PAYMENT_WEBHOOK_SECRET: SECRET,
    });
    expect(map.has('fake')).toBe(false);
  });

  it('registers Notch and Stripe together when both are configured', () => {
    // Different payment methods (MM vs card) — not mutually exclusive.
    const map = buildPaymentProviders({
      NOTCHPAY_PUBLIC_KEY: 'pk_test',
      NOTCHPAY_WEBHOOK_SECRET: 'whsec_notch',
      NOTCHPAY_CALLBACK_URL: 'https://dashboard.example/callback',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_stripe',
      STRIPE_SUCCESS_URL: 'https://dashboard.example/success',
      STRIPE_CANCEL_URL: 'https://dashboard.example/cancel',
    });
    expect(map.get('notchpay')).toBeInstanceOf(NotchPayProvider);
    expect(map.get('stripe')).toBeInstanceOf(StripePaymentProvider);
    expect(map.size).toBe(2);
  });

  it('registers Notch without PAYMENT_PROVIDER=notchpay (keys alone suffice)', () => {
    const map = buildPaymentProviders({
      NOTCHPAY_PUBLIC_KEY: 'pk_test',
      NOTCHPAY_WEBHOOK_SECRET: 'whsec_test',
      NOTCHPAY_CALLBACK_URL: 'https://dashboard.example/callback',
    });
    expect(map.get('notchpay')).toBeInstanceOf(NotchPayProvider);
  });

  it('omits Stripe live keys outside production without allow flag', () => {
    const map = buildPaymentProviders({
      NODE_ENV: 'development',
      STRIPE_SECRET_KEY: 'sk_live_dangerous',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
      STRIPE_SUCCESS_URL: 'https://dashboard.example/success',
      STRIPE_CANCEL_URL: 'https://dashboard.example/cancel',
    });
    expect(map.has('stripe')).toBe(false);
  });

  it('omits a method when any required key is missing', () => {
    expect(
      buildPaymentProviders({
        NOTCHPAY_PUBLIC_KEY: 'pk_test',
        NOTCHPAY_WEBHOOK_SECRET: 'whsec_test',
      }).has('notchpay'),
    ).toBe(false);

    expect(
      buildPaymentProviders({
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test',
        STRIPE_SUCCESS_URL: 'https://dashboard.example/success',
      }).has('stripe'),
    ).toBe(false);
  });
});

describe('the disabled provider', () => {
  // Typed as the port, not the class. Callers only ever hold a
  // PaymentProvider, so this is the contract worth testing — and the class
  // itself may ignore arguments it has no use for.
  const provider: PaymentProvider = new DisabledPaymentProvider();

  it('refuses to start a checkout', async () => {
    await expect(
      provider.createCheckout({
        paymentId: 'p1',
        centerId: 'c1',
        amountXaf: 45000,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuses every webhook, so nothing can be activated through it', async () => {
    await expect(provider.verifyWebhook(Buffer.from('{}'), {})).rejects.toThrow(
      'PAYMENT_PROVIDER_NOT_CONFIGURED',
    );
  });
});

describe('the fake provider', () => {
  const provider = new FakePaymentProvider(SECRET);

  const signed = (payload: unknown, secret = SECRET) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return {
      raw,
      headers: { [FAKE_SIGNATURE_HEADER]: signFakeWebhook(secret, raw) },
    };
  };

  describe('checkout', () => {
    it('returns one stable reference per payment', async () => {
      // Stable so a repeated checkout for the same payment names the same
      // provider transaction, as the unique index on payments requires.
      const request = { paymentId: 'p1', centerId: 'c1', amountXaf: 45000 };

      const first = await provider.createCheckout(request);
      const second = await provider.createCheckout(request);

      expect(first.providerReference).toBe(second.providerReference);
      expect(first.providerReference).toContain('p1');
    });

    it('returns a checkout URL that cannot reach a real payment page', async () => {
      // The .invalid top-level domain is reserved and never resolves, so the
      // fake can never be mistaken for a working checkout.
      const session = await provider.createCheckout({
        paymentId: 'p1',
        centerId: 'c1',
        amountXaf: 45000,
      });

      expect(new URL(session.checkoutUrl).hostname.endsWith('.invalid')).toBe(
        true,
      );
    });
  });

  describe('webhooks', () => {
    it('accepts a correctly signed success', async () => {
      const { raw, headers } = signed({
        reference: 'fake_p1',
        outcome: 'SUCCEEDED',
      });

      await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
        providerReference: 'fake_p1',
        outcome: 'SUCCEEDED',
      });
    });

    it('accepts a correctly signed failure', async () => {
      const { raw, headers } = signed({
        reference: 'fake_p1',
        outcome: 'FAILED',
      });

      await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
        providerReference: 'fake_p1',
        outcome: 'FAILED',
      });
    });

    it('refuses an event with no signature', async () => {
      await expect(
        provider.verifyWebhook(
          Buffer.from(
            JSON.stringify({ reference: 'fake_p1', outcome: 'SUCCEEDED' }),
          ),
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses an event signed with the wrong secret', async () => {
      const { raw, headers } = signed(
        { reference: 'fake_p1', outcome: 'SUCCEEDED' },
        'someone-elses-secret-that-is-also-long-enough',
      );

      await expect(provider.verifyWebhook(raw, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses a body altered after signing', async () => {
      // The signature covers the exact bytes. Changing FAILED to SUCCEEDED in
      // transit must not survive verification.
      const { headers } = signed({ reference: 'fake_p1', outcome: 'FAILED' });
      const tampered = Buffer.from(
        JSON.stringify({ reference: 'fake_p1', outcome: 'SUCCEEDED' }),
      );

      await expect(provider.verifyWebhook(tampered, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses a signature of the wrong length without throwing a crash', async () => {
      // timingSafeEqual throws on unequal lengths; that must become a clean
      // refusal, not a 500.
      const raw = Buffer.from('{}');

      await expect(
        provider.verifyWebhook(raw, { [FAKE_SIGNATURE_HEADER]: 'abc' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
      ['not JSON', 'not json'],
      ['no reference', JSON.stringify({ outcome: 'SUCCEEDED' })],
      [
        'an unknown outcome',
        JSON.stringify({ reference: 'fake_p1', outcome: 'MAYBE' }),
      ],
      [
        'a non-string reference',
        JSON.stringify({ reference: 42, outcome: 'SUCCEEDED' }),
      ],
    ])('refuses a signed payload with %s', async (_case, body) => {
      // Signed but malformed: verified, yet unusable. A 400, never a guess.
      const raw = Buffer.from(body);

      await expect(
        provider.verifyWebhook(raw, {
          [FAKE_SIGNATURE_HEADER]: signFakeWebhook(SECRET, raw),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

describe('the Notch Pay provider', () => {
  const HASH = 'notch-test-hash-key-for-unit-tests';
  const CALLBACK = 'https://dashboard.example/payments/callback';

  const httpPost = jest.fn();
  const provider = new NotchPayProvider(
    {
      publicKey: 'pk_test',
      webhookSecret: HASH,
      callbackUrl: CALLBACK,
      baseUrl: 'https://api.notchpay.test',
    },
    httpPost,
  );

  const signed = (payload: unknown, secret = HASH) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return {
      raw,
      headers: {
        [NOTCHPAY_SIGNATURE_HEADER]: signNotchPayWebhook(secret, raw),
      },
    };
  };

  beforeEach(() => {
    httpPost.mockReset();
  });

  describe('checkout', () => {
    it('opens a Notch payment and returns the merchant reference as providerReference', async () => {
      httpPost.mockResolvedValue({
        status: 201,
        data: {
          authorization_url: 'https://pay.notchpay.test/checkout/abc',
          transaction: { reference: 'trx.test_1' },
        },
      });

      const session = await provider.createCheckout({
        paymentId: 'pay-1',
        centerId: 'center-1',
        amountXaf: 45000,
        customerEmail: 'manager@school.test',
        customerName: 'École Test',
        customerPhone: '+237600000000',
      });

      expect(session).toEqual({
        providerReference: 'pay-1',
        checkoutUrl: 'https://pay.notchpay.test/checkout/abc',
      });
      expect(httpPost).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.notchpay.test/payments',
          body: expect.objectContaining({
            amount: 45000,
            currency: 'XAF',
            reference: 'pay-1',
            callback: CALLBACK,
            customer: expect.objectContaining({
              email: 'manager@school.test',
            }),
          }),
          headers: expect.objectContaining({
            Authorization: 'pk_test',
          }),
        }),
      );
    });

    it('refuses checkout without a customer email', async () => {
      await expect(
        provider.createCheckout({
          paymentId: 'pay-1',
          centerId: 'center-1',
          amountXaf: 45000,
        }),
      ).rejects.toThrow('PAYMENT_CUSTOMER_EMAIL_REQUIRED');
      expect(httpPost).not.toHaveBeenCalled();
    });

    it('refuses when Notch returns no checkout URL', async () => {
      httpPost.mockResolvedValue({
        status: 200,
        data: { message: 'missing url' },
      });

      await expect(
        provider.createCheckout({
          paymentId: 'pay-1',
          centerId: 'center-1',
          amountXaf: 45000,
          customerEmail: 'manager@school.test',
        }),
      ).rejects.toThrow('PAYMENT_CHECKOUT_FAILED');
    });
  });

  describe('webhooks', () => {
    it('accepts a correctly signed payment.complete', async () => {
      const { raw, headers } = signed({
        type: 'payment.complete',
        payload: {
          event: 'payment.complete',
          data: { merchant_reference: 'pay-1', status: 'complete' },
        },
      });

      await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
        providerReference: 'pay-1',
        outcome: 'SUCCEEDED',
      });
    });

    it('maps payment.failed and cancelled to FAILED', async () => {
      const failed = signed({
        type: 'payment.failed',
        payload: { data: { merchant_reference: 'pay-1' } },
      });
      await expect(
        provider.verifyWebhook(failed.raw, failed.headers),
      ).resolves.toEqual({
        providerReference: 'pay-1',
        outcome: 'FAILED',
      });

      const cancelled = signed({
        type: 'payment.canceled',
        payload: { data: { merchant_reference: 'pay-2' } },
      });
      await expect(
        provider.verifyWebhook(cancelled.raw, cancelled.headers),
      ).resolves.toEqual({
        providerReference: 'pay-2',
        outcome: 'FAILED',
      });
    });

    it('refuses an event with no signature', async () => {
      await expect(
        provider.verifyWebhook(
          Buffer.from(
            JSON.stringify({
              type: 'payment.complete',
              payload: { data: { merchant_reference: 'pay-1' } },
            }),
          ),
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses an event signed with the wrong secret', async () => {
      const { raw, headers } = signed(
        {
          type: 'payment.complete',
          payload: { data: { merchant_reference: 'pay-1' } },
        },
        'someone-elses-hash-key',
      );

      await expect(provider.verifyWebhook(raw, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses a body altered after signing', async () => {
      const { headers } = signed({
        type: 'payment.failed',
        payload: { data: { merchant_reference: 'pay-1' } },
      });
      const tampered = Buffer.from(
        JSON.stringify({
          type: 'payment.complete',
          payload: { data: { merchant_reference: 'pay-1' } },
        }),
      );

      await expect(provider.verifyWebhook(tampered, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses pending / unknown statuses', async () => {
      const { raw, headers } = signed({
        type: 'payment.processing',
        payload: {
          data: { merchant_reference: 'pay-1', status: 'processing' },
        },
      });

      await expect(provider.verifyWebhook(raw, headers)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a signed payload with no reference', async () => {
      const { raw, headers } = signed({
        type: 'payment.complete',
        payload: { data: {} },
      });

      await expect(provider.verifyWebhook(raw, headers)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});

describe('the Stripe provider', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';
  const createSessions = jest.fn();
  const constructEvent = jest.fn();

  const fakeStripe = {
    checkout: { sessions: { create: createSessions } },
    webhooks: { constructEvent },
  } as unknown as Stripe;

  const provider = new StripePaymentProvider(
    {
      secretKey: 'sk_test_x',
      webhookSecret: WEBHOOK_SECRET,
      successUrl: 'https://dashboard.example/success',
      cancelUrl: 'https://dashboard.example/cancel',
    },
    () => fakeStripe,
  );

  beforeEach(() => {
    createSessions.mockReset();
    constructEvent.mockReset();
  });

  describe('checkout', () => {
    it('creates a Checkout Session and returns session id + url', async () => {
      createSessions.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });

      const session = await provider.createCheckout({
        paymentId: 'pay-1',
        centerId: 'center-1',
        amountXaf: 45000,
        customerEmail: 'manager@school.test',
      });

      expect(session).toEqual({
        providerReference: 'cs_test_123',
        checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
      });
      expect(createSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          client_reference_id: 'pay-1',
          customer_email: 'manager@school.test',
          line_items: [
            expect.objectContaining({
              price_data: expect.objectContaining({
                currency: 'xaf',
                unit_amount: 45000,
              }),
            }),
          ],
        }),
      );
    });

    it('refuses when Stripe returns no url', async () => {
      createSessions.mockResolvedValue({ id: 'cs_test_123', url: null });

      await expect(
        provider.createCheckout({
          paymentId: 'pay-1',
          centerId: 'center-1',
          amountXaf: 45000,
          customerEmail: 'manager@school.test',
        }),
      ).rejects.toThrow('PAYMENT_CHECKOUT_FAILED');
    });
  });

  describe('webhooks', () => {
    const signedBody = (event: unknown) => {
      const raw = Buffer.from(JSON.stringify(event));
      return {
        raw,
        headers: { [STRIPE_SIGNATURE_HEADER]: 't=1,v1=fake' },
      };
    };

    it('accepts checkout.session.completed as SUCCEEDED', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_123',
            mode: 'payment',
            payment_status: 'paid',
          },
        },
      };
      constructEvent.mockReturnValue(event);
      const { raw, headers } = signedBody(event);

      await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
        providerReference: 'cs_test_123',
        outcome: 'SUCCEEDED',
      });
      expect(constructEvent).toHaveBeenCalledWith(
        raw,
        't=1,v1=fake',
        WEBHOOK_SECRET,
      );
    });

    it('maps async_payment_failed and expired to FAILED', async () => {
      for (const type of [
        'checkout.session.async_payment_failed',
        'checkout.session.expired',
      ]) {
        const event = {
          type,
          data: { object: { id: 'cs_test_fail' } },
        };
        constructEvent.mockReturnValue(event);
        const { raw, headers } = signedBody(event);

        await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
          providerReference: 'cs_test_fail',
          outcome: 'FAILED',
        });
      }
    });

    it('refuses missing signature', async () => {
      await expect(
        provider.verifyWebhook(Buffer.from('{}'), {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses invalid signature from constructEvent', async () => {
      constructEvent.mockImplementation(() => {
        throw new Error('bad sig');
      });
      const { raw, headers } = signedBody({});

      await expect(provider.verifyWebhook(raw, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses unhandled event types', async () => {
      constructEvent.mockReturnValue({
        type: 'customer.created',
        data: { object: {} },
      });
      const { raw, headers } = signedBody({});

      await expect(provider.verifyWebhook(raw, headers)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
