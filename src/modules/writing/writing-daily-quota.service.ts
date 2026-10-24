import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  FREE_WRITING_CORRECTIONS_PER_DAY,
  utcDayStart,
} from '../../shared/services/entitlement-spend.service';

export { FREE_WRITING_CORRECTIONS_PER_DAY };

/**
 * Product quota for training Schreiben AI corrections (not exam attempts).
 */
@Injectable()
export class WritingDailyQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /** How many of Start's free training corrections remain today (UTC). */
  async remainingToday(studentId: string, now = new Date()): Promise<number> {
    const used = await this.prisma.writingAttempt.count({
      where: {
        student_id: studentId,
        exam_attempt_id: null,
        created_at: { gte: utcDayStart(now) },
        status: { in: ['pending', 'completed'] },
      },
    });
    return Math.max(0, FREE_WRITING_CORRECTIONS_PER_DAY - used);
  }

  /**
   * Refuses a new training submission when the student already has two
   * pending or completed training attempts today (UTC) and has no other
   * allowance path. Prefer `WritingService.submit`, which also spends
   * `AI_SCHREIBEN_CREDIT` after the free two.
   *
   * Exam attempts (`exam_attempt_id` set) are ignored — they are Exam Day,
   * not Start's daily Schreiben allowance.
   */
  async assertMaySubmit(studentId: string, now = new Date()): Promise<void> {
    if ((await this.remainingToday(studentId, now)) > 0) return;

    throw new HttpException(
      {
        messageKey: 'writingDailyLimit',
        message:
          'Vous avez utilisé vos 2 corrections Schreiben du jour. Réessayez demain.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
