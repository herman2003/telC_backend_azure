/**
 * Handing out what a centre bought, against real Postgres.
 *
 * The rules are unit-tested with a mock. These are the three claims a mock
 * cannot make: that the last pass cannot be assigned twice, that a period is
 * extended rather than restarted, and that a lapsed pass begins again from
 * today rather than from the date it ran out. Assign/revoke concurrency is
 * here too — FOR UPDATE only proves itself against a real database.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { EntitlementsService } from '../src/modules/centers/entitlements.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import {
  EntitlementSpendService,
  FREE_LIVE_SESSIONS_PER_MONTH,
} from '../src/shared/services/entitlement-spend.service';
import { StudentEntitlementService } from '../src/shared/services/student-entitlement.service';
import { TrialGiftVoidService } from '../src/modules/centers/trial-gift-void.service';

const prisma = new PrismaService();
const policy = new SubscriptionPolicyService();
const entitlements = new EntitlementsService(
  prisma,
  policy,
  new TrialGiftVoidService(prisma, policy),
);
const spend = new EntitlementSpendService(
  prisma,
  new StudentEntitlementService(prisma, policy),
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

const poolOf = async (
  centerId: string,
  product: 'PREP_PASS' | 'AI_SPEAKING_CREDIT',
) =>
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
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
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
    expect(added).toBeGreaterThan(29.9);
    expect(added).toBeLessThan(30.1);
  });

  it('restarts from today when the last pass already ran out', async () => {
    // GREATEST(expires_at, now()). Extending from a date in the past would
    // sell a centre thirty days that had already elapsed.
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
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
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
        // 140 unallocated − 12 assigned = 128 left in the school stock.
        { product: 'AI_SPEAKING_CREDIT', balance: 128, frozen: false },
        { product: 'PREP_PASS', balance: 5, frozen: false },
      ]),
    );
    expect(view.capped).toEqual([{ product: 'AI_SPEAKING_CREDIT', seats: 1 }]);
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
    expect(view.capped).toEqual([]);
  });
});

describe('stopping a seat', () => {
  it('returns unused assigned credits to the pool and leaves spent alone', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 20);
    // `cap` is assigned remaining; `used` is lifetime spent.
    await prisma.codeEntitlementCap.create({
      data: {
        code_id: code.id,
        product: 'AI_SPEAKING_CREDIT',
        cap: 4,
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
    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(24);
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

describe('assign / revoke under load', () => {
  it('lets concurrent absolute assigns settle without inventing stock', async () => {
    // Both managers type a new number at once. FOR UPDATE serialises them so
    // the pool moves by the net of the final seat balance, not twice.
    const center = await makeCenter();
    const code = await makeCode(center.id);
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 20);
    await entitlements.setCap(
      identity(center.id),
      code.id,
      'AI_SPEAKING_CREDIT',
      10,
    );

    await Promise.all([
      entitlements.setCap(
        identity(center.id),
        code.id,
        'AI_SPEAKING_CREDIT',
        15,
      ),
      entitlements.setCap(
        identity(center.id),
        code.id,
        'AI_SPEAKING_CREDIT',
        12,
      ),
    ]);

    const cap = await prisma.codeEntitlementCap.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'AI_SPEAKING_CREDIT' },
      },
    });
    const unallocated = await poolOf(center.id, 'AI_SPEAKING_CREDIT');
    expect(cap.cap + unallocated).toBe(20);
    expect([12, 15]).toContain(cap.cap);
  });

  it('does not return a credit that a concurrent spend already burned', async () => {
    const center = await makeCenter();
    const student = await prisma.student.create({
      data: {
        email: `ent-race-${Date.now()}-${Math.random()}@example.com`,
        center_id: center.id,
      },
    });
    const code = await prisma.activationCode.create({
      data: {
        center_id: center.id,
        code: `LQ-RACE-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        status: 'CONNECTED',
        student_id: student.id,
        connected_at: new Date(),
      },
    });
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 0);
    await prisma.codeEntitlementCap.create({
      data: {
        code_id: code.id,
        product: 'AI_SPEAKING_CREDIT',
        cap: 1,
        used: 0,
      },
    });
    for (let i = 0; i < FREE_LIVE_SESSIONS_PER_MONTH; i++) {
      await prisma.aiUsage.create({
        data: { student_id: student.id, operation: 'SPEAKING_LIVE_SESSION' },
      });
    }

    await Promise.allSettled([
      spend.spend(student.id, 'AI_SPEAKING_CREDIT'),
      entitlements.revoke(identity(center.id), code.id, 'AI_SPEAKING_CREDIT'),
    ]);

    const cap = await prisma.codeEntitlementCap.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'AI_SPEAKING_CREDIT' },
      },
    });
    const unallocated = await poolOf(center.id, 'AI_SPEAKING_CREDIT');
    // One credit existed. Either spent (used=1, pool=0) or returned (used=0,
    // pool=1) — never both (used=1 and pool=1). Spend may reject if revoke
    // won the lock first; that is fine.
    expect(cap.cap).toBe(0);
    expect(cap.used + unallocated).toBe(1);
  });
});

describe('the seat list is paged', () => {
  /** A school with more seats than fits in one summary response. */
  async function centreWithCaps(count: number) {
    const center = await makeCenter();
    await fillPool(center.id, 'AI_SPEAKING_CREDIT', 500);
    for (let i = 0; i < count; i++) {
      const code = await makeCode(center.id);
      await prisma.codeEntitlementCap.create({
        data: { code_id: code.id, product: 'AI_SPEAKING_CREDIT', cap: 10 },
      });
    }
    return center;
  }

  it('keeps the overview a summary, not a list of every seat', async () => {
    // A centre with 500 codes across three products would otherwise get
    // 1,500 rows every time the dashboard loads. The overview says how many
    // seats hold a cap; the paged route says which.
    const center = await centreWithCaps(5);

    const view = await entitlements.overview(identity(center.id));

    expect(view).not.toHaveProperty('caps');
    expect(view.capped).toEqual([{ product: 'AI_SPEAKING_CREDIT', seats: 5 }]);
  });

  it('returns one page of seats at a time, with the total', async () => {
    const center = await centreWithCaps(5);

    const page = await entitlements.cappedCodes(
      identity(center.id),
      'AI_SPEAKING_CREDIT',
      { page: 1, pageSize: 2 },
    );

    expect(page.total).toBe(5);
    expect(page.codes).toHaveLength(2);
    expect(page.codes[0]).toMatchObject({ cap: 10, used: 0 });
  });

  it('caps the page size, so one request cannot ask for everything', async () => {
    const center = await centreWithCaps(3);

    const page = await entitlements.cappedCodes(
      identity(center.id),
      'AI_SPEAKING_CREDIT',
      { page: 1, pageSize: 5000 },
    );

    expect(page.pageSize).toBeLessThanOrEqual(100);
  });

  it('shows nothing of another centre', async () => {
    const mine = await makeCenter();
    const theirs = await centreWithCaps(3);

    const page = await entitlements.cappedCodes(
      identity(mine.id),
      'AI_SPEAKING_CREDIT',
      { page: 1, pageSize: 20 },
    );

    expect(page.total).toBe(0);
    expect(theirs).toBeDefined();
  });
});
