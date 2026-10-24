/**
 * One school, from 4,500 FCFA to a spent credit, through the real services.
 *
 * Every step below already has a suite of its own, and each of those builds
 * the step before it by hand: the spend tests create a CONNECTED code
 * directly, the entitlement tests never redeem one, the activation tests
 * never spend. So the pieces are proven and the JOINS are not, and the joins
 * are where this product actually breaks — a cap attached to a code the
 * student does not hold is invisible to every suite that writes its own
 * fixture.
 *
 * This walks the whole path once, in order, with nothing faked but the
 * provider's "the money moved" signal:
 *
 *   trial  →  student redeems  →  school pays for 10 seats
 *          →  school buys 40 credits for that student's seat
 *          →  student spends their five free sessions, then a credit
 *
 * The trap it exists to catch: paying RETIRES the trial code and issues a new
 * one, so the id a manager saw before the payment is dead afterwards. If
 * anything downstream still points at the old code, the school pays and the
 * student gets nothing.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import { CenterTrialService } from '../src/modules/centers/center-trial.service';
import { CodeRedemptionService } from '../src/modules/centers/code-redemption.service';
import { PaymentActivationService } from '../src/modules/centers/payment-activation.service';
import { EntitlementPurchaseService } from '../src/modules/centers/entitlement-purchase.service';
import { EntitlementSpendService, FREE_LIVE_SESSIONS_PER_MONTH } from '../src/shared/services/entitlement-spend.service';
import { StudentEntitlementService } from '../src/shared/services/student-entitlement.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';
import { TrialAddonGate } from '../src/modules/centers/trial-addon-gate';

const prisma = new PrismaService();
const policy = new SubscriptionPolicyService();
const trials = new CenterTrialService(prisma);
const emailStub = {
  sendCodeActivatedToCenter: () => Promise.resolve(),
};
const redemption = new CodeRedemptionService(
  prisma,
  policy,
  emailStub as never,
);
const activation = new PaymentActivationService(prisma, policy);
const purchases = new EntitlementPurchaseService(
  prisma,
  new TrialAddonGate(prisma, policy),
);
const spend = new EntitlementSpendService(
  prisma,
  new StudentEntitlementService(prisma, policy),
);

const START_PRICE_XAF = 4_500;
const SEATS = 10;

async function wipe() {
  await prisma.centerUser.deleteMany({
    where: { email: { startsWith: 'journey-' } },
  });
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'journey-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Journey Test' } },
  });
}

/** A school that could be billed: country, city, a manager with a phone. */
async function makeSchool() {
  const center = await prisma.center.create({
    data: {
      name: `Journey Test ${Date.now()}-${Math.random()}`,
      country_code: 'CM',
      city_id: 'douala',
      logo_url: 'https://cdn.lerniqo.tech/center-logos/test.png',
      subscription: { create: { plan: 'TRIAL' } },
    },
  });
  const manager = await prisma.centerUser.create({
    data: {
      center_id: center.id,
      first_name: 'Journey',
      last_name: 'Manager',
      email: `journey-manager-${Date.now()}-${Math.random()}@example.com`,
      password_hash: 'x',
      phone: '+237600000000',
      email_verified: true,
    },
  });
  return {
    id: center.id,
    identity: { centerId: center.id, centerUserId: manager.id } as never,
  };
}

async function makeStudent() {
  return prisma.student.create({
    data: {
      email: `journey-student-${Date.now()}-${Math.random()}@example.com`,
    },
  });
}

/** What a verified provider event does, and the only thing faked here. */
async function paymentSucceeds(
  centerId: string,
  kind: 'SEATS' | 'AI_SPEAKING_CREDIT',
  quantity: number,
  unitPriceXaf: number,
) {
  const payment = await prisma.payment.create({
    data: {
      center_id: centerId,
      kind,
      quantity,
      unit_price_xaf: unitPriceXaf,
      amount_xaf: quantity * unitPriceXaf,
      idempotency_key: `journey-${Date.now()}-${Math.random()}`,
      request_hash: 'journey',
    },
  });
  await activation.activate(payment.id);
  return payment;
}

const seatOf = (studentId: string) =>
  prisma.activationCode.findFirstOrThrow({
    where: { student_id: studentId, status: 'CONNECTED' },
    select: { id: true, code: true, expires_at: true },
  });

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('a school, from its first 4,500 to a spent credit', () => {
  it('carries one student all the way through', async () => {
    const school = await makeSchool();
    const student = await makeStudent();

    // ---- 1. Pilote Exam Day. Three seats, three codes, fourteen days.
    const trial = await trials.start(school.identity);
    expect(trial.codes).toHaveLength(3);
    expect(trial.codes[0].code).toMatch(/^LQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // ---- 2. The student redeems one, through the real route.
    await redemption.redeem(
      { studentId: student.id },
      trial.codes[0].code,
      'ip',
    );

    const onTrial = await seatOf(student.id);
    expect(onTrial.id).toBe(trial.codes[0].id);
    expect(onTrial.expires_at).not.toBeNull(); // a trial seat has its own clock

    // ---- 3. The school pays: ten seats at 4,500.
    await paymentSucceeds(school.id, 'SEATS', SEATS, START_PRICE_XAF);

    // Ten codes to hand out (retired trial codes do not count).
    const live = await prisma.activationCode.count({
      where: { center_id: school.id, status: { not: 'DEACTIVATED' } },
    });
    expect(live).toBe(SEATS);

    // And the student moved: a NEW code, no expiry of its own, same person.
    const onPaid = await seatOf(student.id);
    expect(onPaid.id).not.toBe(onTrial.id);
    expect(onPaid.expires_at).toBeNull();

    // ---- 4. The school buys forty credits for that student's seat.
    //
    // Naming the seat they hold NOW. This is the join: the id the manager
    // saw before the payment is dead, and buying against it would credit the
    // pool and cap a code nobody holds.
    const order = await purchases.purchase(
      school.identity,
      `journey-${Math.random()}`,
      {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 40,
        codeIds: [onPaid.id],
        capPerCode: 10,
      },
    );
    // 40 x 300 HT, plus the 18% VAT every provider amount now carries.
    expect(order.amountXaf).toBe(14_160);

    // Still nothing granted: the manager has only said what they want.
    await expect(
      prisma.centerEntitlementPool.count({ where: { center_id: school.id } }),
    ).resolves.toBe(0);

    await activation.activate(order.id);

    // ---- 5. The student's five free sessions come first.
    const fresh = await spend.forStudent(student.id);
    expect(fresh).toMatchObject({
      frozen: false,
      aiSpeaking: { freeRemaining: FREE_LIVE_SESSIONS_PER_MONTH, creditsAvailable: 10 },
    });

    for (let i = 0; i < FREE_LIVE_SESSIONS_PER_MONTH; i++) {
      const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');
      expect(decision.allowed).toBe(true);
      await spend.spend(student.id, 'AI_SPEAKING_CREDIT');
      await prisma.aiUsage.create({
        data: {
          student_id: student.id,
          operation: 'SPEAKING_LIVE_SESSION',
          counts_toward_free: true,
        },
      });
    }

    // Free sessions run; unallocated stock is untouched (40 bought,
    // 10 already assigned to this seat → 30 left in the school pool).
    await expect(
      prisma.centerEntitlementPool.findFirstOrThrow({
        where: { center_id: school.id },
        select: { balance: true },
      }),
    ).resolves.toEqual({ balance: 30 });

    // ---- 6. The next session spends an assigned credit (not the pool).
    const sixth = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');
    expect(sixth).toMatchObject({ allowed: true, freeRemaining: 0 });

    await spend.spend(student.id, 'AI_SPEAKING_CREDIT');

    await expect(
      prisma.centerEntitlementPool.findFirstOrThrow({
        where: { center_id: school.id },
        select: { balance: true },
      }),
    ).resolves.toEqual({ balance: 30 });

    await expect(
      prisma.codeEntitlementCap.findFirstOrThrow({
        where: { code_id: onPaid.id },
        select: { cap: true, used: true },
      }),
    ).resolves.toEqual({ cap: 9, used: 1 });
  });

  it('refuses credits bought for a seat that no longer exists', async () => {
    // The trap this file was written to look for. Paying for seats retires
    // the trial code and issues a new one, so a dashboard loaded before the
    // payment is holding a dead id. Buying against it used to be accepted:
    // the money moved, the pool was credited, and the cap was silently
    // dropped at activation because that step filters deactivated codes. The
    // school paid twelve thousand francs and the student it was for could
    // not spend a single session.
    //
    // Told now, before the invoice, rather than discovered afterwards.
    const school = await makeSchool();
    const student = await makeStudent();

    const trial = await trials.start(school.identity);
    await redemption.redeem(
      { studentId: student.id },
      trial.codes[0].code,
      'ip',
    );
    const staleId = trial.codes[0].id;

    await paymentSucceeds(school.id, 'SEATS', SEATS, START_PRICE_XAF);

    // The id the manager's screen was showing a moment ago.
    await expect(
      prisma.activationCode.findUniqueOrThrow({
        where: { id: staleId },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: 'DEACTIVATED' });

    await expect(
      purchases.purchase(school.identity, `journey-${Math.random()}`, {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 40,
        codeIds: [staleId],
        capPerCode: 10,
      }),
    ).rejects.toThrow('CODE_NOT_IN_CENTER');

    // And nothing was charged for.
    await expect(
      prisma.payment.count({
        where: { center_id: school.id, kind: 'AI_SPEAKING_CREDIT' },
      }),
    ).resolves.toBe(0);
  });

  it('freezes the whole thing when the school stops paying, and loses nothing', async () => {
    // The other half of the model: what a school keeps when it lapses. The
    // credits were paid for separately and must still be there on the day
    // they settle up.
    const school = await makeSchool();
    const student = await makeStudent();

    const trial = await trials.start(school.identity);
    await redemption.redeem(
      { studentId: student.id },
      trial.codes[0].code,
      'ip',
    );
    await paymentSucceeds(school.id, 'SEATS', SEATS, START_PRICE_XAF);

    const seat = await seatOf(student.id);
    const order = await purchases.purchase(
      school.identity,
      `journey-${Math.random()}`,
      {
        product: 'AI_SPEAKING_CREDIT',
        quantity: 40,
        codeIds: [seat.id],
        capPerCode: 10,
      },
    );
    await activation.activate(order.id);

    // The period runs out, and more than the grace week passes.
    await prisma.centerSubscription.update({
      where: { center_id: school.id },
      data: { paid_until: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    });

    const lapsed = await spend.forStudent(student.id);
    expect(lapsed.frozen).toBe(true);

    await expect(spend.spend(student.id, 'AI_SPEAKING_CREDIT')).rejects.toThrow(
      'FROZEN',
    );

    // Nothing taken. Unallocated stock and the seat assignment wait.
    await expect(
      prisma.centerEntitlementPool.findFirstOrThrow({
        where: { center_id: school.id },
        select: { balance: true },
      }),
    ).resolves.toEqual({ balance: 30 });
    await expect(
      prisma.codeEntitlementCap.findFirstOrThrow({
        where: { code_id: seat.id },
        select: { cap: true, used: true },
      }),
    ).resolves.toEqual({ cap: 10, used: 0 });
  });
});
