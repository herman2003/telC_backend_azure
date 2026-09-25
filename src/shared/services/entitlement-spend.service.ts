import { ForbiddenException, Injectable } from '@nestjs/common';
import type { EntitlementProduct } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { StudentEntitlementService } from './student-entitlement.service';

/**
 * What Start includes, per student per calendar month.
 *
 * Five conversations with Elena, which is what the offer promises. Past that a
 * student spends a credit their center bought.
 */
export const FREE_LIVE_SESSIONS_PER_MONTH = 5;

/**
 * Where the free allowance starts counting.
 *
 * One function, called by everything that needs the answer, so the window is
 * defined in a single place. It returns the start of the UTC month and
 * nothing else.
 *
 * The seam exists for a change nobody needs yet: if a grandfathering rule is
 * ever wanted after launch — a student mid-window on the day the rule changes
 * — it is one line here rather than a hunt through every caller. No such
 * constant is written today. The product has not launched, so there is no
 * student whose history could be punished, and a dormant line carrying a
 * future date never gets deleted.
 *
 * UTC rather than the student's own timezone: a device setting a client can
 * change is not a window, and a month boundary an hour out in Douala costs
 * nobody anything — unlike a daily one, which is why the old rolling window
 * refused calendar days.
 */
export function quotaWindowStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** When the free allowance comes back. */
export function quotaWindowEnd(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export type EntitlementRefusal =
  /** The center's Start subscription has lapsed. Nothing is lost. */
  | 'FROZEN'
  /** No live activation code, so no seat to hold anything. */
  | 'NO_CODE'
  /** The center holds none of this product. */
  | 'POOL_EMPTY'
  /** The center has some and has given this seat none. */
  | 'NO_CAP'
  /** This seat has spent everything it was allowed. */
  | 'CAP_REACHED'
  /** A period product this seat does not hold, or that has run out. */
  | 'NOT_HELD';

export interface EntitlementDecision {
  allowed: boolean;
  /** Null when allowed. A closed set, so a client can say seven true things
   *  rather than one vague one. */
  reason: EntitlementRefusal | null;
  /** Free sessions left this month. Zero for products that have no free
   *  allowance. */
  freeRemaining: number;
  /**
   * What this student can actually spend: the smaller of what is left in the
   * pool and what is left of this seat's cap.
   *
   * One number rather than two, because two would leave every client working
   * out the same minimum and one of them getting it wrong.
   */
  creditsAvailable: number;
  /** When the free allowance returns, or null for products without one. */
  resetsAt: Date | null;
  /** The live period's end, for the products that are a period. */
  expiresAt: Date | null;
}

export interface HeldPeriodView {
  active: boolean;
  expiresAt: Date | null;
}

export interface StudentEntitlementsView {
  prepPass: HeldPeriodView;
  aiAssisted: HeldPeriodView;
  aiSpeaking: {
    freeRemaining: number;
    resetsAt: Date;
    /** What this student can actually use: the smaller of the pool and what
     *  is left of their cap. */
    creditsAvailable: number;
  };
  /** True when the centre's Start subscription has lapsed. Everything above
   *  is what they will have back the moment it is paid. */
  frozen: boolean;
}

/** Products that are a balance drawn against a cap. Everything else is a
 *  period. */
const COUNTED: ReadonlySet<EntitlementProduct> = new Set([
  'AI_SPEAKING_CREDIT',
]);

const FREE_ALLOWANCE: Partial<Record<EntitlementProduct, number>> = {
  AI_SPEAKING_CREDIT: FREE_LIVE_SESSIONS_PER_MONTH,
};

const refused = (
  reason: EntitlementRefusal,
  over: Partial<EntitlementDecision> = {},
): EntitlementDecision => ({
  allowed: false,
  reason,
  freeRemaining: 0,
  creditsAvailable: 0,
  resetsAt: null,
  expiresAt: null,
  ...over,
});

/**
 * The one authority on whether a student may use a paid add-on, and the one
 * place that spends it.
 *
 * Written once and called from every product, because two copies would drift
 * and the one that drifted would be the one spending money. It is the same
 * reasoning that put `AiQuotaService` in one file.
 *
 * Start is the door. A center that has stopped paying freezes: nothing can be
 * spent, and nothing is taken away. That rule is not re-implemented here — it
 * is `StudentEntitlementService`, which the rest of the system already reads,
 * because two implementations of one rule is how they drift apart.
 */
@Injectable()
export class EntitlementSpendService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudentEntitlementService,
  ) {}

  /**
   * Whether this student may use the product, and everything a client needs
   * to say why not.
   *
   * Free allowance first, always: a student never spends money they did not
   * have to. A refusal here costs nothing.
   */
  async mayUse(
    studentId: string,
    product: EntitlementProduct,
    now = new Date(),
  ): Promise<EntitlementDecision> {
    const { studentsMayLearn, studentExists } =
      await this.access.forStudent(studentId);

    // Frozen before anything else is read. A lapsed center has not run out of
    // credits — they are sitting there, waiting to be paid for — and telling
    // the student they are out would be both wrong and unactionable.
    if (!studentExists || !studentsMayLearn) {
      return refused('FROZEN');
    }

    const seat = await this.seatOf(studentId);
    if (!seat) return refused('NO_CODE');

    if (!COUNTED.has(product)) {
      const held = await this.prisma.codeEntitlement.findUnique({
        where: { code_id_product: { code_id: seat.id, product } },
        select: { expires_at: true },
      });

      return held && held.expires_at > now
        ? {
            allowed: true,
            reason: null,
            freeRemaining: 0,
            creditsAvailable: 0,
            resetsAt: null,
            expiresAt: held.expires_at,
          }
        : refused('NOT_HELD');
    }

    const freeRemaining = await this.freeRemaining(studentId, product, now);
    const resetsAt = quotaWindowEnd(now);

    if (freeRemaining > 0) {
      return {
        allowed: true,
        reason: null,
        freeRemaining,
        creditsAvailable: await this.creditsAvailable(seat, product),
        resetsAt,
        expiresAt: null,
      };
    }

    const credits = await this.creditsAvailable(seat, product);
    if (credits > 0) {
      return {
        allowed: true,
        reason: null,
        freeRemaining: 0,
        creditsAvailable: credits,
        resetsAt,
        expiresAt: null,
      };
    }

    // Out of free sessions and unable to draw on the pool. Which of the three
    // reasons it is decides what the app offers next, so they are kept apart.
    const cap = await this.prisma.codeEntitlementCap.findUnique({
      where: { code_id_product: { code_id: seat.id, product } },
      select: { cap: true, used: true },
    });
    const pool = await this.poolBalance(seat.center_id, product);

    if (!cap || cap.cap === 0) {
      return refused(pool > 0 ? 'NO_CAP' : 'POOL_EMPTY', { resetsAt });
    }
    if (cap.used >= cap.cap) return refused('CAP_REACHED', { resetsAt });
    return refused('POOL_EMPTY', { resetsAt });
  }

  /**
   * Takes what the student is about to use.
   *
   * Called AFTER the thing succeeded, never before — the same rule the AI
   * quota follows, and for the same reason: a failure on our side must not
   * cost a student something their center paid for.
   *
   * A free session spends nothing here. It is recorded by whoever ran it, as
   * an `ai_usage` row, which is what the allowance is counted from.
   *
   * The pool and the cap move together or not at all: both are conditional
   * updates inside one transaction, so two students spending the last credit
   * at the same instant cannot both win, and a cap lowered between the check
   * and the spend refuses rather than overdraws.
   */
  async spend(
    studentId: string,
    product: EntitlementProduct,
    now = new Date(),
  ): Promise<void> {
    if (!COUNTED.has(product)) return;

    // Checked here as well as in `mayUse`, and not only for tidiness. A centre
    // can lapse between the two calls, and a caller written later may not ask
    // the first question at all. Either way the harm is identical: money the
    // centre paid for, spent while they are being told they may not spend it.
    const { studentsMayLearn, studentExists } =
      await this.access.forStudent(studentId);
    if (!studentExists || !studentsMayLearn) {
      throw new ForbiddenException('FROZEN');
    }

    const seat = await this.seatOf(studentId);
    if (!seat) throw new ForbiddenException('NO_CODE');

    // Free first. Nothing is taken from the center while the student still
    // has their own allowance.
    if ((await this.freeRemaining(studentId, product, now)) > 0) return;

    await this.prisma.$transaction(async (tx) => {
      const pool = await tx.centerEntitlementPool.updateMany({
        where: {
          center_id: seat.center_id,
          product,
          balance: { gte: 1 },
        },
        data: { balance: { decrement: 1 } },
      });
      if (pool.count !== 1) {
        throw new ForbiddenException('NO_CREDITS_REMAINING');
      }

      // Raw, because `used < cap` compares two columns and Prisma's `where`
      // cannot. Reading the cap and then writing would let two sessions
      // started together both pass a check that was true for neither by the
      // time they wrote.
      const capped = await tx.$executeRaw`
        UPDATE code_entitlement_caps
           SET used = used + 1, updated_at = now()
         WHERE code_id = ${seat.id}
           AND product = ${product}::"EntitlementProduct"
           AND used < cap
      `;
      if (capped !== 1) {
        // Rolls the pool decrement back with it. A seat that may not spend
        // must not cost the center a credit.
        throw new ForbiddenException('NO_CREDITS_REMAINING');
      }
    });
  }

  /**
   * Everything the app needs to decide what to show, in one call.
   *
   * Three products and one flag rather than three round trips, because a
   * client assembling this itself would be a fourth place that has to know
   * which product is a period and which is a balance.
   *
   * A frozen centre still gets real numbers back, not zeroes: the student
   * should be able to see what is waiting for them.
   */
  async forStudent(
    studentId: string,
    now = new Date(),
  ): Promise<StudentEntitlementsView> {
    const [prepPass, aiAssisted, aiSpeaking] = await Promise.all([
      this.mayUse(studentId, 'PREP_PASS', now),
      this.mayUse(studentId, 'AI_ASSISTED_LEARNING', now),
      this.mayUse(studentId, 'AI_SPEAKING_CREDIT', now),
    ]);

    const frozen = prepPass.reason === 'FROZEN';

    return {
      prepPass: {
        active: prepPass.allowed,
        expiresAt: prepPass.expiresAt,
      },
      aiAssisted: {
        active: aiAssisted.allowed,
        expiresAt: aiAssisted.expiresAt,
      },
      aiSpeaking: {
        freeRemaining: aiSpeaking.freeRemaining,
        resetsAt: aiSpeaking.resetsAt ?? quotaWindowEnd(now),
        creditsAvailable: aiSpeaking.creditsAvailable,
      },
      frozen,
    };
  }

  /** How many of the month's free sessions are left. */
  private async freeRemaining(
    studentId: string,
    product: EntitlementProduct,
    now: Date,
  ): Promise<number> {
    const allowance = FREE_ALLOWANCE[product];
    if (!allowance) return 0;

    const used = await this.prisma.aiUsage.count({
      where: {
        student_id: studentId,
        operation: 'SPEAKING_LIVE_SESSION',
        created_at: { gte: quotaWindowStart(now) },
      },
    });

    return Math.max(0, allowance - used);
  }

  private async creditsAvailable(
    seat: { id: string; center_id: string },
    product: EntitlementProduct,
  ): Promise<number> {
    const [cap, balance] = await Promise.all([
      this.prisma.codeEntitlementCap.findUnique({
        where: { code_id_product: { code_id: seat.id, product } },
        select: { cap: true, used: true },
      }),
      this.poolBalance(seat.center_id, product),
    ]);
    if (!cap) return 0;

    return Math.max(0, Math.min(balance, cap.cap - cap.used));
  }

  private async poolBalance(
    centerId: string,
    product: EntitlementProduct,
  ): Promise<number> {
    const pool = await this.prisma.centerEntitlementPool.findUnique({
      where: { center_id_product: { center_id: centerId, product } },
      select: { balance: true },
    });
    return pool?.balance ?? 0;
  }

  /**
   * The seat this student holds.
   *
   * One connected code per student, enforced by a partial unique index, so
   * there is never a choice to make about which one.
   */
  private async seatOf(
    studentId: string,
  ): Promise<{ id: string; center_id: string } | null> {
    return this.prisma.activationCode.findFirst({
      where: { student_id: studentId, status: 'CONNECTED' },
      select: { id: true, center_id: true },
    });
  }
}
