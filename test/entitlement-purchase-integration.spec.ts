/**
 * Buying an add-on, against real Postgres.
 *
 * The idempotency rules are a claim about a unique index and about what
 * happens when two requests race, so a mock proves none of it: it will happily
 * create two payments for one key and report success both times.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { EntitlementPurchaseService } from '../src/modules/centers/entitlement-purchase.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import { PaymentActivationService } from '../src/modules/centers/payment-activation.service';

const prisma = new PrismaService();
const purchases = new EntitlementPurchaseService(prisma);
const activation = new PaymentActivationService(
  prisma,
  new SubscriptionPolicyService(),
);

async function wipe() {
  // Managers first: center_users has no cascade, so deleting the centre out
  // from under one fails on the foreign key.
  await prisma.centerUser.deleteMany({
    where: { email: { startsWith: 'purchase-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Purchase Test' } },
  });
}

/**
 * A centre complete enough to be billed: a country for the currency, a city
 * for support, and a manager with a phone to chase an unpaid invoice.
 */
async function makeCenter(complete = true) {
  const center = await prisma.center.create({
    data: {
      name: `Purchase Test ${Date.now()}-${Math.random()}`,
      ...(complete ? { country_code: 'CM', city_id: 'douala' } : {}),
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
  const manager = await prisma.centerUser.create({
    data: {
      center_id: center.id,
      first_name: 'Purchase',
      last_name: 'Tester',
      email: `purchase-test-${Date.now()}-${Math.random()}@example.com`,
      password_hash: 'x',
      ...(complete ? { phone: '+237600000000' } : {}),
      email_verified: true,
    },
  });
  return {
    id: center.id,
    identity: { centerId: center.id, centerUserId: manager.id } as never,
  };
}

async function makeCode(centerId: string) {
  return prisma.activationCode.create({
    data: {
      center_id: centerId,
      code: `LQ-BUY-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

const key = () => `purchase-test-${Date.now()}-${Math.random()}`;

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('what a purchase records', () => {
  it('prices credits at 300 a piece and grants nothing', async () => {
    const center = await makeCenter();

    const payment = await purchases.purchase(center.identity, key(), {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 40,
    });

    expect(payment).toMatchObject({
      kind: 'AI_SPEAKING_CREDIT',
      quantity: 40,
      unitPriceXaf: 300,
      amountXaf: 14_160,
      status: 'PENDING',
    });
    // The three amounts an invoice needs, and they agree: 12,000 HT + 2,160.
    await expect(
      prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }),
    ).resolves.toMatchObject({
      amount_net_xaf: 12_000,
      vat_amount_xaf: 2_160,
      amount_xaf: 14_160,
    });
    // Nothing is granted until a verified provider event says money moved.
    await expect(
      prisma.centerEntitlementPool.findMany({
        where: { center_id: center.id },
      }),
    ).resolves.toEqual([]);
  });

  it('prices a Prep Pass at 3000', async () => {
    const center = await makeCenter();

    const payment = await purchases.purchase(center.identity, key(), {
      product: 'PREP_PASS',
      quantity: 6,
    });

    expect(payment).toMatchObject({ unitPriceXaf: 3_000, amountXaf: 21_240 });
  });

  it('carries the chosen seats and cap to the webhook', async () => {
    const center = await makeCenter();
    const first = await makeCode(center.id);
    const second = await makeCode(center.id);

    const payment = await purchases.purchase(center.identity, key(), {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 20,
      codeIds: [first.id, second.id],
      capPerCode: 10,
    });

    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { metadata: true },
    });
    expect(stored.metadata).toEqual({
      codeIds: [first.id, second.id],
      capPerCode: 10,
    });
  });

  it('stores no metadata for a plain top-up', async () => {
    const center = await makeCenter();

    const payment = await purchases.purchase(center.identity, key(), {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 40,
    });

    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      select: { metadata: true },
    });
    expect(stored.metadata).toBeNull();
  });
});

describe('what a purchase refuses', () => {
  it('refuses a seat belonging to another centre', async () => {
    // Before any row is written. The webhook re-checks as well, because the
    // two are hours apart, but a manager should be told now rather than
    // discover the cap missing after paying.
    const mine = await makeCenter();
    const theirs = await makeCenter();
    const theirCode = await makeCode(theirs.id);

    await expect(
      purchases.purchase(mine.identity, key(), {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 10,
        codeIds: [theirCode.id],
        capPerCode: 10,
      }),
    ).rejects.toThrow('CODE_NOT_IN_CENTER');

    await expect(
      prisma.payment.count({ where: { center_id: mine.id } }),
    ).resolves.toBe(0);
  });

  it('refuses nothing, or less than nothing', async () => {
    const center = await makeCenter();

    await expect(
      purchases.purchase(center.identity, key(), {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 0,
      }),
    ).rejects.toThrow('ENTITLEMENT_QUANTITY_INVALID');
  });

  it('refuses an order beyond the maximum', async () => {
    const center = await makeCenter();

    await expect(
      purchases.purchase(center.identity, key(), {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 100_000,
      }),
    ).rejects.toThrow('ENTITLEMENT_QUANTITY_ABOVE_MAXIMUM');
  });

  it('refuses a centre that cannot be billed', async () => {
    // The same gate as seats and exam slots: taking money needs a country for
    // the currency, a city for support and a phone to chase an invoice.
    const center = await makeCenter(false);

    await expect(
      purchases.purchase(center.identity, key(), {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 10,
      }),
    ).rejects.toThrow();
  });
});

describe('the idempotency key', () => {
  it('answers a retry from the payment that already exists', async () => {
    const center = await makeCenter();
    const reused = key();
    const order = {
      product: 'AI_SPEAKING_CREDIT' as const,
      quantity: 40,
    };

    const first = await purchases.purchase(center.identity, reused, order);
    const second = await purchases.purchase(center.identity, reused, order);

    expect(second.id).toBe(first.id);
    await expect(
      prisma.payment.count({ where: { center_id: center.id } }),
    ).resolves.toBe(1);
  });

  it('refuses the same key used for a different quantity', async () => {
    const center = await makeCenter();
    const reused = key();

    await purchases.purchase(center.identity, reused, {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 40,
    });

    await expect(
      purchases.purchase(center.identity, reused, {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 100,
      }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses the same key used for a different product', async () => {
    // Forty credits is 12,000 XAF and forty passes is 120,000. Handing back
    // either for the other would bill a centre for something it did not buy.
    const center = await makeCenter();
    const reused = key();

    await purchases.purchase(center.identity, reused, {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 40,
    });

    await expect(
      purchases.purchase(center.identity, reused, {
        product: 'PREP_PASS',
        quantity: 40,
      }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('refuses the same key used for different seats', async () => {
    // The seats are part of the intent, not decoration: replaying one key
    // with a different list would move somebody else's cap.
    const center = await makeCenter();
    const first = await makeCode(center.id);
    const second = await makeCode(center.id);
    const reused = key();

    await purchases.purchase(center.identity, reused, {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 20,
      codeIds: [first.id],
      capPerCode: 10,
    });

    await expect(
      purchases.purchase(center.identity, reused, {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 20,
        codeIds: [second.id],
        capPerCode: 10,
      }),
    ).rejects.toThrow('IDEMPOTENCY_KEY_REUSED');
  });

  it('lets exactly one of two simultaneous retries create the payment', async () => {
    const center = await makeCenter();
    const reused = key();
    const order = {
      product: 'AI_SPEAKING_CREDIT' as const,
      quantity: 40,
    };

    const outcomes = await Promise.allSettled([
      purchases.purchase(center.identity, reused, order),
      purchases.purchase(center.identity, reused, order),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(2);
    await expect(
      prisma.payment.count({ where: { center_id: center.id } }),
    ).resolves.toBe(1);
  });
});

describe('buying, end to end', () => {
  it('turns a purchase into four assignments, and not before', async () => {
    // The success criterion the whole block was designed around. Both halves
    // are tested on their own with payments built by hand; this is the one
    // that proves the metadata a manager chose actually survives the round
    // trip through the code that writes it and the code that reads it.
    const center = await makeCenter();
    const seats = [
      await makeCode(center.id),
      await makeCode(center.id),
      await makeCode(center.id),
      await makeCode(center.id),
    ];

    const payment = await purchases.purchase(center.identity, key(), {
      product: 'AI_SPEAKING_CREDIT',
      quantity: 40,
      codeIds: seats.map((seat) => seat.id),
      capPerCode: 10,
    });

    // Paid for, and still granted nothing.
    await expect(
      prisma.centerEntitlementPool.count({ where: { center_id: center.id } }),
    ).resolves.toBe(0);

    await activation.activate(payment.id);

    // 40 purchased and fully assigned → unallocated 0, four seats × 10.
    await expect(
      prisma.centerEntitlementPool.findUniqueOrThrow({
        where: {
          center_id_product: {
            center_id: center.id,
            product: 'AI_SPEAKING_CREDIT',
          },
        },
        select: { balance: true },
      }),
    ).resolves.toEqual({ balance: 0 });

    const caps = await prisma.codeEntitlementCap.findMany({
      where: { code_id: { in: seats.map((seat) => seat.id) } },
      select: { cap: true, used: true },
    });
    expect(caps).toHaveLength(4);
    expect(caps.every((row) => row.cap === 10 && row.used === 0)).toBe(true);
  });
});
