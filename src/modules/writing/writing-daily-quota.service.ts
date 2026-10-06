import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { utcDayStart } from '../../shared/services/entitlement-spend.service';

/** Start includes two AI Schreiben corrections per student per UTC day. */
export const FREE_WRITING_CORRECTIONS_PER_DAY = 2;

/**
 * Product quota for training Schreiben AI corrections (not exam attempts).
 */
@Injectable()
export class WritingDailyQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Refuses a new training submission when the student already has two
   * pending or completed training attempts today (UTC).
   *
   * Exam attempts (`exam_attempt_id` set) are ignored — they are Exam Day,
   * not Start's daily Schreiben allowance.
   */
  async assertMaySubmit(studentId: string, now = new Date()): Promise<void> {
    const used = await this.prisma.writingAttempt.count({
      where: {
        student_id: studentId,
        exam_attempt_id: null,
        created_at: { gte: utcDayStart(now) },
        status: { in: ['pending', 'completed'] },
      },
    });

    if (used >= FREE_WRITING_CORRECTIONS_PER_DAY) {
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
}
