/**
 * The three tables an entitlement lives in, against real Postgres.
 *
 * A mocked Prisma would accept a balance of minus one and a cap on a code that
 * does not exist. The constraints are the point of this task, and only the
 * database can be asked whether they hold.
 *
 * The shape, and why it is three tables rather than one, is ADR 0002.
 */
import { PrismaService } from '../src/shared/services/prisma.service';

const prisma = new PrismaService();

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'entitlement-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Entitlement Test' } },
  });
}

async function makeCenter() {
  return prisma.center.create({
    data: {
      name: `Entitlement Test ${Date.now()}-${Math.random()}`,
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
}

async function makeCode(centerId: string) {
  return prisma.activationCode.create({
    data: {
      center_id: centerId,
      code: `LQ-TEST-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('the pool: what a centre bought', () => {
  it('holds one balance per centre and product', async () => {
    const center = await makeCenter();

    await prisma.centerEntitlementPool.create({
      data: {
        center_id: center.id,
        product: 'AI_SPEAKING_CREDIT',
        balance: 40,
      },
    });

    const pool = await prisma.centerEntitlementPool.findUniqueOrThrow({
      where: {
        center_id_product: {
          center_id: center.id,
          product: 'AI_SPEAKING_CREDIT',
        },
      },
    });
    expect(pool.balance).toBe(40);
  });

  it('keeps the two products apart', async () => {
    // One pot per product, not one pot with a discount. A centre may hold
    // credits and passes at the same time and neither can be spent as the
    // other.
    const center = await makeCenter();

    await prisma.centerEntitlementPool.createMany({
      data: [
        { center_id: center.id, product: 'AI_SPEAKING_CREDIT', balance: 40 },
        { center_id: center.id, product: 'PREP_PASS', balance: 6 },
      ],
    });

    const pools = await prisma.centerEntitlementPool.findMany({
      where: { center_id: center.id },
    });

    // Sorted here rather than in the query: Postgres orders an enum by the
    // order its values were declared, not alphabetically, and nothing in the
    // product should depend on either.
    expect(
      pools
        .map((row) => [row.product, row.balance])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['AI_SPEAKING_CREDIT', 40],
      ['PREP_PASS', 6],
    ]);
  });

  it('refuses a balance below zero', async () => {
    // The backstop under the conditional update that spends a credit. If that
    // rule is ever written as a read followed by a write, this is what turns
    // the bug into a failure instead of a free session.
    const center = await makeCenter();
    await prisma.centerEntitlementPool.create({
      data: { center_id: center.id, product: 'AI_SPEAKING_CREDIT', balance: 1 },
    });

    await expect(
      prisma.centerEntitlementPool.update({
        where: {
          center_id_product: {
            center_id: center.id,
            product: 'AI_SPEAKING_CREDIT',
          },
        },
        data: { balance: { decrement: 2 } },
      }),
    ).rejects.toThrow();
  });
});

describe('the cap: who may draw on the pool', () => {
  it('belongs to a code, not to a student', async () => {
    // A code exists before anybody holds it, so a centre can buy ahead; and a
    // seat that changes hands carries what was bought for it. ADR 0002.
    const center = await makeCenter();
    const code = await makeCode(center.id);

    const cap = await prisma.codeEntitlementCap.create({
      data: {
        code_id: code.id,
        product: 'AI_SPEAKING_CREDIT',
        cap: 10,
      },
    });

    expect(cap.used).toBe(0);
    expect(code.student_id).toBeNull();
  });

  it('allows a cap to be lowered below what has already been used', async () => {
    // A manager stopping somebody mid-term sets the cap to zero. Their six
    // spent sessions are history, not a contradiction — which is why "used
    // must not exceed cap" is NOT a constraint. The spend condition is
    // `used < cap`, checked when spending.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await prisma.codeEntitlementCap.create({
      data: {
        code_id: code.id,
        product: 'AI_SPEAKING_CREDIT',
        cap: 10,
        used: 6,
      },
    });

    const stopped = await prisma.codeEntitlementCap.update({
      where: {
        code_id_product: {
          code_id: code.id,
          product: 'AI_SPEAKING_CREDIT',
        },
      },
      data: { cap: 0 },
    });

    expect(stopped.cap).toBe(0);
    expect(stopped.used).toBe(6);
  });

  it('refuses a negative cap', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);

    await expect(
      prisma.codeEntitlementCap.create({
        data: { code_id: code.id, product: 'AI_SPEAKING_CREDIT', cap: -1 },
      }),
    ).rejects.toThrow();
  });

  it('goes when its code goes', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await prisma.codeEntitlementCap.create({
      data: { code_id: code.id, product: 'AI_SPEAKING_CREDIT', cap: 10 },
    });

    await prisma.activationCode.delete({ where: { id: code.id } });

    await expect(
      prisma.codeEntitlementCap.findUnique({
        where: {
          code_id_product: {
            code_id: code.id,
            product: 'AI_SPEAKING_CREDIT',
          },
        },
      }),
    ).resolves.toBeNull();
  });
});

describe('the assignment: a period on one seat', () => {
  it('holds an expiry per code and product', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    const expires = new Date('2026-12-04T00:00:00.000Z');

    const granted = await prisma.codeEntitlement.create({
      data: {
        code_id: code.id,
        product: 'PREP_PASS',
        expires_at: expires,
      },
    });

    expect(granted.expires_at).toEqual(expires);
  });

  it('holds one row per product, so a second pass extends rather than doubles', async () => {
    // Enforced by the primary key. Two live Prep Passes on one seat is not a
    // state anything should have to reason about.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await prisma.codeEntitlement.create({
      data: {
        code_id: code.id,
        product: 'PREP_PASS',
        expires_at: new Date('2026-12-04T00:00:00.000Z'),
      },
    });

    await expect(
      prisma.codeEntitlement.create({
        data: {
          code_id: code.id,
          product: 'PREP_PASS',
          expires_at: new Date('2027-01-01T00:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
  });
});

describe('what a payment was for', () => {
  it('carries the codes and the cap from the purchase to the webhook', async () => {
    // Hours can pass between the two, and nothing may be granted before money
    // moves — so the manager's choice has to be stored somewhere in between.
    // It is re-validated at activation and never trusted.
    const center = await makeCenter();

    const payment = await prisma.payment.create({
      data: {
        center_id: center.id,
        kind: 'AI_SPEAKING_CREDIT',
        quantity: 40,
        unit_price_xaf: 300,
        amount_xaf: 12_000,
        idempotency_key: `entitlement-test-${Math.random()}`,
        request_hash: 'hash',
        metadata: { codeIds: ['a', 'b', 'c', 'd'], capPerCode: 10 },
      },
    });

    const stored = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(stored.metadata).toEqual({
      codeIds: ['a', 'b', 'c', 'd'],
      capPerCode: 10,
    });
  });

  it('leaves metadata null for a purchase that needs none', async () => {
    const center = await makeCenter();

    const payment = await prisma.payment.create({
      data: {
        center_id: center.id,
        kind: 'SEATS',
        quantity: 10,
        unit_price_xaf: 4_500,
        amount_xaf: 45_000,
        idempotency_key: `entitlement-test-${Math.random()}`,
        request_hash: 'hash',
      },
    });

    expect(payment.metadata).toBeNull();
  });
});
