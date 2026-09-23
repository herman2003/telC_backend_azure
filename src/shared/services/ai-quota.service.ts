import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AiOperation } from '@prisma/client';
import { AiUsageService } from './ai-usage.service';
import { StudentEntitlementService } from './student-entitlement.service';

/**
 * AI operations per student per rolling window.
 *
 * One number since the tiers went (Start is the only plan): a constant rather
 * than a table, so git carries the history of when it changed and why, a
 * change gets a review instead of an UPDATE someone runs at night, and the
 * rows in `ai_usage` show within weeks whether it is too stingy.
 *
 * The new pricing replaces this with 5 sessions a month plus bought credits;
 * that is its own phase, and this stays the daily rule until then.
 */
export const AI_ALLOWANCE_PER_WINDOW = 2;

/**
 * A rolling window, not a calendar day.
 *
 * A calendar day needs a timezone, and the product is not only for Cameroon:
 * UTC midnight is 1am in Douala and 9am in Tokyo, which splits a student's day
 * in an arbitrary place. The student's own timezone would have to come from
 * their device, and a student who changes that setting gets a fresh day — a
 * quota a client can reset is not a quota.
 */
export const AI_QUOTA_WINDOW_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export interface AiQuotaDecision {
  allowed: boolean;
  usedToday: number;
  allowedToday: number;
  /** Never negative, even for a student somehow over their allowance. */
  remaining: number;
  /**
   * When enough counted operations have left the window to permit the next
   * one, or null if no such row can be found. A rolling window has no midnight
   * to quote.
   */
  resetsAt: Date | null;
}

/**
 * The one authority on whether a student may run another AI operation.
 *
 * Written once and called from every AI path, because two copies would drift
 * and the one that drifted would be the one spending money. It makes no HTTP
 * decision of its own beyond `assertWithinQuota`, which exists so every caller
 * refuses in the same shape.
 *
 * It answers only the quota question. Whether the student's center is entitled
 * to anything at all is `StudentSubscriptionGuard`'s refusal, and it has to
 * reach the student as SUBSCRIPTION_INACTIVE — a student whose school stopped
 * paying must not be told they have run out of sessions.
 */
@Injectable()
export class AiQuotaService {
  constructor(
    private readonly entitlement: StudentEntitlementService,
    private readonly usage: AiUsageService,
  ) {}

  async check(
    studentId: string,
    operation: AiOperation,
  ): Promise<AiQuotaDecision> {
    const { studentExists } = await this.entitlement.forStudent(studentId);

    // A caller with no `students` row cannot be metered: `ai_usage.student_id`
    // is a foreign key to that table, so every insert for them fails, and
    // `recordDelivered` swallows that failure by design because its job is to
    // protect a result the student already has. The two together left the
    // count permanently at zero — an unmetered caller with an unbounded
    // supply of paid AI. A guest token is exactly this shape.
    //
    // A meter that cannot count refuses. Nothing is asked of `ai_usage`,
    // because there is nothing there to ask about.
    if (!studentExists) {
      return {
        allowed: false,
        usedToday: 0,
        allowedToday: 0,
        remaining: 0,
        resetsAt: null,
      };
    }

    const allowedToday = AI_ALLOWANCE_PER_WINDOW;

    // One cutoff for both reads. A second `new Date()` would drift by however
    // long the first query took, so the reset time could name a row that was
    // never counted and a moment already past.
    const since = new Date(Date.now() - AI_QUOTA_WINDOW_HOURS * HOUR_MS);

    const usedToday = await this.usage.countSince(studentId, operation, since);
    const allowed = usedToday < allowedToday;

    // If usage is above the allowance, more than the oldest row may need to
    // expire. Select the row whose expiry leaves one slot for the next call.
    const rowsBeforeUnlock = Math.max(0, usedToday - allowedToday);
    const unlockRow = allowed
      ? null
      : await this.usage.oldestSince(
          studentId,
          operation,
          since,
          rowsBeforeUnlock,
        );

    return {
      allowed,
      usedToday,
      allowedToday,
      remaining: Math.max(0, allowedToday - usedToday),
      resetsAt: unlockRow
        ? new Date(unlockRow.getTime() + AI_QUOTA_WINDOW_HOURS * HOUR_MS)
        : null,
    };
  }

  /**
   * Refuses a student who has spent their allowance, with everything the app
   * needs to say something useful.
   *
   * The refusal is a sales moment rather than an error: "you have used 2 of 2
   * today — back at 14:32" is only possible if the numbers travel with it. A bare 403 leaves a client with nothing to
   * show but a failure.
   */
  async assertWithinQuota(
    studentId: string,
    operation: AiOperation,
  ): Promise<void> {
    const decision = await this.check(studentId, operation);

    if (decision.allowed) {
      return;
    }

    // An allowance of zero is not an exhausted allowance. Telling a guest
    // they have used 0 of 0 today would invite them to wait for a reset that
    // will never come; what they actually need is an account.
    if (decision.allowedToday === 0) {
      throw new ForbiddenException({ message: 'AI_REQUIRES_ACCOUNT' });
    }

    throw new ForbiddenException({
      message: 'AI_QUOTA_EXCEEDED',
      usedToday: decision.usedToday,
      allowedToday: decision.allowedToday,
      resetsAt: decision.resetsAt,
    });
  }
}
