/**
 * The one function that turns a payment into access.
 *
 * Everything here is a claim about rows and about concurrency, so it runs
 * against the disposable branch in `.env.test` and never against a mock. A
 * mocked Prisma will happily "activate" twice, add seats it should set, and
 * lose a paid_until extension, and report success every time.
 *
 * One plan since 2026-09-23: a center holds one seat row, and a payment
 * carries the price it was quoted at rather than a per-tier breakdown.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { PaymentActivationService } from '../src/modules/centers/payment-activation.service';
import { StudentEntitlementService } from '../src/shared/services/student-entitlement.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

const prisma = new PrismaService();
const activation = new PaymentActivationService(
  prisma,
  new SubscriptionPolicyService(),
);
const entitlement = new StudentEntitlementService(
  prisma,
  new SubscriptionPolicyService(),
);

const DAY_MS = 24 * 60 * 60 * 1000;
/** The database clock and this process's clock differ by network latency. */
const CLOCK_TOLERANCE_MS = 2 * 60 * 1000;

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'activation-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Activation Test' } },
  });
}

/** A fresh trial center: one Start seat at zero, as registration creates. */
async function makeCenter(paidUntil: Date | null = null) {
  return prisma.center.create({
    data: {
      name: `Activation Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      subscription: {
        create: { plan: paidUntil ? 'PAID' : 'TRIAL', paid_until: paidUntil },
      },
      seats: { create: { quantity: 1, unit_price_xaf: 0 } },
    },
  });
}

async function setSeats(centerId: string, quantity: number, price: number) {
  await prisma.centerSeat.deleteMany({ where: { center_id: centerId } });
  await prisma.centerSeat.create({
    data: { center_id: centerId, quantity, unit_price_xaf: price },
  });
}

/**
 * A payment exactly as creation would leave it, at a price chosen by the
 * test. Inserted directly because what is under test is what activation does
 * with the payment, not how it was priced.
 */
async function makePayment(
  centerId: string,
  seats: number,
  price = 4500,
  renewsPeriod = true,
) {
  return prisma.payment.create({
    data: {
      center_id: centerId,
      quantity: seats,
      unit_price_xaf: price,
      amount_xaf: seats * price,
      renews_period: renewsPeriod,
      idempotency_key: `activation-${Date.now()}-${Math.random()}`,
      request_hash: 'test',
    },
  });
}

async function makeStudent(centerId: string) {
  return prisma.student.create({
    data: {
      email: `activation-test-${Date.now()}-${Math.random()}@example.com`,
      center_id: centerId,
    },
  });
}

async function makeCode(centerId: string) {
  return prisma.activationCode.create({
    data: {
      center_id: centerId,
      code: `LQ-ACTV-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    },
  });
}

/** An add-on purchase as the centre's screen would leave it. */
async function makeAddOnPayment(
  centerId: string,
  kind: 'AI_SPEAKING_CREDIT' | 'PREP_PASS',
  quantity: number,
  metadata?: { codeIds: string[]; capPerCode: number },
) {
  const price = kind === 'PREP_PASS' ? 3000 : 300;
  return prisma.payment.create({
    data: {
      center_id: centerId,
      kind,
      quantity,
      unit_price_xaf: price,
      amount_xaf: quantity * price,
      idempotency_key: `activation-${Date.now()}-${Math.random()}`,
      request_hash: 'test',
      ...(metadata ? { metadata } : {}),
    },
  });
}

const poolOf = async (
  centerId: string,
  product: 'AI_SPEAKING_CREDIT' | 'PREP_PASS',
) =>
  (
    await prisma.centerEntitlementPool.findUnique({
      where: { center_id_product: { center_id: centerId, product } },
      select: { balance: true },
    })
  )?.balance ?? null;

const codesOf = (centerId: string) =>
  prisma.activationCode.findMany({
    where: { center_id: centerId },
    select: { code: true, status: true, expires_at: true, student_id: true },
    orderBy: { created_at: 'asc' },
  });

const liveCodeCount = (centerId: string) =>
  prisma.activationCode.count({
    where: { center_id: centerId, status: { not: 'DEACTIVATED' } },
  });

/** A code the centre already holds, as the trial or an earlier payment left it. */
async function giveCode(centerId: string, over: Record<string, unknown> = {}) {
  return prisma.activationCode.create({
    data: {
      center_id: centerId,
      code: `LQ-MINT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      ...over,
    },
  });
}

const seatsOf = (centerId: string) =>
  prisma.centerSeat.findMany({
    where: { center_id: centerId },
    select: { quantity: true, unit_price_xaf: true },
  });

const subscriptionOf = (centerId: string) =>
  prisma.centerSubscription.findUniqueOrThrow({
    where: { center_id: centerId },
  });

const expectNear = (actual: Date | null, expectedMs: number) => {
  expect(actual).not.toBeNull();
  expect(Math.abs(actual!.getTime() - expectedMs)).toBeLessThan(
    CLOCK_TOLERANCE_MS,
  );
};

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('activating a payment', () => {
  it('marks the payment succeeded, once', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    const result = await activation.activate(payment.id);

    expect(result.outcome).toBe('ACTIVATED');
    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(row.status).toBe('SUCCEEDED');
    expectNear(row.succeeded_at, Date.now());
  });

  it('turns a trial center into a paid one for thirty days', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);

    const subscription = await subscriptionOf(center.id);
    expect(subscription.plan).toBe('PAID');
    expectNear(subscription.paid_until, Date.now() + 30 * DAY_MS);
  });

  it('gives the center students access the moment it activates', async () => {
    // The point of all of it. SubscriptionPolicyService derives ACTIVE from
    // paid_until, so nothing else has to be switched on.
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);

    await expect(entitlement.forStudent(student.id)).resolves.toMatchObject({
      status: 'ACTIVE',
      studentsMayLearn: true,
    });
  });

  it('refuses a payment that does not exist', async () => {
    await expect(
      activation.activate('00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('PAYMENT_NOT_FOUND');
  });
});

describe('what activation writes into center_seats', () => {
  it('overwrites the zero-priced trial seat with the paid one', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);

    await expect(seatsOf(center.id)).resolves.toEqual([
      { quantity: 10, unit_price_xaf: 4500 },
    ]);
  });

  it('SETS the quantity rather than adding to it, because it is a total', async () => {
    // A center holding ten that pays for fifteen holds fifteen, not twenty-five.
    const center = await makeCenter();
    await setSeats(center.id, 10, 4500);
    const payment = await makePayment(center.id, 15, 4500);

    await activation.activate(payment.id);

    await expect(seatsOf(center.id)).resolves.toEqual([
      { quantity: 15, unit_price_xaf: 4500 },
    ]);
  });

  it('stamps the price from the payment, not today list price', async () => {
    // Grandfathering. The payment carries the price the center agreed to at
    // quote time; stamping the current constant instead would reprice a
    // center that was promised 4,000.
    const center = await makeCenter();
    await setSeats(center.id, 10, 4000);
    const payment = await makePayment(center.id, 12, 4000);

    await activation.activate(payment.id);

    await expect(seatsOf(center.id)).resolves.toEqual([
      { quantity: 12, unit_price_xaf: 4000 },
    ]);
  });

  it('honours a payment even if the center is now over its seats', async () => {
    // Money has moved. Refusing would take it and grant nothing; being over
    // the limit already blocks new provisioning without evicting anyone.
    const center = await makeCenter();
    for (let i = 0; i < 12; i++) await makeStudent(center.id);
    const payment = await makePayment(center.id, 10, 4500);

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ACTIVATED',
    });
  });
});

describe('paid_until', () => {
  it('extends from the current end while the center is still paid up', async () => {
    // Paying early must not throw away the days already bought.
    const center = await makeCenter(new Date(Date.now() + 10 * DAY_MS));
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);

    expectNear(
      (await subscriptionOf(center.id)).paid_until,
      Date.now() + 40 * DAY_MS,
    );
  });

  it('extends from now when the center had lapsed', async () => {
    // A lapsed center must not buy thirty days that are already in the past.
    const center = await makeCenter(new Date(Date.now() - 20 * DAY_MS));
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);

    expectNear(
      (await subscriptionOf(center.id)).paid_until,
      Date.now() + 30 * DAY_MS,
    );
  });
});

/**
 * D4 rule 3: adding seats never moves the renewal date.
 *
 * The decision is taken when the payment is created, where the clock is the
 * right one to read, and carried on the row. Activation obeys the row rather
 * than looking at the clock again — which is the whole point, since by the time
 * a webhook lands the period may have ended.
 */
describe('a payment that only adds seats', () => {
  it('leaves the period exactly where it was', async () => {
    const endsAt = new Date(Date.now() + 20 * DAY_MS);
    const center = await makeCenter(endsAt);
    await setSeats(center.id, 10, 4500);
    const payment = await makePayment(center.id, 12, 4500, false);

    const result = await activation.activate(payment.id);

    expect((await subscriptionOf(center.id)).paid_until).toEqual(endsAt);
    // Reported as it stands, so a caller cannot mistake it for an extension.
    expect(result.paidUntil).toEqual(endsAt);
    // The seats were still bought. Only the date was left alone.
    await expect(seatsOf(center.id)).resolves.toEqual([
      { quantity: 12, unit_price_xaf: 4500 },
    ]);
  });

  it('leaves it alone even when the webhook lands after the period ended', async () => {
    // The case the stored decision exists for. A school adds two seats on its
    // last day; the provider delivers the next morning. Re-reading the clock
    // here would see a lapsed centre, call it a renewal, and hand it a month
    // it never paid for.
    const endedAt = new Date(Date.now() - 2 * DAY_MS);
    const center = await makeCenter(endedAt);
    await setSeats(center.id, 10, 4500);
    const payment = await makePayment(center.id, 12, 4500, false);

    await activation.activate(payment.id);

    expect((await subscriptionOf(center.id)).paid_until).toEqual(endedAt);
  });

  it('leaves the anchor day alone when the webhook lands after the grace', async () => {
    // A school adds a seat on its last day; the provider delivers ten days
    // later, so the centre reads as BLOCKED here. The anchor day exists to say
    // which day of the month its periods end on — a payment that bought no
    // period must not rewrite it.
    const center = await makeCenter(new Date(Date.now() - 10 * DAY_MS));
    await prisma.centerSubscription.update({
      where: { center_id: center.id },
      data: { anchor_day: 7 },
    });
    await setSeats(center.id, 10, 4500);
    const payment = await makePayment(center.id, 12, 4500, false);

    await activation.activate(payment.id);

    expect((await subscriptionOf(center.id)).anchor_day).toBe(7);
  });

  it('still mints the codes the added seats paid for', async () => {
    const center = await makeCenter(new Date(Date.now() + 20 * DAY_MS));
    await setSeats(center.id, 10, 4500);
    const payment = await makePayment(center.id, 12, 4500, false);

    await activation.activate(payment.id);

    expect(await liveCodeCount(center.id)).toBe(12);
  });
});

/**
 * A renewal may shrink (D4 rule 5), and seats are the code pool (D1). Without
 * handing the surplus back, a school renewing seventeen seats as twelve would
 * keep seventeen working codes on twelve seats' money — paid codes carry no
 * expiry of their own, so nothing else would ever take them away.
 */
describe('a renewal into a smaller pack', () => {
  it('deactivates the codes it stopped paying for', async () => {
    const center = await makeCenter(new Date(Date.now() - DAY_MS));
    await setSeats(center.id, 17, 4500);
    for (let i = 0; i < 17; i++) await giveCode(center.id);
    const payment = await makePayment(center.id, 12, 4500);

    await activation.activate(payment.id);

    expect(await liveCodeCount(center.id)).toBe(12);
  });

  it('never takes a code off a student who is using it', async () => {
    // This file does not evict. A pack that somehow shrinks below the students
    // holding codes sheds what nobody holds and leaves the rest; the seat
    // floors are what stop the order being accepted in the first place.
    const center = await makeCenter(new Date(Date.now() - DAY_MS));
    await setSeats(center.id, 17, 4500);
    for (let i = 0; i < 14; i++) await giveCode(center.id);
    const student = await makeStudent(center.id);
    await giveCode(center.id, {
      status: 'CONNECTED',
      student_id: student.id,
      connected_at: new Date(),
    });
    const payment = await makePayment(center.id, 12, 4500);

    await activation.activate(payment.id);

    const connected = await prisma.activationCode.count({
      where: { center_id: center.id, status: 'CONNECTED' },
    });
    expect(connected).toBe(1);
    expect(await liveCodeCount(center.id)).toBe(12);
  });

  it('records why each code was taken back', async () => {
    const center = await makeCenter(new Date(Date.now() - DAY_MS));
    await setSeats(center.id, 17, 4500);
    for (let i = 0; i < 17; i++) await giveCode(center.id);
    const payment = await makePayment(center.id, 12, 4500);

    await activation.activate(payment.id);

    const events = await prisma.activationCodeEvent.count({
      where: { center_id: center.id, to_status: 'DEACTIVATED' },
    });
    expect(events).toBe(5);
  });
});

describe('exactly once', () => {
  it('ignores a repeated activation of the same payment', async () => {
    // A provider that retries a webhook, or delivers it twice.
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    await activation.activate(payment.id);
    const first = (await subscriptionOf(center.id)).paid_until;

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ALREADY_ACTIVE',
    });
    expect((await subscriptionOf(center.id)).paid_until).toEqual(first);
  });

  it('extends only once when the same payment is activated concurrently', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    const results = await Promise.all([
      activation.activate(payment.id),
      activation.activate(payment.id),
    ]);

    expect(results.map((r) => r.outcome).sort()).toEqual([
      'ACTIVATED',
      'ALREADY_ACTIVE',
    ]);
    // Thirty days, not sixty.
    expectNear(
      (await subscriptionOf(center.id)).paid_until,
      Date.now() + 30 * DAY_MS,
    );
  });

  it('keeps both extensions when two different payments activate at once', async () => {
    // A read-then-write of paid_until would lose one of them.
    const center = await makeCenter();
    const a = await makePayment(center.id, 10, 4500);
    const b = await makePayment(center.id, 10, 4500);

    await Promise.all([activation.activate(a.id), activation.activate(b.id)]);

    expectNear(
      (await subscriptionOf(center.id)).paid_until,
      Date.now() + 60 * DAY_MS,
    );
  });
});

describe('failure', () => {
  it('marks a pending payment failed', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);

    await expect(activation.markFailed(payment.id)).resolves.toMatchObject({
      outcome: 'MARKED_FAILED',
    });

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(row.status).toBe('FAILED');
    expectNear(row.failed_at, Date.now());
    // And grants nothing.
    expect((await subscriptionOf(center.id)).paid_until).toBeNull();
  });

  it('never undoes a success', async () => {
    // A failure event arriving after the success, out of order.
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);
    await activation.activate(payment.id);

    await expect(activation.markFailed(payment.id)).resolves.toMatchObject({
      outcome: 'UNCHANGED',
    });
    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(row.status).toBe('SUCCEEDED');
  });

  it('still activates a payment that succeeds after being marked failed', async () => {
    // The provider is the authority on whether money moved. A success that
    // arrives late has still taken the center's money.
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10, 4500);
    await activation.markFailed(payment.id);

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ACTIVATED',
    });
    expect((await subscriptionOf(center.id)).plan).toBe('PAID');
  });
});

describe('the provider reference', () => {
  it('cannot be shared by two payments', async () => {
    // One provider transaction must never be applied to two payments.
    const center = await makeCenter();
    const a = await makePayment(center.id, 10, 4500);
    const b = await makePayment(center.id, 10, 4500);
    await prisma.payment.update({
      where: { id: a.id },
      data: { provider_reference: 'ref-1' },
    });

    await expect(
      prisma.payment.update({
        where: { id: b.id },
        data: { provider_reference: 'ref-1' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows any number of payments with no reference yet', async () => {
    const center = await makeCenter();
    await makePayment(center.id, 10, 4500);
    await makePayment(center.id, 10, 4500);

    await expect(
      prisma.payment.count({
        where: { center_id: center.id, provider_reference: null },
      }),
    ).resolves.toBe(2);
  });
});

describe('an add-on payment', () => {
  it('credits the pool rather than the subscription', async () => {
    // Buying credits is not paying for Start. A centre that tops up must not
    // thereby extend the period it owes money for.
    const center = await makeCenter();
    const payment = await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40);

    const result = await activation.activate(payment.id);

    expect(result.outcome).toBe('ACTIVATED');
    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(40);
    expect(result.paidUntil).toBeNull();
  });

  it('adds to a pool that already exists', async () => {
    // Buying twice accumulates. The history of who bought what is `payments`;
    // a second ledger here would be a second thing to keep true.
    const center = await makeCenter();
    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );
    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 25)).id,
    );

    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(65);
  });

  it('keeps the products in separate pots', async () => {
    const center = await makeCenter();
    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );
    await activation.activate(
      (await makeAddOnPayment(center.id, 'PREP_PASS', 6)).id,
    );

    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(40);
    await expect(poolOf(center.id, 'PREP_PASS')).resolves.toBe(6);
  });

  it('applies the caps the manager chose at purchase', async () => {
    // The choice was made hours earlier and nothing may be granted before
    // money moves, so it travelled on the payment.
    const center = await makeCenter();
    const first = await makeCode(center.id);
    const second = await makeCode(center.id);
    const payment = await makeAddOnPayment(
      center.id,
      'AI_SPEAKING_CREDIT',
      20,
      { codeIds: [first.id, second.id], capPerCode: 10 },
    );

    await activation.activate(payment.id);

    const caps = await prisma.codeEntitlementCap.findMany({
      where: { code_id: { in: [first.id, second.id] } },
      select: { cap: true, used: true },
    });
    expect(caps).toHaveLength(2);
    expect(caps.every((row) => row.cap === 10 && row.used === 0)).toBe(true);
  });

  it('raises a cap that already exists rather than replacing it', async () => {
    // A second purchase for the same seat is more allowance, not a reset —
    // and a reset would silently undo a cap a manager had raised by hand.
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

    await activation.activate(
      (
        await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 10, {
          codeIds: [code.id],
          capPerCode: 10,
        })
      ).id,
    );

    const cap = await prisma.codeEntitlementCap.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'AI_SPEAKING_CREDIT' },
      },
    });
    expect(cap.cap).toBe(20);
    expect(cap.used).toBe(6);
  });

  it('still credits the pool when a chosen code has since been deactivated', async () => {
    // The money moved. A grant that cannot be fully applied must not fail the
    // activation and leave the centre paying for nothing.
    const center = await makeCenter();
    const live = await makeCode(center.id);
    const gone = await makeCode(center.id);
    await prisma.activationCode.update({
      where: { id: gone.id },
      data: { status: 'DEACTIVATED' },
    });

    await activation.activate(
      (
        await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 20, {
          codeIds: [live.id, gone.id],
          capPerCode: 10,
        })
      ).id,
    );

    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(20);
    const caps = await prisma.codeEntitlementCap.findMany({
      where: { code_id: { in: [live.id, gone.id] } },
    });
    expect(caps.map((row) => row.code_id)).toEqual([live.id]);
  });

  it('ignores a code belonging to another centre', async () => {
    // Metadata is client-supplied and re-validated here. Without the check a
    // centre could cap a rival's seat by sending its id.
    const mine = await makeCenter();
    const theirs = await makeCenter();
    const theirCode = await makeCode(theirs.id);

    await activation.activate(
      (
        await makeAddOnPayment(mine.id, 'AI_SPEAKING_CREDIT', 10, {
          codeIds: [theirCode.id],
          capPerCode: 10,
        })
      ).id,
    );

    await expect(poolOf(mine.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(10);
    await expect(
      prisma.codeEntitlementCap.findMany({ where: { code_id: theirCode.id } }),
    ).resolves.toHaveLength(0);
  });

  it('grants once when the same webhook arrives twice', async () => {
    const center = await makeCenter();
    const code = await makeCode(center.id);
    const payment = await makeAddOnPayment(
      center.id,
      'AI_SPEAKING_CREDIT',
      40,
      { codeIds: [code.id], capPerCode: 10 },
    );

    await activation.activate(payment.id);
    const second = await activation.activate(payment.id);

    expect(second.outcome).toBe('ALREADY_ACTIVE');
    await expect(poolOf(center.id, 'AI_SPEAKING_CREDIT')).resolves.toBe(40);
    const cap = await prisma.codeEntitlementCap.findUniqueOrThrow({
      where: {
        code_id_product: { code_id: code.id, product: 'AI_SPEAKING_CREDIT' },
      },
    });
    expect(cap.cap).toBe(10);
  });

  it('leaves the seat count alone', async () => {
    // Credits are not seats. A centre that buys an add-on has not bought
    // anybody the right to learn.
    const center = await makeCenter();
    await setSeats(center.id, 10, 4500);

    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );

    await expect(seatsOf(center.id)).resolves.toEqual([
      { quantity: 10, unit_price_xaf: 4500 },
    ]);
  });
});

describe('a paid centre gets codes to hand out', () => {
  // The P0. Until this existed, activation set the seat count and the paid
  // period and minted nothing, so a school could pay for ten places and
  // enrol one student — the one holding the trial code.

  it('mints one code per seat when the centre holds none', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10);

    await activation.activate(payment.id);

    const codes = await codesOf(center.id);
    expect(codes).toHaveLength(10);
    expect(codes.every((row) => row.status === 'ACTIVATED')).toBe(true);
  });

  it('gives paid codes no expiry of their own', async () => {
    // They follow `paid_until`. A date here would be a second thing to keep
    // true, and it would go stale the moment the centre renews.
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 3)).id);

    const codes = await codesOf(center.id);
    expect(codes.every((row) => row.expires_at === null)).toBe(true);
  });

  it('tops up rather than replacing what the centre already holds', async () => {
    // Ten seats with one code already means nine new ones. Never ten, and
    // never deleting the one that exists — somebody may be using it.
    const center = await makeCenter();
    const existing = await giveCode(center.id, { status: 'CONNECTED' });

    await activation.activate((await makePayment(center.id, 10)).id);

    const codes = await codesOf(center.id);
    expect(codes).toHaveLength(10);
    expect(codes.map((row) => row.code)).toContain(existing.code);
  });

  it('does not count deactivated codes toward the quota', async () => {
    // DEACTIVATED is terminal: nothing brings a code back. Counting them
    // would quietly cost the school a seat it keeps paying for, every time a
    // manager takes one back.
    const center = await makeCenter();
    await giveCode(center.id, { status: 'DEACTIVATED' });
    await giveCode(center.id, { status: 'DEACTIVATED' });
    await giveCode(center.id, { status: 'ACTIVATED' });

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(liveCodeCount(center.id)).resolves.toBe(10);
    // The dead ones are history, and history is not deleted.
    await expect(codesOf(center.id)).resolves.toHaveLength(12);
  });

  it('mints nothing the second time the same webhook arrives', async () => {
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10);

    await activation.activate(payment.id);
    await activation.activate(payment.id);

    await expect(codesOf(center.id)).resolves.toHaveLength(10);
  });

  it('mints nothing extra when the centre pays a second time', async () => {
    // Renewal, and the case the counting actually exists for. A replayed
    // webhook never reaches here — the payment is already SUCCEEDED and
    // activation returns early — so the same payment twice proves nothing
    // about minting. Two DIFFERENT payments do: without counting what is
    // already held, a school that renews would end up with twenty codes for
    // ten seats, and twenty places to learn for the price of ten.
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 10)).id);
    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(codesOf(center.id)).resolves.toHaveLength(10);
  });

  it('mints up to the new quota when the centre buys more seats', async () => {
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 10)).id);
    await activation.activate((await makePayment(center.id, 16)).id);

    await expect(codesOf(center.id)).resolves.toHaveLength(16);
  });

  it('mints nothing when two activations race', async () => {
    // The count is taken inside the transaction that mints, so the second
    // sees the first's rows. Counting outside would hand a school twenty
    // codes for ten seats.
    const center = await makeCenter();
    const payment = await makePayment(center.id, 10);

    await Promise.allSettled([
      activation.activate(payment.id),
      activation.activate(payment.id),
    ]);

    await expect(codesOf(center.id)).resolves.toHaveLength(10);
  });

  it('mints nothing for a centre already at its quota', async () => {
    const center = await makeCenter();
    for (let i = 0; i < 10; i++) await giveCode(center.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(codesOf(center.id)).resolves.toHaveLength(10);
  });

  it('gives every code a distinct value', async () => {
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 10)).id);

    const codes = await codesOf(center.id);
    expect(new Set(codes.map((row) => row.code)).size).toBe(10);
    expect(
      codes.every((row) => /^LQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(row.code)),
    ).toBe(true);
  });

  it('mints nothing for an add-on payment', async () => {
    // Credits are not seats. Buying them must not hand out places to learn.
    const center = await makeCenter();

    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );

    await expect(codesOf(center.id)).resolves.toHaveLength(0);
  });
});

describe('the trial code is retired when a school starts paying', () => {
  // D4 rule 2: "A trial student is moved to a paid code automatically and the
  // trial code is retired." A trial code carries an expiry of its own; a paid
  // one follows `paid_until`. Leaving the student on the trial code would cut
  // them off on the old trial date, days after their school paid.

  /** The trial, as `center-trial.service` leaves it: one code with a date. */
  async function trialCode(centerId: string, studentId?: string) {
    return prisma.activationCode.create({
      data: {
        center_id: centerId,
        code: `LQ-TRIA-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        expires_at: new Date(Date.now() + 5 * DAY_MS),
        ...(studentId
          ? {
              status: 'CONNECTED' as const,
              student_id: studentId,
              linked_name: 'Awa Mbarga',
              linked_email: 'awa@example.com',
              connected_at: new Date(),
            }
          : {}),
      },
    });
  }

  it('moves the student onto a paid code and retires the old one', async () => {
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    const trial = await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const retired = await prisma.activationCode.findUniqueOrThrow({
      where: { id: trial.id },
    });
    expect(retired.status).toBe('DEACTIVATED');

    const paid = await prisma.activationCode.findFirstOrThrow({
      where: { center_id: center.id, status: 'CONNECTED' },
    });
    expect(paid.id).not.toBe(trial.id);
    expect(paid.student_id).toBe(student.id);
    expect(paid.expires_at).toBeNull();
  });

  it('keeps the student attached to their school', async () => {
    // The ordinary deactivation path clears `center_id` — that is how a
    // manager removes somebody. Doing it here would cut off the very student
    // the school has just paid for.
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const after = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
      select: { center_id: true },
    });
    expect(after.center_id).toBe(center.id);
  });

  it('carries the student name and email onto the new code', async () => {
    // A manager looking at the Users page should see the same person on the
    // seat, not an empty row that happens to be connected.
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const paid = await prisma.activationCode.findFirstOrThrow({
      where: { center_id: center.id, status: 'CONNECTED' },
    });
    expect(paid).toMatchObject({
      linked_name: 'Awa Mbarga',
      linked_email: 'awa@example.com',
    });
    expect(paid.connected_at).not.toBeNull();
  });

  it('still ends at exactly one code per seat', async () => {
    // The move must not cost the school a place, nor hand it a spare.
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(liveCodeCount(center.id)).resolves.toBe(10);
  });

  it('retires a trial code nobody redeemed', async () => {
    // Left alone it would expire on the old trial date, and a school would
    // hand out a code that dies in a week.
    const center = await makeCenter();
    const unused = await trialCode(center.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const after = await prisma.activationCode.findUniqueOrThrow({
      where: { id: unused.id },
    });
    expect(after.status).toBe('DEACTIVATED');
    await expect(liveCodeCount(center.id)).resolves.toBe(10);
  });

  it('leaves no code carrying an expiry of its own', async () => {
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    await trialCode(center.id, student.id);
    await trialCode(center.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const live = await prisma.activationCode.findMany({
      where: { center_id: center.id, status: { not: 'DEACTIVATED' } },
      select: { expires_at: true },
    });
    expect(live.every((row) => row.expires_at === null)).toBe(true);
  });

  it('records the move, so it can be explained afterwards', async () => {
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    const trial = await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);

    const events = await prisma.activationCodeEvent.findMany({
      where: { center_id: center.id },
      orderBy: { created_at: 'asc' },
    });
    const retirement = events.find((event) => event.code_id === trial.id);
    expect(retirement).toMatchObject({
      from_status: 'CONNECTED',
      to_status: 'DEACTIVATED',
      student_id: student.id,
      // Nobody at the school acted: the payment did.
      center_user_id: null,
    });
  });

  it('does nothing on a renewal, because no trial code is left', async () => {
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    await trialCode(center.id, student.id);

    await activation.activate((await makePayment(center.id, 10)).id);
    const afterFirst = await prisma.activationCode.count({
      where: { center_id: center.id },
    });

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(
      prisma.activationCode.count({ where: { center_id: center.id } }),
    ).resolves.toBe(afterFirst);
    await expect(liveCodeCount(center.id)).resolves.toBe(10);
  });

  it('leaves an add-on payment well alone', async () => {
    const center = await makeCenter();
    const student = await makeStudent(center.id);
    const trial = await trialCode(center.id, student.id);

    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );

    const after = await prisma.activationCode.findUniqueOrThrow({
      where: { id: trial.id },
    });
    expect(after.status).toBe('CONNECTED');
  });
});

describe('the anchor day', () => {
  // D4 rule 9: every period of a centre ends on the same day of the month,
  // counted in Africa/Douala. Stored now because it cannot be recovered
  // later — the day a school first paid is only knowable on the day it pays
  // — and because `code-reset-allowance.ts` already says in a comment that
  // it is waiting for the column.

  /** Today, where the rule says to count it. */
  const doualaDay = () =>
    new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Africa/Douala' }),
    ).getDate();

  /**
   * A day that is definitely not today.
   *
   * Pinning a fixture to a literal 1 made two of these tests pass on the 1st
   * of the month whatever the code did, and fail on the 2nd. A fixture that
   * is only correct one day in thirty is worse than no fixture.
   */
  const someOtherDay = () => (doualaDay() % 28) + 1;

  const anchorOf = async (centerId: string) =>
    (
      await prisma.centerSubscription.findUniqueOrThrow({
        where: { center_id: centerId },
        select: { anchor_day: true },
      })
    ).anchor_day;

  it('is set by the first payment', async () => {
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 10)).id);

    const day = await anchorOf(center.id);
    expect(day).not.toBeNull();
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });

  it('is the day in Douala, not in UTC', async () => {
    // Africa/Douala is UTC+1, so anything after 23:00 UTC is already
    // tomorrow there. A school paying at 23:30 on the 31st anchors on the
    // 1st, and billing it on the 31st would be a day early every month.
    const center = await makeCenter();

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(anchorOf(center.id)).resolves.toBe(doualaDay());
  });

  it('is not moved by a later payment', async () => {
    // Rule 3: adding seats mid-period never moves the renewal date. A school
    // that buys six more seats on the 5th still renews on the 1st.
    const center = await makeCenter();
    await activation.activate((await makePayment(center.id, 10)).id);

    const pinned = someOtherDay();
    await prisma.centerSubscription.update({
      where: { center_id: center.id },
      data: { anchor_day: pinned },
    });
    await activation.activate((await makePayment(center.id, 16)).id);

    await expect(anchorOf(center.id)).resolves.toBe(pinned);
  });

  it('starts again when a blocked centre pays', async () => {
    // Rule 7: more than seven days late and the centre is blocked; paying
    // then starts a new period that day, because the blocked days are not
    // charged. Keeping the old anchor would bill them for time they spent
    // locked out.
    const center = await makeCenter(new Date(Date.now() - 60 * DAY_MS));
    await prisma.centerSubscription.update({
      where: { center_id: center.id },
      data: { anchor_day: someOtherDay() },
    });

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(anchorOf(center.id)).resolves.toBe(doualaDay());
  });

  it('is left alone by a centre still inside its grace period', async () => {
    // Rule 7 again, the other half: up to seven days late the anchor does
    // not change. Only being blocked resets it.
    const center = await makeCenter(new Date(Date.now() - 2 * DAY_MS));
    const pinned = someOtherDay();
    await prisma.centerSubscription.update({
      where: { center_id: center.id },
      data: { anchor_day: pinned },
    });

    await activation.activate((await makePayment(center.id, 10)).id);

    await expect(anchorOf(center.id)).resolves.toBe(pinned);
  });

  it('is not touched by an add-on payment', async () => {
    const center = await makeCenter();
    await activation.activate((await makePayment(center.id, 10)).id);
    const first = await anchorOf(center.id);

    await activation.activate(
      (await makeAddOnPayment(center.id, 'AI_SPEAKING_CREDIT', 40)).id,
    );

    await expect(anchorOf(center.id)).resolves.toBe(first);
  });
});
