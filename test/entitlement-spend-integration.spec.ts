/**
 * The interface every paid add-on goes through, against real Postgres.
 *
 * ADR 0003: assign moves stock onto the seat; spend burns assigned remaining;
 * the unallocated pool is untouched at spend time. Concurrency is on the seat
 * balance, not on a shared draw from the pool.
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

async function fillUnallocated(centerId: string, balance: number) {
  await prisma.centerEntitlementPool.create({
    data: { center_id: centerId, product: 'AI_SPEAKING_CREDIT', balance },
  });
}

/** Assigned remaining on the seat (`cap`); `used` is lifetime spent. */
async function assignSeat(codeId: string, assigned: number, used = 0) {
  await prisma.codeEntitlementCap.create({
    data: {
      code_id: codeId,
      product: 'AI_SPEAKING_CREDIT',
      cap: assigned,
      used,
    },
  });
}

/** Free sessions already run this month (count toward Start's monthly budget). */
async function usedSessions(studentId: string, count: number) {
  for (let i = 0; i < count; i++) {
    await prisma.aiUsage.create({
      data: {
        student_id: studentId,
        operation: 'SPEAKING_LIVE_SESSION',
        counts_toward_free: true,
      },
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
    const { student } = await makeSeat();

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({
      allowed: true,
      reason: null,
      freeRemaining: FREE_LIVE_SESSIONS_PER_MONTH,
    });
  });

  it('spends nothing from the seat while free sessions remain', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 30);
    await assignSeat(code.id, 10);

    await spend.spend(student.id, 'AI_SPEAKING_CREDIT');

    await expect(poolOf(center.id)).resolves.toBe(30);
    await expect(capOf(code.id)).resolves.toMatchObject({
      cap: 10,
      used: 0,
    });
  });

  it('counts down as sessions are run', async () => {
    const { student } = await makeSeat();
    await usedSessions(student.id, 3);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.freeRemaining).toBe(FREE_LIVE_SESSIONS_PER_MONTH - 3);
  });

  it('ignores sessions run in an earlier month', async () => {
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
  it('burns assigned remaining and leaves unallocated alone', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 30);
    await assignSeat(code.id, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');
    await spend.spend(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: true, freeRemaining: 0 });
    await expect(poolOf(center.id)).resolves.toBe(30);
    await expect(capOf(code.id)).resolves.toMatchObject({
      cap: 9,
      used: 1,
    });
  });

  it('reports assigned remaining, not unallocated stock', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 3);
    await assignSeat(code.id, 8);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.creditsAvailable).toBe(8);
  });

  it('says NO_CAP when the centre has unallocated credits and this seat has none', async () => {
    const { center, student } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 40);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'NO_CAP' });
  });

  it('says CAP_REACHED when this seat has spent its assignment', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 40);
    await assignSeat(code.id, 0, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'CAP_REACHED' });
  });

  it('says POOL_EMPTY when nothing is assigned and the school has no stock', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 0);
    await assignSeat(code.id, 0);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'POOL_EMPTY' });
  });
});

describe('the freeze', () => {
  it('refuses everything when the centre stopped paying', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillUnallocated(center.id, 50);
    await assignSeat(code.id, 10);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision).toMatchObject({ allowed: false, reason: 'FROZEN' });
  });

  it('takes nothing away', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillUnallocated(center.id, 50);
    await assignSeat(code.id, 6, 4);

    await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    await expect(poolOf(center.id)).resolves.toBe(50);
    await expect(capOf(code.id)).resolves.toMatchObject({ cap: 6, used: 4 });
  });

  it('is not the same answer as being out of credits', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillUnallocated(center.id, 0);
    await assignSeat(code.id, 0);

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.reason).toBe('FROZEN');
  });
});

describe('spending under load', () => {
  it('lets exactly one of two simultaneous spends take the last assigned credit', async () => {
    const first = await makeSeat();
    await usedSessions(first.student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(first.center.id, 0);
    await assignSeat(first.code.id, 1);

    const outcomes = await Promise.allSettled([
      spend.spend(first.student.id, 'AI_SPEAKING_CREDIT'),
      spend.spend(first.student.id, 'AI_SPEAKING_CREDIT'),
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
    await expect(capOf(first.code.id)).resolves.toMatchObject({
      cap: 0,
      used: 1,
    });
    await expect(poolOf(first.center.id)).resolves.toBe(0);
  });

  it('does not touch unallocated stock when the seat has nothing left', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 40);
    await assignSeat(code.id, 0, 10);

    await expect(spend.spend(student.id, 'AI_SPEAKING_CREDIT')).rejects.toThrow(
      'NO_CREDITS_REMAINING',
    );

    await expect(poolOf(center.id)).resolves.toBe(40);
  });
});

describe('what the student reads', () => {
  it('answers all three products and the freeze in one call', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 30);
    await assignSeat(code.id, 10);
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
      aiSpeaking: {
        freeRemaining: FREE_LIVE_SESSIONS_PER_MONTH - 2,
        creditsAvailable: 10,
      },
      frozen: false,
    });
  });

  it('shows what is waiting rather than zeroes when the centre has lapsed', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillUnallocated(center.id, 50);
    await assignSeat(code.id, 10);

    const mine = await spend.forStudent(student.id);

    expect(mine.frozen).toBe(true);
    expect(mine.prepPass.active).toBe(false);
  });

  it('reports only what is assigned to the seat', async () => {
    const { center, student, code } = await makeSeat();
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 40);
    await assignSeat(code.id, 4, 6);

    const mine = await spend.forStudent(student.id);

    expect(mine.aiSpeaking).toMatchObject({
      freeRemaining: 0,
      creditsAvailable: 4,
    });
  });
});

describe('spending is guarded on its own, not only by mayUse', () => {
  it('refuses to spend credits a frozen centre still holds', async () => {
    const { center, student, code } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await usedSessions(student.id, FREE_LIVE_SESSIONS_PER_MONTH);
    await fillUnallocated(center.id, 50);
    await assignSeat(code.id, 10);

    await expect(spend.spend(student.id, 'AI_SPEAKING_CREDIT')).rejects.toThrow(
      'FROZEN',
    );

    await expect(poolOf(center.id)).resolves.toBe(50);
    await expect(capOf(code.id)).resolves.toMatchObject({ used: 0 });
  });

  it('does not let a frozen centre lose a free session either', async () => {
    const { center, student } = await makeSeat(
      new Date(Date.now() - 60 * DAY_MS),
    );
    await fillUnallocated(center.id, 60);

    await expect(spend.spend(student.id, 'AI_SPEAKING_CREDIT')).rejects.toThrow(
      'FROZEN',
    );
  });
});

describe('a caller with no account', () => {
  it('is told there is no account, not that a centre has lapsed', async () => {
    const decision = await spend.mayUse(
      '00000000-0000-4000-8000-000000000000',
      'AI_SPEAKING_CREDIT',
    );

    expect(decision).toMatchObject({ allowed: false, reason: 'NO_ACCOUNT' });
  });
});

describe('one free session per Teil per UTC day', () => {
  it('lets three different Teile through for free the same day', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 10);
    await assignSeat(code.id, 5);

    for (const teil of [1, 2, 3]) {
      const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT', new Date(), {
        teilNumber: teil,
      });
      expect(decision).toMatchObject({ allowed: true });
      await expect(
        spend.spend(student.id, 'AI_SPEAKING_CREDIT', new Date(), {
          teilNumber: teil,
        }),
      ).resolves.toBe('FREE');
      await prisma.aiUsage.create({
        data: {
          student_id: student.id,
          operation: 'SPEAKING_LIVE_SESSION',
          teil_number: teil,
          counts_toward_free: true,
        },
      });
    }

    await expect(capOf(code.id)).resolves.toMatchObject({ cap: 5, used: 0 });
  });

  it('spends a credit on a second free attempt of the same Teil the same day', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 10);
    await assignSeat(code.id, 5);

    await prisma.aiUsage.create({
      data: {
        student_id: student.id,
        operation: 'SPEAKING_LIVE_SESSION',
        teil_number: 2,
        counts_toward_free: true,
      },
    });

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT', new Date(), {
      teilNumber: 2,
    });
    expect(decision).toMatchObject({
      allowed: true,
      freeRemaining: FREE_LIVE_SESSIONS_PER_MONTH - 1,
      creditsAvailable: 5,
    });

    await expect(
      spend.spend(student.id, 'AI_SPEAKING_CREDIT', new Date(), {
        teilNumber: 2,
      }),
    ).resolves.toBe('CREDIT');
    await expect(capOf(code.id)).resolves.toMatchObject({ cap: 4, used: 1 });
  });

  it('does not let a credit session eat the free monthly budget', async () => {
    const { student } = await makeSeat();

    await prisma.aiUsage.create({
      data: {
        student_id: student.id,
        operation: 'SPEAKING_LIVE_SESSION',
        teil_number: 1,
        counts_toward_free: false,
      },
    });

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');
    expect(decision.freeRemaining).toBe(FREE_LIVE_SESSIONS_PER_MONTH);
  });

  it('skips free allowance when allowFree is false (Mit Elena)', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 10);
    await assignSeat(code.id, 3);

    await expect(
      spend.spend(student.id, 'AI_SPEAKING_CREDIT', new Date(), {
        teilNumber: 2,
        allowFree: false,
      }),
    ).resolves.toBe('CREDIT');
    await expect(capOf(code.id)).resolves.toMatchObject({ cap: 2, used: 1 });
  });
});

describe('an exam is paid for separately, and spends nothing of the student', () => {
  it('leaves the free monthly sessions untouched', async () => {
    const { student } = await makeSeat();

    for (let teil = 1; teil <= 3; teil++) {
      await prisma.aiUsage.create({
        data: { student_id: student.id, operation: 'SPEAKING_EVALUATION' },
      });
    }

    const decision = await spend.mayUse(student.id, 'AI_SPEAKING_CREDIT');

    expect(decision.freeRemaining).toBe(FREE_LIVE_SESSIONS_PER_MONTH);
  });

  it('leaves the unallocated pool and the seat assignment untouched', async () => {
    const { center, student, code } = await makeSeat();
    await fillUnallocated(center.id, 40);
    await assignSeat(code.id, 10);

    await prisma.aiUsage.create({
      data: { student_id: student.id, operation: 'SPEAKING_EVALUATION' },
    });

    await expect(poolOf(center.id)).resolves.toBe(40);
    await expect(capOf(code.id)).resolves.toMatchObject({ used: 0 });
  });
});
