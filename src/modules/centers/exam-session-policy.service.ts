import { BadRequestException, Injectable } from '@nestjs/common';

/** The access windows the product sells, in hours. Not a free number: a
 *  client that could choose would sell itself a permanent exam. */
export const ACCESS_WINDOW_HOURS = [24, 48, 72] as const;

export type AccessWindowHours = (typeof ACCESS_WINDOW_HOURS)[number];

export type ExamSessionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'OPEN'
  | 'CLOSED'
  | 'CANCELLED';

/** The subset of the row this policy reads. Narrow on purpose: the rule must
 *  not start depending on the name, the Modelltest or anything incidental. */
export interface ExamSessionRecord {
  opens_at: Date;
  closes_at: Date;
  published_at: Date | null;
  cancelled_at: Date | null;
  force_closed_at: Date | null;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * What state a sitting is in, derived on every read.
 *
 * There is no status column, for the reason `CenterSubscription` has none: a
 * stored status has to be kept true by a scheduled job, and when that job
 * runs late the failure direction is letting a closed exam be taken. An
 * exam that opens because the clock passed cannot be late.
 */
@Injectable()
export class ExamSessionPolicyService {
  statusOf(session: ExamSessionRecord, now = new Date()): ExamSessionStatus {
    // Cancelled first, and deliberately before the window: a sitting called
    // off inside its own window must not read as open, and a cancelled draft
    // must not read as editable.
    if (session.cancelled_at) return 'CANCELLED';
    if (!session.published_at) return 'DRAFT';
    if (now < session.opens_at) return 'SCHEDULED';
    if (session.force_closed_at || now >= session.closes_at) return 'CLOSED';
    return 'OPEN';
  }

  /** Whether a candidate may begin. The one question the student side asks. */
  mayStart(session: ExamSessionRecord, now = new Date()): boolean {
    return this.statusOf(session, now) === 'OPEN';
  }

  /**
   * Whether the center may still change the sitting.
   *
   * Publishing is not a freeze: until a candidate can start, changing the
   * Modelltest or the participant list harms nobody. Once it has opened,
   * somebody may be sitting it, and the exam they started must stay the exam
   * they finish.
   */
  mayEdit(session: ExamSessionRecord, now = new Date()): boolean {
    const status = this.statusOf(session, now);
    return status === 'DRAFT' || status === 'SCHEDULED';
  }

  /** When a sitting opening at `opensAt` stops admitting candidates. */
  closesAt(opensAt: Date, windowHours: number): Date {
    if (!ACCESS_WINDOW_HOURS.includes(windowHours as AccessWindowHours)) {
      throw new BadRequestException('ACCESS_WINDOW_INVALID');
    }
    return new Date(opensAt.getTime() + windowHours * HOUR_MS);
  }
}
