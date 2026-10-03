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
  FapshiPaymentProvider,
  FAPSHI_WEBHOOK_SECRET_HEADER,
} from '../src/modules/centers/payment-providers/fapshi-payment-provider';
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

  it('registers Fapshi and Stripe together when both are configured', () => {
    // Different payment methods (MM vs card) — not mutually exclusive.
    const map = buildPaymentProviders({
      FAPSHI_APIUSER: 'user-test',
      FAPSHI_APIKEY: 'key-test',
      FAPSHI_WEBHOOK_SECRET: 'whsec_fapshi',
      FAPSHI_REDIRECT_URL: 'https://dashboard.example/callback',
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_WEBHOOK_SECRET: 'whsec_stripe',
      STRIPE_SUCCESS_URL: 'https://dashboard.example/success',
      STRIPE_CANCEL_URL: 'https://dashboard.example/cancel',
    });
    expect(map.get('fapshi')).toBeInstanceOf(FapshiPaymentProvider);
    expect(map.get('stripe')).toBeInstanceOf(StripePaymentProvider);
    expect(map.size).toBe(2);
  });

  it('registers Fapshi without PAYMENT_PROVIDER=fapshi (keys alone suffice)', () => {
    const map = buildPaymentProviders({
      FAPSHI_APIUSER: 'user-test',
      FAPSHI_APIKEY: 'key-test',
      FAPSHI_WEBHOOK_SECRET: 'whsec_test',
      FAPSHI_REDIRECT_URL: 'https://dashboard.example/callback',
    });
    expect(map.get('fapshi')).toBeInstanceOf(FapshiPaymentProvider);
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
        FAPSHI_APIUSER: 'user-test',
        FAPSHI_APIKEY: 'key-test',
        FAPSHI_WEBHOOK_SECRET: 'whsec_test',
      }).has('fapshi'),
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

describe('the Fapshi provider', () => {
  const SECRET = 'fapshi-test-webhook-secret';
  const REDIRECT = 'https://dashboard.example/payments/callback';

  const httpPost = jest.fn();
  const provider = new FapshiPaymentProvider(
    {
      apiUser: 'user-test',
      apiKey: 'key-test',
      webhookSecret: SECRET,
      redirectUrl: REDIRECT,
      baseUrl: 'https://sandbox.fapshi.test',
    },
    httpPost,
  );

  const signed = (payload: unknown, secret = SECRET) => {
    const raw = Buffer.from(JSON.stringify(payload));
    return {
      raw,
      headers: {
        [FAPSHI_WEBHOOK_SECRET_HEADER]: secret,
      },
    };
  };

  beforeEach(() => {
    httpPost.mockReset();
  });

  describe('checkout', () => {
    it('opens a Fapshi payment and returns transId as providerReference', async () => {
      httpPost.mockResolvedValue({
        status: 200,
        data: {
          message: 'ok',
          link: 'https://pay.fapshi.test/checkout/abc',
          transId: 'XX123ABC',
          dateInitiated: '2026-10-03',
        },
      });

      const session = await provider.createCheckout({
        paymentId: 'pay-1',
        centerId: 'center-1',
        amountXaf: 45000,
        customerEmail: 'manager@school.test',
      });

      expect(session).toEqual({
        providerReference: 'XX123ABC',
        checkoutUrl: 'https://pay.fapshi.test/checkout/abc',
      });
      expect(httpPost).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://sandbox.fapshi.test/initiate-pay',
          body: expect.objectContaining({
            amount: 45000,
            externalId: 'pay-1',
            redirectUrl: REDIRECT,
            email: 'manager@school.test',
            userId: 'center-1',
          }),
          headers: expect.objectContaining({
            apiuser: 'user-test',
            apikey: 'key-test',
          }),
        }),
      );
    });

    it('allows checkout without a customer email', async () => {
      httpPost.mockResolvedValue({
        status: 200,
        data: {
          link: 'https://pay.fapshi.test/checkout/abc',
          transId: 'XX123ABC',
        },
      });

      await expect(
        provider.createCheckout({
          paymentId: 'pay-1',
          centerId: 'center-1',
          amountXaf: 45000,
        }),
      ).resolves.toEqual({
        providerReference: 'XX123ABC',
        checkoutUrl: 'https://pay.fapshi.test/checkout/abc',
      });
    });

    it('refuses when Fapshi returns no checkout URL', async () => {
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
    it('accepts a correctly authenticated SUCCESSFUL event', async () => {
      const { raw, headers } = signed({
        transId: 'XX123ABC',
        status: 'SUCCESSFUL',
        externalId: 'pay-1',
      });

      await expect(provider.verifyWebhook(raw, headers)).resolves.toEqual({
        providerReference: 'XX123ABC',
        outcome: 'SUCCEEDED',
      });
    });

    it('maps FAILED and EXPIRED to FAILED', async () => {
      const failed = signed({ transId: 'XX1', status: 'FAILED' });
      await expect(
        provider.verifyWebhook(failed.raw, failed.headers),
      ).resolves.toEqual({
        providerReference: 'XX1',
        outcome: 'FAILED',
      });

      const expired = signed({ transId: 'XX2', status: 'EXPIRED' });
      await expect(
        provider.verifyWebhook(expired.raw, expired.headers),
      ).resolves.toEqual({
        providerReference: 'XX2',
        outcome: 'FAILED',
      });
    });

    it('refuses an event with no webhook secret header', async () => {
      await expect(
        provider.verifyWebhook(
          Buffer.from(
            JSON.stringify({
              transId: 'XX123ABC',
              status: 'SUCCESSFUL',
            }),
          ),
          {},
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refuses an event with the wrong secret', async () => {
      const { raw, headers } = signed(
        { transId: 'XX123ABC', status: 'SUCCESSFUL' },
        'someone-elses-secret',
      );

      await expect(provider.verifyWebhook(raw, headers)).rejects.toThrow(
        'WEBHOOK_SIGNATURE_INVALID',
      );
    });

    it('refuses pending / unknown statuses', async () => {
      const { raw, headers } = signed({
        transId: 'XX123ABC',
        status: 'PENDING',
      });

      await expect(provider.verifyWebhook(raw, headers)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('refuses a signed payload with no transId', async () => {
      const { raw, headers } = signed({
        status: 'SUCCESSFUL',
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
