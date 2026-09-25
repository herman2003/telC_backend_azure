/**
 * The interface every paid add-on goes through, against real Postgres.
 *
 * Two claims a mock cannot make: that the pool and the cap move together or
 * not at all, and that two sessions started at the same instant cannot both
 * take the last credit. Everything else here is about the order of the rules,
 * which is cheap to check and expensive to get wrong.
 */
import { PrismaService } from '../src/shared/services/prisma.service';
import {
  EntitlementSpendService,
  FREE_LIVE_SESSIONS_PER_MONTH,
} from '../src/shared/services/entitlement-spend.service';
import { StudentEntitlementService } from '../src/shared/services/student-entitlement.service';
import { SubscriptionPolicyService } from '../src/modules/centers/subscription-policy.service';

const prisma = new PrismaService();
const spend = new EntitlementSpendService(
  prisma,
  new StudentEntitlementService(prisma, new SubscriptionPolicyService()),
);

const DAY_MS = 24 * 60 * 60 * 1000;

async function wipe() {
  await prisma.student.deleteMany({
    where: { email: { startsWith: 'spend-test-' } },
  });
  await prisma.center.deleteMany({
    where: { name: { startsWith: 'Spend Test' } },
  });
}

/** A paid centre, one student, one connected code: the ordinary case. */
async function makeSeat(
  paidUntil: Date | null = new Date(Date.now() + 30 * DAY_MS),
) {
  const center = await prisma.center.create({
    data: {
      name: `Spend Test ${Date.now()}-${Math.random()}`,
      subscription: {
        create: { plan: paidUntil ? 'PAID' : 'TRIAL', paid_until: paidUntil },
      },
    },
  });
  const student = await prisma.student.create({
    data: {
      email: `spend-test-${Date.now()}-${Math.random()}@example.com`,
      center_id: center.id,
    },
  });
  const code = await prisma.activationCode.create({
    data: {
      center_id: center.id,
      code: `LQ-SPD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      status: 'CONNECTED',
      student_id: student.id,
      connected_at: new Date(),
    },
  });
  return { center, student, code };
}

async function fillPool(centerId: string, balance: number) {
  await prisma.centerEntitlementPool.create({
    data: { center_id: centerId, product: 'AI_SPEAKING_CREDIT', balance },
  });
}

async function setCap(codeId: string, cap: number, used = 0) {
  await prisma.codeEntitlementCap.create({
    data: { code_id: codeId, product: 'AI_SPEAKING_CREDIT', cap, used },
  });
}

/** Sessions already run this month. */
async function usedSessions(studentId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await prisma.aiUsage.create({
      data: { student_id: studentId, operation: 'SPEAKING_LIVE_SESSION' },
    });
  }
}

const poolOf = async (centerId: string) =>
  (
    await prisma.centerEntitlementPool.findUniqueOrThrow({
      where: {
        center_id_product: {
          center_id: centerId,
          product: 'AI_SPEAKING_CREDIT',
        },
      },
      select: { balance: true },
    })
  ).balance;

const capOf = async (codeId: string) =>
  prisma.codeEntitlementCap.findUniqueOrThrow({
    where: {
      code_id_product: { code_id: codeId, product: 'AI_SPEAKING_CREDIT' },
    },
    select: { cap: true, used: true },
  });

beforeEach(wipe);

afterAll(async () => {
  await wipe();
  await prisma.onModuleDestroy();
});

describe('the free allowance comes first', () => {
  it('lets a student with none of it spent through, without a cap', async () => {
    // Start includes five a month. A student who has never had a credit
    // assigned still gets those five.
    const { student } = await makeSeat();

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({
      allowed: true,
      reason: null,
      freeRemaining: FREE_LIVE_SESSIONS_PER_MONTH,
    });
  });

  it('spends nothing from the centre while free sessions remain', async () => {
    const { center, student, code } = await makeSeat();
    await fillPool(center.id, 40);
    await setCap(code.id, 10);

    await spend.spend(student.id, 'AI_SPEAKING_CREDIT');

    await expect(poolOf(center.id)).resolves.toBe(40);
    await expect(capOf(code.id)).resolves.toMatchObject({ used: 0 });
  });

  it('counts down as sessions are run', async () => {
    const { student } = await makeSeat();
    await usedSessions(student.id, 3);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.freeRemaining).toBe(2);
  });

  it('ignores sessions run in an earlier month', async () => {
    // The window is the calendar month, so last month's five must not count
    // against this month's.
    const { student } = await makeSeat();
    await usedSessions(student.id, 5);
    await prisma.aiUsage.updateMany({
      where: { student_id: student.id },
      data: { created_at: new Date('2026-08-15T00:00:00.000Z') },
    });

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.freeRemaining).toBe(FREE_LIVE_SESSIONS_PER_MONTH);
  });
});

describe('once the free allowance is gone', () => {
  it('draws on the centre pool, against the cap', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 40);
    await setCap(code.id, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');
    await spend.spend(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: true, freeRemaining: 0 });
    await expect(poolOf(center.id)).resolves.toBe(39);
    await expect(capOf(code.id)).resolves.toMatchObject({ used: 1 });
  });

  it('reports the smaller of the pool and what is left of the cap', async () => {
    // One number, not two. Two would leave every client working out the same
    // minimum and one of them getting it wrong.
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 3);
    await setCap(code.id, 10, 2);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.creditsAvailable).toBe(3);
  });

  it('says NO_CAP when the centre has credits and this seat has none', async () => {
    // Different from being out of credits, and the app offers something
    // different: ask your centre, rather than your centre should buy more.
    const { center, student } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 40);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'NO_CAP' });
  });

  it('says CAP_REACHED when this seat has spent its allowance', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 40);
    await setCap(code.id, 10, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'CAP_REACHED' });
  });

  it('says POOL_EMPTY when the centre has run out', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 0);
    await setCap(code.id, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'POOL_EMPTY' });
  });
});

describe('the freeze', () => {
  it('refuses everything when the centre stopped paying', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillPool(center.id, 60);
    await setCap(code.id, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'FROZEN' });
  });

  it('takes nothing away', async () => {
    // The credits were paid for. They wait.
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillPool(center.id, 60);
    await setCap(code.id, 10, 4);

    await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    await expect(poolOf(center.id)).resolves.toBe(60);
    await expect(capOf(code.id)).resolves.toMatchObject({ cap: 10, used: 4 });
  });

  it('is not the same answer as being out of credits', async () => {
    // FROZEN and POOL_EMPTY need different sentences: one is the centre's
    // problem to fix, the other is a purchase.
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillPool(center.id, 0);
    await setCap(code.id, 0);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.reason).toBe('FROZEN');
  });
});

describe('spending under load', () => {
  it('lets exactly one of two simultaneous spends take the last credit', async () => {
    const first = await makeSeat();
    const second = await prisma.student.create({
      data: {
        email: `spend-test-b-${Date.now()}-${Math.random()}@example.com`,
        center_id: first.center.id,
      },
    });
    const secondCode = await prisma.activationCode.create({
      data: {
        center_id: first.center.id,
        code: `LQ-SPD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        status: 'CONNECTED',
        student_id: second.id,
        connected_at: new Date(),
      },
    });
    await usedSessions(first.student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await usedSessions(second.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(first.center.id, 1);
    await setCap(first.code.id, 10);
    await setCap(secondCode.id, 10);

    const outcomes = await Promise.allSettled([
      spend.spend(first.student.id, 'AI_SPEAKING_CREDIT'),
      spend.spend(second.id, 'AI_SPEAKING_CREDIT'),
    ]);

    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = outcomes.find(
      (outcome) => outcome.status === 'rejected',
    ) as PromiseRejectedResult;
    expect((rejected.reason as Error).message).toContain(
      'NO_CREDITS_REMAINING',
    );
    await expect(poolOf(first.center.id)).resolves.toBe(0);
  });

  it('gives the credit back when the cap refuses it', async () => {
    // The pool and the cap move together or not at all. A seat that may not
    // spend must not cost the centre a credit on its way to being refused.
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 40);
    await setCap(code.id, 10, 10);

    await expect(spend.spend(student.id, 'AI_SPEAKING_CREDIT')).rejects.toThrow(
      'NO_CREDITS_REMAINING',
    );

    await expect(poolOf(center.id)).resolves.toBe(40);
  });
});

describe('what the student reads', () => {
  it('answers all three products and the freeze in one call', async () => {
    const { center, student, code } = await makeSeat();
    await fillPool(center.id, 40);
    await setCap(code.id, 10);
    await usedSessions(student.id, 2);
    await prisma.codeEntitlement.create({
      data: {
        code_id: code.id,
        product: 'PREP_PASS',
        expires_at: new Date(Date.now() + 40 * DAY_MS),
      },
    });

    const mine = await spend.forStudent(student.id);

    expect(mine).toMatchObject({
      prepPass: { active: true },
      aiAssisted: { active: false, expiresAt: null },
      aiSpeaking: { freeRemaining: 3, creditsAvailable: 10 },
      frozen: false,
    });
  });

  it('shows what is waiting rather than zeroes when the centre has lapsed', async () => {
    // The screen that explains why nothing works. Reporting nothing would
    // leave the app unable to tell "you have none" from "yours are frozen".
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillPool(center.id, 60);
    await setCap(code.id, 10);

    const mine = await spend.forStudent(student.id);

    expect(mine.frozen).toBe(true);
    expect(mine.prepPass.active).toBe(false);
  });

  it('caps what it reports at what the seat may actually draw', async () => {
    // The pool holds forty, this seat may take four more. Four is the number
    // the student can use, and the only one worth showing them.
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 40);
    await setCap(code.id, 10, 6);

    const mine = await spend.forStudent(student.id);

    expect(mine.aiSpeaking).toMatchObject({
      freeRemaining: 0,
      creditsAvailable: 4,
    });
  });
});

describe('spending is guarded on its own, not only by mayUse', () => {
  it('refuses to spend credits a frozen centre still holds', async () => {
    // mayUse checks the freeze, and every caller is supposed to ask it first.
    // That is not enough: a centre can lapse between the two calls, and a
    // caller written later may simply not ask. Either way the harm is the
    // same — money the centre paid for, spent while they are being told they
    // may not spend it.
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillPool(center.id, 60);
    await setCap(code.id, 10);

    await expect(
      spend.spend(student.id, 'AI_SPEAKING_CREDIT'),
    ).rejects.toThrow('FROZEN');

    await expect(poolOf(center.id)).resolves.toBe(60);
    await expect(capOf(code.id)).resolves.toMatchObject({ used: 0 });
  });

  it('does not let a frozen centre lose a free session either', async () => {
    // The free five are Start's, and Start is what has lapsed.
    const { center, student } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillPool(center.id, 60);

    await expect(
      spend.spend(student.id, 'AI_SPEAKING_CREDIT'),
    ).rejects.toThrow('FROZEN');
  });
});
