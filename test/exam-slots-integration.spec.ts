/**
 * Buying exam slots, end to end, against real Postgres.
 *
 * Crediting a balance exactly once is a claim about one transaction and one
 * conditional update. A mocked Prisma will credit a replayed webhook twice
 * and report success both times.
 *
 * Runs against the disposable branch in `.env.test`, over the direct endpoint.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { ExamSlotsService } from '../src/modules/centers/exam-slots.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import { PaymentActivationService } from '../src/modules/centers/payment-activation.service';
import { ExamSessionsService } from '../src/modules/centers/exam-sessions.service';
import { ExamParticipantsService } from '../src/modules/centers/exam-participants.service';
import { NotificationsService } from '../src/shared/services/notifications.service';
import { ExamSessionPolicyService } from '../src/modules/centers/exam-session-policy.service';
import { PaymentCheckoutService } from '../src/modules/centers/payment-checkout.service';
import { PaymentWebhookService } from '../src/modules/centers/payment-webhook.service';
import {
  FakePaymentProvider,
  FAKE_SIGNATURE_HEADER,
  signFakeWebhook,
} from '../src/modules/centers/payment-providers/fake-payment-provider';
import { registryOf } from '../src/modules/centers/payment-providers/payment-provider-registry';

const SECRET = 'a-long-enough-fake-webhook-secret-for-tests';

const prisma = new PrismaService();
const slots = new ExamSlotsService(prisma);
const activation = new PaymentActivationService(
  prisma,
  new SubscriptionPolicyService(),
);
const provider = new FakePaymentProvider(SECRET);
const checkout = new PaymentCheckoutService(prisma, registryOf(provider));
const webhooks = new PaymentWebhookService(
  prisma,
  activation,
  registryOf(provider),
);
const policy = new ExamSessionPolicyService();
const sessions = new ExamSessionsService(prisma, policy);
const participants = new ExamParticipantsService(
  prisma,
  policy,
  new NotificationsService(prisma),
);

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'slots-test-' } },
  });
  await prisma.centerUser.deleteMany({
    where: { email: { startsWith: 'slots-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Slots Test' } },
  });
}

/** A center that may be charged: country, city and a manager with a phone. */
async function makeCenter(over: Record<string, unknown> = {}) {
  const center = await prisma.center.create({
    data: {
      name: `Slots Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      logo_url: 'https://cdn.lerniqo.tech/center-logos/test.png',
      subscription: { create: { plan: 'TRIAL' } },
      ...over,
    },
  });
  const manager = await prisma.centerUser.create({
    data: {
      center_id: center.id,
      first_name: 'Slots',
      last_name: 'Tester',
      email: `slots-test-${Date.now()}-${Math.random()}@example.com`,
      password_hash: 'x',
      phone: '+237600000000',
      email_verified: true,
    },
  });
  return {
    center,
    identity: { centerId: center.id, centerUserId: manager.id } as never,
  };
}

const balanceOf = async (centerId: string) =>
  (
    await prisma.center.findUniqueOrThrow({
      where: { id: centerId },
      select: { exam_slots_remaining: true },
    })
  ).exam_slots_remaining;

const subscriptionOf = (centerId: string) =>
  prisma.centerSubscription.findUniqueOrThrow({
    where: { center_id: centerId },
  });

/** A signed provider event, as the webhook route would receive it. */
const delivery = (payload: {
  reference: string;
  outcome: 'SUCCEEDED' | 'FAILED';
}) => {
  const rawBody = Buffer.from(JSON.stringify(payload));
  return {
    rawBody,
    headers: { [FAKE_SIGNATURE_HEADER]: signFakeWebhook(SECRET, rawBody) },
  };
};

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('buying exam slots', () => {
  it('grants nothing until the provider says the money moved', async () => {
    const { center, identity } = await makeCenter();

    const payment = await slots.purchase(identity, 5, 'key-1');

    expect(payment.status).toBe('PENDING');
    await expect(balanceOf(center.id)).resolves.toBe(0);
  });

  it('credits the balance when the payment is activated', async () => {
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ACTIVATED',
    });

    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('adds to a balance rather than replacing it', async () => {
    // Slots are bought over time. A second purchase must not reset the first.
    const { center, identity } = await makeCenter({ exam_slots_remaining: 3 });
    const payment = await slots.purchase(identity, 5, 'key-1');

    await activation.activate(payment.id);

    await expect(balanceOf(center.id)).resolves.toBe(8);
  });

  it('does not extend the subscription, because an exam is not a month', async () => {
    // The whole reason activation branches. A center buying exam slots has
    // not thereby paid for its students to learn.
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');

    await activation.activate(payment.id);

    const subscription = await subscriptionOf(center.id);
    expect(subscription.plan).toBe('TRIAL');
    expect(subscription.paid_until).toBeNull();
  });

  it('leaves the seat row alone', async () => {
    // Seats say how many students may learn; slots say how many may sit an
    // exam. Writing one from the other would sell a school the wrong thing.
    const { center, identity } = await makeCenter();
    await prisma.centerSeat.create({
      data: { center_id: center.id, quantity: 10, unit_price_xaf: 4500 },
    });
    const payment = await slots.purchase(identity, 5, 'key-1');

    await activation.activate(payment.id);

    await expect(
      prisma.centerSeat.findUniqueOrThrow({
        where: { center_id: center.id },
        select: { quantity: true, unit_price_xaf: true },
      }),
    ).resolves.toEqual({ quantity: 10, unit_price_xaf: 4500 });
  });

  it('credits once when the webhook is delivered twice', async () => {
    // Providers retry. The second delivery must change nothing.
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');
    await activation.activate(payment.id);

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ALREADY_ACTIVE',
    });
    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('credits once when two deliveries arrive at the same moment', async () => {
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');

    const results = await Promise.all([
      activation.activate(payment.id),
      activation.activate(payment.id),
    ]);

    expect(results.map((r) => r.outcome).sort()).toEqual([
      'ACTIVATED',
      'ALREADY_ACTIVE',
    ]);
    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('credits nothing when the provider says the payment failed', async () => {
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');

    await expect(activation.markFailed(payment.id)).resolves.toMatchObject({
      outcome: 'MARKED_FAILED',
    });

    await expect(balanceOf(center.id)).resolves.toBe(0);
  });

  it('still credits a success that arrives after a failure', async () => {
    // The provider is the authority on whether money moved. A success
    // delivered late has still taken the center's money, and refusing it
    // would keep the money and grant nothing.
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');
    await activation.markFailed(payment.id);

    await expect(activation.activate(payment.id)).resolves.toMatchObject({
      outcome: 'ACTIVATED',
    });
    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('credits the AI pool, and only the AI pool', async () => {
    // AI slots are not for sale at launch, but a PENDING EXAM_SLOTS_AI payment
    // (from before the gate, or when the product reopens) must still activate
    // into the AI pool — never into seats.
    const { center } = await makeCenter();
    const payment = await prisma.payment.create({
      data: {
        center_id: center.id,
        kind: 'EXAM_SLOTS_AI',
        quantity: 5,
        unit_price_xaf: 1_500,
        amount_net_xaf: 7_500,
        vat_amount_xaf: 1_350,
        amount_xaf: 8_850,
        status: 'PENDING',
        idempotency_key: `key-ai-${Date.now()}`,
        request_hash: `hash-ai-${Date.now()}`,
      },
    });

    await activation.activate(payment.id);

    const after = await prisma.center.findUniqueOrThrow({
      where: { id: center.id },
      select: {
        exam_slots_remaining: true,
        exam_ai_slots_remaining: true,
      },
    });
    expect(after).toEqual({
      exam_slots_remaining: 0,
      exam_ai_slots_remaining: 5,
    });
    // And the subscription is where it was.
    await expect(subscriptionOf(center.id)).resolves.toMatchObject({
      plan: 'TRIAL',
      paid_until: null,
    });
  });

  it('refuses to sell AI slots at launch', async () => {
    const { identity } = await makeCenter();

    await expect(
      slots.purchase(identity, 5, 'key-ai', 'AI'),
    ).rejects.toThrow('EXAM_AI_TIER_NOT_AVAILABLE');
  });

  it('refuses a center that has not finished its profile', async () => {
    const center = await prisma.center.create({
      data: {
        name: `Slots Test incomplete ${Date.now()}`,
        subscription: { create: { plan: 'TRIAL' } },
      },
    });
    const manager = await prisma.centerUser.create({
      data: {
        center_id: center.id,
        first_name: 'Slots',
        last_name: 'Tester',
        email: `slots-test-inc-${Date.now()}@example.com`,
        password_hash: 'x',
        email_verified: true,
      },
    });

    await expect(
      slots.purchase(
        { centerId: center.id, centerUserId: manager.id } as never,
        5,
        'key-1',
      ),
    ).rejects.toThrow('CENTER_PROFILE_INCOMPLETE');
  });
});

describe('a seat payment still behaves as it always did', () => {
  it('extends the paid period and sets seats, untouched by the branch', async () => {
    // The regression this phase most risks: seat payments are live.
    const { center } = await makeCenter();
    const payment = await prisma.payment.create({
      data: {
        center_id: center.id,
        kind: 'SEATS',
        quantity: 10,
        unit_price_xaf: 4500,
        amount_xaf: 45000,
        idempotency_key: `slots-test-${Date.now()}`,
        request_hash: 'test',
      },
    });

    await activation.activate(payment.id);

    const subscription = await subscriptionOf(center.id);
    expect(subscription.plan).toBe('PAID');
    expect(subscription.paid_until).not.toBeNull();
    await expect(
      prisma.centerSeat.findUniqueOrThrow({
        where: { center_id: center.id },
        select: { quantity: true },
      }),
    ).resolves.toEqual({ quantity: 10 });
    // And bought no exam slots on the way.
    await expect(balanceOf(center.id)).resolves.toBe(0);
  });
});

describe('the whole loop', () => {
  it('goes from checkout to a credited balance on a signed provider event', async () => {
    // Not activation called by hand: the path a real payment takes. The
    // webhook knows nothing about exam slots, which is the point of putting
    // them on the payments table.
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');
    const session = await checkout.startCheckout(identity, payment.id, 'fake');

    const event = delivery({
      reference: session.providerReference,
      outcome: 'SUCCEEDED',
    });
    await webhooks.handle(event.rawBody, event.headers);

    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('credits once when the provider delivers the same event twice', async () => {
    const { center, identity } = await makeCenter();
    const payment = await slots.purchase(identity, 5, 'key-1');
    const session = await checkout.startCheckout(identity, payment.id, 'fake');
    const event = delivery({
      reference: session.providerReference,
      outcome: 'SUCCEEDED',
    });

    await webhooks.handle(event.rawBody, event.headers);
    await webhooks.handle(event.rawBody, event.headers);

    await expect(balanceOf(center.id)).resolves.toBe(5);
  });

  it('buys five slots and publishes a sitting for five candidates', async () => {
    // Every piece being right separately is not the same claim as the loop
    // closing. This is the claim the phase exists for.
    const { center, identity } = await makeCenter();

    const payment = await slots.purchase(identity, 5, 'key-1');
    await activation.activate(payment.id);
    expect(await balanceOf(center.id)).toBe(5);

    const students: string[] = [];
    for (let i = 0; i < 5; i++) {
      const student = await prisma.student.create({
        data: {
          email: `slots-test-${i}-${Date.now()}-${Math.random()}@example.com`,
          center_id: center.id,
        },
      });
      students.push(student.id);
    }

    const sitting = await sessions.create(identity, {
      name: 'Slots Test sitting',
      modelltestNumber: 1,
      opensAt: new Date(Date.now() + DAY),
      accessWindowHours: 48,
    });
    await participants.setParticipants(identity, sitting.id, students);

    await expect(
      participants.publish(identity, sitting.id),
    ).resolves.toMatchObject({ slotsSpent: 5, slotsRemaining: 0 });

    // And the next sitting has nothing to spend.
    const second = await sessions.create(identity, {
      name: 'Slots Test second sitting',
      modelltestNumber: 1,
      opensAt: new Date(Date.now() + 2 * DAY),
      accessWindowHours: 24,
    });
    await participants.setParticipants(identity, second.id, [students[0]]);
    await expect(participants.publish(identity, second.id)).rejects.toThrow(
      'NOT_ENOUGH_EXAM_SLOTS',
    );
  });
});
