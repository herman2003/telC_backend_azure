/**
 * Handing out what a centre bought, against real Postgres.
 *
 * The rules are unit-tested with a mock. These are the three claims a mock
 * cannot make: that the last pass cannot be assigned twice, that a period is
 * extended rather than restarted, and that a lapsed pass begins again from
 * today rather than from the date it ran out.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { EntitlementsService } from '../src/modules/centers/entitlements.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

const prisma = new PrismaService();
const entitlements = new EntitlementsService(
  prisma,
  new SubscriptionPolicyService(),
);

const DAY_MS = 24 * 60 * 60 * 1000;
/** The database clock and this process's clock differ by network latency. */
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

const identity = (centerId: string) =>
  ({ centerId, centerUserId: `${centerId}-owner` }) as never;

async function wipe() {
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Entitlements Test' } },
  });
}

async function makeCenter(
  paidUntil: Date | null = new Date(Date.now() + 30 * DAY_MS),
) {
  return prisma.center.create({
    data: {
      name: `Entitlements Test ${Date.now()}-${Math.random()}`,
      subscription: {
        create: { plan: paidUntil ? 'PAID' : 'TRIAL', paid_until: paidUntil },
      },
    },
  });
}

async function makeCode(centerId: string) {
  return prisma.activationCode.create({
    data: {
      center_id: centerId,
      code: `LQ-ENT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

async function fillPool(
  centerId: string,
  product: 'PREP_PASS' | 'AI_SPEAKING_CREDIT',
  balance: number,
) {
  await prisma.centerEntitlementPool.create({
    data: { center_id: centerId, product, balance },
  });
}

const poolOf = async (centerId: string, product: 'PREP_PASS') =>
  (
    await prisma.centerEntitlementPool.findUniqueOrThrow({
      where: { center_id_product: { center_id: centerId, product } },
      select: { balance: true },
    })
  ).balance;

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('assigning a period', () => {
  it('spends one from the pool and dates the pass from today', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'PREP_PASS', 6);

    const granted = await entitlements.grantPeriod(
      identity(center.id),
      code.id,
      'PREP_PASS',
    );

    await expect(poolOf(center.id, 'PREP_PASS')).resolves.toBe(5);
    const days = (granted.expiresAt.getTime() - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(59.9);
    expect(days).toBeLessThan(60.1);
  });

  it('extends a live pass instead of restarting it', async () => {
    // Two passes on one seat is not a state anything should reason about, and
    // restarting would take away days the centre had already paid for.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'PREP_PASS', 6);

    const first = await entitlements.grantPeriod(
      identity(center.id),
      code.id,
      'PREP_PASS',
    );
    const second = await entitlements.grantPeriod(
      identity(center.id),
      code.id,
      'PREP_PASS',
    );

    const added =
      (second.expiresAt.getTime() - first.expiresAt.getTime()) / DAY_MS;
    expect(added).toBeGreaterThan(59.9);
    expect(added).toBeLessThan(60.1);
  });

  it('restarts from today when the last pass already ran out', async () => {
    // GREATEST(expires_at, now()). Extending from a date in the past would
    // sell a centre sixty days that had already elapsed.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'PREP_PASS', 6);
    await prisma.codeEntitlement.create({
      data: {
        code_id: code.id,
        product: 'PREP_PASS',
        expires_at: new Date(Date.now() - 100 * DAY_MS),
      },
    });

    const granted = await entitlements.grantPeriod(
      identity(center.id),
      code.id,
      'PREP_PASS',
    );

    const days = (granted.expiresAt.getTime() - Date.now()) / DAY_MS;
    expect(days).toBeGreaterThan(59.9);
    expect(days).toBeLessThan(60.1);
  });

  it('lets exactly one of two simultaneous assignments take the last pass', async () => {
    // The conditional decrement is the concurrency control. Read-then-write
    // would let both managers succeed and leave the pool at minus one — which
    // the check constraint would then refuse, turning a silent overdraft into
    // a 500 rather than into a clean refusal.
    const center = await makeCenter();
    const first = await makeCode(center.id);
    const second = await makeCode(center.id);
    await fillPool(center.id, 'PREP_PASS', 1);

    const outcomes = await Promise.allSettled([
      entitlements.grantPeriod(identity(center.id), first.id, 'PREP_PASS'),
      entitlements.grantPeriod(identity(center.id), second.id, 'PREP_PASS'),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    await expect(poolOf(center.id, 'PREP_PASS')).resolves.toBe(0);

    // And refused CLEANLY. The check constraint would also stop a
    // read-then-write from overdrawing the pool, but it would arrive as a
    // constraint violation — a 500 where the manager should have been told
    // they are out of passes. Asserting the message is what tells the two
    // apart; without it this test passes with the guard deleted.
    const refused = outcomes.find(
      (outcome) => outcome.status === 'rejected',
    ) as PromiseRejectedResult;
    expect((refused.reason as Error).message).toContain(
      'NOT_ENOUGH_ENTITLEMENTS',
    );

    const granted = await prisma.codeEntitlement.count({
      where: { code_id: { in: [first.id, second.id] } },
    });
    expect(granted).toBe(1);
  });

  it('refuses a seat belonging to another centre, and spends nothing', async () => {
    const mine = await makeCenter();
    const theirs = await makeCenter();
    const theirCode = await makeCode(theirs.id);
    await fillPool(mine.id, 'PREP_PASS', 6);

    await expect(
      entitlements.grantPeriod(identity(mine.id), theirCode.id, 'PREP_PASS'),
    ).rejects.toThrow('CODE_NOT_IN_CENTER');
    await expect(poolOf(mine.id, 'PREP_PASS')).resolves.toBe(6);
  });
});

describe('what the centre sees', () => {
  it('shows the pool, the caps and how many seats hold a live period', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 140);
    await fillPool(center.id, 'PREP_PASS', 6);
    await entitlements.setCap(
      identity(center.id),
      code.id,
      'AI_SPEAKING_CREDIT',
      12,
    );
    await entitlements.grantPeriod(identity(center.id), code.id, 'PREP_PASS');

    const view = await entitlements.overview(identity(center.id));

    expect(view.pools).toEqual(
      expect.arrayContaining([
        { product: 'AI_SPEAKING_CREDIT', balance: 140, frozen: false },
        { product: 'PREP_PASS', balance: 5, frozen: false },
      ]),
    );
    expect(view.caps).toEqual([
      expect.objectContaining({
        product: 'AI_SPEAKING_CREDIT',
        cap: 12,
        used: 0,
      }),
    ]);
    expect(view.assigned).toEqual([{ product: 'PREP_PASS', seats: 1 }]);
  });

  it('counts only live periods as assigned', async () => {
    // An expired pass is not a seat the centre is currently serving, and
    // counting it would overstate what they are getting for their money.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await prisma.codeEntitlement.create({
      data: {
        code_id: code.id,
        product: 'PREP_PASS',
        expires_at: new Date(Date.now() - DAY_MS),
      },
    });

    const view = await entitlements.overview(identity(center.id));

    expect(view.assigned).toEqual([]);
  });

  it('marks the pools frozen when Start has lapsed, without touching them', async () => {
    const center = await makeCenter(new Date(Date.now() - 60 * DAY_MS));
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 60);

    const view = await entitlements.overview(identity(center.id));

    expect(view.pools).toEqual([
      { product: 'AI_SPEAKING_CREDIT', balance: 60, frozen: true },
    ]);
  });

  it('sees nothing of another centre', async () => {
    const mine = await makeCenter();
    const theirs = await makeCenter();
    await fillPool(theirs.id, 'AI_SPEAKING_CREDIT', 100);

    const view = await entitlements.overview(identity(mine.id));

    expect(view.pools).toEqual([]);
    expect(view.caps).toEqual([]);
  });
});

describe('stopping a seat', () => {
  it('sets the cap to zero and leaves what was spent alone', async () => {
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

    await entitlements.revoke(
      identity(center.id),
      code.id,
      'AI_SPEAKING_CREDIT',
    );

    const cap = await prisma.codeEntitlementCap.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'AI_SPEAKING_CREDIT' },
      },
    });
    expect(cap).toMatchObject({ cap: 0, used: 6 });
  });

  it('does not cut short a period the centre already paid for', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'PREP_PASS', 1);
    const granted = await entitlements.grantPeriod(
      identity(center.id),
      code.id,
      'PREP_PASS',
    );

    await entitlements.revoke(identity(center.id), code.id, 'PREP_PASS');

    const still = await prisma.codeEntitlement.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'PREP_PASS' },
      },
    });
    expect(
      Math.abs(still.expires_at.getTime() - granted.expiresAt.getTime()),
    ).toBeLessThan(CLOCK_TOLERANCE_MS);
  });
});
